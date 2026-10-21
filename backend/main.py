from backend.routes.maintenance import router as maintenance_router
import os

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import get_db, engine, Base
from backend.models import Vehicle
from backend.schemas import VehicleCreate, VehicleResponse
from backend.routes.service import router as service_router
from backend.routes.inspection import router as inspection_router 
from backend.routes.work_orders import router as work_orders_router

app = FastAPI(
    title="Army Vehicle Maintenance Portal",
    description="Vehicle registration and maintenance management system",
    version="1.0.0"
)
# Create tables on startup if they don't exist yet.
Base.metadata.create_all(bind=engine)

# Allow the Vite dev server (and any origins listed in CORS_ORIGINS) to call the API.
_origins = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(maintenance_router)
app.include_router(service_router)
app.include_router(inspection_router)
app.include_router(work_orders_router)

@app.get("/")
def home():
    return {
        "message": "Army Vehicle Maintenance Portal is running!",
        "status": "success"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/vehicles/", response_model=VehicleResponse, status_code=201)
def create_vehicle(
    vehicle_data: VehicleCreate,
    db: Session = Depends(get_db)
):
    existing_vehicle = (
        db.query(Vehicle)
        .filter(
            Vehicle.registration_number
            == vehicle_data.registration_number
        )
        .first()
    )

    if existing_vehicle:
        raise HTTPException(
            status_code=409,
            detail="This vehicle registration number already exists."
        )

    new_vehicle = Vehicle(**vehicle_data.model_dump())

    if not new_vehicle.next_service_due_date:
        from datetime import date
        from dateutil.relativedelta import relativedelta
        from backend.models import MaintenanceRule

        rules = (
            db.query(MaintenanceRule)
            .filter(
                MaintenanceRule.vehicle_model == new_vehicle.model,
                MaintenanceRule.is_active == 1,
                MaintenanceRule.interval_months > 0
            )
            .order_by(MaintenanceRule.interval_months.asc())
            .all()
        )
        if not rules and new_vehicle.model:
            base_model = new_vehicle.model.split()[0]
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
        base_date = new_vehicle.last_service_date or date.today()
        new_vehicle.next_service_due_date = base_date + relativedelta(months=min_months)

    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)

    return new_vehicle


@app.get("/vehicles/", response_model=list[VehicleResponse])
def get_vehicles(db: Session = Depends(get_db)):
    return db.query(Vehicle).order_by(Vehicle.id).all()


@app.get("/vehicles/{vehicle_id}", response_model=VehicleResponse)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    return vehicle
