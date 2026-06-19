"""
사용 기록 라우터 — usage_logs 테이블 사용
- 가동 시작 (POST)
- 가동 종료 (PATCH /{id}/end)
- 목록 조회 (GET) — 날짜/현장/장비 필터
- 일별 요약 (GET /summary)
"""
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import supabase
from models.usage_log import UsageLogStartRequest, UsageLogEndRequest

router = APIRouter(prefix="/usage-logs", tags=["usage-logs"])


def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")

def _now_time() -> str:
    return datetime.now().strftime("%H:%M")


# ─── 목록 조회 ────────────────────────────────────────────────
@router.get("")
async def list_logs(
    date: str = None,
    site_id: str = None,
    equip: str = None,
    status: str = None,
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    query = supabase.table("usage_logs").select("*").order("created_at", desc=True).limit(limit)

    role = current_user["role"]
    user_client = current_user.get("client_name", "")
    if role not in ("aj", "admin", "as_tech") and user_client:
        query = query.eq("client_name", user_client)
    if role == "partner":
        query = query.eq("site_id", current_user["site_id"])
    elif role == "tech":
        query = query.eq("recorder", current_user.get("name", ""))

    if date:    query = query.eq("date", date)
    if site_id: query = query.eq("site_id", site_id)
    if equip:   query = query.ilike("equip_no", f"%{equip}%")
    if status:  query = query.eq("status", status)

    return (query.execute()).data or []


# ─── 일별 요약 ────────────────────────────────────────────────
@router.get("/summary")
async def summary(
    date: str = None,
    site_id: str = None,
    current_user: dict = Depends(get_current_user),
):
    target_date = date or _today()

    # 오늘 기록 (완료+가동중 모두 포함)
    query = supabase.table("usage_logs").select("*").eq("date", target_date)
    if site_id: query = query.eq("site_id", site_id)
    rows = (query.execute()).data or []

    done_rows   = [r for r in rows if r.get("status") == "done"]
    total_hours = sum(float(r.get("used_hours") or 0) for r in done_rows)
    equip_set   = {r["equip_no"] for r in rows if r.get("equip_no")}
    by_equip    = {}
    for r in done_rows:
        eq = r.get("equip_no", "-")
        by_equip[eq] = round(by_equip.get(eq, 0) + float(r.get("used_hours") or 0), 2)

    # 현장 전체 가동 중 장비 수 (equipment.status = 'in_use')
    eq_query = supabase.table("equipment").select("id", count="exact").eq("status", "in_use")
    if site_id: eq_query = eq_query.eq("site_id", site_id)
    total_in_use = eq_query.execute().count or 0

    utilization = round(len(equip_set) / total_in_use * 100, 1) if total_in_use > 0 else 0

    return {
        "date":          target_date,
        "total_hours":   round(total_hours, 2),
        "equip_count":   len(equip_set),
        "record_count":  len(rows),
        "total_in_use":  total_in_use,
        "utilization":   utilization,
        "by_equip":      by_equip,
    }


# ─── 가동 시작 ────────────────────────────────────────────────
@router.post("")
async def start_log(body: UsageLogStartRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("tech", "partner", "aj"):
        raise HTTPException(status_code=403, detail="가동 기록 권한이 없습니다.")

    # 같은 장비 진행 중 체크
    existing = supabase.table("usage_logs")\
        .select("id").eq("equip_no", body.equip).eq("status", "using").execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="해당 장비가 이미 가동 중입니다.")

    today     = _today()
    now_time  = _now_time()
    record_id = f"LOG-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

    data = {
        "record_id":   record_id,
        "date":        today,
        "site_id":     body.site_id,
        "company":     body.company,
        "equip_no":    body.equip,
        "floor":       body.floor,
        "recorder":    body.recorder,
        "client_name": current_user.get("client_name", ""),
        "status":      "using",
        "start_time":  now_time,
        "used_hours":  0,
    }
    res = supabase.table("usage_logs").insert(data).execute()
    return res.data[0]


# ─── 가동 종료 ────────────────────────────────────────────────
@router.patch("/{log_id}/end")
async def end_log(
    log_id: int,
    body: UsageLogEndRequest,
    current_user: dict = Depends(get_current_user),
):
    row = supabase.table("usage_logs").select("*").eq("id", log_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")

    old = row.data
    if old["status"] != "using":
        raise HTTPException(status_code=400, detail="이미 종료된 기록입니다.")

    # 사용 시간 계산
    used_hours = 0.0
    try:
        fmt      = "%H:%M"
        start_dt = datetime.strptime(old["start_time"], fmt)
        end_dt   = datetime.strptime(body.end_time, fmt)
        delta    = (end_dt - start_dt).total_seconds() / 3600
        if delta < 0:
            delta += 24  # 자정 넘긴 케이스
        used_hours = round(delta, 2)
    except Exception:
        pass

    supabase.table("usage_logs").update({
        "status":     "done",
        "end_time":   body.end_time,
        "used_hours": used_hours,
    }).eq("id", log_id).execute()

    return {"ok": True, "used_hours": used_hours}


# ─── 단건 조회 ────────────────────────────────────────────────
@router.get("/{log_id}")
async def get_log(log_id: int, current_user: dict = Depends(get_current_user)):
    res = supabase.table("usage_logs").select("*").eq("id", log_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
    return res.data
