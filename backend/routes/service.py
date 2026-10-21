
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Vehicle, ServiceRecord

router = APIRouter(
    prefix="/service-records",
    tags=["Service Records"]
)


from backend.schemas import ServiceRecordCreate


COMPONENT_NAME_MAP = {
    "engine oil": "Engine Oil",
    "front brake pads": "Front Brake Pads",
    "rear brake shoes": "Rear Brake Shoes",
    "brake fluid": "Brake Fluid",
    "brake system inspection": "Brake System Inspection",
    "tyre pressure check": "Tyre Pressure Check",
    "front-left tyre": "Front-Left Tyre",
    "front-right tyre": "Front-Right Tyre",
    "rear-left tyre": "Rear-Left Tyre",
    "rear-right tyre": "Rear-Right Tyre",
    "spare tyre": "Spare Tyre",
    "wheel alignment & balancing": "Wheel Alignment & Balancing",
    "tyre replacement inspection": "Tyre Replacement Inspection",
    "battery visual & terminal check": "Battery Visual & Terminal Check",
    "battery voltage & health test": "Battery Voltage & Health Test",
    "alternator & load testing": "Alternator & Load Testing",
    "battery replacement inspection": "Battery Replacement Inspection",
    "bumper, cladding & retaining clips": "Bumper, Cladding & Retaining Clips",
    "front & rear wiper blades": "Front & Rear Wiper Blades",
    "headlight lens oxidation": "Headlight Lens Oxidation",
    "underbody anti-rust coating": "Underbody Anti-Rust Coating",
    "headlight & fog light bulbs": "Headlight & Fog Light Bulbs",
    "hood & tailgate gas struts": "Hood & Tailgate Gas Struts",
    "exterior paint wax & sealant": "Exterior Paint Wax & Sealant",
    "windshield washer fluid": "Windshield Washer Fluid",
    "door weatherstrips": "Door Weatherstrips",
    "ceramic coating": "Ceramic Coating",
    # Aliases
    "oil filter": "Engine Oil Filter",
    "engine oil filter": "Engine Oil Filter",
    "air filter": "Air Filter",
    "fuel filter": "Fuel Filter",
    "coolant": "Coolant",
    "engine coolant": "Coolant",
    "brakes": "Front Brake Pads",
    "brake pads": "Front Brake Pads",
    "brake pads & discs": "Front Brake Pads",
    "brake shoes": "Rear Brake Shoes",
    "transfer case": "Transfer Case Oil",
    "transfer case oil": "Transfer Case Oil",
    "transmission": "Transfer Case Oil",
    "transmission fluid": "Transmission Fluid",
    "battery": "Battery Visual & Terminal Check",
    "tyres": "Tyre Pressure Check",
    "tires": "Tyre Pressure Check",
    "clutch": "Clutch",
    "suspension": "Suspension",
}


def normalize_component_name(name: str) -> str:
    if not name:
        return name
    return COMPONENT_NAME_MAP.get(name.strip().lower(), name.strip())


@router.post("/", status_code=201)
def create_service_record(
    record_data: ServiceRecordCreate,
    db: Session = Depends(get_db)
):
    vehicle = db.query(Vehicle).filter(
        Vehicle.id == record_data.vehicle_id
    ).first()

    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found."
        )

    # Create the service record, including historical records.
    data = record_data.model_dump()
    data["component_name"] = normalize_component_name(data["component_name"])
    new_record = ServiceRecord(**data)
    db.add(new_record)

    # Update the odometer only if the new reading is higher.
    if record_data.odometer_km > vehicle.current_odometer_km:
        vehicle.current_odometer_km = record_data.odometer_km

    # Update the last service date only if this record is newer.
    if (
        vehicle.last_service_date is None
        or record_data.service_date > vehicle.last_service_date
    ):
        vehicle.last_service_date = record_data.service_date

    # Automatically recompute next_service_due_date from maintenance rules
    from dateutil.relativedelta import relativedelta
    from backend.models import MaintenanceRule
    rules = (
        db.query(MaintenanceRule)
        .filter(
            MaintenanceRule.vehicle_model == vehicle.model,
            MaintenanceRule.is_active == 1,
            MaintenanceRule.interval_months > 0
        )
        .order_by(MaintenanceRule.interval_months.asc())
        .all()
    )
    if not rules and vehicle.model:
        base_model = vehicle.model.split()[0]
        rules = (
            db.query(MaintenanceRule)
            .filter(
                MaintenanceRule.vehicle_model == base_model,
                MaintenanceRule.is_active == 1,
                MaintenanceRule.interval_months > 0
            )
            .order_by(MaintenanceRule.interval_months.asc())
            .all()
        )
    min_months = rules[0].interval_months if rules else 12
    if vehicle.last_service_date:
        vehicle.next_service_due_date = vehicle.last_service_date + relativedelta(months=min_months)

    try:
        db.commit()
        db.refresh(new_record)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Service record created successfully",
        "id": new_record.id,
        "vehicle_id": new_record.vehicle_id,
        "component_name": new_record.component_name,
        "service_date": new_record.service_date,
        "odometer_km": new_record.odometer_km
    }


@router.get("/")
def get_service_records(
    vehicle_id: int | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(ServiceRecord)

    if vehicle_id is not None:
        query = query.filter(
            ServiceRecord.vehicle_id == vehicle_id
        )

    return query.order_by(ServiceRecord.id.desc()).all()
