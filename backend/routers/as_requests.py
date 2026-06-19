"""
AS 요청 라우터
- 신청 등록 (tech·partner·aj)
- 목록 / 상세 조회
- 기사 배정 (aj)
- 처리 시작 (as_tech)
- 완료 처리 (as_tech·aj)
- 취소 (aj)
"""
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user, require_role
from database import supabase
from models.as_request import (
    AsRequestCreateRequest,
    AsRequestAssignRequest,
    AsRequestResolveRequest,
    AsRequestHoldRequest,
    AsRequestCancelRequest,
)
from services.push_service import send_push

router = APIRouter(prefix="/as-requests", tags=["as-requests"])

STATUS_FLOW = {
    "pending":    "접수 대기",
    "assigned":   "기사 배정",
    "in_progress":"처리 중",
    "resolved":   "처리 완료",
    "cancelled":  "취소",
}


# ─── 목록 조회 ────────────────────────────────────────────────
@router.get("")
async def list_as_requests(
    status: str = None,
    site_id: str = None,
    tech_id: str = None,
    q: str = None,       # 통합 검색: 장비번호/업체명/고장유형
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    query = supabase.table("as_requests").select("*").order("created_at", desc=True).limit(limit)

    role = current_user["role"]
    if role == "partner":
        query = query.eq("site_id", current_user["site_id"])
    elif role == "tech":
        query = query.eq("created_by", current_user["sub"])

    if status:  query = query.eq("status", status)
    if site_id: query = query.eq("site_id", site_id)
    if tech_id: query = query.eq("tech_id", tech_id)
    if q:
        query = query.or_(
            f"equip_no.ilike.%{q}%,company.ilike.%{q}%,fault_type.ilike.%{q}%"
        )

    return (query.execute()).data or []


# ─── 상세 조회 ────────────────────────────────────────────────
@router.get("/{req_id}")
async def get_as_request(req_id: int, current_user: dict = Depends(get_current_user)):
    res = supabase.table("as_requests").select("*").eq("id", req_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="AS 요청을 찾을 수 없습니다.")
    return res.data


# ─── 신청 등록 ────────────────────────────────────────────────
@router.post("")
async def create_as_request(body: AsRequestCreateRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("tech", "partner", "aj"):
        raise HTTPException(status_code=403, detail="AS 요청 권한이 없습니다.")

    record_id = f"AS-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

    data = {
        "record_id":     record_id,
        "site_id":       body.site_id,
        "site_name":     body.site_name,
        "company":       body.company,
        "equip_id":      body.equip_id,
        "equip_no":      body.equip_no,
        "equip_spec":    body.equip_spec,
        "location":      body.location,
        "fault_type":    body.fault_type,
        "description":   body.description,
        "reporter_name": body.reporter_name,
        "reporter_phone":body.reporter_phone,
        "status":        "requested",
        "created_by":    current_user["sub"],
    }
    res = supabase.table("as_requests").insert(data).execute()
    req = res.data[0]

    _notify_aj(
        type_="as_request",
        title=f"[AS 요청] {body.company} · {body.fault_type}",
        body=f"{body.site_name} / {body.location} / {body.description[:50]}",
        ref_id=str(req["id"]),
    )
    return req


# ─── 기사 배정 (AJ) ──────────────────────────────────────────
@router.patch("/{req_id}/assign")
async def assign_tech(
    req_id: int,
    body: AsRequestAssignRequest,
    current_user: dict = Depends(require_role("aj")),
):
    old = _get_or_404(req_id)

    supabase.table("as_requests").update({
        "status":     "assigned",
        "tech_id":    body.tech_id,
        "tech_name":  body.tech_name,
        "tech_phone": body.tech_phone,
    }).eq("id", req_id).execute()

    # 배정된 AS기사에게 알림
    tech = supabase.table("app_users").select("id,push_sub,notif_prefs").eq("id", body.tech_id).single().execute()
    if tech.data:
        _save_notif(
            tech.data["id"], "as_request",
            f"[AS 배정] {old['company']} · {old['fault_type']}",
            f"{old['site_name']} / {old['location']}",
            ref_id=str(req_id),
        )
        if tech.data.get("push_sub") and (tech.data.get("notif_prefs") or {}).get("as_request", True):
            try: send_push(tech.data["push_sub"], f"[AS 배정] {old['company']}", f"{old['site_name']} / {old['location']}")
            except: pass

    return {"ok": True}


# ─── 처리 시작 (as_tech) ─────────────────────────────────────
@router.patch("/{req_id}/start")
async def start_as(
    req_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("as_tech", "aj"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    old = _get_or_404(req_id)
    supabase.table("as_requests").update({
        "status":        "in_progress",
        "in_progress_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", req_id).execute()
    _notify_requester(old, "as_request",
        f"[AS 처리 시작] {old['company']} · {old['fault_type']}",
        f"{old['site_name']} / {old['location']}",
        ref_id=str(req_id))
    return {"ok": True}


# ─── 완료 처리 ────────────────────────────────────────────────
@router.patch("/{req_id}/resolve")
async def resolve_as(
    req_id: int,
    body: AsRequestResolveRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("as_tech", "aj"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    old = _get_or_404(req_id)
    now = datetime.now(timezone.utc)

    update_data = {
        "status":        "completed",
        "resolve_note":  body.resolve_note,
        "material_used": body.material_used,
        "resolved_at":   now.isoformat(),
    }
    if body.tech_name:
        update_data["tech_name"] = body.tech_name
    supabase.table("as_requests").update(update_data).eq("id", req_id).execute()

    # 신청자에게 완료 알림
    if old.get("created_by"):
        creator = supabase.table("app_users").select("id,push_sub,notif_prefs").eq("id", old["created_by"]).single().execute()
        if creator.data:
            _save_notif(
                creator.data["id"], "as_request",
                f"[AS 완료] {old['company']} · {old['fault_type']}",
                body.resolve_note[:60],
                ref_id=str(req_id),
            )
            if creator.data.get("push_sub") and (creator.data.get("notif_prefs") or {}).get("as_request", True):
                try: send_push(creator.data["push_sub"], f"[AS 완료] {old['fault_type']}", body.resolve_note[:60])
                except: pass

    return {"ok": True}


# ─── 자재 수급 중 ────────────────────────────────────────────
@router.patch("/{req_id}/material")
async def material_as(
    req_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("as_tech", "aj", "admin"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    old = _get_or_404(req_id)
    supabase.table("as_requests").update({
        "status":      "material_pending",
        "material_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", req_id).execute()
    _notify_requester(old, "as_request",
        f"[AS 자재 수급 중] {old['company']} · {old['fault_type']}",
        f"{old['site_name']} / {old['location']}",
        ref_id=str(req_id))
    return {"ok": True}


# ─── 보류 ─────────────────────────────────────────────────────
@router.patch("/{req_id}/hold")
async def hold_as(
    req_id: int,
    body: AsRequestHoldRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("as_tech", "aj", "admin"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    old = _get_or_404(req_id)
    supabase.table("as_requests").update({
        "status":      "held",
        "hold_reason": body.hold_reason,
        "held_at":     datetime.now(timezone.utc).isoformat(),
    }).eq("id", req_id).execute()
    _notify_requester(old, "as_request",
        f"[AS 보류] {old['company']} · {old['fault_type']}",
        body.hold_reason[:60] if body.hold_reason else f"{old['site_name']} / {old['location']}",
        ref_id=str(req_id))
    return {"ok": True}


# ─── 처리 재개 (보류 → 처리중) ───────────────────────────────
@router.patch("/{req_id}/resume")
async def resume_as(
    req_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("as_tech", "aj", "admin"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    old = _get_or_404(req_id)
    supabase.table("as_requests").update({
        "status":        "in_progress",
        "in_progress_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", req_id).execute()
    _notify_requester(old, "as_request",
        f"[AS 처리 재개] {old['company']} · {old['fault_type']}",
        f"{old['site_name']} / {old['location']}",
        ref_id=str(req_id))
    return {"ok": True}


# ─── 취소 ─────────────────────────────────────────────────────
@router.patch("/{req_id}/cancel")
async def cancel_as(
    req_id: int,
    body: AsRequestCancelRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("as_tech", "aj", "admin", "partner", "tech"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    supabase.table("as_requests").update({
        "status":       "cancelled",
        "cancel_reason": body.cancel_reason,
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", req_id).execute()
    return {"ok": True}


# ─── 내부 헬퍼 ────────────────────────────────────────────────
def _get_or_404(req_id: int) -> dict:
    res = supabase.table("as_requests").select("*").eq("id", req_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="AS 요청을 찾을 수 없습니다.")
    return res.data

def _save_notif(target_id, type_, title, body, ref_id=None):
    supabase.table("notifications").insert({
        "target_id": target_id, "type": type_,
        "title": title, "body": body, "ref_id": ref_id,
    }).execute()

def _notify_requester(old, type_, title, body, ref_id=None):
    if not old.get("created_by"): return
    creator = supabase.table("app_users").select("id,push_sub,notif_prefs").eq("id", old["created_by"]).single().execute()
    if creator.data:
        _save_notif(creator.data["id"], type_, title, body, ref_id)
        if creator.data.get("push_sub") and (creator.data.get("notif_prefs") or {}).get("as_request", True):
            try: send_push(creator.data["push_sub"], title, body)
            except: pass

def _notify_aj(type_, title, body, ref_id=None):
    ajs = supabase.table("app_users").select("id,push_sub,notif_prefs").eq("role","aj").eq("status","active").execute()
    for u in ajs.data or []:
        _save_notif(u["id"], type_, title, body, ref_id)
        if u.get("push_sub") and (u.get("notif_prefs") or {}).get("as_request", True):
            try: send_push(u["push_sub"], title, body)
            except: pass
