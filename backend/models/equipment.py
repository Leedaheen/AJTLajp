"""장비 관련 Pydantic 모델"""
from pydantic import BaseModel
from typing import Optional


class EquipmentCreateRequest(BaseModel):
    equip_no: str
    spec: Optional[str] = ""
    model: Optional[str] = ""
    site_id: Optional[str] = ""
    site_name: Optional[str] = ""
    company: Optional[str] = ""
    floor: Optional[str] = None


class EquipmentUpdateRequest(BaseModel):
    equip_no: Optional[str] = None
    spec: Optional[str] = None
    model: Optional[str] = None
    serial_no: Optional[str] = None
    site_id: Optional[str] = None
    site_name: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = None
    out_date: Optional[str] = None
    qr_code: Optional[str] = None
    change_log: Optional[list] = None
    floor: Optional[str] = None
