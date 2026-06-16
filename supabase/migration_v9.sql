-- migration_v9.sql — transit 테이블에 partner_confirmed_at 컬럼 추가
ALTER TABLE transit ADD COLUMN IF NOT EXISTS partner_confirmed_at timestamptz;
