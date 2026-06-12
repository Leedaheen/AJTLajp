-- ============================================================
-- 관리자 계정 생성 + 비밀번호 검증 함수
-- pgcrypto 불필요 — PostgreSQL 기본 내장 md5() 사용
-- Supabase 대시보드 → SQL Editor에서 실행하세요.
-- ============================================================

-- ── 1. auth.users + app_users 에 관리자 계정 삽입 ────────────
DO $$
DECLARE
  v_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  -- auth.users 에 관리자 항목 삽입 (FK 충족용)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_admin_id) THEN
    INSERT INTO auth.users (
      id, instance_id,
      email, encrypted_password,
      aud, role,
      email_confirmed_at,
      created_at, updated_at,
      confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@aj-internal.local',
      md5('aj1234'),          -- auth 테이블용 (실제 로그인에 사용 안 됨)
      'authenticated', 'authenticated',
      now(), now(), now(),
      '', '', '', ''
    );
  END IF;

  -- app_users 에 관리자 프로필 삽입
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE local_id = 'admin') THEN
    INSERT INTO app_users (
      id, email, name, phone,
      role, site_id, status,
      local_id, pw_hash,
      created_at, approved_at
    ) VALUES (
      v_admin_id,
      'admin@aj-internal.local',
      'AJ관리자',
      '010-0000-0000',
      'aj', 'ALL', 'active',
      'admin',
      md5('aj1234'),          -- md5 해시로 저장
      now(), now()
    );
  END IF;
END;
$$;


-- ── 2. 비밀번호 검증 RPC 함수 (md5 비교) ────────────────────
CREATE OR REPLACE FUNCTION verify_admin_login(
  p_local_id text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user app_users;
BEGIN
  SELECT * INTO v_user
  FROM app_users
  WHERE local_id = p_local_id
    AND status = 'active'
  LIMIT 1;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- md5 해시 비교
  IF v_user.pw_hash IS NULL OR v_user.pw_hash <> md5(p_password) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_password');
  END IF;

  RETURN jsonb_build_object(
    'ok',      true,
    'id',      v_user.id,
    'email',   v_user.email,
    'name',    v_user.name,
    'role',    v_user.role,
    'site_id', v_user.site_id,
    'status',  v_user.status,
    'phone',   v_user.phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION verify_admin_login(text, text) TO anon, authenticated;


-- ── 확인 쿼리 ────────────────────────────────────────────────
-- SELECT verify_admin_login('admin', 'aj1234');
-- 결과: {"ok": true, "id": "...", "name": "AJ관리자", ...}
