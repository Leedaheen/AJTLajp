-- ============================================================
-- migration_v5.sql — 장비 시리얼번호 추가
-- ============================================================

-- equipment 테이블에 시리얼번호 컬럼 추가
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS serial_no text;

-- 인덱스 (시리얼번호 검색 대비)
CREATE INDEX IF NOT EXISTS idx_equipment_serial ON equipment(serial_no);
