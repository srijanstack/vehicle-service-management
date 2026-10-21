from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# Vehicle Schemas
# ============================================================================

class VehicleBase(BaseModel):
    registration_number: str = Field(min_length=1, max_length=50)
    vehicle_name: str = Field(min_length=1, max_length=100)
    vehicle_type: str = "SUV"
    manufacturer: str = "Mahindra"
    model: str = "Scorpio"
    manufacture_year: int | None = Field(default=None, ge=1900, le=2100)
    unit_name: str | None = None
    current_odometer_km: int = Field(default=0, ge=0)
    last_service_date: date | None = None
    next_service_due_date: date | None = None
    status: str = "Active"


class VehicleCreate(VehicleBase):
    pass


class VehicleOdometerUpdate(BaseModel):
    current_odometer_km: int = Field(ge=0, description="Current odometer reading in kilometers")


class VehicleUpdate(BaseModel):
    registration_number: str | None = Field(default=None, min_length=1, max_length=50)
    vehicle_name: str | None = Field(default=None, min_length=1, max_length=100)
    vehicle_type: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    manufacture_year: int | None = Field(default=None, ge=1900, le=2100)
    unit_name: str | None = None
    current_odometer_km: int | None = Field(default=None, ge=0)
    last_service_date: date | None = None
    next_service_due_date: date | None = None
    status: str | None = None


class VehicleResponse(VehicleBase):
    id: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


VehicleSchema = VehicleResponse


# ============================================================================
# Maintenance Rule Schemas
# ============================================================================

class MaintenanceRuleBase(BaseModel):
    vehicle_model: str = Field(min_length=1, max_length=100)
    component: str | None = None
    component_name: str | None = None
    service_task: str | None = None
    suggested_km_interval: str | None = None
    suggested_time_interval: str | None = None
    interval_km: int | None = Field(default=None, ge=0)
    interval_months: int | None = Field(default=None, ge=0)
    inspection_required: int = 1
    is_active: int = 1
    notes: str | None = None


class MaintenanceRuleCreate(MaintenanceRuleBase):
    pass


class MaintenanceRuleResponse(MaintenanceRuleBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


MaintenanceRuleSchema = MaintenanceRuleResponse
MaintenanceSchema = MaintenanceRuleResponse


# ============================================================================
# Service Record Schemas
# ============================================================================

class ServiceRecordBase(BaseModel):
    vehicle_id: int = Field(gt=0)
    service_date: date
    odometer_km: int = Field(ge=0)
    component_name: str = Field(min_length=1, max_length=100)
    service_type: str = Field(min_length=1, max_length=100)
    work_description: str
    parts_replaced: str | None = None
    parts_cost: int = Field(default=0, ge=0)
    labour_cost: int = Field(default=0, ge=0)
    performed_by: str | None = None
    remarks: str | None = None


class ServiceRecordCreate(ServiceRecordBase):
    pass


class ServiceRecordResponse(ServiceRecordBase):
    id: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


ServiceRecordSchema = ServiceRecordResponse


# ============================================================================
# Inspection Schemas
# ============================================================================

class InspectionBase(BaseModel):
    vehicle_id: int = Field(gt=0)
    component_name: str = Field(min_length=1, max_length=100)
    inspection_date: date
    condition: str = Field(min_length=1, max_length=50)
    defect_description: str | None = None
    inspection_decision: str = Field(min_length=1, max_length=100)
    recommended_action: str | None = None
    inspected_by: str | None = None


class InspectionCreate(InspectionBase):
    pass


class InspectionResponse(InspectionBase):
    id: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


InspectionSchema = InspectionResponse


# ============================================================================
# Work Order Schemas
# ============================================================================

class WorkOrderBase(BaseModel):
    vehicle_id: int = Field(gt=0)
    component_name: str = Field(min_length=1, max_length=100)
    issue_description: str = Field(min_length=1)
    priority: str = "Medium"
    status: str = "Pending"
    due_date: date | None = None
    assigned_to: str | None = None
    remarks: str | None = None


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    issue_description: str | None = None
    due_date: date | None = None
    assigned_to: str | None = None
    completion_date: date | None = None
    action_taken: str | None = None
    remarks: str | None = None


class WorkOrderResponse(WorkOrderBase):
    id: int
    created_date: date | None = None
    completion_date: date | None = None
    action_taken: str | None = None

    model_config = ConfigDict(from_attributes=True)


WorkOrderSchema = WorkOrderResponse
