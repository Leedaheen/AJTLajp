"""사용자 관련 Pydantic 모델"""
from pydantic import BaseModel
from typing import Optional


class GoogleLoginRequest(BaseModel):
    """Google 로그인 요청 — 프론트에서 받은 credential 전달"""
    credential: str
    role: str        # tech / partner / aj / as_tech
    site_id: str     # P4 / P5 / ALL (aj만 ALL 가능)
    phone: Optional[str] = ""


class ApproveUserRequest(BaseModel):
    """사용자 승인/거절 요청"""
    action: str              # approve / reject
    reject_reason: Optional[str] = ""


class UpdateRoleRequest(BaseModel):
    """역할 변경 요청 (AJ관리자만)"""
    role: str
    site_id: Optional[str] = None


class UpdateNotifPrefsRequest(BaseModel):
    """알림 수신 설정"""
    transit: bool = True
    as_: bool = True
    approval: bool = True
