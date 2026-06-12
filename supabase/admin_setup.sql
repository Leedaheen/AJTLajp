-- ============================================================
-- 관리자 계정 생성 + 비밀번호 검증 함수
-- Supabase 대시보드 → SQL Editor에서 실행하세요.
-- ============================================================

-- ── 1. pgcrypto 활성화 (이미 활성화된 경우 무시됨) ──────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ── 2. 관리자 계정 생성 ──────────────────────────────────────
-- app_users.id 는 auth.users(id) FK 참조이므로
-- auth.users 에도 동일 UUID로 먼저 삽입합니다.

DO $$
DECLARE
  v_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  -- auth.users 에 관리자 항목 삽입 (없을 때만)
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
      crypt('aj1234', gen_salt('bf')),
      'authenticated', 'authenticated',
      now(), now(), now(),
      '', '', '', ''
    );
  END IF;

  -- app_users 에 관리자 프로필 삽입 (없을 때만)
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
      crypt('aj1234', gen_salt('bf')),
      now(), now()
    );
  END IF;
END;
$$;


-- ── 3. 비밀번호 검증 RPC 함수 생성 ──────────────────────────
-- Edge Function 없이 DB 레벨에서 bcrypt 검증합니다.
-- auth.js 에서 _sb.rpc('verify_admin_login', {...}) 로 호출됩니다.

CREATE OR REPLACE FUNCTION verify_admin_login(
  p_local_id text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER   -- RLS 우회 (관리자 전용 함수)
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

  -- 계정 없음
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- 비밀번호 불일치
  IF v_user.pw_hash IS NULL OR
     v_user.pw_hash <> crypt(p_password, v_user.pw_hash) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_password');
  END IF;

  -- 성공: 사용자 정보 반환
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

-- 함수 실행 권한 (anon 포함 — 로그인 전 호출이므로)
GRANT EXECUTE ON FUNCTION verify_admin_login(text, text) TO anon, authenticated;


-- ── 확인용 쿼리 ──────────────────────────────────────────────
-- SELECT local_id, name, role, status FROM app_users WHERE local_id = 'admin';
-- SELECT verify_admin_login('admin', 'aj1234');
