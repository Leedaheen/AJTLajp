from typing import Optional
from pydantic import BaseModel


class UsageLogStartRequest(BaseModel):
    site_id: str
    site_name: Optional[str] = ""
    company: str
    equip: str          # 장비번호
    floor: str          # 사용 층/위치
    recorder: str       # 기록자 이름
    meter_start: Optional[str] = ""


class UsageLogEndRequest(BaseModel):
    end_time: str       # HH:MM
    meter_end: Optional[str] = ""
    off_reason: Optional[str] = ""
