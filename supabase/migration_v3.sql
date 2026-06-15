-- ============================================================
-- migration_v3.sql
-- 반입/반출 흐름 버그 수정 + AS 처리기사 컬럼 추가
-- 1. transit.partner_confirmed_at 컬럼 추가 (migration_v2에서 이미 추가됨, IF NOT EXISTS)
-- 2. equipment.project 컬럼 추가 (migration_v2에서 이미 추가됨, IF NOT EXISTS)
-- 3. as_requests.tech_name / tech_phone 컬럼 추가 (schema에서 누락됨)
-- 4. partner 일정 확인완료 RLS 정책 추가
-- 5. partner 취소 RLS 정책 추가
-- 6. notifications INSERT RLS 정책 추가
-- ============================================================

-- ① transit 테이블: partner 확인완료 타임스탬프 컬럼 (migration_v2에서 추가됐을 수 있음)
ALTER TABLE transit
  ADD COLUMN IF NOT EXISTS partner_confirmed_at timestamptz;

-- ② equipment 테이블: 프로젝트 컬럼 (migration_v2에서 추가됐을 수 있음)
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS project text;

-- ③ as_requests 테이블: 처리기사 이름/연락처 컬럼 누락 수정
ALTER TABLE as_requests
  ADD COLUMN IF NOT EXISTS tech_name  text;
ALTER TABLE as_requests
  ADD COLUMN IF NOT EXISTS tech_phone text;

-- ④ partner 일정 확인완료 RLS 정책
--    partner가 자신이 신청한 scheduled 건을 confirmed로만 변경 가능
DROP POLICY IF EXISTS "transit_update_partner_confirm" ON transit;
CREATE POLICY "transit_update_partner_confirm"
  ON transit FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'partner'
    AND created_by = auth.uid()
    AND status = 'scheduled'
  )
  WITH CHECK (status = 'confirmed');

-- ⑤ partner 취소 RLS 정책
--    partner가 자신이 신청한 requested/scheduled 건을 취소 가능
DROP POLICY IF EXISTS "transit_update_partner_cancel" ON transit;
CREATE POLICY "transit_update_partner_cancel"
  ON transit FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'partner'
    AND created_by = auth.uid()
    AND status IN ('requested', 'scheduled')
  )
  WITH CHECK (status = 'cancelled');

-- ⑥ notifications INSERT RLS 정책
--    활성 사용자가 알림 등록 가능 (일정 확정 알림 등)
DROP POLICY IF EXISTS "notif_insert_authenticated" ON notifications;
CREATE POLICY "notif_insert_authenticated"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IS NOT NULL);
