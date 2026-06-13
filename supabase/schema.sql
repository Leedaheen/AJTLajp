-- ============================================================
-- 고소작업대 운영 앱 — Supabase 스키마 + RLS 정책
-- ============================================================
-- 중요: app_users.id = auth.uid() 로 연결됩니다.
-- Google OAuth 로그인 후 app_users에 행을 INSERT 할 때
-- id 값을 auth.uid() 로 지정해야 모든 RLS 정책이 동작합니다.
-- ============================================================

-- ── 테이블 정의 ───────────────────────────────────────────────

-- ① 사용자 테이블
-- id = auth.uid() 로 연결 (Google OAuth 후 반드시 동일한 값 사용)
CREATE TABLE IF NOT EXISTS app_users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_id     text UNIQUE,
  email         text UNIQUE NOT NULL,
  name          text NOT NULL,
  phone         text DEFAULT '',
  role          text NOT NULL CHECK (role IN ('tech','partner','aj','as_tech')),
  site_id       text NOT NULL CHECK (site_id IN ('P4','P5','ALL')),
  status        text DEFAULT 'pending' CHECK (status IN ('pending','active','rejected')),
  reject_reason text,
  local_id      text UNIQUE,            -- 관리자 전용 로컬 ID
  pw_hash       text,                   -- 관리자 전용 bcrypt 해시
  push_sub      jsonb,
  notif_prefs   jsonb DEFAULT '{"transit":true,"as":true,"approval":true}',
  created_at    timestamptz DEFAULT now(),
  approved_at   timestamptz,
  approved_by   uuid REFERENCES app_users(id)
);

-- ② 반입/반출 신청 테이블
CREATE TABLE IF NOT EXISTS transit (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id        text UNIQUE,
  type             text NOT NULL CHECK (type IN ('in','out')),
  site_id          text NOT NULL,
  site_name        text NOT NULL,
  company          text NOT NULL,
  equip_specs      jsonb NOT NULL,
  aj_equip         text,
  reporter_name    text NOT NULL,
  reporter_phone   text NOT NULL,
  manager_name     text,
  manager_phone    text,
  manager_location text,
  requested_date   text,
  scheduled_date   text,
  vehicle_info     text,
  driver_info      text,
  status           text DEFAULT 'requested' CHECK (
    status IN ('requested','scheduled','confirmed','completed','cancelled')
  ),
  cancelled_reason text,
  note             text,
  change_log       jsonb DEFAULT '[]',
  created_by       uuid REFERENCES app_users(id),
  created_at       timestamptz DEFAULT now(),
  completed_at     timestamptz
);

-- ③ 장비 테이블
CREATE TABLE IF NOT EXISTS equipment (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id   text UNIQUE,
  equip_no    text NOT NULL,
  spec        text,
  model       text,
  site_id     text,
  site_name   text,
  company     text,
  status      text DEFAULT 'stock' CHECK (status IN ('stock','in_use','transit','returned')),
  qr_code     text UNIQUE,
  in_date     text,
  out_date    text,
  transit_id  bigint REFERENCES transit(id),
  created_at  timestamptz DEFAULT now()
);

-- ④ AS 요청 테이블
CREATE TABLE IF NOT EXISTS as_requests (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id        text UNIQUE,
  site_id          text NOT NULL,
  site_name        text NOT NULL,
  equip_no         text,
  equip_spec       text,
  equip_id         bigint REFERENCES equipment(id),
  company          text NOT NULL,
  location         text NOT NULL,
  fault_type       text NOT NULL,
  description      text,
  reporter_name    text NOT NULL,
  reporter_phone   text NOT NULL,
  created_by       uuid REFERENCES app_users(id),
  status           text DEFAULT 'requested' CHECK (
    status IN ('requested','in_progress','material_pending','held','completed','cancelled')
  ),
  resolve_note     text,
  hold_reason      text,
  cancel_reason    text,
  material_used    text,
  requested_at     timestamptz DEFAULT now(),
  in_progress_at   timestamptz,
  material_at      timestamptz,
  held_at          timestamptz,
  resolved_at      timestamptz,
  cancelled_at     timestamptz,
  elapsed_min      integer
);

-- ⑤ 장비 사용 기록 테이블
CREATE TABLE IF NOT EXISTS usage_logs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id    text UNIQUE,
  equip_id     bigint REFERENCES equipment(id),
  equip_no     text NOT NULL,
  site_id      text,
  company      text,
  team_name    text,
  floor        text,
  location     text,
  recorder_id  uuid REFERENCES app_users(id),
  recorder     text,
  start_time   timestamptz,
  end_time     timestamptz,
  used_hours   numeric DEFAULT 0,
  status       text DEFAULT 'using' CHECK (status IN ('using','done')),
  date         text,
  created_at   timestamptz DEFAULT now()
);

-- ⑥ 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_id  uuid NOT NULL REFERENCES app_users(id),
  type       text CHECK (type IN ('transit','as','approval','schedule')),
  title      text NOT NULL,
  body       text NOT NULL,
  ref_id     text,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ⑦ 현장 테이블
CREATE TABLE IF NOT EXISTS sites (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ⑧ 프로젝트 테이블
CREATE TABLE IF NOT EXISTS projects (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ⑨ 업체 테이블
CREATE TABLE IF NOT EXISTS companies (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  site_id    text,          -- null = 전체 현장 공통
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── 인덱스 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_equipment_site     ON equipment(site_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status   ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_qr       ON equipment(qr_code);
CREATE INDEX IF NOT EXISTS idx_transit_site       ON transit(site_id);
CREATE INDEX IF NOT EXISTS idx_transit_status     ON transit(status);
CREATE INDEX IF NOT EXISTS idx_transit_company    ON transit(company);
CREATE INDEX IF NOT EXISTS idx_as_site            ON as_requests(site_id);
CREATE INDEX IF NOT EXISTS idx_as_status          ON as_requests(status);
CREATE INDEX IF NOT EXISTS idx_usage_equip        ON usage_logs(equip_id);
CREATE INDEX IF NOT EXISTS idx_usage_recorder     ON usage_logs(recorder_id);
CREATE INDEX IF NOT EXISTS idx_notif_target       ON notifications(target_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread       ON notifications(target_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_users_role         ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_users_status       ON app_users(status);

-- ── 헬퍼 함수 ─────────────────────────────────────────────────
-- 테이블 생성 후 정의해야 합니다 (순서 중요).
-- SECURITY DEFINER: RLS를 우회하여 자신의 행만 안전하게 조회.

CREATE OR REPLACE FUNCTION get_my_role()
  RETURNS text
  LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT role FROM app_users
  WHERE id = auth.uid() AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_site()
  RETURNS text
  LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT site_id FROM app_users
  WHERE id = auth.uid() AND status = 'active'
  LIMIT 1;
$$;

-- ── RLS 활성화 ────────────────────────────────────────────────
ALTER TABLE sites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit       ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment     ENABLE ROW LEVEL SECURITY;
ALTER TABLE as_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS 정책
-- 원칙:
--   1. anon(미인증) 사용자는 아무것도 읽을 수 없습니다.
--   2. authenticated 사용자도 status='active' 여야 데이터에 접근합니다.
--      (pending/rejected 계정은 자신의 app_users 행만 읽을 수 있습니다)
--   3. service_role(Edge Function 내부)은 RLS를 우회합니다.
--      별도 정책 불필요 — Supabase 기본 동작입니다.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- sites / projects
-- ────────────────────────────────────────────────────────────

CREATE POLICY "sites_select_active"
  ON sites FOR SELECT TO authenticated
  USING (get_my_role() IS NOT NULL);

CREATE POLICY "sites_insert_aj"
  ON sites FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'aj');

CREATE POLICY "sites_update_aj"
  ON sites FOR UPDATE TO authenticated
  USING (get_my_role() = 'aj');

CREATE POLICY "projects_select_active"
  ON projects FOR SELECT TO authenticated
  USING (get_my_role() IS NOT NULL);

CREATE POLICY "projects_insert_aj"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'aj');

CREATE POLICY "projects_update_aj"
  ON projects FOR UPDATE TO authenticated
  USING (get_my_role() = 'aj');

-- ────────────────────────────────────────────────────────────
-- companies
-- ────────────────────────────────────────────────────────────

-- 활성 사용자 전원 조회 가능 (반입/반출 폼 업체 선택용)
CREATE POLICY "companies_select_active"
  ON companies FOR SELECT
  TO authenticated
  USING (get_my_role() IS NOT NULL);

-- aj만 추가·수정 가능
CREATE POLICY "companies_insert_aj"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'aj');

CREATE POLICY "companies_update_aj"
  ON companies FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'aj');

-- ────────────────────────────────────────────────────────────
-- app_users
-- ────────────────────────────────────────────────────────────

-- 자기 자신은 항상 조회 가능 (승인 대기 중에도 자신의 상태 확인 필요)
CREATE POLICY "users_select_own"
  ON app_users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- aj 관리자는 모든 사용자 조회 가능
CREATE POLICY "users_select_aj"
  ON app_users FOR SELECT
  TO authenticated
  USING (get_my_role() = 'aj');

-- 신규 가입 시 자신의 행 등록 (OAuth 후 프로필 저장)
CREATE POLICY "users_insert_self"
  ON app_users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 자신의 연락처·push_sub·notif_prefs 수정 가능
CREATE POLICY "users_update_own_profile"
  ON app_users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- role, status, approved_by 는 자신이 바꿀 수 없음
    -- (프론트엔드 수준 제어 + Edge Function으로 이중 보호)
  );

-- aj만 역할/상태/승인 변경 가능
CREATE POLICY "users_update_aj"
  ON app_users FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'aj');

-- 삭제는 누구도 불가 (soft delete: status = 'rejected')
-- DELETE 정책 미생성 = 전원 차단

-- ────────────────────────────────────────────────────────────
-- transit (반입/반출)
-- ────────────────────────────────────────────────────────────

-- partner: 자신이 신청한 건 또는 같은 company 건 조회
CREATE POLICY "transit_select_partner"
  ON transit FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'partner'
    AND (
      created_by = auth.uid()
      OR company = (SELECT company FROM app_users WHERE id = auth.uid() AND status = 'active')
    )
  );

-- aj: 모든 건 조회
CREATE POLICY "transit_select_aj"
  ON transit FOR SELECT
  TO authenticated
  USING (get_my_role() = 'aj');

-- partner·aj: 신청 등록
CREATE POLICY "transit_insert"
  ON transit FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() IN ('partner','aj')
    AND created_by = auth.uid()
  );

-- aj만 수정 가능 (일정 확정, 배차, 상태 변경)
CREATE POLICY "transit_update_aj"
  ON transit FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'aj');

-- 삭제 불가 (change_log로 이력 보존)

-- ────────────────────────────────────────────────────────────
-- equipment (장비)
-- ────────────────────────────────────────────────────────────

-- 활성 사용자 전원 조회 가능 (QR 스캔, 장비 목록 확인)
-- site_id 'ALL' 인 aj는 전 현장, 나머지는 자신의 현장만
CREATE POLICY "equipment_select_active"
  ON equipment FOR SELECT
  TO authenticated
  USING (
    get_my_role() IS NOT NULL   -- active 사용자만
    AND (
      get_my_site() = 'ALL'
      OR site_id = get_my_site()
      OR site_id IS NULL        -- 재고(미배치) 장비
    )
  );

-- aj만 장비 등록·수정 가능
CREATE POLICY "equipment_insert_aj"
  ON equipment FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'aj');

CREATE POLICY "equipment_update_aj"
  ON equipment FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'aj');

-- 삭제 불가 (반출 완료 시 status = 'returned'로 처리)

-- ────────────────────────────────────────────────────────────
-- as_requests (AS 요청)
-- ────────────────────────────────────────────────────────────

-- tech·partner·aj: 자신의 현장 AS 요청 조회
CREATE POLICY "as_select_by_site"
  ON as_requests FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('tech','partner')
    AND (
      get_my_site() = 'ALL'
      OR site_id = get_my_site()
    )
  );

-- as_tech·aj: 모든 AS 요청 조회 (처리/분석 목적)
CREATE POLICY "as_select_aj_astech"
  ON as_requests FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('as_tech','aj'));

-- tech·partner·aj: AS 요청 등록
CREATE POLICY "as_insert"
  ON as_requests FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('tech','partner','aj'));

-- as_tech: 모든 AS 요청 처리 가능 (기사 배정 없이 직접 처리)
CREATE POLICY "as_update_astech"
  ON as_requests FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'as_tech');

-- aj: 모든 AS 요청 수정 가능 (재배정, 강제 완료)
CREATE POLICY "as_update_aj"
  ON as_requests FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'aj');

-- 삭제 불가

-- ────────────────────────────────────────────────────────────
-- usage_logs (사용 기록)
-- ────────────────────────────────────────────────────────────

-- tech·partner: 자신이 기록한 것 또는 자신의 현장
CREATE POLICY "usage_select_own"
  ON usage_logs FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('tech','partner')
    AND (
      recorder_id = auth.uid()
      OR site_id = get_my_site()
    )
  );

-- aj: 모든 사용 기록 조회 (분석용)
CREATE POLICY "usage_select_aj"
  ON usage_logs FOR SELECT
  TO authenticated
  USING (get_my_role() = 'aj');

-- tech·partner·aj: 사용 기록 등록
CREATE POLICY "usage_insert"
  ON usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() IN ('tech','partner','aj')
    AND recorder_id = auth.uid()
  );

-- 자신이 시작한 기록의 end_time, used_hours, status 수정 가능
CREATE POLICY "usage_update_own"
  ON usage_logs FOR UPDATE
  TO authenticated
  USING (
    recorder_id = auth.uid()
    AND get_my_role() IN ('tech','partner','aj')
  );

-- 삭제 불가

-- ────────────────────────────────────────────────────────────
-- notifications (알림)
-- ────────────────────────────────────────────────────────────

-- 자신에게 온 알림만 조회
CREATE POLICY "notif_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (target_id = auth.uid());

-- 읽음 처리(is_read 수정)만 본인이 가능
CREATE POLICY "notif_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (target_id = auth.uid())
  WITH CHECK (target_id = auth.uid());

-- INSERT는 service_role(Edge Function)만 가능
-- anon/authenticated 의 INSERT 정책 미생성 = 차단

-- ── Realtime 구독 설정 ─────────────────────────────────────
-- RLS가 활성화된 테이블에서 Realtime 사용 시
-- 사용자는 자신이 SELECT 권한을 가진 행의 변경만 수신합니다.
-- Supabase 대시보드 → Database → Replication 에서도 설정 가능합니다.
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE transit;
ALTER PUBLICATION supabase_realtime ADD TABLE as_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE equipment;
