"""
반입/반출 신청 라우터
- 신청 등록 (협력사·AJ)
- 목록/상세 조회
- 일정 확정 + 배차 (AJ)
- 수정 (변경이력 자동기록)
- 완료 처리 (AJ) → 반입 시 QR 자동 생성
- 취소
"""
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user, require_role
from database import supabase
from models.transit import (
    TransitCreateRequest,
    TransitScheduleRequest,
    TransitDispatchRequest,
    TransitUpdateRequest,
    TransitCancelRequest,
    TransitCompleteRequest,
)
from services.push_service import send_push

router = APIRouter(prefix="/transit", tags=["transit"])

SITE_NAMES = {"P4": "P4 복합동", "P5": "P5 복합동"}
SPEC_OPTIONS = ["6M","8M","10M","12M","14M","16M","16M굴절","18M","20M굴절"]


# ─── 목록 조회 ────────────────────────────────────────────────
@router.get("")
async def list_transit(
    status: str = None,
    type: str = None,
    site_id: str = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    query = supabase.table("transit").select("*").order("created_at", desc=True).limit(limit)

    # 협력사는 본인 현장만
    if current_user["role"] == "partner":
        query = query.eq("site_id", current_user["site_id"])

    if status:  query = query.eq("status", status)
    if type:    query = query.eq("type", type)
    if site_id: query = query.eq("site_id", site_id)

    return (query.execute()).data


# ─── 상세 조회 ────────────────────────────────────────────────
@router.get("/{transit_id}")
async def get_transit(transit_id: int, current_user: dict = Depends(get_current_user)):
    res = supabase.table("transit").select("*").eq("id", transit_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="신청 내역을 찾을 수 없습니다.")
    return res.data


# ─── 신청 등록 ────────────────────────────────────────────────
@router.post("")
async def create_transit(body: TransitCreateRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("partner", "aj"):
        raise HTTPException(status_code=403, detail="반입/반출 신청 권한이 없습니다.")

    record_id = f"TR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

    data = {
        "record_id":        record_id,
        "type":             body.type,
        "site_id":          body.site_id,
        "site_name":        SITE_NAMES.get(body.site_id, body.site_id),
        "company":          body.company,
        "project":          body.project,
        "floor":            body.floor if body.type == "in" else None,
        "equip_specs":      [s.dict() for s in body.equip_specs],
        "aj_equip":         body.aj_equip or body.equip_nos or "",
        "reporter_name":    body.reporter_name,
        "reporter_phone":   body.reporter_phone,
        "manager_name":     body.manager_name,
        "manager_phone":    body.manager_phone,
        "manager_location": body.manager_location,
        "requested_date":   body.requested_date,
        "note":             body.note,
        "status":           "requested",
        "change_log":       [],
        "created_by":       current_user["sub"],
    }
    # 컬럼이 DB에 존재할 때만 포함 (스키마 마이그레이션 전 방어 처리)
    if body.requested_time:
        data["requested_time"] = body.requested_time
    res = supabase.table("transit").insert(data).execute()
    transit = res.data[0]

    # AJ관리자 전원에게 알림
    _notify_aj(
        type_="transit",
        title=f"[{'반입' if body.type=='in' else '반출'} 신청] {body.company}",
        body=f"{body.site_name} / {_specs_str(body.equip_specs)} / 희망일: {body.requested_date or '미정'}",
        ref_id=str(transit["id"]),
    )
    return transit


# ─── 일정 확정 + 배차 (AJ) ────────────────────────────────────
@router.patch("/{transit_id}/schedule")
async def schedule_transit(
    transit_id: int,
    body: TransitScheduleRequest,
    current_user: dict = Depends(require_role("aj")),
):
    old = _get_or_404(transit_id)
    now_str = _now_str()

    log_entry = {
        "who":    f"{_me_name(current_user)}(AJ관리자)",
        "when":   now_str,
        "before": f"확정일: {old.get('scheduled_date','미정')} / 배차: {old.get('driver_info','미정')}",
        "after":  f"확정일: {body.scheduled_date} / 배차: {body.driver_info or '미정'}",
    }
    change_log = (old.get("change_log") or []) + [log_entry]

    # partner_confirmed 상태에서 AJ가 확정하면 → confirmed (최종확정)
    # 그 외(requested)에서 날짜를 바꾸면 → scheduled (협력사 재확인 필요)
    # 날짜 변경 없으면 → confirmed 직접 확정
    if old.get("status") == "partner_confirmed":
        new_status = "confirmed"
    elif body.status in ("scheduled", "confirmed"):
        new_status = body.status
    else:
        new_status = "scheduled"

    update = {
        "status":         new_status,
        "scheduled_date": body.scheduled_date,
        "aj_equip":       body.aj_equip,
        "vehicle_info":   body.vehicle_info,
        "driver_info":    body.driver_info,
        "change_log":     change_log,
    }
    if body.scheduled_time is not None:
        update["scheduled_time"] = body.scheduled_time
    if body.note is not None:
        update["note"] = body.note
    if new_status == "confirmed":
        update["partner_confirmed_at"] = now_str
        update["confirmed_by_name"] = _me_name(current_user)
    elif new_status == "scheduled":
        update["scheduled_by_name"] = _me_name(current_user)

    supabase.table("transit").update(update).eq("id", transit_id).execute()

    # 협력사에게 알림
    _notify_partner(
        old=old,
        type_="transit",
        title=f"[일정 확정] {old['company']}",
        body=f"확정일: {body.scheduled_date} / 배차: {body.driver_info or '미정'}",
        ref_id=str(transit_id),
    )
    return {"ok": True}


# ─── 협력사 일정 확인완료 ─────────────────────────────────────
@router.patch("/{transit_id}/partner-confirm")
async def partner_confirm_transit(
    transit_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("partner", "aj", "admin"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    old = _get_or_404(transit_id)
    if old["status"] != "scheduled":
        raise HTTPException(status_code=400, detail="협력사 확인 대기 상태가 아닙니다.")
    now_str = _now_str()
    supabase.table("transit").update({
        "status":                    "partner_confirmed",
        "partner_confirmed_at":      now_str,
        "partner_confirmed_by_name": _me_name(current_user),
    }).eq("id", transit_id).execute()
    return {"ok": True}


# ─── 배차정보 등록 (AJ) ───────────────────────────────────────
@router.patch("/{transit_id}/dispatch")
async def dispatch_transit(
    transit_id: int,
    body: TransitDispatchRequest,
    current_user: dict = Depends(require_role("aj")),
):
    patch = {
        "vehicle_info": body.vehicle_info,
        "driver_info":  body.driver_info,
    }
    if body.scheduled_date is not None:
        patch["scheduled_date"] = body.scheduled_date
    if body.scheduled_time is not None:
        patch["scheduled_time"] = body.scheduled_time
    if body.aj_equip is not None:
        patch["aj_equip"] = body.aj_equip
    supabase.table("transit").update(patch).eq("id", transit_id).execute()
    return {"ok": True}


# ─── 수정 (변경이력 자동기록) ─────────────────────────────────
@router.patch("/{transit_id}")
async def update_transit(
    transit_id: int,
    body: TransitUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("partner", "aj"):
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")

    old = _get_or_404(transit_id)
    changes = []
    update = {}

    field_labels = {
        "scheduled_date": "확정일",
        "requested_date": "희망일",
        "vehicle_info":   "배차차량",
        "driver_info":    "배차기사",
        "manager_name":   "양중담당자",
        "manager_phone":  "양중담당자 연락처",
        "note":           "비고",
    }

    for field, label in field_labels.items():
        new_val = getattr(body, field)
        if new_val is not None and new_val != old.get(field):
            changes.append({
                "who":    f"{_me_name(current_user)}({_role_label(current_user['role'])})",
                "when":   _now_str(),
                "before": f"{label}: {old.get(field, '') or '없음'}",
                "after":  f"{label}: {new_val}",
            })
            update[field] = new_val

    if not update:
        return {"ok": True, "message": "변경 사항 없음"}

    change_log = (old.get("change_log") or []) + changes
    update["change_log"] = change_log
    supabase.table("transit").update(update).eq("id", transit_id).execute()

    # 관련자 알림
    _notify_related(
        old=old,
        actor=current_user,
        type_="transit",
        title=f"[일정 변경] {old['company']}",
        body=" | ".join([f"{c['before']} → {c['after']}" for c in changes]),
        ref_id=str(transit_id),
    )
    return {"ok": True}


# ─── 완료 처리 (AJ) ──────────────────────────────────────────
@router.patch("/{transit_id}/complete")
async def complete_transit(
    transit_id: int,
    body: TransitCompleteRequest,
    current_user: dict = Depends(require_role("aj")),
):
    old = _get_or_404(transit_id)
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")

    update = {
        "status":             "completed",
        "completed_at":       now.isoformat(),
        "completed_by_name":  _me_name(current_user),
    }

    if old["type"] == "in":
        # AJ가 입력한 쉼표 구분 장비번호로 장비 레코드 생성
        equip_no_list = [s.strip() for s in (body.equip_nos or "").split(",") if s.strip()]
        equip_specs   = old.get("equip_specs") or []
        flat_specs    = []
        for spec_item in equip_specs:
            flat_specs.extend([spec_item.get("spec", "")] * spec_item.get("qty", 1))

        for i, equip_no in enumerate(equip_no_list):
            spec = flat_specs[i] if i < len(flat_specs) else ""
            supabase.table("equipment").insert({
                "record_id":  f"EQ-{uuid.uuid4().hex[:8].upper()}",
                "equip_no":   equip_no,
                "spec":       spec,
                "site_id":    old["site_id"],
                "site_name":  old["site_name"],
                "company":    old["company"],
                "status":     "in_use",
                "qr_code":    f"AJ-{uuid.uuid4().hex[:8].upper()}",
                "in_date":    today,
                "transit_id": transit_id,
            }).execute()

        update["aj_equip"] = ", ".join(equip_no_list)

    elif old["type"] == "out":
        # 신청 시 등록된 장비번호로 반출 처리
        equip_nos_raw = old.get("aj_equip") or body.equip_nos or ""
        for equip_no in [s.strip() for s in equip_nos_raw.split(",") if s.strip()]:
            supabase.table("equipment").update({
                "status":   "returned",
                "qr_code":  None,
                "out_date": today,
            }).eq("equip_no", equip_no).execute()

    supabase.table("transit").update(update).eq("id", transit_id).execute()

    _notify_partner(
        old=old,
        type_="transit",
        title=f"[{'반입' if old['type']=='in' else '반출'} 완료] {old['company']}",
        body=f"{old['site_name']} 반{'입' if old['type']=='in' else '출'} 처리가 완료되었습니다.",
        ref_id=str(transit_id),
    )
    return {"ok": True}


# ─── 취소 ─────────────────────────────────────────────────────
@router.patch("/{transit_id}/cancel")
async def cancel_transit(
    transit_id: int,
    body: TransitCancelRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("partner", "aj"):
        raise HTTPException(status_code=403, detail="취소 권한이 없습니다.")

    old = _get_or_404(transit_id)
    log_entry = {
        "who":    f"{_me_name(current_user)}({_role_label(current_user['role'])})",
        "when":   _now_str(),
        "before": f"상태: {old['status']}",
        "after":  "취소",
    }
    change_log = (old.get("change_log") or []) + [log_entry]

    supabase.table("transit").update({
        "status":           "cancelled",
        "cancelled_reason": body.cancelled_reason,
        "change_log":       change_log,
    }).eq("id", transit_id).execute()

    _notify_related(
        old=old, actor=current_user,
        type_="transit",
        title=f"[신청 취소] {old['company']}",
        body=f"취소 사유: {body.cancelled_reason}",
        ref_id=str(transit_id),
    )
    return {"ok": True}


# ─── 내부 헬퍼 ────────────────────────────────────────────────
def _get_or_404(transit_id: int) -> dict:
    res = supabase.table("transit").select("*").eq("id", transit_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="신청 내역을 찾을 수 없습니다.")
    return res.data

def _now_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

def _me_name(user: dict) -> str:
    res = supabase.table("app_users").select("name").eq("id", user["sub"]).single().execute()
    return res.data["name"] if res.data else "알 수 없음"

def _role_label(role: str) -> str:
    return {"tech":"기술인","partner":"협력사","aj":"AJ관리자","as_tech":"AS기사"}.get(role, role)

def _specs_str(specs) -> str:
    return ", ".join([f"{s.spec}×{s.qty}" for s in specs])

def _save_notif(target_id, type_, title, body, ref_id=None):
    supabase.table("notifications").insert({
        "target_id": target_id, "type": type_,
        "title": title, "body": body, "ref_id": ref_id,
    }).execute()

def _notify_aj(type_, title, body, ref_id=None):
    ajs = supabase.table("app_users").select("id,push_sub,notif_prefs").eq("role","aj").eq("status","active").execute()
    for u in ajs.data or []:
        _save_notif(u["id"], type_, title, body, ref_id)
        if u.get("push_sub") and (u.get("notif_prefs") or {}).get("transit", True):
            try: send_push(u["push_sub"], title, body)
            except: pass

def _notify_partner(old, type_, title, body, ref_id=None):
    if not old.get("created_by"): return
    user = supabase.table("app_users").select("id,push_sub,notif_prefs").eq("id", old["created_by"]).single().execute()
    if user.data:
        _save_notif(user.data["id"], type_, title, body, ref_id)
        if user.data.get("push_sub") and (user.data.get("notif_prefs") or {}).get("transit", True):
            try: send_push(user.data["push_sub"], title, body)
            except: pass

def _notify_related(old, actor, type_, title, body, ref_id=None):
    notified = set()
    # 신청자
    if old.get("created_by") and old["created_by"] != actor["sub"]:
        _save_notif(old["created_by"], type_, title, body, ref_id)
        notified.add(old["created_by"])
    # AJ관리자
    ajs = supabase.table("app_users").select("id,push_sub,notif_prefs").eq("role","aj").eq("status","active").execute()
    for u in ajs.data or []:
        if u["id"] not in notified and u["id"] != actor["sub"]:
            _save_notif(u["id"], type_, title, body, ref_id)
            notified.add(u["id"])
            if u.get("push_sub") and (u.get("notif_prefs") or {}).get("transit", True):
                try: send_push(u["push_sub"], title, body)
                except: pass
