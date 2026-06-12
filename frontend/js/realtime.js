/**
 * Supabase Realtime 구독 관리 모듈
 *
 * - on(key, table, cb)   : 페이지 전환 시 자동 해제되는 구독 (목록 자동갱신용)
 * - onGlobal(key, ...)   : 페이지와 무관하게 유지되는 구독 (알림 등)
 * - offPage()            : 페이지 이동 시 페이지 구독 전체 해제
 */
const Realtime = (() => {
  const _page   = new Map(); // 페이지 레벨 구독
  const _global = new Map(); // 전역(알림 등) 구독

  // 단순 디바운서 — 짧은 시간 내 연속 이벤트를 한번으로 묶음
  function _debounce(fn, ms = 400) {
    let t;
    return () => { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function _make(prefix, key, table, callback) {
    if (!_sb) return null;
    const ch = _sb
      .channel(`${prefix}-${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table },
          _debounce(callback))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] ${prefix}/${key} 구독 완료 (${table})`);
        }
      });
    return ch;
  }

  /** 페이지 레벨 구독 등록 */
  function on(key, table, callback) {
    _remove(_page, key);
    const ch = _make('page', key, table, callback);
    if (ch) _page.set(key, ch);
  }

  /** 전역 구독 등록 (페이지 이동에도 유지) */
  function onGlobal(key, table, callback) {
    _remove(_global, key);
    const ch = _make('global', key, table, callback);
    if (ch) _global.set(key, ch);
  }

  /** 페이지 이동 시 페이지 구독 전체 해제 */
  function offPage() {
    _page.forEach((ch, key) => _remove(_page, key));
    _page.clear();
  }

  function _remove(map, key) {
    const ch = map.get(key);
    if (ch) {
      try { _sb?.removeChannel(ch); } catch (_) {}
      map.delete(key);
    }
  }

  return { on, onGlobal, offPage };
})();
