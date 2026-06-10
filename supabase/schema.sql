-- ============================================================
-- 고소작업대 운영 앱 — Supabase 스키마
-- ============================================================

-- ① 사용자 테이블
CREATE TABLE IF NOT EXISTS app_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id     text UNIQUE NOT NULL,
  email         text UNIQUE NOT NULL,
  name          text NOT NULL,
  phone         text DEFAULT '',
  role          text CHECK (role IN ('tech','partner','aj','as_tech')) NOT NULL,
  site_id       text CHECK (site_id IN ('P4','P5','ALL')) NOT NULL,
  status        text DEFAULT 'pending' CHECK (status IN ('pending','active','rejected')),
  reject_reason text,
  local_id      text UNIQUE,            -- 관리자 전용 ID (Google 없이 로그인)
  pw_hash       text,                   -- 관리자 전용 비밀번호 해시 (bcrypt)
  push_sub      jsonb,                   -- PWA Push 구독 정보
  notif_prefs   jsonb DEFAULT '{"transit":true,"as":true,"approval":true}',
  created_at    timestamptz DEFAULT now(),
  approved_at   timestamptz,
  approved_by   uuid REFERENCES app_users(id)
);

-- ② 반입/반출 신청 테이블
CREATE TABLE IF NOT EXISTS transit (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id        text UNIQUE,
  type             text CHECK (type IN ('in','out')) NOT NULL,
  site_id          text NOT NULL,
  site_name        text NOT NULL,
  company          text NOT NULL,
  equip_specs      jsonb NOT NULL,       -- [{spec:'6M', qty:2}, ...]
  aj_equip         text,
  reporter_name    text NOT NULL,
  reporter_phone   text NOT NULL,
  manager_name     text,                 -- 양중담당자
  manager_phone    text,
  manager_location text,
  requested_date   text,                 -- 희망 날짜
  scheduled_date   text,                 -- AJ 확정 날짜
  vehicle_info     text,                 -- 배차 차량
  driver_info      text,                 -- 배차 기사
  status           text DEFAULT 'requested' CHECK (
    status IN ('requested','scheduled','confirmed','completed','cancelled')
  ),
  cancelled_reason text,
  note             text,
  change_log       jsonb DEFAULT '[]',   -- [{who, when, before, after}, ...]
  created_by       uuid REFERENCES app_users(id),
  created_at       timestamptz DEFAULT now(),
  completed_at     timestamptz
);

-- ③ 장비 테이블
CREATE TABLE IF NOT EXISTS equipment (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id   text UNIQUE,
  equip_no    text NOT NULL,
  spec        text,                      -- 6M / 8M / 10M / 12M / 14M / 16M / 16M굴절 / 18M / 20M굴절
  model       text,
  site_id     text,
  site_name   text,
  company     text,
  status      text DEFAULT 'stock' CHECK (status IN ('stock','in_use','transit','returned')),
  qr_code     text UNIQUE,              -- 반출 시 NULL
  in_date     text,
  out_date    text,
  transit_id  bigint REFERENCES transit(id),
  created_at  timestamptz DEFAULT now()
);

-- ④ AS 요청 테이블
CREATE TABLE IF NOT EXISTS as_requests (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id      text UNIQUE,
  site_id        text NOT NULL,
  site_name      text NOT NULL,
  equip_no       text NOT NULL,
  equip_id       bigint REFERENCES equipment(id),
  company        text NOT NULL,
  location       text NOT NULL,          -- 층/열수
  fault_type     text NOT NULL CHECK (
    fault_type IN ('작동불량','충전불량','누유의심','파손','자재요청','오류코드','기타')
  ),
  description    text,
  reporter_name  text NOT NULL,
  reporter_phone text NOT NULL,
  user_name      text,
  user_phone     text,
  status         text DEFAULT 'requested' CHECK (
    status IN ('requested','in_progress','material_pending','completed')
  ),
  tech_id        uuid REFERENCES app_users(id),
  tech_name      text,
  tech_phone     text,
  resolve_note   text,
  requested_at   timestamptz DEFAULT now(),
  material_at    timestamptz,
  resolved_at    timestamptz,
  elapsed_min    integer                 -- 소요시간(분) 자동계산
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
  target_id  uuid REFERENCES app_users(id),
  type       text CHECK (type IN ('transit','as','approval','schedule')),
  title      text NOT NULL,
  body       text NOT NULL,
  ref_id     text,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_equipment_site     ON equipment(site_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status   ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_qr       ON equipment(qr_code);
CREATE INDEX IF NOT EXISTS idx_transit_site       ON transit(site_id);
CREATE INDEX IF NOT EXISTS idx_transit_status     ON transit(status);
CREATE INDEX IF NOT EXISTS idx_as_site            ON as_requests(site_id);
CREATE INDEX IF NOT EXISTS idx_as_status          ON as_requests(status);
CREATE INDEX IF NOT EXISTS idx_usage_equip        ON usage_logs(equip_id);
CREATE INDEX IF NOT EXISTS idx_notif_target       ON notifications(target_id);
CREATE INDEX IF NOT EXISTS idx_users_role         ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_users_status       ON app_users(status);

-- RLS 활성화
ALTER TABLE app_users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit      ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment    ENABLE ROW LEVEL SECURITY;
ALTER TABLE as_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS 정책: service_role은 모두 허용 (백엔드에서 service key 사용)
CREATE POLICY "service_role_all" ON app_users    FOR ALL USING (true);
CREATE POLICY "service_role_all" ON transit      FOR ALL USING (true);
CREATE POLICY "service_role_all" ON equipment    FOR ALL USING (true);
CREATE POLICY "service_role_all" ON as_requests  FOR ALL USING (true);
CREATE POLICY "service_role_all" ON usage_logs   FOR ALL USING (true);
CREATE POLICY "service_role_all" ON notifications FOR ALL USING (true);
