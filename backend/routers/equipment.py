"""
장비 관리 라우터
- 목록 조회 (검색: 업체명/장비번호/위치/제원/상태)
- 상세 조회
- QR 스캔 → 장비 정보 반환
- 추가 / 수정 (AJ)
"""
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user, require_role
from database import supabase
from models.equipment import EquipmentCreateRequest, EquipmentUpdateRequest
import uuid

router = APIRouter(prefix="/equipment", tags=["equipment"])


# ─── 목록 조회 ────────────────────────────────────────────────
@router.get("")
async def list_equipment(
    status: str = None,
    site_id: str = None,
    spec: str = None,
    company: str = None,
    q: str = None,       # 통합 검색 (장비번호/업체명)
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    order_col = "out_date" if status == "returned" else "in_date"
    query = supabase.table("equipment").select("*").order(order_col, desc=True, nullsfirst=False).limit(limit)

    role = current_user["role"]
    user_client = current_user.get("client_name", "")
    if role not in ("aj", "admin") and user_client:
        query = query.eq("client_name", user_client)

    if status:  query = query.eq("status", status)
    if site_id: query = query.eq("site_id", site_id)
    if spec:    query = query.eq("spec", spec)
    if company: query = query.ilike("company", f"%{company}%")

    res = query.execute()
    data = res.data or []

    # 통합 검색 (서버 필터링)
    if q:
        q_lower = q.lower()
        data = [
            e for e in data
            if q_lower in (e.get("equip_no") or "").lower()
            or q_lower in (e.get("company") or "").lower()
            or q_lower in (e.get("spec") or "").lower()
            or q_lower in (e.get("site_name") or "").lower()
        ]
    return data


# ─── 상세 조회 ────────────────────────────────────────────────
@router.get("/{equip_id}")
async def get_equipment(equip_id: int, current_user: dict = Depends(get_current_user)):
    res = supabase.table("equipment").select("*").eq("id", equip_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다.")
    return res.data


# ─── QR 스캔 ─────────────────────────────────────────────────
@router.get("/qr/{qr_code}")
async def scan_qr(qr_code: str, current_user: dict = Depends(get_current_user)):
    res = supabase.table("equipment").select("*").eq("qr_code", qr_code).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="등록되지 않은 QR코드입니다.")

    equip = res.data

    # 현재 사용 중인지 확인
    usage = supabase.table("usage_logs")\
        .select("team_name,recorder,floor")\
        .eq("equip_id", equip["id"])\
        .eq("status", "using")\
        .execute()

    return {
        **equip,
        "current_usage": usage.data[0] if usage.data else None,
    }


# ─── 장비 추가 (AJ) ──────────────────────────────────────────
@router.post("")
async def create_equipment(
    body: EquipmentCreateRequest,
    current_user: dict = Depends(require_role("aj")),
):
    record_id = f"EQ-{uuid.uuid4().hex[:8].upper()}"
    data = {
        "record_id": record_id,
        "equip_no":  body.equip_no,
        "spec":      body.spec,
        "model":     body.model,
        "site_id":   body.site_id,
        "site_name": body.site_name,
        "company":   body.company,
        "status":    "stock",
    }
    res = supabase.table("equipment").insert(data).execute()
    return res.data[0]


# ─── 장비 수정 (AJ) ──────────────────────────────────────────
@router.patch("/{equip_id}")
async def update_equipment(
    equip_id: int,
    body: EquipmentUpdateRequest,
    current_user: dict = Depends(require_role("aj")),
):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        return {"ok": True}
    supabase.table("equipment").update(update).eq("id", equip_id).execute()
    return {"ok": True}
