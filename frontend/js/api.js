/**
 * API 모듈 — Supabase JS SDK 기반
 */
const Api = (() => {
  function _qs(path) {
    const [base, search] = path.split('?');
    const params = {};
    if (search) {
      search.split('&').forEach(p => {
        const [k, v] = p.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { base: base.replace(/^\//, ''), params };
  }

  function _applyFilters(query, params) {
    if (params.status)    query = query.eq('status', params.status);
    if (params.statuses)  query = query.in('status', params.statuses.split(','));
    if (params.site_id)   query = query.eq('site_id', params.site_id);
    if (params.company)   query = query.eq('company', params.company);
    if (params.type)      query = query.eq('type', params.type);
    if (params.equip_id)  query = query.eq('equip_id', Number(params.equip_id));
    if (params.spec)      query = query.eq('spec', params.spec);
    if (params.date)      query = query.eq('date', params.date);
    if (params.equip)     query = query.ilike('equip_no', `%${params.equip}%`);
    if (params.equip_no)  query = query.eq('equip_no', params.equip_no);
    if (params.role)      query = query.eq('role', params.role);
    if (params.q)         query = query.or(
      `equip_no.ilike.%${params.q}%,company.ilike.%${params.q}%`
    );
    if (params.limit)     query = query.limit(Number(params.limit));
    return query;
  }

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

    if (base === 'transit') {
      ({ data, error } = await _applyFilters(
        _sb.from('transit').select('*').order('created_at', { ascending: false }),
        params
      ));
    } else if (base === 'equipment') {
      ({ data, error } = await _applyFilters(
        _sb.from('equipment').select('*').order('created_at', { ascending: false }),
        params
      ));
    } else if (base.match(/^equipment\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('equipment').select('*').eq('id', id).maybeSingle());
      if (!error) return data;
    } else if (base.match(/^equipment\/qr\//)) {
      const qr = base.split('/').pop();
      ({ data, error } = await _sb.from('equipment').select('*').eq('qr_code', qr).maybeSingle());
      if (!error) return data;
    } else if (base === 'as-requests') {
      let q = _sb.from('as_requests').select('*').order('requested_at', { ascending: false });
      if (params.status)  q = q.eq('status', params.status);
      if (params.site_id) q = q.eq('site_id', params.site_id);
      if (params.tech_id) q = q.eq('tech_id', params.tech_id);
      if (params.limit)   q = q.limit(Number(params.limit));
      if (params.q)       q = q.or(
        `equip_no.ilike.%${params.q}%,company.ilike.%${params.q}%,fault_type.ilike.%${params.q}%`
      );
      ({ data, error } = await q);
    } else if (base === 'usage-logs/summary') {
      const date   = params.date || new Date().toISOString().slice(0, 10);
      const siteId = params.site_id || '';
      let q = _sb.from('usage_logs').select('used_hours,equip_no,site_id').eq('date', date);
      if (siteId) q = q.eq('site_id', siteId);
      const { data: rows = [] } = await q;
      const totalHours = rows.reduce((s, r) => s + Number(r.used_hours || 0), 0);
      const equipSet = new Set(rows.map(r => r.equip_no).filter(Boolean));
      return {
        total_hours:  Math.round(totalHours * 10) / 10,
        equip_count:  equipSet.size,
        record_count: rows.length,
      };
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
      let q = _sb.from('app_users').select('*').order('created_at', { ascending: false });
      if (params.status) q = q.eq('status', params.status);
      if (params.role)   q = q.eq('role', params.role);
      ({ data, error } = await q);
    } else if (base === 'sites') {
      ({ data, error } = await _sb.from('sites').select('*').eq('active', true).order('id'));
    } else if (base === 'projects') {
      ({ data, error } = await _sb.from('projects').select('*').eq('active', true).order('id'));
    } else if (base === 'sites/all') {
      ({ data, error } = await _sb.from('sites').select('*').order('id'));
    } else if (base === 'projects/all') {
      ({ data, error } = await _sb.from('projects').select('*').order('id'));
    } else if (base === 'companies') {
      let q = _sb.from('companies').select('*').eq('active', true).order('name');
      if (params.site_id) q = q.or(`site_id.eq.${params.site_id},site_id.is.null`);
      ({ data, error } = await q);
    } else if (base === 'companies/all') {
      ({ data, error } = await _sb.from('companies').select('*').order('name'));
    } else if (base.startsWith('analytics/')) {
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
    } else if (base === 'equipment') {
      ({ data, error } = await _sb.from('equipment').insert(body).select().single());
    } else if (base === 'usage-logs/start' || base === 'usage-logs') {
      ({ data, error } = await _sb.from('usage_logs').insert(body).select().single());
    } else if (base === 'usage-logs/end') {
      const { id, end_time, used_hours } = body;
      ({ data, error } = await _sb.from('usage_logs')
        .update({ end_time, used_hours, status: 'done' })
        .eq('id', id).select().single()
      );
    } else if (base === 'push/subscribe' || base === 'users/me/push-subscribe') {
      const uid = Auth.getUser()?.id;
      ({ data, error } = await _sb.from('app_users')
        .update({ push_sub: body }).eq('id', uid).select().single()
      );
    } else if (base === 'notifications') {
      ({ data, error } = await _sb.from('notifications').insert(body).select().single());
    } else if (base === 'sites') {
      ({ data, error } = await _sb.from('sites').insert(body).select().single());
    } else if (base === 'projects') {
      ({ data, error } = await _sb.from('projects').insert(body).select().single());
    } else if (base === 'companies') {
      ({ data, error } = await _sb.from('companies').insert(body).select().single());
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
    if (base.match(/^transit\/\d+\/schedule$/)) {
      const id = Number(base.split('/')[1]);
      const { status: bodyStatus, ...rest } = body;
      const status = bodyStatus || 'scheduled';
      ({ data, error } = await _sb.from('transit')
        .update({ status, ...rest })
        .eq('id', id).select().single()
      );
    } else if (base.match(/^transit\/\d+\/partner-confirm$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('transit')
        .update({ status: 'confirmed', partner_confirmed_at: new Date().toISOString() })
        .eq('id', id).select().single()
      );
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
    } else if (base.match(/^transit\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('transit').update(body).eq('id', id).select().single());

    // as-requests
    } else if (base.match(/^as-requests\/\d+\/assign$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('as_requests')
        .update({ status: 'assigned', ...body })
        .eq('id', id).select().single()
      );
    } else if (base.match(/^as-requests\/\d+\/start$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('as_requests')
        .update({ status: 'in_progress' })
        .eq('id', id).select().single()
      );
    } else if (base.match(/^as-requests\/\d+\/cancel$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('as_requests')
        .update({ status: 'cancelled' })
        .eq('id', id).select().single()
      );
    } else if (base.match(/^as-requests\/\d+\/resolve$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('as_requests')
        .update({ status: 'completed', resolved_at: new Date().toISOString(), ...body })
        .eq('id', id).select().single()
      );
    } else if (base.match(/^as-requests\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('as_requests').update(body).eq('id', id).select().single());

    // usage-logs
    } else if (base.match(/^usage-logs\/\d+\/end$/)) {
      const id = Number(base.split('/')[1]);
      const { data: log } = await _sb.from('usage_logs').select('start_time,date').eq('id', id).maybeSingle();
      const recordDate  = log?.date || new Date().toISOString().slice(0, 10);
      const endFull     = new Date(`${recordDate}T${body.end_time}:00`);
      const startFull   = new Date(log?.start_time || Date.now());
      const usedHours   = Math.max(0, Math.round((endFull - startFull) / 36000) / 100);
      ({ data, error } = await _sb.from('usage_logs')
        .update({
          end_time:   endFull.toISOString(),
          used_hours: usedHours,
          status:     'done',
          ...(body.meter_end  ? { meter_end:  body.meter_end }  : {}),
          ...(body.off_reason ? { off_reason: body.off_reason } : {}),
        })
        .eq('id', id).select().single()
      );

    // notifications
    } else if (base.match(/^notifications\/\d+\/read$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('notifications').update({ is_read: true }).eq('id', id));

    // users
    } else if (base.match(/^users\/.+\/approve$/)) {
      const id = base.split('/')[1];
      const updateBody = body.action === 'approve'
        ? { status: 'active',   approved_at: new Date().toISOString() }
        : { status: 'rejected', reject_reason: body.reject_reason };
      ({ data, error } = await _sb.from('app_users').update(updateBody).eq('id', id).select().single());
    } else if (base.match(/^users\/.+\/role$/)) {
      const id = base.split('/')[1];
      ({ data, error } = await _sb.from('app_users')
        .update({ role: body.role, site_id: body.site_id })
        .eq('id', id)
      );
    } else if (base === 'users/me/notif-prefs') {
      const uid = Auth.getUser()?.id;
      ({ data, error } = await _sb.from('app_users').update({ notif_prefs: body }).eq('id', uid));
    } else if (base === 'users/me/credentials') {
      try {
        const { data: result, error: fnErr } = await _sb.functions.invoke('change-admin-credentials', { body });
        if (fnErr) throw new Error(fnErr.message || '서버 오류');
        if (!result?.ok) throw new Error(result?.message || '비밀번호 변경 실패');
        return result;
      } catch (e) {
        if (!silent) Toast.error(e.message || '계정 정보 변경 실패');
        throw e;
      }

    // equipment
    } else if (base.match(/^equipment\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('equipment').update(body).eq('id', id).select().single());

    // sites
    } else if (base.match(/^sites\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('sites').update(body).eq('id', id).select().single());

    // projects
    } else if (base.match(/^projects\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('projects').update(body).eq('id', id).select().single());

    // companies
    } else if (base.match(/^companies\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ data, error } = await _sb.from('companies').update(body).eq('id', id).select().single());

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
    } else if (base.match(/^sites\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ error } = await _sb.from('sites').delete().eq('id', id));
    } else if (base.match(/^projects\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ error } = await _sb.from('projects').delete().eq('id', id));
    } else if (base.match(/^companies\/\d+$/)) {
      const id = Number(base.split('/')[1]);
      ({ error } = await _sb.from('companies').delete().eq('id', id));
    } else {
      if (!silent) Toast.error(`알 수 없는 경로: ${path}`);
      throw new Error('UNKNOWN_PATH');
    }

    _handle(error, silent);
    return { success: true };
  }

  // ── 분석 집계 ─────────────────────────────────────────────────
  async function _analytics(type, params) {
    const days   = Number(params.days || 30);
    const siteId = params.site_id || '';
    const since  = new Date(Date.now() - days * 86400000).toISOString();

    if (type === 'equipment') {
      let q = _sb.from('equipment').select('*');
      if (siteId) q = q.eq('site_id', siteId);
      const { data: rows = [] } = await q;
      return {
        total:      rows.length,
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
        total:           rows.length,
        resolved_count:  resolved.length,
        avg_elapsed_min: avgMin,
        by_fault:        _countBy(rows, 'fault_type'),
        by_status:       _countBy(rows, 'status'),
        by_tech:         _countBy(rows, 'tech_name'),
        by_date: Object.entries(byDate)
          .map(([date, count]) => ({ date, count }))
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

  // ── 이미지 압축 (Canvas로 리사이즈 후 JPEG 변환) ────────
  // 원본 이미지가 크면 base64가 6MB 제한 초과 → 최대 1600px / 품질 0.82로 압축
  function _compressImage(file) {
    return new Promise((resolve) => {
      // JPEG/PNG/WEBP만 압축, 나머지는 그대로
      if (!file.type.startsWith('image/')) { resolve(file); return; }

      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        else if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  // ── Supabase Edge Function 파일 업로드 ──────────────────
  async function uploadFile(functionName, file) {
    // 이미지 압축 → base64 변환 → JSON 전송
    const compressed = await _compressImage(file);

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });

    const anonKey = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : '';
    const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

    const resp = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(anonKey ? { 'Authorization': `Bearer ${anonKey}` } : {}),
      },
      body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' }),
    });

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = result.error || `오류 (${resp.status})`;
      Toast.error(msg);
      throw new Error(msg);
    }
    return result;
  }

  return { get, post, patch, delete: del, uploadFile };
})();
