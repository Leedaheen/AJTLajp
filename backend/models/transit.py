"""반입/반출 신청 관련 Pydantic 모델"""
from pydantic import BaseModel
from typing import Optional, List


class EquipSpec(BaseModel):
    spec: str   # 6M / 8M / 10M ...
    qty: int


class TransitCreateRequest(BaseModel):
    type: str                          # in / out
    site_id: str                       # P4 / P5
    site_name: str
    company: str
    equip_specs: List[EquipSpec]
    reporter_name: str
    reporter_phone: str
    manager_name: Optional[str] = ""   # 양중담당자
    manager_phone: Optional[str] = ""
    manager_location: Optional[str] = ""
    requested_date: Optional[str] = ""
    note: Optional[str] = ""


class TransitScheduleRequest(BaseModel):
    """AJ관리자: 일정 확정 + 배차 입력"""
    scheduled_date: str
    vehicle_info: Optional[str] = ""
    driver_info: Optional[str] = ""
    note: Optional[str] = None


class TransitUpdateRequest(BaseModel):
    """일정 변경 (협력사·AJ 모두 가능, 변경이력 자동기록)"""
    scheduled_date: Optional[str] = None
    requested_date: Optional[str] = None
    vehicle_info: Optional[str] = None
    driver_info: Optional[str] = None
    manager_name: Optional[str] = None
    manager_phone: Optional[str] = None
    note: Optional[str] = None


class TransitCancelRequest(BaseModel):
    cancelled_reason: str
