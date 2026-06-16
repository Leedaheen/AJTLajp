-- migration_v7.sql — equipment 테이블에 제조년 컬럼 추가
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS manufacture_year text;
