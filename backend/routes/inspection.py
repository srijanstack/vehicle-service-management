
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Vehicle, Inspection, WorkOrder
from backend.routes.service import normalize_component_name

router = APIRouter(prefix="/inspections", tags=["Inspections"])


from backend.schemas import InspectionCreate


@router.post("/", status_code=201)
def create_inspection(
    inspection_data: InspectionCreate,
    db: Session = Depends(get_db)
):
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == inspection_data.vehicle_id)
        .first()
    )

    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found."
        )

    data = inspection_data.model_dump()
    data["component_name"] = normalize_component_name(data["component_name"])
    new_inspection = Inspection(**data)

    db.add(new_inspection)

    # If inspection reveals a defect or requires service, automatically create a Work Order
    needs_work_order = (
        new_inspection.inspection_decision in ["Service Required", "Fail"]
        or new_inspection.condition in ["Poor", "Critical"]
    )

    created_wo = None
    if needs_work_order:
        is_critical = (
            new_inspection.condition == "Critical"
            or new_inspection.inspection_decision == "Fail"
        )
        priority = "Critical" if is_critical else "High"
        defect = (new_inspection.defect_description or "").strip() or "Defect detected during inspection"
        rec = f" Action: {new_inspection.recommended_action.strip()}" if new_inspection.recommended_action else ""
        desc = f"Inspection finding [{new_inspection.condition} / {new_inspection.inspection_decision}]: {defect}.{rec}"

        # Check if an open work order already exists for this vehicle & component
        existing_wo = (
            db.query(WorkOrder)
            .filter(
                WorkOrder.vehicle_id == vehicle.id,
                WorkOrder.component_name == new_inspection.component_name,
                WorkOrder.status.in_(["Pending", "In Progress"])
            )
            .first()
        )

        if not existing_wo:
            created_wo = WorkOrder(
                vehicle_id=vehicle.id,
                component_name=new_inspection.component_name,
                issue_description=desc,
                priority=priority,
                status="Pending",
                assigned_to=new_inspection.inspected_by,
                remarks=f"Auto-generated from inspection on {new_inspection.inspection_date}"
            )
            db.add(created_wo)
        else:
            if is_critical:
                existing_wo.priority = "Critical"
            existing_wo.issue_description = desc
            created_wo = existing_wo

        if is_critical and vehicle.status != "Under Maintenance":
            vehicle.status = "Under Maintenance"

    db.commit()
    db.refresh(new_inspection)
    if created_wo:
        db.refresh(created_wo)

    msg = "Inspection record created successfully"
    if created_wo:
        msg += f". Work order #{created_wo.id} automatically created for {new_inspection.component_name}."

    return {
        "message": msg,
        "id": new_inspection.id,
        "vehicle_id": new_inspection.vehicle_id,
        "component_name": new_inspection.component_name,
        "condition": new_inspection.condition,
        "inspection_decision": new_inspection.inspection_decision,
        "work_order_created": bool(created_wo),
        "work_order_id": created_wo.id if created_wo else None
    }


@router.get("/")
def get_inspections(
    vehicle_id: int | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Inspection)

    if vehicle_id is not None:
        query = query.filter(Inspection.vehicle_id == vehicle_id)

    return query.order_by(Inspection.id.desc()).all()
