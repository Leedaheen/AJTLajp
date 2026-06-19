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
    company: Optional[str] = None       # 업체명
    client_name: Optional[str] = None  # 소속 (발주처)


class UpdateNotifPrefsRequest(BaseModel):
    """알림 수신 설정"""
    transit: bool = True
    as_: bool = True
    approval: bool = True


class AdminLoginRequest(BaseModel):
    """관리자 ID/PW 로그인 요청"""
    admin_id: str   # 관리자가 설정한 아이디
    password: str   # 평문 패스워드 (전송 후 서버에서 해시 비교)


class ChangeCredentialsRequest(BaseModel):
    """관리자 계정 ID/PW 변경 요청"""
    current_password: str          # 현재 패스워드 확인
    new_admin_id: Optional[str] = None   # 새 아이디 (변경 안 하면 생략)
    new_password: Optional[str] = None  # 새 패스워드 (변경 안 하면 생략)
