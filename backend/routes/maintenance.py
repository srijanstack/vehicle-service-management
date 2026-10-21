import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from dateutil.relativedelta import relativedelta
from backend.database import get_db
from backend.models import Vehicle, MaintenanceRule, ServiceRecord, Inspection
from backend.rules_engine import check_maintenance_due


router = APIRouter(
    prefix="/maintenance-rules",
    tags=["Maintenance Rules"]
)


def parse_km_interval(val: str | None, default_num: int | None = None) -> tuple[int, bool]:
    """Extract numeric km and whether 'inspection' is specified in string."""
    if val is None or not str(val).strip():
        return (default_num or 0, False)
    text = str(val).lower()
    is_inspection = "inspection" in text
    match = re.search(r"([\d,]+)", text)
    if match:
        num = int(match.group(1).replace(",", ""))
        return (num, is_inspection)
    return (default_num or 0, is_inspection)


def parse_time_interval(val: str | None, default_num: int | None = None) -> int:
    """Extract numeric months from interval string."""
    if val is None or not str(val).strip():
        return default_num or 0
    match = re.search(r"(\d+)", str(val))
    if match:
        return int(match.group(1))
    return default_num or 0


from backend.schemas import MaintenanceRuleCreate


@router.post("/", status_code=201)
def create_maintenance_rule(
    rule_data: MaintenanceRuleCreate,
    db: Session = Depends(get_db)
):
    comp = (rule_data.component or rule_data.component_name or "").strip()
    if not comp:
        raise HTTPException(
            status_code=422,
            detail="Component is required."
        )

    parsed_km, is_insp = parse_km_interval(rule_data.suggested_km_interval, rule_data.interval_km)
    interval_km = rule_data.interval_km if rule_data.interval_km is not None else parsed_km

    parsed_months = parse_time_interval(rule_data.suggested_time_interval, rule_data.interval_months)
    interval_months = rule_data.interval_months if rule_data.interval_months is not None else parsed_months

    inspection_required = 1 if is_insp else (rule_data.inspection_required if rule_data.inspection_required is not None else 1)

    suggested_km = rule_data.suggested_km_interval
    if not suggested_km:
        suggested_km = f"{interval_km:,} km{' inspection' if inspection_required else ''}" if interval_km else "0 km"

    suggested_time = rule_data.suggested_time_interval
    if not suggested_time:
        suggested_time = f"{interval_months} month{'s' if interval_months != 1 else ''}" if interval_months else "—"

    if interval_km == 0 and interval_months == 0 and suggested_km in ("0 km", "0", "") and suggested_time in ("—", "0 months", ""):
        raise HTTPException(
            status_code=422,
            detail="Provide a kilometre interval or a month interval."
        )

    task = (rule_data.service_task or f"Inspect and service {comp}").strip()

    rule = MaintenanceRule(
        vehicle_model=rule_data.vehicle_model.strip(),
        component=comp,
        component_name=comp,
        service_task=task,
        suggested_km_interval=suggested_km,
        suggested_time_interval=suggested_time,
        interval_km=interval_km,
        interval_months=interval_months,
        inspection_required=inspection_required,
        is_active=rule_data.is_active,
        notes=rule_data.notes,
    )

    try:
        db.add(rule)
        db.commit()
        db.refresh(rule)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This maintenance rule already exists."
        )

    return {
        "message": "Maintenance rule created successfully",
        "id": rule.id,
        "component": rule.component,
        "suggested_km_interval": rule.suggested_km_interval,
        "suggested_time_interval": rule.suggested_time_interval
    }


@router.get("/")
def get_maintenance_rules(
    db: Session = Depends(get_db)
):
    rules = (
        db.query(MaintenanceRule)
        .order_by(MaintenanceRule.id)
        .all()
    )
    result = []
    for r in rules:
        comp = r.component or r.component_name
        km_str = r.suggested_km_interval or (f"{r.interval_km:,} km" if r.interval_km else "0 km")
        time_str = r.suggested_time_interval or (f"{r.interval_months} month{'s' if r.interval_months != 1 else ''}" if r.interval_months else "—")
        result.append({
            "id": r.id,
            "vehicle_model": r.vehicle_model,
            "component": comp,
            "component_name": comp,
            "service_task": r.service_task,
            "suggested_km_interval": km_str,
            "suggested_time_interval": time_str,
            "interval_km": r.interval_km or 0,
            "interval_months": r.interval_months or 0,
            "inspection_required": r.inspection_required,
            "is_active": r.is_active,
            "notes": r.notes,
        })
    return result


COMPONENT_ALIASES = {
    "engine oil": ["engine oil"],
    "front brake pads": ["front brake pads", "brake pads & discs", "brake pads", "brakes", "front brakes"],
    "rear brake shoes": ["rear brake shoes", "brake shoes", "rear brakes"],
    "brake fluid": ["brake fluid", "brakes", "fluid"],
    "brake system inspection": ["brake system inspection", "brake system", "brakes", "brake pads & discs"],
    "tyre pressure check": ["tyre pressure check", "tyre pressure", "tyres", "tires"],
    "front-left tyre": ["front-left tyre", "front left tyre", "tyres", "tires"],
    "rear-left tyre": ["rear-left tyre", "rear left tyre", "tyres", "tires"],
    "wheel alignment & balancing": ["wheel alignment & balancing", "wheel alignment", "dynamic wheel balancing", "alignment"],
    "spare tyre": ["spare tyre", "spare tire", "tyres", "tires"],
    "front-right tyre": ["front-right tyre", "front right tyre", "tyres", "tires"],
    "tyre replacement inspection": ["tyre replacement inspection", "tyre replacement", "tyres", "tires"],
    "rear-right tyre": ["rear-right tyre", "rear right tyre", "tyres", "tires"],
    "battery visual & terminal check": ["battery visual & terminal check", "battery check", "battery"],
    "battery voltage & health test": ["battery voltage & health test", "battery test", "battery"],
    "alternator & load testing": ["alternator & load testing", "alternator", "load testing"],
    "battery replacement inspection": ["battery replacement inspection", "battery replacement", "battery"],
    "bumper, cladding & retaining clips": ["bumper, cladding & retaining clips", "bumper", "cladding"],
    "front & rear wiper blades": ["front & rear wiper blades", "wiper blades", "wipers", "wiper blade"],
    "headlight lens oxidation": ["headlight lens oxidation", "headlight lens", "headlights"],
    "underbody anti-rust coating": ["underbody anti-rust coating", "anti-rust coating", "underbody coating"],
    "headlight & fog light bulbs": ["headlight & fog light bulbs", "headlight bulbs", "fog light bulbs", "headlights", "fog lights"],
    "hood & tailgate gas struts": ["hood & tailgate gas struts", "gas struts", "hood struts", "tailgate struts"],
    "exterior paint wax & sealant": ["exterior paint wax & sealant", "paint wax", "wax", "sealant"],
    "windshield washer fluid": ["windshield washer fluid", "washer fluid", "windshield washer"],
    "door weatherstrips": ["door weatherstrips", "weatherstrips", "door seals"],
    "ceramic coating": ["ceramic coating", "coating"],
    # Common component aliases
    "engine oil filter": ["engine oil filter", "oil filter", "oil filter element"],
    "air filter": ["air filter"],
    "fuel filter": ["fuel filter"],
    "coolant": ["coolant", "engine coolant"],
    "brake pads & discs": ["brake pads & discs", "front brake pads", "brake pads", "brakes"],
    "transfer case oil": ["transfer case oil", "transfer case", "transmission", "transmission fluid"],
}


@router.get("/check/{vehicle_id}")
def check_vehicle_maintenance(
    vehicle_id: int,
    today: date | None = None,
    db: Session = Depends(get_db)
):
    from sqlalchemy import or_

    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id)
        .first()
    )

    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found."
        )

    rules = (
        db.query(MaintenanceRule)
        .filter(
            MaintenanceRule.vehicle_model == vehicle.model,
            MaintenanceRule.is_active == 1
        )
        .order_by(MaintenanceRule.id)
        .all()
    )

    if not rules and vehicle.model:
        # Fallback to base model (e.g. 'Scorpio GS' -> 'Scorpio')
        base_model = vehicle.model.split()[0]
        rules = (
            db.query(MaintenanceRule)
            .filter(
                MaintenanceRule.vehicle_model == base_model,
                MaintenanceRule.is_active == 1
            )
            .order_by(MaintenanceRule.id)
            .all()
        )

    results = []

    for rule in rules:
        comp = rule.component or rule.component_name
        comp_key = comp.strip().lower()
        aliases = COMPONENT_ALIASES.get(comp_key, [comp_key])
        conditions = [ServiceRecord.component_name.ilike(a) for a in aliases]

        last_service = (
            db.query(ServiceRecord)
            .filter(
                ServiceRecord.vehicle_id == vehicle_id,
                or_(*conditions)
            )
            .order_by(
                ServiceRecord.service_date.desc(),
                ServiceRecord.id.desc()
            )
            .first()
        )

        last_service_km = (
            last_service.odometer_km
            if last_service else None
        )

        last_service_date = (
            last_service.service_date
            if last_service else vehicle.last_service_date
        )

        result = check_maintenance_due(
            current_odometer_km=vehicle.current_odometer_km,
            last_service_odometer_km=last_service_km,
            last_service_date=last_service_date,
            interval_km=rule.interval_km or 0,
            interval_months=rule.interval_months or 0,
            today=today
        )

        # Check for recent inspection on this component
        insp_conditions = [Inspection.component_name.ilike(a) for a in aliases]
        last_inspection = (
            db.query(Inspection)
            .filter(
                Inspection.vehicle_id == vehicle_id,
                or_(*insp_conditions)
            )
            .order_by(
                Inspection.inspection_date.desc(),
                Inspection.id.desc()
            )
            .first()
        )

        if last_inspection:
            # If inspection failed or required service, and was not addressed by a subsequent service:
            if last_inspection.inspection_decision in ["Service Required", "Fail"] or last_inspection.condition in ["Poor", "Critical"]:
                if not last_service or last_inspection.inspection_date >= last_service.service_date:
                    result["maintenance_due"] = True
                    insp_reason = f"Inspection defect [{last_inspection.condition}]: {last_inspection.defect_description or last_inspection.inspection_decision}"
                    if insp_reason not in result["reasons"]:
                        result["reasons"].insert(0, insp_reason)
            # If inspection passed and rule requires inspection:
            elif last_inspection.inspection_decision in ["Pass", "Good", "Monitor"] and (rule.inspection_required == 1 or "inspect" in (rule.service_task or "").lower()):
                if not last_service or last_inspection.inspection_date > (last_service.service_date or date(1970, 1, 1)):
                    if rule.interval_months and rule.interval_months > 0:
                        next_due_date = last_inspection.inspection_date + relativedelta(months=rule.interval_months)
                        result["next_due_date"] = next_due_date.isoformat()
                        current_day = today or date.today()
                        result["date_due"] = current_day >= next_due_date
                        result["maintenance_due"] = result["km_due"] or result["date_due"]
                        if not result["date_due"]:
                            result["reasons"] = [r for r in result["reasons"] if "Time interval" not in r]

        km_str = rule.suggested_km_interval or (f"{rule.interval_km:,} km" if rule.interval_km else "0 km")
        time_str = rule.suggested_time_interval or (f"{rule.interval_months} month{'s' if rule.interval_months != 1 else ''}" if rule.interval_months else "—")

        results.append({
            "rule_id": rule.id,
            "component": comp,
            "component_name": comp,
            "service_task": rule.service_task,
            "suggested_km_interval": km_str,
            "suggested_time_interval": time_str,
            "interval_km": rule.interval_km or 0,
            "interval_months": rule.interval_months or 0,
            "inspection_required": rule.inspection_required,
            "notes": rule.notes,
            **result
        })

    return {
        "vehicle_id": vehicle.id,
        "vehicle_model": vehicle.model,
        "current_odometer_km": vehicle.current_odometer_km,
        "maintenance_checks": results
    }
