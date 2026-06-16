-- ============================================================
-- setup_storage.sql — Supabase Storage 버킷 생성 + 공개 접근 설정
-- Supabase 대시보드 SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 'support-files' 버킷 생성 (공개 읽기)
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-files', 'support-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. 누구나 읽기(다운로드) 가능
CREATE POLICY "public read support-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'support-files');

-- 3. AJ관리자(aj)·admin만 업로드/삭제 가능
CREATE POLICY "aj upload support-files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'support-files'
    AND (get_my_role() IN ('aj', 'admin'))
  );

CREATE POLICY "aj delete support-files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'support-files'
    AND (get_my_role() IN ('aj', 'admin'))
  );
