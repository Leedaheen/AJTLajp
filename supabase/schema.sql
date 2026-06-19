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
  project          text,
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
  cancelled_reason       text,
  note                   text,
  change_log             jsonb DEFAULT '[]',
  created_by             uuid REFERENCES app_users(id),
  created_at             timestamptz DEFAULT now(),
  completed_at           timestamptz,
  partner_confirmed_at   timestamptz
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
  project     text,
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
  tech_name        text,
  tech_phone       text,
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
--
-- 주의: DROP POLICY IF EXISTS 로 기존 정책을 완전히 제거 후 재생성합니다.
--   Supabase 테이블 에디터로 자동 생성된 default 정책과의 충돌을 방지합니다.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 기존 정책 전체 삭제 (충돌 방지)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sites_select_active"           ON sites;
DROP POLICY IF EXISTS "sites_insert_aj"               ON sites;
DROP POLICY IF EXISTS "sites_update_aj"               ON sites;
DROP POLICY IF EXISTS "sites_delete_aj"               ON sites;

DROP POLICY IF EXISTS "projects_select_active"        ON projects;
DROP POLICY IF EXISTS "projects_insert_aj"            ON projects;
DROP POLICY IF EXISTS "projects_update_aj"            ON projects;
DROP POLICY IF EXISTS "projects_delete_aj"            ON projects;

DROP POLICY IF EXISTS "companies_select_active"       ON companies;
DROP POLICY IF EXISTS "companies_insert_aj"           ON companies;
DROP POLICY IF EXISTS "companies_update_aj"           ON companies;
DROP POLICY IF EXISTS "companies_delete_aj"           ON companies;

DROP POLICY IF EXISTS "users_select_own"              ON app_users;
DROP POLICY IF EXISTS "users_select_aj"               ON app_users;
DROP POLICY IF EXISTS "users_insert_self"             ON app_users;
DROP POLICY IF EXISTS "users_update_own_profile"      ON app_users;
DROP POLICY IF EXISTS "users_update_aj"               ON app_users;

DROP POLICY IF EXISTS "transit_select_partner"        ON transit;
DROP POLICY IF EXISTS "transit_select_aj"             ON transit;
DROP POLICY IF EXISTS "transit_insert"                ON transit;
DROP POLICY IF EXISTS "transit_update_aj"             ON transit;
DROP POLICY IF EXISTS "transit_update_partner_confirm" ON transit;
DROP POLICY IF EXISTS "transit_update_partner_cancel" ON transit;

DROP POLICY IF EXISTS "equipment_select_active"       ON equipment;
DROP POLICY IF EXISTS "equipment_insert_aj"           ON equipment;
DROP POLICY IF EXISTS "equipment_update_aj"           ON equipment;

DROP POLICY IF EXISTS "as_select_by_site"             ON as_requests;
DROP POLICY IF EXISTS "as_select_aj_astech"           ON as_requests;
DROP POLICY IF EXISTS "as_insert"                     ON as_requests;
DROP POLICY IF EXISTS "as_update_astech"              ON as_requests;
DROP POLICY IF EXISTS "as_update_aj"                  ON as_requests;

DROP POLICY IF EXISTS "usage_select_own"              ON usage_logs;
DROP POLICY IF EXISTS "usage_select_aj"               ON usage_logs;
DROP POLICY IF EXISTS "usage_insert"                  ON usage_logs;
DROP POLICY IF EXISTS "usage_update_own"              ON usage_logs;

DROP POLICY IF EXISTS "notif_select_own"              ON notifications;
DROP POLICY IF EXISTS "notif_update_own"              ON notifications;
DROP POLICY IF EXISTS "notif_insert_authenticated"    ON notifications;

-- Supabase 테이블 에디터 자동생성 기본 정책도 삭제
DROP POLICY IF EXISTS "Enable read access for all users" ON transit;
DROP POLICY IF EXISTS "Enable read access for all users" ON as_requests;
DROP POLICY IF EXISTS "Enable read access for all users" ON equipment;
DROP POLICY IF EXISTS "Enable read access for all users" ON app_users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON transit;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON as_requests;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON transit;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON as_requests;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON equipment;

-- ────────────────────────────────────────────────────────────
-- sites / projects / companies
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

CREATE POLICY "sites_delete_aj"
  ON sites FOR DELETE TO authenticated
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

CREATE POLICY "projects_delete_aj"
  ON projects FOR DELETE TO authenticated
  USING (get_my_role() = 'aj');

CREATE POLICY "companies_select_active"
  ON companies FOR SELECT TO authenticated
  USING (get_my_role() IS NOT NULL);

CREATE POLICY "companies_insert_aj"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'aj');

CREATE POLICY "companies_update_aj"
  ON companies FOR UPDATE TO authenticated
  USING (get_my_role() = 'aj');

CREATE POLICY "companies_delete_aj"
  ON companies FOR DELETE TO authenticated
  USING (get_my_role() = 'aj');

-- ────────────────────────────────────────────────────────────
-- app_users
-- ────────────────────────────────────────────────────────────

CREATE POLICY "users_select_own"
  ON app_users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_select_aj"
  ON app_users FOR SELECT TO authenticated
  USING (get_my_role() = 'aj');

CREATE POLICY "users_insert_self"
  ON app_users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own_profile"
  ON app_users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_aj"
  ON app_users FOR UPDATE TO authenticated
  USING (get_my_role() = 'aj');

-- ────────────────────────────────────────────────────────────
-- transit (반입/반출)
-- ────────────────────────────────────────────────────────────

-- partner: 자신이 신청한 건만 조회
CREATE POLICY "transit_select_partner"
  ON transit FOR SELECT TO authenticated
  USING (
    get_my_role() = 'partner'
    AND created_by = auth.uid()
  );

-- aj: 전체 조회
CREATE POLICY "transit_select_aj"
  ON transit FOR SELECT TO authenticated
  USING (get_my_role() = 'aj');

-- partner·aj: 신청 등록 (created_by = 본인 강제)
CREATE POLICY "transit_insert"
  ON transit FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('partner','aj')
    AND created_by = auth.uid()
  );

-- aj: 모든 수정 허용
CREATE POLICY "transit_update_aj"
  ON transit FOR UPDATE TO authenticated
  USING (get_my_role() = 'aj')
  WITH CHECK (get_my_role() = 'aj');

-- partner: scheduled → confirmed (일정 확인완료)
CREATE POLICY "transit_update_partner_confirm"
  ON transit FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'partner'
    AND created_by = auth.uid()
    AND status = 'scheduled'
  )
  WITH CHECK (status = 'confirmed');

-- partner: requested/scheduled → cancelled (취소)
CREATE POLICY "transit_update_partner_cancel"
  ON transit FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'partner'
    AND created_by = auth.uid()
    AND status IN ('requested','scheduled')
  )
  WITH CHECK (status = 'cancelled');

-- ────────────────────────────────────────────────────────────
-- equipment (장비)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "equipment_select_active"
  ON equipment FOR SELECT TO authenticated
  USING (
    get_my_role() IS NOT NULL
    AND (
      get_my_site() = 'ALL'
      OR site_id = get_my_site()
      OR site_id IS NULL
    )
  );

CREATE POLICY "equipment_insert_aj"
  ON equipment FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'aj');

CREATE POLICY "equipment_update_aj"
  ON equipment FOR UPDATE TO authenticated
  USING (get_my_role() = 'aj')
  WITH CHECK (get_my_role() = 'aj');

-- ────────────────────────────────────────────────────────────
-- as_requests (AS 요청)
-- ────────────────────────────────────────────────────────────

-- tech·partner: 자신의 현장 AS 조회
CREATE POLICY "as_select_by_site"
  ON as_requests FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('tech','partner')
    AND (
      get_my_site() = 'ALL'
      OR site_id = get_my_site()
    )
  );

-- as_tech·aj: 전체 조회
CREATE POLICY "as_select_aj_astech"
  ON as_requests FOR SELECT TO authenticated
  USING (get_my_role() IN ('as_tech','aj'));

-- tech·partner·aj: AS 요청 등록
CREATE POLICY "as_insert"
  ON as_requests FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('tech','partner','aj'));

-- as_tech: AS 처리
CREATE POLICY "as_update_astech"
  ON as_requests FOR UPDATE TO authenticated
  USING (get_my_role() = 'as_tech')
  WITH CHECK (get_my_role() = 'as_tech');

-- aj: 모든 AS 수정
CREATE POLICY "as_update_aj"
  ON as_requests FOR UPDATE TO authenticated
  USING (get_my_role() = 'aj')
  WITH CHECK (get_my_role() = 'aj');

-- ────────────────────────────────────────────────────────────
-- usage_logs (사용 기록)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "usage_select_own"
  ON usage_logs FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('tech','partner')
    AND (
      recorder_id = auth.uid()
      OR site_id = get_my_site()
    )
  );

CREATE POLICY "usage_select_aj"
  ON usage_logs FOR SELECT TO authenticated
  USING (get_my_role() = 'aj');

CREATE POLICY "usage_insert"
  ON usage_logs FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('tech','partner','aj')
    AND recorder_id = auth.uid()
  );

CREATE POLICY "usage_update_own"
  ON usage_logs FOR UPDATE TO authenticated
  USING (
    recorder_id = auth.uid()
    AND get_my_role() IN ('tech','partner','aj')
  );

-- ────────────────────────────────────────────────────────────
-- notifications (알림)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "notif_select_own"
  ON notifications FOR SELECT TO authenticated
  USING (target_id = auth.uid());

CREATE POLICY "notif_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (target_id = auth.uid())
  WITH CHECK (target_id = auth.uid());

CREATE POLICY "notif_insert_authenticated"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IS NOT NULL);

-- ── Realtime 구독 설정 ─────────────────────────────────────
-- 이미 등록된 테이블은 건너뜁니다 (idempotent).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications','transit','as_requests','equipment']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 기존 DB 업그레이드: 누락 컬럼 추가 (이미 있으면 무시됨)
-- CREATE TABLE IF NOT EXISTS 는 기존 테이블에 새 컬럼을 추가하지 않으므로
-- 별도 ALTER TABLE 로 처리합니다.
-- ============================================================
ALTER TABLE transit   ADD COLUMN IF NOT EXISTS floor text;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS serial_no text;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS manufacture_year text;

-- ── floors 테이블 (층수 마스터) ──────────────────────────────
CREATE TABLE IF NOT EXISTS floors (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  sort_order integer DEFAULT 0,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_floors_active ON floors(active, sort_order);

ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "floors_select_active" ON floors;
DROP POLICY IF EXISTS "floors_insert_aj"     ON floors;
DROP POLICY IF EXISTS "floors_update_aj"     ON floors;
DROP POLICY IF EXISTS "floors_delete_aj"     ON floors;

CREATE POLICY "floors_select_active"
  ON floors FOR SELECT TO authenticated
  USING (get_my_role() IS NOT NULL);

CREATE POLICY "floors_insert_aj"
  ON floors FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('aj','admin'));

CREATE POLICY "floors_update_aj"
  ON floors FOR UPDATE TO authenticated
  USING  (get_my_role() IN ('aj','admin'))
  WITH CHECK (get_my_role() IN ('aj','admin'));

CREATE POLICY "floors_delete_aj"
  ON floors FOR DELETE TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- ── equipment_models 테이블 (장비 모델 마스터) ───────────────
CREATE TABLE IF NOT EXISTS equipment_models (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model      text NOT NULL,
  spec       text,
  maker      text,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eqmodels_active ON equipment_models(active, spec, model);

ALTER TABLE equipment_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eqmodels_select_active" ON equipment_models;
DROP POLICY IF EXISTS "eqmodels_insert_aj"     ON equipment_models;
DROP POLICY IF EXISTS "eqmodels_update_aj"     ON equipment_models;
DROP POLICY IF EXISTS "eqmodels_delete_aj"     ON equipment_models;

CREATE POLICY "eqmodels_select_active"
  ON equipment_models FOR SELECT TO authenticated
  USING (get_my_role() IS NOT NULL);

CREATE POLICY "eqmodels_insert_aj"
  ON equipment_models FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('aj','admin'));

CREATE POLICY "eqmodels_update_aj"
  ON equipment_models FOR UPDATE TO authenticated
  USING  (get_my_role() IN ('aj','admin'))
  WITH CHECK (get_my_role() IN ('aj','admin'));

CREATE POLICY "eqmodels_delete_aj"
  ON equipment_models FOR DELETE TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- ── 추가 RLS 정책 ────────────────────────────────────────────

-- tech/partner: 본인이 신청한 AS 요청을 'requested' 단계에서만 취소 가능
DROP POLICY IF EXISTS "as_update_cancel_creator" ON as_requests;
CREATE POLICY "as_update_cancel_creator"
  ON as_requests FOR UPDATE TO authenticated
  USING (
    get_my_role() IN ('tech','partner')
    AND created_by = auth.uid()
    AND status = 'requested'
  )
  WITH CHECK (status = 'cancelled');

-- as_tech: QR 스캔 AS 신청 시 사용 기록에서 현재 층수 자동입력을 위한 SELECT 권한
DROP POLICY IF EXISTS "usage_select_as_tech" ON usage_logs;
CREATE POLICY "usage_select_as_tech"
  ON usage_logs FOR SELECT TO authenticated
  USING (get_my_role() = 'as_tech');

-- ── 추가 스키마 업그레이드 ─────────────────────────────────

-- transit 시간 컬럼 추가
ALTER TABLE transit ADD COLUMN IF NOT EXISTS requested_time text;
ALTER TABLE transit ADD COLUMN IF NOT EXISTS scheduled_time text;

-- AS SELECT RLS 수정: site_id=NULL 사용자도 본인 신청 건 조회 가능
DROP POLICY IF EXISTS "as_select_by_site" ON as_requests;
CREATE POLICY "as_select_by_site"
  ON as_requests FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('tech','partner')
    AND (
      get_my_site() = 'ALL'
      OR site_id = get_my_site()
      OR created_by = auth.uid()
    )
  );

-- ── 고객지원 게시판 테이블 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS support_posts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category    text NOT NULL,
  title       text NOT NULL,
  body        text,
  attachments jsonb DEFAULT '[]',
  author_name text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_posts_created ON support_posts(created_at DESC);

ALTER TABLE support_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_select_authenticated" ON support_posts;
DROP POLICY IF EXISTS "support_insert_aj"            ON support_posts;
DROP POLICY IF EXISTS "support_update_aj"            ON support_posts;
DROP POLICY IF EXISTS "support_delete_aj"            ON support_posts;

CREATE POLICY "support_select_authenticated"
  ON support_posts FOR SELECT TO authenticated
  USING (get_my_role() IS NOT NULL);

CREATE POLICY "support_insert_aj"
  ON support_posts FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('aj','admin'));

CREATE POLICY "support_update_aj"
  ON support_posts FOR UPDATE TO authenticated
  USING  (get_my_role() IN ('aj','admin'))
  WITH CHECK (get_my_role() IN ('aj','admin'));

CREATE POLICY "support_delete_aj"
  ON support_posts FOR DELETE TO authenticated
  USING (get_my_role() IN ('aj','admin'));

-- equipment change_log 컬럼 추가
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS change_log jsonb DEFAULT '[]';
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS floor text;

-- transit 단계별 담당자 이름 컬럼 추가
ALTER TABLE transit ADD COLUMN IF NOT EXISTS scheduled_by_name text;
ALTER TABLE transit ADD COLUMN IF NOT EXISTS partner_confirmed_by_name text;
ALTER TABLE transit ADD COLUMN IF NOT EXISTS confirmed_by_name text;
ALTER TABLE transit ADD COLUMN IF NOT EXISTS completed_by_name text;

-- transit status 제약에 partner_confirmed 추가
ALTER TABLE transit DROP CONSTRAINT IF EXISTS transit_status_check;
ALTER TABLE transit ADD CONSTRAINT transit_status_check
  CHECK (status IN ('requested','scheduled','partner_confirmed','confirmed','completed','cancelled'));


-- 발주처 테이블
CREATE TABLE IF NOT EXISTS clients (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       text UNIQUE NOT NULL,
  name       text NOT NULL,
  active     boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 기본 발주처 3개 삽입 (중복 무시)
INSERT INTO clients (code, name, sort_order) VALUES
  ('MOOLSAN',   '물산',   1),
  ('ENA',       'E&A',    2),
  ('JOONGHAP',  '중공업', 3)
ON CONFLICT (code) DO NOTHING;

-- app_users 에 발주처 컬럼 추가
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS client_id text;

-- app_users role 제약에 pro 추가
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('tech','partner','aj','as_tech','admin','pro'));
