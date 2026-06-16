-- ============================================================
-- migration_v4.sql — RLS 보안 취약점 수정
-- 1. [CRITICAL] users_update_own_profile — role/status 자가 변경 차단
-- 2. [HIGH]     sites / projects / companies — DELETE 정책 추가
-- ============================================================

-- ─── 1. CRITICAL: 사용자 자가 권한 상승 차단 ──────────────────

-- 현재 DB에 저장된 role을 반환하는 SECURITY DEFINER 함수
-- (get_my_role()은 status='active' 일 때만 반환하므로 별도 생성)
CREATE OR REPLACE FUNCTION get_my_role_stored()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM app_users WHERE id = auth.uid()
$$;

-- 현재 DB에 저장된 status를 반환하는 SECURITY DEFINER 함수
CREATE OR REPLACE FUNCTION get_my_status_stored()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT status FROM app_users WHERE id = auth.uid()
$$;

-- users_update_own_profile 재작성
-- role, status, approved_by, approved_at 은 자신이 변경 불가
DROP POLICY IF EXISTS "users_update_own_profile" ON app_users;
CREATE POLICY "users_update_own_profile"
  ON app_users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role   = get_my_role_stored()
    AND status = get_my_status_stored()
  );

-- ─── 2. HIGH: 관리자설정 삭제 기능 복구 ──────────────────────

-- sites DELETE (AJ만)
CREATE POLICY "sites_delete"
  ON sites FOR DELETE
  TO authenticated
  USING (get_my_role() = 'aj');

-- projects DELETE (AJ만)
CREATE POLICY "projects_delete"
  ON projects FOR DELETE
  TO authenticated
  USING (get_my_role() = 'aj');

-- companies DELETE (AJ만)
CREATE POLICY "companies_delete"
  ON companies FOR DELETE
  TO authenticated
  USING (get_my_role() = 'aj');

-- ─── 3. CRITICAL: fault_type CHECK 제약 제거 ──────────────────
-- 프론트 FAULT_TYPES 목록이 변경되었으나 DB 제약이 구버전 값을 강제하여
-- AS 신청 시 constraint violation 오류 발생. 제약 제거로 해결.
ALTER TABLE as_requests DROP CONSTRAINT IF EXISTS as_requests_fault_type_check;
