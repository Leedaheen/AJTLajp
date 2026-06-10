"""
인증 모듈 — Google OAuth2 토큰 검증 + 앱 JWT 발급
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from jose import JWTError, jwt

from config import GOOGLE_CLIENT_ID, JWT_SECRET, JWT_EXPIRE_HOURS

bearer_scheme = HTTPBearer()


def verify_google_token(credential: str) -> dict:
    """Google ID 토큰을 검증하고 사용자 정보를 반환합니다."""
    try:
        info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
        return {
            "google_id": info["sub"],
            "email": info["email"],
            "name": info.get("name", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Google 토큰 검증 실패: {str(e)}")


def create_app_token(user_id: str, role: str, site_id: str) -> str:
    """앱 JWT를 생성합니다."""
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "role": role,
        "site_id": site_id,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_app_token(token: str) -> dict:
    """앱 JWT를 디코딩합니다."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="인증 토큰이 유효하지 않습니다.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """요청 헤더의 JWT에서 현재 사용자 정보를 추출합니다."""
    return decode_app_token(credentials.credentials)


def require_role(*roles: str):
    """특정 역할만 허용하는 의존성 팩토리입니다."""
    def checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
        return current_user
    return checker
