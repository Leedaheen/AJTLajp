"""
환경변수 로드 모듈
모든 설정값은 .env 파일에서 읽어옵니다. 코드에 직접 입력하지 마세요.
"""
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL        = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

GOOGLE_CLIENT_ID    = os.environ["GOOGLE_CLIENT_ID"]

JWT_SECRET          = os.environ["JWT_SECRET"]
JWT_EXPIRE_HOURS    = int(os.getenv("JWT_EXPIRE_HOURS", "72"))

VAPID_PUBLIC_KEY    = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY   = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_EMAIL         = os.getenv("VAPID_EMAIL", "mailto:admin@example.com")

FRONTEND_URL        = os.getenv("FRONTEND_URL", "http://localhost:3000")
