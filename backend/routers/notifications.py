"""알림 라우터 — 조회, 읽음 처리"""
from fastapi import APIRouter, Depends
from auth import get_current_user
from database import supabase

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(current_user: dict = Depends(get_current_user)):
    """내 알림 목록을 최신순으로 반환합니다."""
    res = (
        supabase.table("notifications")
        .select("*")
        .eq("target_id", current_user["sub"])
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return res.data


@router.patch("/{notif_id}/read")
async def mark_read(notif_id: int, current_user: dict = Depends(get_current_user)):
    """알림을 읽음 처리합니다."""
    supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).eq("target_id", current_user["sub"]).execute()
    return {"ok": True}


@router.patch("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    """모든 알림을 읽음 처리합니다."""
    supabase.table("notifications").update({"is_read": True}).eq("target_id", current_user["sub"]).execute()
    return {"ok": True}
