"""
사용자 관리 라우터
- Google 로그인/가입
- 관리자 ID/PW 로그인
- 승인/거절 (AJ관리자)
- 역할 변경 (AJ관리자)
- 알림 설정 변경
- 관리자 계정 ID/PW 변경
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext

from auth import verify_google_token, create_app_token, get_current_user, require_role
from database import supabase
from models.user import (
    GoogleLoginRequest,
    AdminLoginRequest,
    ChangeCredentialsRequest,
    ApproveUserRequest,
    UpdateRoleRequest,
    UpdateNotifPrefsRequest,
)
from services.push_service import send_push

router = APIRouter(prefix="/users", tags=["users"])
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

ROLE_LABELS = {
    "tech": "기술인",
    "partner": "협력사 담당자",
    "aj": "AJ관리자",
    "as_tech": "AS기사",
}

# ─── 로그인 / 가입 ──────────────────────────────────────────


@router.post("/auth/google")
async def google_login(body: GoogleLoginRequest):
    """
    Google credential을 검증하고 앱 JWT를 반환합니다.
    신규 사용자면 DB에 등록 후 pending 상태로 대기합니다.
    """
    google_info = verify_google_token(body.credential)

    # AJ관리자만 ALL 사이트 선택 가능
    site_id = body.site_id
    if body.role != "aj" and site_id == "ALL":
        site_id = "P4"  # 기본값 처리

    # 기존 사용자 조회
    res = supabase.table("app_users").select("*").eq("google_id", google_info["google_id"]).execute()

    if res.data:
        user = res.data[0]
        # 역할/사이트가 바뀐 경우 업데이트 (재신청)
        if user["status"] == "rejected":
            supabase.table("app_users").update({
                "role": body.role,
                "site_id": site_id,
                "phone": body.phone,
                "status": "pending",
                "reject_reason": None,
            }).eq("id", user["id"]).execute()
            user["status"] = "pending"
    else:
        # 신규 사용자 등록
        new_user = {
            "google_id": google_info["google_id"],
            "email": google_info["email"],
            "name": google_info["name"],
            "phone": body.phone,
            "role": body.role,
            "site_id": site_id,
            # tech·aj는 즉시 활성화, 나머지는 pending
            "status": "active" if body.role in ("tech", "aj") else "pending",
        }
        insert_res = supabase.table("app_users").insert(new_user).execute()
        user = insert_res.data[0]

        # 승인 대기 역할이면 AJ관리자들에게 알림 발송
        if user["status"] == "pending":
            _notify_aj_managers(user)

    # pending/rejected 상태는 토큰 미발급
    if user["status"] == "pending":
        return {"status": "pending", "message": "AJ관리자 승인 대기 중입니다."}
    if user["status"] == "rejected":
        return {
            "status": "rejected",
            "message": "가입이 거절되었습니다.",
            "reject_reason": user.get("reject_reason", ""),
        }

    token = create_app_token(user["id"], user["role"], user["site_id"])
    return {
        "status": "active",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "site_id": user["site_id"],
        },
    }


# ─── 내 정보 ────────────────────────────────────────────────


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """현재 로그인한 사용자 정보를 반환합니다."""
    res = supabase.table("app_users").select("*").eq("id", current_user["sub"]).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    user = res.data
    user.pop("push_sub", None)  # 구독 정보는 제외
    return user


# ─── 사용자 목록 (AJ관리자만) ───────────────────────────────


@router.get("")
async def list_users(
    status: str = None,
    current_user: dict = Depends(require_role("aj")),
):
    """사용자 목록을 반환합니다. status 파라미터로 필터링 가능합니다."""
    query = supabase.table("app_users").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    res = query.execute()
    return res.data


# ─── 승인 / 거절 (AJ관리자만) ──────────────────────────────


@router.patch("/{user_id}/approve")
async def approve_user(
    user_id: str,
    body: ApproveUserRequest,
    current_user: dict = Depends(get_current_user),
):
    """사용자를 승인하거나 거절합니다."""
    if current_user["role"] not in ("aj", "admin", "pro"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    target = supabase.table("app_users").select("*").eq("id", user_id).single().execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # pro는 자신의 담당 현장 사용자만 승인 가능
    if current_user["role"] == "pro":
        if target.data.get("site_id") != current_user.get("site_id"):
            raise HTTPException(status_code=403, detail="담당 현장의 사용자만 승인할 수 있습니다.")

    user = target.data
    now = datetime.now(timezone.utc).isoformat()

    if body.action == "approve":
        supabase.table("app_users").update({
            "status": "active",
            "approved_at": now,
            "approved_by": current_user["sub"],
            "reject_reason": None,
        }).eq("id", user_id).execute()

        # 승인 알림
        _save_notification(
            target_id=user_id,
            type_="approval",
            title="가입이 승인되었습니다",
            body=f"{ROLE_LABELS.get(user['role'], user['role'])}으로 승인되었습니다. 지금 바로 이용하세요.",
        )
        _send_push_to_user(user, "가입 승인", "앱을 새로고침하여 이용을 시작하세요.")

    elif body.action == "reject":
        if not body.reject_reason:
            raise HTTPException(status_code=400, detail="거절 사유를 입력해주세요.")
        supabase.table("app_users").update({
            "status": "rejected",
            "reject_reason": body.reject_reason,
        }).eq("id", user_id).execute()

        _save_notification(
            target_id=user_id,
            type_="approval",
            title="가입이 거절되었습니다",
            body=f"사유: {body.reject_reason}",
        )
        _send_push_to_user(user, "가입 거절", body.reject_reason)

    return {"ok": True}


# ─── 역할 변경 (AJ관리자만) ────────────────────────────────


@router.patch("/{user_id}/role")
async def update_role(
    user_id: str,
    body: UpdateRoleRequest,
    current_user: dict = Depends(require_role("aj")),
):
    """사용자 역할을 변경합니다."""
    update_data = {"role": body.role}
    if body.site_id:
        update_data["site_id"] = body.site_id

    supabase.table("app_users").update(update_data).eq("id", user_id).execute()
    return {"ok": True}


# ─── 알림 수신 설정 ─────────────────────────────────────────


@router.patch("/me/notif-prefs")
async def update_notif_prefs(
    body: UpdateNotifPrefsRequest,
    current_user: dict = Depends(get_current_user),
):
    """내 알림 수신 설정을 변경합니다."""
    prefs = {"transit": body.transit, "as": body.as_, "approval": body.approval}
    supabase.table("app_users").update({"notif_prefs": prefs}).eq("id", current_user["sub"]).execute()
    return {"ok": True}


# ─── Push 구독 저장 ─────────────────────────────────────────


@router.post("/me/push-subscribe")
async def save_push_subscription(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """PWA Push 구독 정보를 저장합니다."""
    supabase.table("app_users").update({"push_sub": body}).eq("id", current_user["sub"]).execute()
    return {"ok": True}


# ─── 관리자 ID/PW 로그인 ────────────────────────────────────


@router.post("/auth/admin")
async def admin_login(body: AdminLoginRequest):
    """
    관리자 ID/PW 로그인입니다.
    Google 계정 없이도 관리자 기능을 사용할 수 있습니다.
    """
    res = supabase.table("app_users").select("*").eq("local_id", body.admin_id).execute()
    if not res.data:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    user = res.data[0]

    if not user.get("pw_hash") or not _pwd.verify(body.password, user["pw_hash"]):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    if user["status"] != "active":
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다.")

    token = create_app_token(user["id"], user["role"], user["site_id"])
    return {
        "status": "active",
        "token": token,
        "user": {
            "id":      user["id"],
            "name":    user["name"],
            "email":   user["email"],
            "role":    user["role"],
            "site_id": user["site_id"],
        },
    }


# ─── 관리자 계정 ID/PW 변경 ─────────────────────────────────


@router.patch("/me/credentials")
async def change_credentials(
    body: ChangeCredentialsRequest,
    current_user: dict = Depends(require_role("aj")),
):
    """
    관리자 아이디와 비밀번호를 변경합니다.
    현재 비밀번호 확인 후 변경됩니다.
    """
    res = supabase.table("app_users").select("local_id,pw_hash").eq("id", current_user["sub"]).single().execute()
    user = res.data
    if not user or not user.get("pw_hash"):
        raise HTTPException(status_code=400, detail="이 계정은 ID/PW 변경이 지원되지 않습니다.")

    if not _pwd.verify(body.current_password, user["pw_hash"]):
        raise HTTPException(status_code=401, detail="현재 비밀번호가 올바르지 않습니다.")

    update_data = {}
    if body.new_admin_id:
        # 중복 아이디 체크
        dup = supabase.table("app_users").select("id").eq("local_id", body.new_admin_id).execute()
        if dup.data and dup.data[0]["id"] != current_user["sub"]:
            raise HTTPException(status_code=409, detail="이미 사용 중인 아이디입니다.")
        update_data["local_id"] = body.new_admin_id
    if body.new_password:
        if len(body.new_password) < 4:
            raise HTTPException(status_code=400, detail="비밀번호는 4자 이상이어야 합니다.")
        update_data["pw_hash"] = _pwd.hash(body.new_password)

    if not update_data:
        raise HTTPException(status_code=400, detail="변경할 내용이 없습니다.")

    supabase.table("app_users").update(update_data).eq("id", current_user["sub"]).execute()
    return {"ok": True, "message": "계정 정보가 변경되었습니다."}


# ─── 내부 헬퍼 ──────────────────────────────────────────────


def _notify_aj_managers(new_user: dict):
    """AJ관리자 전원에게 신규 가입 알림을 보냅니다."""
    aj_users = supabase.table("app_users").select("id,push_sub,notif_prefs").eq("role", "aj").eq("status", "active").execute()
    for aj in aj_users.data or []:
        _save_notification(
            target_id=aj["id"],
            type_="approval",
            title="새 가입 신청",
            body=f"{new_user['name']} ({ROLE_LABELS.get(new_user['role'], '')} / {new_user.get('site_id','')}) 승인 대기 중",
        )
        if aj.get("push_sub") and (aj.get("notif_prefs") or {}).get("approval", True):
            try:
                send_push(aj["push_sub"], "새 가입 신청", f"{new_user['name']}님의 가입 신청을 확인해주세요.")
            except Exception:
                pass


def _send_push_to_user(user: dict, title: str, body: str):
    if user.get("push_sub"):
        try:
            send_push(user["push_sub"], title, body)
        except Exception:
            pass


def _save_notification(target_id: str, type_: str, title: str, body: str, ref_id: str = None):
    supabase.table("notifications").insert({
        "target_id": target_id,
        "type": type_,
        "title": title,
        "body": body,
        "ref_id": ref_id,
    }).execute()
