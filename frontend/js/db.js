/**
 * Supabase 클라이언트 초기화
 * 배포 전에 아래 두 값을 실제 프로젝트 값으로 교체하세요.
 * Supabase 대시보드 → Settings → API 에서 확인할 수 있습니다.
 */
var SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
var SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

try {
  window._sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
} catch (e) {
  // 플레이스홀더 값으로 인한 초기화 실패 — 프리뷰 모드에서는 무시됩니다
  console.warn('[db.js] Supabase 초기화 건너뜀 (플레이스홀더 URL). 실제 URL로 교체하세요.');
  window._sb = null;
}
