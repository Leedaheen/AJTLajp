"""
고소작업대 운영 앱 — FastAPI 백엔드 진입점
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import FRONTEND_URL
from routers import users, notifications

app = FastAPI(
    title="AJ 고소작업대 운영 API",
    version="1.0.0",
    docs_url="/api/docs",   # Swagger UI
    redoc_url=None,
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

# 프론트엔드 정적 파일 서빙 (같은 서버에서 배포할 때)
# app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")


@app.get("/api/health")
async def health():
    """서버 상태 확인"""
    return {"status": "ok"}
