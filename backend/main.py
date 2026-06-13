"""
고소작업대 운영 앱 — FastAPI 백엔드 진입점
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from config import FRONTEND_URL
from database import supabase
from routers import users, notifications, transit, equipment, as_requests, usage_logs, analytics, parse_doc
from passlib.context import CryptContext

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작 시 기본 관리자 계정이 없으면 자동 생성합니다."""
    existing = supabase.table("app_users").select("id").eq("local_id", "admin").execute()
    if not existing.data:
        supabase.table("app_users").insert({
            "google_id": "__admin_local__",
            "email":     "admin@local",
            "name":      "관리자",
            "role":      "aj",
            "site_id":   "ALL",
            "status":    "active",
            "local_id":  "admin",
            "pw_hash":   _pwd.hash("aj1234"),
        }).execute()
    yield

app = FastAPI(
    title="AJ 고소작업대 운영 API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    lifespan=lifespan,
)

# CORS — 프론트엔드 도메인만 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(users.router,         prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(transit.router,       prefix="/api")
app.include_router(equipment.router,     prefix="/api")
app.include_router(as_requests.router,   prefix="/api")
app.include_router(usage_logs.router,    prefix="/api")
app.include_router(analytics.router,     prefix="/api")
app.include_router(parse_doc.router,     prefix="/api")

# 프론트엔드 정적 파일 서빙
_frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(_frontend_dir):
    app.mount("/", StaticFiles(directory=_frontend_dir, html=True), name="frontend")


@app.get("/api/health")
async def health():
    """서버 상태 확인"""
    return {"status": "ok"}
