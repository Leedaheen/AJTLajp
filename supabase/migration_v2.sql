-- ============================================================
-- Migration v2 — 현장/프로젝트 관리, 장비 추적 강화
-- Supabase 대시보드 → SQL Editor에서 실행하세요.
-- ============================================================

-- ── 1. transit 테이블 컬럼 추가 ──────────────────────────────
ALTER TABLE transit ADD COLUMN IF NOT EXISTS project text;
ALTER TABLE transit ADD COLUMN IF NOT EXISTS partner_confirmed_at timestamptz;

-- ── 2. equipment 테이블 컬럼 추가 ────────────────────────────
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS project text;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS out_date text;

-- ── 3. sites 테이블 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       text UNIQUE NOT NULL,
  name       text NOT NULL,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── 4. projects 테이블 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       text UNIQUE NOT NULL,
  name       text NOT NULL,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── 5. 초기 데이터 ───────────────────────────────────────────
INSERT INTO sites (code, name) VALUES
  ('P4', 'P4 복합동'),
  ('P5', 'P5 복합동')
ON CONFLICT (code) DO NOTHING;

INSERT INTO projects (code, name) VALUES
  ('Ph1', 'Phase 1'),
  ('Ph2', 'Phase 2'),
  ('Ph3', 'Phase 3'),
  ('Ph4', 'Phase 4')
ON CONFLICT (code) DO NOTHING;

-- ── 6. RLS 설정 ──────────────────────────────────────────────
ALTER TABLE sites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 조회: 인증된 사용자 전체 허용
CREATE POLICY "sites_read"    ON sites    FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_read" ON projects FOR SELECT TO authenticated USING (true);

-- 삽입: AJ 역할만 허용
CREATE POLICY "sites_insert" ON sites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'aj')
  );
CREATE POLICY "projects_insert" ON projects FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'aj')
  );

-- 수정: AJ 역할만 허용
CREATE POLICY "sites_update" ON sites FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'aj'));
CREATE POLICY "projects_update" ON projects FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'aj'));

-- ── 확인 쿼리 ────────────────────────────────────────────────
-- SELECT * FROM sites;
-- SELECT * FROM projects;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'transit' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'equipment' ORDER BY ordinal_position;
