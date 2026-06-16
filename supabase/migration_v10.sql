-- migration_v10.sql — admin 역할을 모든 RLS 정책에 추가
-- admin은 aj와 동일한 권한을 가져야 하나, 기존 정책에 누락되어 있어
-- transit 신청/조회, AS 신청/조회, 장비 관리 등이 모두 차단되던 문제 수정

-- ── sites ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "sites_insert_aj" ON sites;
DROP POLICY IF EXISTS "sites_update_aj" ON sites;
CREATE POLICY "sites_insert_aj" ON sites FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('aj','admin'));
CREATE POLICY "sites_update_aj" ON sites FOR UPDATE TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- ── projects ───────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_insert_aj" ON projects;
DROP POLICY IF EXISTS "projects_update_aj" ON projects;
CREATE POLICY "projects_insert_aj" ON projects FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('aj','admin'));
CREATE POLICY "projects_update_aj" ON projects FOR UPDATE TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- ── companies ──────────────────────────────────────────────
DROP POLICY IF EXISTS "companies_insert_aj" ON companies;
DROP POLICY IF EXISTS "companies_update_aj" ON companies;
CREATE POLICY "companies_insert_aj" ON companies FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('aj','admin'));
CREATE POLICY "companies_update_aj" ON companies FOR UPDATE TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- ── app_users ──────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_aj" ON app_users;
DROP POLICY IF EXISTS "users_update_aj" ON app_users;
CREATE POLICY "users_select_aj" ON app_users FOR SELECT TO authenticated
  USING (get_my_role() IN ('aj','admin'));
CREATE POLICY "users_update_aj" ON app_users FOR UPDATE TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- ── transit ────────────────────────────────────────────────
DROP POLICY IF EXISTS "transit_select_aj"  ON transit;
DROP POLICY IF EXISTS "transit_insert"     ON transit;
DROP POLICY IF EXISTS "transit_update_aj"  ON transit;

-- admin: 모든 건 조회
CREATE POLICY "transit_select_aj" ON transit FOR SELECT TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- partner·aj·admin: 신청 등록
CREATE POLICY "transit_insert" ON transit FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('partner','aj','admin')
    AND created_by = auth.uid()
  );

-- aj·admin: 모든 건 수정 가능
CREATE POLICY "transit_update_aj" ON transit FOR UPDATE TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- ── equipment ──────────────────────────────────────────────
DROP POLICY IF EXISTS "equipment_insert_aj" ON equipment;
DROP POLICY IF EXISTS "equipment_update_aj" ON equipment;
CREATE POLICY "equipment_insert_aj" ON equipment FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('aj','admin'));
CREATE POLICY "equipment_update_aj" ON equipment FOR UPDATE TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- ── as_requests ────────────────────────────────────────────
DROP POLICY IF EXISTS "as_select_aj_astech" ON as_requests;
DROP POLICY IF EXISTS "as_insert"           ON as_requests;
DROP POLICY IF EXISTS "as_update_aj"        ON as_requests;

CREATE POLICY "as_select_aj_astech" ON as_requests FOR SELECT TO authenticated
  USING (get_my_role() IN ('as_tech','aj','admin'));

CREATE POLICY "as_insert" ON as_requests FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('tech','partner','aj','admin'));

CREATE POLICY "as_update_aj" ON as_requests FOR UPDATE TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- ── usage_logs ─────────────────────────────────────────────
DROP POLICY IF EXISTS "usage_select_aj"  ON usage_logs;
DROP POLICY IF EXISTS "usage_insert"     ON usage_logs;
DROP POLICY IF EXISTS "usage_update_own" ON usage_logs;

CREATE POLICY "usage_select_aj" ON usage_logs FOR SELECT TO authenticated
  USING (get_my_role() IN ('aj','admin'));

CREATE POLICY "usage_insert" ON usage_logs FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('tech','partner','aj','admin')
    AND recorder_id = auth.uid()
  );

CREATE POLICY "usage_update_own" ON usage_logs FOR UPDATE TO authenticated
  USING (
    recorder_id = auth.uid()
    AND get_my_role() IN ('tech','partner','aj','admin')
  );
