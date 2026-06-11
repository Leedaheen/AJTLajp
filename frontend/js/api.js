/**
 * API 모듈 — Supabase JS SDK 기반
 * REST 스타일 경로를 Supabase 쿼리로 변환합니다.
 * 기존 페이지 코드가 Api.get/post/patch/delete 를 그대로 사용할 수 있습니다.
 */
const Api = (() => {
  // URL 쿼리스트링 파싱
  function _qs(path) {
    const [base, search] = path.split('?');
    const params = {};
    if (search) {
      search.split('&').forEach(p => {
        const [k, v] = p.split('=');
        params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { base: base.replace(/^\//, ''), params };
  }

  // Supabase 쿼리에 공통 필터 적용
  function _applyFilters(query, params) {
    if (params.status)   query = query.eq('status', params.status);
    if (params.site_id)  query = query.eq('site_id', params.site_id);
    if (params.type)     query = query.eq('type', params.type);
    if (params.equip_id) query = query.eq('equip_id', Number(params.equip_id));
    if (params.q)        query = query.or(
      `equip_no.ilike.%${params.q}%,company.ilike.%${params.q}%`
    );
    if (params.limit)    query = query.limit(Number(params.limit));
    return query;
  }

  // 에러 처리
  function _handle(error, silent) {
    if (!error) return;
    if (!silent) Toast.error(error.message || '오류가 발생했습니다.');
    throw new Error(error.message);
  }

  // ── GET ───────────────────────────────────────────────────────
  async function get(path, opts = {}) {
    const { base, params } = _qs(path);
    const silent = opts.silent === true;
    let data, error;

    // 경로별 라우팅
    if (base === 'transit') {
      ({ data, error } = await _applyFilters(
        _sb.from('transit').select('*').order('created_at', { ascending: false }),
        params
      ));
    } else if (base.startsWith('transit/') && base.endsWith('/complete')) {
      return;
    } else if (base === 'equipment') {
      ({ data, error } = await _applyFilters(
        _sb.from('equipment').select('*').order('created_at', { ascending: false }),
        params
      ));
    } else if (base.match(/^equipment\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('equipment').select('*').eq('id', id).single());
      if (!error) return data;
    } else if (base.match(/^equipment\/qr\//)) {
      const qr = base.split('/').pop();
      ({ data, error } = await _sb.from('equipment').select('*').eq('qr_code', qr).single());
      if (!error) return data;
    } else if (base === 'as-requests') {
      let q = _sb.from('as_requests').select('*').order('requested_at', { ascending: false });
      if (params.status)  q = q.eq('status', params.status);
      if (params.tech_id) q = q.eq('tech_id', params.tech_id);
      if (params.limit)   q = q.limit(Number(params.limit));
      if (params.q)       q = q.or(
        `equip_no.ilike.%${params.q}%,company.ilike.%${params.q}%,fault_type.ilike.%${params.q}%`
      );
      ({ data, error } = await q);
    } else if (base === 'usage-logs') {
      ({ data, error } = await _applyFilters(
        _sb.from('usage_logs').select('*').order('created_at', { ascending: false }),
        params
      ));
    } else if (base === 'notifications') {
      const uid = Auth.getUser()?.id;
      ({ data, error } = await _sb
        .from('notifications')
        .select('*')
        .eq('target_id', uid)
        .order('created_at', { ascending: false })
        .limit(50)
      );
    } else if (base === 'users') {
      ({ data, error } = await _sb
        .from('app_users')
        .select('*')
        .order('created_at', { ascending: false })
      );
    } else if (base.startsWith('analytics/')) {
      // 클라이언트 측 집계 — analytics.js 에서 직접 호출
      return await _analytics(base.split('/')[1], params);
    } else {
      if (!silent) Toast.error(`알 수 없는 경로: ${path}`);
      throw new Error('UNKNOWN_PATH');
    }

    _handle(error, silent);
    return data;
  }

  // ── POST ──────────────────────────────────────────────────────
  async function post(path, body, opts = {}) {
    const { base } = _qs(path);
    const silent = opts.silent === true;
    let data, error;

    if (base === 'transit') {
      ({ data, error } = await _sb.from('transit').insert(body).select().single());
    } else if (base === 'as-requests') {
      ({ data, error } = await _sb.from('as_requests').insert(body).select().single());
    } else if (base === 'usage-logs/start') {
      ({ data, error } = await _sb.from('usage_logs').insert(body).select().single());
    } else if (base === 'usage-logs/end') {
      const { id, end_time, used_hours } = body;
      ({ data, error } = await _sb.from('usage_logs')
        .update({ end_time, used_hours, status: 'done' })
        .eq('id', id).select().single()
      );
    } else if (base === 'push/subscribe') {
      const uid = Auth.getUser()?.id;
      ({ data, error } = await _sb.from('app_users')
        .update({ push_sub: body }).eq('id', uid).select().single()
      );
    } else {
      if (!silent) Toast.error(`알 수 없는 경로: ${path}`);
      throw new Error('UNKNOWN_PATH');
    }

    _handle(error, silent);
    return data;
  }

  // ── PATCH ─────────────────────────────────────────────────────
  async function patch(path, body, opts = {}) {
    const { base } = _qs(path);
    const silent = opts.silent === true;
    let data, error;

    // transit
    if (base.match(/^transit\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('transit').update(body).eq('id', id).select().single());
    } else if (base.match(/^transit\/\d+\/complete$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('transit')
        .update({ status: 'completed', completed_at: new Date().toISOString(), ...body })
        .eq('id', id).select().single()
      );
    } else if (base.match(/^transit\/\d+\/cancel$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('transit')
        .update({ status: 'cancelled', ...body })
        .eq('id', id).select().single()
      );
    // as-requests
    } else if (base.match(/^as-requests\/\d+\/resolve$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('as_requests')
        .update({ status: 'completed', resolved_at: new Date().toISOString(), ...body })
        .eq('id', id).select().single()
      );
    } else if (base.match(/^as-requests\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('as_requests').update(body).eq('id', id).select().single());
    // notifications
    } else if (base.match(/^notifications\/\d+\/read$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('notifications').update({ is_read: true }).eq('id', id));
    // users
    } else if (base.match(/^users\/.+\/approve$/)) {
      const id = base.split('/')[1];
      ({ data, error } = await _sb.from('app_users').update(body).eq('id', id).select().single());
    } else if (base.match(/^users\/.+\/role$/)) {
      const id = base.split('/')[1];
      ({ data, error } = await _sb.from('app_users').update({ role: body.role }).eq('id', id));
    } else if (base === 'users/me/notif-prefs') {
      const uid = Auth.getUser()?.id;
      ({ data, error } = await _sb.from('app_users').update({ notif_prefs: body }).eq('id', uid));
    // equipment
    } else if (base.match(/^equipment\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('equipment').update(body).eq('id', id).select().single());
    } else {
      if (!silent) Toast.error(`알 수 없는 경로: ${path}`);
      throw new Error('UNKNOWN_PATH');
    }

    _handle(error, silent);
    return data;
  }

  // ── DELETE ────────────────────────────────────────────────────
  async function del(path, opts = {}) {
    const { base } = _qs(path);
    const silent = opts.silent === true;
    let error;

    if (base.match(/^equipment\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ error } = await _sb.from('equipment').delete().eq('id', id));
    } else {
      if (!silent) Toast.error(`알 수 없는 경로: ${path}`);
      throw new Error('UNKNOWN_PATH');
    }

    _handle(error, silent);
    return { success: true };
  }

  // ── 분석 집계 (클라이언트 측) ─────────────────────────────────
  async function _analytics(type, params) {
    const days    = Number(params.days || 30);
    const siteId  = params.site_id || '';
    const since   = new Date(Date.now() - days * 86400000).toISOString();

    if (type === 'equipment') {
      let q = _sb.from('equipment').select('*');
      if (siteId) q = q.eq('site_id', siteId);
      const { data: rows = [] } = await q;
      return {
        total: rows.length,
        by_status:  _countBy(rows, 'status'),
        by_spec:    _countBy(rows, 'spec'),
        by_site:    _countBy(rows, 'site_id'),
        by_company: _countBy(rows, 'company'),
        recent: [...rows].sort((a, b) => (b.in_date||'') > (a.in_date||'') ? 1 : -1).slice(0, 10),
      };
    }

    if (type === 'as') {
      let q = _sb.from('as_requests').select('*').gte('requested_at', since);
      if (siteId) q = q.eq('site_id', siteId);
      const { data: rows = [] } = await q;
      const resolved = rows.filter(r => r.status === 'completed');
      const avgMin = resolved.length
        ? Math.round(resolved.reduce((s, r) => s + (r.elapsed_min || 0), 0) / resolved.length)
        : 0;
      const byDate = {};
      rows.forEach(r => {
        const d = (r.requested_at || '').slice(0, 10);
        byDate[d] = (byDate[d] || 0) + 1;
      });
      return {
        total: rows.length,
        resolved_count: resolved.length,
        avg_elapsed_min: avgMin,
        by_fault:  _countBy(rows, 'fault_type'),
        by_status: _countBy(rows, 'status'),
        by_tech:   _countBy(rows, 'tech_name'),
        by_date:   Object.entries(byDate).map(([date, count]) => ({ date, count }))
                         .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }

    if (type === 'usage') {
      let q = _sb.from('usage_logs').select('*').gte('created_at', since);
      if (siteId) q = q.eq('site_id', siteId);
      const { data: rows = [] } = await q;
      const totalHours = rows.reduce((s, r) => s + Number(r.used_hours || 0), 0);
      const byDate = {};
      rows.forEach(r => {
        const d = (r.date || r.created_at || '').slice(0, 10);
        byDate[d] = (byDate[d] || 0) + Number(r.used_hours || 0);
      });
      return {
        total_records: rows.length,
        total_hours:   Math.round(totalHours * 10) / 10,
        active_now:    rows.filter(r => r.status === 'using').length,
        by_spec:       _countBy(rows, 'spec'),
        by_company:    _countBy(rows, 'company'),
        by_date: Object.entries(byDate)
          .map(([date, hours]) => ({ date, hours: Math.round(hours * 10) / 10 }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }

    return {};
  }

  function _countBy(arr, key) {
    const map = {};
    arr.forEach(item => {
      const v = item[key] || '기타';
      map[v] = (map[v] || 0) + 1;
    });
    return Object.entries(map).map(([label, count]) => ({ label, count }));
  }

  return {
    get,
    post,
    patch,
    delete: del,
  };
})();
