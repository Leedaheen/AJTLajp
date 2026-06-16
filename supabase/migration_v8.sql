-- migration_v8.sql — 고객지원 게시판 동적 게시글 테이블
CREATE TABLE IF NOT EXISTS support_posts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category    text NOT NULL,
  title       text NOT NULL,
  body        text,
  attachments jsonb DEFAULT '[]',
  created_by  uuid REFERENCES app_users(id),
  author_name text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE support_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read support_posts" ON support_posts;
DROP POLICY IF EXISTS "aj insert support_posts"          ON support_posts;
DROP POLICY IF EXISTS "aj update support_posts"          ON support_posts;
DROP POLICY IF EXISTS "aj delete support_posts"          ON support_posts;

CREATE POLICY "authenticated read support_posts"
  ON support_posts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "aj insert support_posts"
  ON support_posts FOR INSERT
  WITH CHECK (get_my_role() IN ('aj', 'admin'));

CREATE POLICY "aj update support_posts"
  ON support_posts FOR UPDATE
  USING (get_my_role() IN ('aj', 'admin'));

CREATE POLICY "aj delete support_posts"
  ON support_posts FOR DELETE
  USING (get_my_role() IN ('aj', 'admin'));
