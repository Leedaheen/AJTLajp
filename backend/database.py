"""
Supabase 클라이언트 초기화
service_role key를 사용해 RLS를 우회합니다 (백엔드 전용).
"""
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
