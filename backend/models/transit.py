"""반입/반출 신청 관련 Pydantic 모델"""
from pydantic import BaseModel
from typing import Optional, List


class EquipSpec(BaseModel):
    spec: str   # 6M / 8M / 10M ...
    qty: int


class TransitCreateRequest(BaseModel):
    type: str                           # in / out
    site_id: str                        # P4 / P5
    site_name: str
    company: str
    client_name: Optional[str] = ""     # 발주처
    project: Optional[str] = ""
    floor: Optional[str] = ""
    equip_specs: List[EquipSpec] = []
    equip_nos: Optional[str] = ""       # 반출 시 장비번호 (쉼표 구분)
    aj_equip: Optional[str] = ""        # 반출 선택 장비번호
    reporter_name: str
    reporter_phone: str
    manager_name: Optional[str] = ""    # 양중담당자
    manager_phone: Optional[str] = ""
    manager_location: Optional[str] = ""
    requested_date: Optional[str] = ""
    requested_time: Optional[str] = ""
    note: Optional[str] = ""


class TransitCompleteRequest(BaseModel):
    """AJ관리자: 완료 처리 — 반입 시 장비번호 입력"""
    equip_nos:    Optional[str] = ""   # 쉼표 구분 장비번호 (반입 시 필수)
    completed_at: Optional[str] = None # 완료 일자 (YYYY-MM-DD), 없으면 오늘


class TransitScheduleRequest(BaseModel):
    """AJ관리자: 일정 확정 + 배차 입력"""
    scheduled_date: str
    scheduled_time: Optional[str] = None
    status: Optional[str] = "scheduled"
    aj_equip: Optional[str] = ""
    vehicle_info: Optional[str] = ""
    driver_info: Optional[str] = ""
    note: Optional[str] = None


class TransitDispatchRequest(BaseModel):
    """배차정보 등록 / 확정단계 통합수정"""
    vehicle_info:   Optional[str] = ""
    driver_info:    Optional[str] = ""
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    aj_equip:       Optional[str] = None


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
