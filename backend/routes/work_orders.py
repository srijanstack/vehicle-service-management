
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Vehicle, WorkOrder

router = APIRouter(prefix="/work-orders", tags=["Work Orders"])


from backend.schemas import WorkOrderCreate, WorkOrderUpdate


from backend.routes.service import normalize_component_name


@router.post("/", status_code=201)
def create_work_order(
    order_data: WorkOrderCreate,
    db: Session = Depends(get_db)
):
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == order_data.vehicle_id)
        .first()
    )

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    data = order_data.model_dump()
    data["component_name"] = normalize_component_name(data["component_name"])
    new_order = WorkOrder(**data)
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    return {
        "message": "Work order created successfully",
        "id": new_order.id,
        "vehicle_id": new_order.vehicle_id,
        "component_name": new_order.component_name,
        "priority": new_order.priority,
        "status": new_order.status
    }


@router.get("/")
def get_work_orders(
    vehicle_id: int | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(WorkOrder)

    if vehicle_id is not None:
        query = query.filter(WorkOrder.vehicle_id == vehicle_id)

    return query.order_by(WorkOrder.id.desc()).all()


@router.put("/{work_order_id}")
@router.patch("/{work_order_id}")
def update_work_order(
    work_order_id: int,
    update_data: WorkOrderUpdate,
    db: Session = Depends(get_db)
):
    work_order = (
        db.query(WorkOrder)
        .filter(WorkOrder.id == work_order_id)
        .first()
    )

    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found.")

    update_values = update_data.model_dump(exclude_unset=True)

    for field, value in update_values.items():
        setattr(work_order, field, value)

    # If completed and completion_date not provided, auto-set to today
    if work_order.status == "Completed" and not work_order.completion_date:
        work_order.completion_date = date.today()

    # If all work orders for this vehicle are resolved, restore vehicle status if it was Under Maintenance
    vehicle = db.query(Vehicle).filter(Vehicle.id == work_order.vehicle_id).first()
    if vehicle and vehicle.status == "Under Maintenance":
        active_orders = (
            db.query(WorkOrder)
            .filter(
                WorkOrder.vehicle_id == vehicle.id,
                WorkOrder.id != work_order.id,
                WorkOrder.status.in_(["Pending", "In Progress"])
            )
            .first()
        )
        if not active_orders and work_order.status in ["Completed", "Cancelled"]:
            vehicle.status = "Active"

    db.commit()
    db.refresh(work_order)

    return {
        "message": "Work order updated successfully",
        "id": work_order.id,
        "vehicle_id": work_order.vehicle_id,
        "component_name": work_order.component_name,
        "issue_description": work_order.issue_description,
        "priority": work_order.priority,
        "status": work_order.status,
        "due_date": work_order.due_date,
        "assigned_to": work_order.assigned_to,
        "completion_date": work_order.completion_date,
        "action_taken": work_order.action_taken,
        "remarks": work_order.remarks,
    }


@router.post("/from-maintenance/{vehicle_id}")
def create_work_orders_from_maintenance(
    vehicle_id: int,
    db: Session = Depends(get_db)
):
    # Import here to avoid circular imports during module loading.
    from backend.routes.maintenance import check_vehicle_maintenance

    maintenance_result = check_vehicle_maintenance(
        vehicle_id=vehicle_id,
        today=None,
        db=db
    )

    created_orders = []

    for item in maintenance_result["maintenance_checks"]:
        if not item["maintenance_due"]:
            continue

        existing_order = (
            db.query(WorkOrder)
            .filter(
                WorkOrder.vehicle_id == vehicle_id,
                WorkOrder.component_name == item["component_name"],
                WorkOrder.status.in_(["Pending", "In Progress"])
            )
            .first()
        )

        if existing_order:
            continue

        new_order = WorkOrder(
            vehicle_id=vehicle_id,
            component_name=item["component_name"],
            issue_description=(
                f"Scheduled maintenance due: {item['service_task']}. "
                f"Reasons: {', '.join(item['reasons'])}"
            ),
            priority="High",
            status="Pending"
        )

        db.add(new_order)
        db.flush()

        created_orders.append({
            "work_order_id": new_order.id,
            "component_name": new_order.component_name,
            "status": new_order.status
        })

    db.commit()

    return {
        "message": "Maintenance work orders processed",
        "vehicle_id": vehicle_id,
        "created_count": len(created_orders),
        "created_work_orders": created_orders
    }


@router.delete("/{work_order_id}", status_code=200)
def delete_work_order(
    work_order_id: int,
    db: Session = Depends(get_db)
):
    work_order = (
        db.query(WorkOrder)
        .filter(WorkOrder.id == work_order_id)
        .first()
    )

    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found.")

    vehicle_id = work_order.vehicle_id
    db.delete(work_order)
    db.commit()

    # If vehicle was Under Maintenance, restore to Active if no pending orders remain
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if vehicle and vehicle.status == "Under Maintenance":
        active_orders = (
            db.query(WorkOrder)
            .filter(
                WorkOrder.vehicle_id == vehicle.id,
                WorkOrder.status.in_(["Pending", "In Progress"])
            )
            .first()
        )
        if not active_orders:
            vehicle.status = "Active"
            db.commit()

    return {
        "message": f"Work order #{work_order_id} deleted successfully",
        "id": work_order_id
    }

