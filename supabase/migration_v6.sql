-- ============================================================
-- migration_v6.sql — 장비 모델 제원표 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS equipment_specs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model        text NOT NULL UNIQUE,
  manufacturer text,
  work_height  text,   -- '8M', '10M', '16M', '16M굴절' 등
  created_at   timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE equipment_specs ENABLE ROW LEVEL SECURITY;

-- 활성 사용자 전원 조회 가능
CREATE POLICY "specs_select"
  ON equipment_specs FOR SELECT TO authenticated
  USING (true);

-- aj만 등록·수정·삭제
CREATE POLICY "specs_insert"
  ON equipment_specs FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'aj');

CREATE POLICY "specs_update"
  ON equipment_specs FOR UPDATE TO authenticated
  USING (get_my_role() = 'aj');

CREATE POLICY "specs_delete"
  ON equipment_specs FOR DELETE TO authenticated
  USING (get_my_role() = 'aj');
