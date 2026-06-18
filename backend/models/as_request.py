from typing import Optional
from pydantic import BaseModel


class AsRequestCreateRequest(BaseModel):
    site_id: str
    site_name: str
    company: str
    equip_id: Optional[int] = None
    equip_no: Optional[str] = None
    equip_spec: Optional[str] = None
    location: str
    fault_type: str
    description: str
    reporter_name: str
    reporter_phone: str


class AsRequestAssignRequest(BaseModel):
    tech_id: str
    tech_name: str
    tech_phone: str


class AsRequestResolveRequest(BaseModel):
    resolve_note: str
    material_used: Optional[str] = None
    tech_name: Optional[str] = None


class AsRequestHoldRequest(BaseModel):
    hold_reason: str


class AsRequestCancelRequest(BaseModel):
    cancel_reason: str
