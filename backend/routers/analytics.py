"""
분석 리포트 라우터 (AJ관리자 전용)
- GET /analytics/as      — AS 현황 분석
- GET /analytics/usage   — 장비 가동률 분석
- GET /analytics/summary — 대시보드 요약 통계
"""
from datetime import datetime, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import supabase

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _date_range(days: int) -> str:
    """오늘로부터 N일 전 날짜 문자열 반환"""
    return (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")


# ─── AS 분석 ─────────────────────────────────────────────────
@router.get("/as")
async def as_analytics(
    site_id: str = None,
    days: int = 30,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "aj":
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    since = _date_range(days)
    query = (
        supabase.table("as_requests")
        .select("*")
        .gte("requested_at", since)
        .order("requested_at", desc=True)
    )
    if site_id:
        query = query.eq("site_id", site_id)

    rows = query.execute().data or []

    # 고장유형별 건수
    by_fault = defaultdict(int)
    for r in rows:
        by_fault[r.get("fault_type") or "기타"] += 1

    # 상태별 건수
    by_status = defaultdict(int)
    for r in rows:
        by_status[r.get("status") or "unknown"] += 1

    # 처리 완료 건만 평균 소요시간 계산
    resolved = [r for r in rows if r.get("status") == "resolved" and r.get("elapsed_min")]
    avg_elapsed = (
        round(sum(r["elapsed_min"] for r in resolved) / len(resolved))
        if resolved else 0
    )

    # 날짜별 신규 접수 건수 (최근 days일)
    by_date = defaultdict(int)
    for r in rows:
        d = (r.get("requested_at") or "")[:10]
        if d:
            by_date[d] += 1

    # 기사별 처리 건수
    by_tech = defaultdict(int)
    for r in rows:
        name = r.get("tech_name") or "미배정"
        by_tech[name] += 1

    return {
        "total": len(rows),
        "by_fault": dict(by_fault),
        "by_status": dict(by_status),
        "by_tech": dict(by_tech),
        "by_date": dict(sorted(by_date.items())),
        "avg_elapsed_min": avg_elapsed,
        "resolved_count": len(resolved),
    }


# ─── 가동률 분석 ─────────────────────────────────────────────
@router.get("/usage")
async def usage_analytics(
    site_id: str = None,
    days: int = 30,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "aj":
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    since = _date_range(days)

    # 사용 기록
    usage_q = (
        supabase.table("usage_logs")
        .select("*")
        .gte("created_at", since)
        .eq("status", "done")
        .order("date", desc=False)
    )
    if site_id:
        usage_q = usage_q.eq("site_id", site_id)
    usage_rows = usage_q.execute().data or []

    # 날짜별 총 가동시간
    by_date = defaultdict(float)
    for r in usage_rows:
        d = r.get("date") or (r.get("created_at") or "")[:10]
        by_date[d] += float(r.get("used_hours") or 0)

    # 제원별 가동시간
    eq_ids = list({r["equip_id"] for r in usage_rows if r.get("equip_id")})
    by_spec = defaultdict(float)
    if eq_ids:
        equip_rows = (
            supabase.table("equipment")
            .select("id,spec")
            .in_("id", eq_ids)
            .execute()
            .data or []
        )
        spec_map = {e["id"]: e.get("spec", "?") for e in equip_rows}
        for r in usage_rows:
            spec = spec_map.get(r.get("equip_id"), "?")
            by_spec[spec] += float(r.get("used_hours") or 0)

    # 업체별 가동시간
    by_company = defaultdict(float)
    for r in usage_rows:
        by_company[r.get("company") or "미입력"] += float(r.get("used_hours") or 0)

    # 현재 사용 중인 장비 수
    active_q = supabase.table("usage_logs").select("id").eq("status", "using")
    if site_id:
        active_q = active_q.eq("site_id", site_id)
    active_count = len(active_q.execute().data or [])

    total_hours = round(sum(by_date.values()), 1)

    return {
        "total_records": len(usage_rows),
        "total_hours": total_hours,
        "active_now": active_count,
        "by_date": {k: round(v, 1) for k, v in sorted(by_date.items())},
        "by_spec": {k: round(v, 1) for k, v in sorted(by_spec.items(), key=lambda x: -x[1])},
        "by_company": {k: round(v, 1) for k, v in sorted(by_company.items(), key=lambda x: -x[1])},
    }


# ─── 장비 현황 분석 ──────────────────────────────────────────
@router.get("/equipment")
async def equipment_analytics(
    site_id: str = None,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "aj":
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    query = supabase.table("equipment").select("*")
    if site_id:
        query = query.eq("site_id", site_id)
    rows = query.execute().data or []

    # 상태별 건수
    by_status = defaultdict(int)
    for r in rows:
        by_status[r.get("status", "?")] += 1

    # 제원별 건수
    by_spec = defaultdict(int)
    for r in rows:
        by_spec[r.get("spec") or "미입력"] += 1

    # 현장별 건수
    by_site = defaultdict(int)
    for r in rows:
        by_site[r.get("site_id") or "미지정"] += 1

    # 업체별 보유 장비 수 (상위 10)
    by_company = defaultdict(int)
    for r in rows:
        by_company[r.get("company") or "미입력"] += 1

    # 최근 반입 장비 (in_date 기준 최근 10건)
    recent = sorted(
        [r for r in rows if r.get("in_date")],
        key=lambda x: x["in_date"],
        reverse=True,
    )[:10]

    return {
        "total": len(rows),
        "by_status": dict(by_status),
        "by_spec": dict(sorted(by_spec.items(), key=lambda x: -x[1])),
        "by_site": dict(by_site),
        "by_company": dict(sorted(by_company.items(), key=lambda x: -x[1])[:10]),
        "recent": [
            {"equip_no": r.get("equip_no"), "spec": r.get("spec"),
             "company": r.get("company"), "in_date": r.get("in_date"),
             "status": r.get("status")}
            for r in recent
        ],
    }


# ─── 대시보드 요약 ────────────────────────────────────────────
@router.get("/summary")
async def dashboard_summary(
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "aj":
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    # 장비 현황
    equip_rows = supabase.table("equipment").select("status,site_id").execute().data or []
    equip_by_site = defaultdict(lambda: defaultdict(int))
    for r in equip_rows:
        equip_by_site[r.get("site_id", "?")][r.get("status", "?")] += 1

    # AS 미처리 건수
    open_as = (
        supabase.table("as_requests")
        .select("id", count="exact")
        .in_("status", ["pending", "assigned", "in_progress"])
        .execute()
    )

    # 이번 달 반입/반출 건수
    month_start = datetime.now().strftime("%Y-%m-01")
    transit_rows = (
        supabase.table("transit")
        .select("type,status")
        .gte("created_at", month_start)
        .execute()
        .data or []
    )

    return {
        "equipment": {site: dict(stats) for site, stats in equip_by_site.items()},
        "open_as_count": open_as.count or 0,
        "monthly_transit": len(transit_rows),
    }
