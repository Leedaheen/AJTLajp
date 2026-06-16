-- setup_storage.sql — Supabase Storage 버킷 생성 + 공개 접근 설정
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-files', 'support-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public read support-files"  ON storage.objects;
DROP POLICY IF EXISTS "aj upload support-files"    ON storage.objects;
DROP POLICY IF EXISTS "aj delete support-files"    ON storage.objects;

CREATE POLICY "public read support-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'support-files');

CREATE POLICY "aj upload support-files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'support-files'
    AND get_my_role() IN ('aj', 'admin')
  );

CREATE POLICY "aj delete support-files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'support-files'
    AND get_my_role() IN ('aj', 'admin')
  );
