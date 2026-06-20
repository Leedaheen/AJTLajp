/**
 * 배차 관리 페이지
 * AJ관리자 전용 — 반입/반출 확정 건의 배차 요청/완료 관리
 *
 * 흐름:
 *   배차 대기 → [배차 요청] O/D번호·공사명·비고 입력
 *             → 배차 요청중 → [배차 완료 입력] 차량번호·기사 정보 입력
 *             → 배차 완료
 */
const DispatchPage = (() => {
  const _sb = window._sb;

  let _tab       = 'pending';   // pending | requested | done | all
  let _cache     = [];
  let _drivers   = [];
  let _notes     = {};          // { client_name: [content, ...] }
  let _cnames    = {};          // { "client_name|site_name": construction_name }
  let _q         = '';          // 검색어 (O/D번호, 장비번호, 업체명)
  let _centerFilter = '';       // 센터 필터

  // ── 날짜 포맷
  function _fmt(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d)) return '-';
    const h = d.getHours();
    return `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')} ${h<12?'오전':'오후'} ${String(h%12||12).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  // ── 영업일 D-1 체크
  function _isDMinus1(dateStr) {
    if (!dateStr) return false;
    const target = new Date(dateStr);
    const now    = new Date();
    now.setHours(0,0,0,0); target.setHours(0,0,0,0);
    const next = new Date(now);
    do { next.setDate(next.getDate()+1); } while (next.getDay()===0 || next.getDay()===6);
    return next.getTime() === target.getTime();
  }

  // ── 공사명 조회
  function _getCname(clientName, siteName) {
    return _cnames[`${clientName||''}|${siteName||''}`] || null;
  }

  // ──────────────────────────────────────────────────
  //  render / loadList
  // ──────────────────────────────────────────────────
  function render() {
    const el = document.getElementById('page-dispatch');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <div>
          <h1 class="page-title" style="margin:0">배차 관리</h1>
          <p style="margin:4px 0 0;font-size:13px;color:var(--gray-500)">반입/반출 확정 건의 배차를 요청하고 관리합니다</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="DispatchPage.openCnameModal()">공사명 관리</button>
          <button class="btn btn-outline btn-sm" onclick="DispatchPage.openNotesModal()">발주처 특이사항</button>
          <button class="btn btn-outline btn-sm" onclick="DispatchPage.openDriversModal()">기사 DB</button>
        </div>
      </div>
      <!-- 검색 바 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <div style="position:relative;flex:1;min-width:180px">
          <i class="ti ti-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--gray-400);font-size:15px;pointer-events:none"></i>
          <input id="dispatch-search" type="text" class="form-input"
            style="padding-left:32px;height:36px;font-size:13px"
            placeholder="O/D번호 · 장비번호 · 업체명"
            value="${_q}"
            oninput="DispatchPage.onSearch(this.value)">
        </div>
        <select id="dispatch-center-filter" class="form-input form-select"
          style="height:36px;font-size:13px;width:auto;min-width:110px"
          onchange="DispatchPage.onCenterFilter(this.value)">
          <option value="">전체 센터</option>
          ${_centerOptions().map(c => `<option value="${c}" ${_centerFilter===c?'selected':''}>${c}</option>`).join('')}
        </select>
        ${_q || _centerFilter ? `<button class="btn btn-outline btn-sm" style="height:36px;white-space:nowrap" onclick="DispatchPage.clearSearch()">초기화</button>` : ''}
      </div>
      <div id="dispatch-body"><div class="text-center" style="padding:40px 0;color:var(--gray-400)">로딩 중...</div></div>
    `;
    loadList();
  }

  async function loadList() {
    const [drvRes, noteRes, cnameRes, transitRes] = await Promise.all([
      _sb.from('drivers').select('*').order('name'),
      _sb.from('client_notes').select('*'),
      _sb.from('construction_names').select('*'),
      _sb.from('transit').select('*, dispatch(*)').in('status', ['confirmed','scheduled','completed']).order('scheduled_date', { ascending: true }),
    ]);

    _drivers = drvRes.data || [];
    _notes   = {};
    (noteRes.data || []).forEach(n => {
      if (!_notes[n.client_name]) _notes[n.client_name] = [];
      _notes[n.client_name].push(n.content);
    });
    _cnames = {};
    (cnameRes.data || []).forEach(c => {
      _cnames[`${c.client_name}|${c.site_name}`] = c.construction_name;
    });

    const clientFilter = App.getClientFilter();
    _cache = (transitRes.data || []).filter(r => !clientFilter || r.client_name === clientFilter);

    _renderBody();
  }

  // ──────────────────────────────────────────────────
  //  렌더
  // ──────────────────────────────────────────────────
  const DEFAULT_CENTERS = ['안성센터', '천안센터', '청주센터'];

  function _centerOptions() {
    const fromData = _cache
      .map(r => r.dispatch?.[0]?.center)
      .filter(c => c && !DEFAULT_CENTERS.includes(c));
    const extras = [...new Set(fromData)].sort();
    return [...DEFAULT_CENTERS, ...extras];
  }

  function _filtered(arr) {
    const q = _q.trim().toLowerCase();
    return arr.filter(r => {
      if (_centerFilter) {
        const c = r.dispatch?.[0]?.center || '';
        if (!c.includes(_centerFilter.replace('센터', ''))) return false;
      }
      if (!q) return true;
      const disp = r.dispatch?.[0] || {};
      return (disp.od_number     || '').toLowerCase().includes(q)
          || (r.aj_equip         || '').toLowerCase().includes(q)
          || (r.company          || '').toLowerCase().includes(q)
          || (r.site_name        || '').toLowerCase().includes(q);
    });
  }

  function _renderBody() {
    const pending    = _cache.filter(r => !r.dispatch?.length);
    const requested  = _cache.filter(r => r.dispatch?.length && r.dispatch[0].status === 'requested');
    const done       = _cache.filter(r => r.dispatch?.length && r.dispatch[0].status === 'completed');

    const d1Items = pending.filter(r => _isDMinus1(r.scheduled_date));

    const base = _tab === 'pending'   ? pending
               : _tab === 'requested' ? requested
               : _tab === 'done'      ? done
               : _cache;
    const list = _filtered(base);

    const el = document.getElementById('dispatch-body');
    if (!el) return;

    const alertHtml = d1Items.length
      ? `<div style="background:#FFFBEB;border:0.5px solid #FCD34D;border-radius:8px;padding:9px 12px;
          font-size:12px;color:#92400E;display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <i class="ti ti-bell-ringing" style="font-size:15px;flex-shrink:0"></i>
          오늘 배차 요청 필요 — ${d1Items.map(r=>`<strong>${r.company} ${r.type==='in'?'반입':'반출'}(${r.scheduled_date})</strong>`).join(', ')} (영업일 D-1)
        </div>` : '';

    const tab = (id, lbl, cnt) => `
      <div onclick="DispatchPage.setTab('${id}')"
        style="padding:8px 14px;font-size:12px;font-weight:500;cursor:pointer;margin-bottom:-1px;
          border-bottom:2px solid ${_tab===id?'#1B365D':'transparent'};
          color:${_tab===id?'#1B365D':'var(--gray-500)'}">
        ${lbl}${cnt?` <span style="background:${_tab===id?'#E8192C':'var(--gray-300)'};color:#fff;border-radius:10px;font-size:10px;padding:1px 6px;font-weight:700">${cnt}</span>`:''}
      </div>`;

    el.innerHTML = `
      ${alertHtml}
      <div style="display:flex;gap:0;border-bottom:1px solid var(--gray-200);margin-bottom:12px">
        ${tab('pending',   '배차 대기',   pending.length)}
        ${tab('requested', '배차 요청중', requested.length)}
        ${tab('done',      '배차 완료',   done.length)}
        ${tab('all',       '전체',        _cache.length)}
      </div>
      ${list.length === 0
        ? `<div class="text-center" style="padding:40px 0;color:var(--gray-400)">항목이 없습니다</div>`
        : list.map(_renderCard).join('')}
    `;
  }

  function _renderCard(t) {
    const disp    = t.dispatch?.[0];
    const status  = disp?.status || 'pending';   // pending | requested | completed
    const urgent  = status === 'pending' && _isDMinus1(t.scheduled_date);
    const typeLabel = t.type === 'in' ? '반입' : '반출';
    const clientNote = (_notes[t.client_name] || []).join(' · ');
    const cname   = _getCname(t.client_name, t.site_name);

    const BADGE = {
      pending:   `<span style="background:#FEF3C7;color:#92400E;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500">배차 대기</span>`,
      requested: `<span style="background:#DBEAFE;color:#1E40AF;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500">배차 요청중</span>`,
      completed: `<span style="background:#D1FAE5;color:#065F46;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500">배차 완료</span>
                  <span style="background:#EAF3DE;color:#3B6D11;font-size:10px;padding:1px 6px;border-radius:10px">반입/반출 자동반영</span>`,
    };

    const noteHtml = clientNote
      ? `<div style="background:#FFFBEB;border:0.5px solid #FCD34D;border-radius:7px;padding:8px 11px;
            font-size:11px;color:#92400E;display:flex;gap:7px;align-items:flex-start;line-height:1.6;margin-top:8px">
          <i class="ti ti-alert-triangle" style="font-size:14px;flex-shrink:0;margin-top:1px"></i>
          <div><strong>${t.client_name} 특이사항:</strong> ${clientNote}</div>
        </div>` : '';

    // ── 배차 대기: 배차 요청 버튼
    const pendingAction = `
      <div style="display:flex;gap:8px;margin-top:8px">
        <div style="flex:1;background:var(--gray-100);border:0.5px solid var(--gray-200);border-radius:8px;
          padding:7px 11px;font-size:13px;color:var(--gray-400);cursor:pointer"
          onclick="DispatchPage.openRequestModal(${t.id})">
          O/D번호·공사명 입력 후 배차 요청...
        </div>
        <button class="btn btn-primary btn-sm" onclick="DispatchPage.openRequestModal(${t.id})">배차 요청</button>
      </div>`;

    // ── 배차 요청중: 요청 내용 표시 + 배차 완료 입력 버튼
    const requestedAction = disp ? `
      <div style="display:grid;grid-template-columns:76px 1fr;gap:3px 10px;font-size:12px;margin-top:8px">
        ${disp.od_number  ? `<span style="color:var(--gray-500)">O/D번호</span><span style="font-weight:500;font-family:monospace;font-size:11px">${disp.od_number}</span>` : ''}
        ${cname           ? `<span style="color:var(--gray-500)">공사명</span><span>${cname}</span>` : ''}
        ${disp.note       ? `<span style="color:var(--gray-500)">비고</span><span style="color:var(--gray-600)">${disp.note}</span>` : ''}
        ${disp.arrival_time ? `<span style="color:var(--gray-500)">도착희망</span><span>${disp.arrival_time}</span>` : ''}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" onclick="DispatchPage.openRequestModal(${t.id})">요청 수정</button>
        <button class="btn btn-primary btn-sm" onclick="DispatchPage.openCompleteModal(${t.id})">배차 완료 입력</button>
      </div>` : '';

    // ── 배차 완료: 전체 정보 표시
    const completedAction = disp ? `
      <div style="display:grid;grid-template-columns:76px 1fr;gap:3px 10px;font-size:12px;margin-top:8px">
        ${disp.od_number     ? `<span style="color:var(--gray-500)">O/D번호</span><span style="font-weight:500;font-family:monospace;font-size:11px">${disp.od_number}</span>` : ''}
        <span style="color:var(--gray-500)">기사</span><span style="font-weight:500">${disp.driver_name} <a href="tel:${disp.driver_phone}" style="color:#1B365D;font-weight:400">${disp.driver_phone||''}</a></span>
        <span style="color:var(--gray-500)">차량</span><span>${disp.vehicle_plate}</span>
        ${disp.arrival_time  ? `<span style="color:var(--gray-500)">도착예정</span><span>${disp.arrival_time}</span>` : ''}
        ${disp.center        ? `<span style="color:var(--gray-500)">센터</span><span>${disp.center}</span>` : ''}
        ${disp.note          ? `<span style="color:var(--gray-500)">비고</span><span style="color:var(--gray-600)">${disp.note}</span>` : ''}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-outline btn-sm" onclick="DispatchPage.openCompleteModal(${t.id})">수정</button>
      </div>` : '';

    const action = status === 'pending'   ? pendingAction
                 : status === 'requested' ? requestedAction
                 : completedAction;

    return `
      <div class="card" style="margin-bottom:10px;${urgent?'border:1.5px solid #FCA5A5;':''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:4px">
              ${BADGE[status]}
              ${urgent ? `<span style="background:#FCEBEB;color:#A32D2D;font-size:10px;padding:1px 7px;border-radius:10px">D-1 오늘 요청 필요</span>` : ''}
              <span style="font-size:11px;color:var(--gray-400)">${typeLabel} · 확정일 ${t.scheduled_date||'-'}</span>
            </div>
            <div style="font-size:14px;font-weight:700;color:#1B365D">${t.company} · ${t.site_name||''}</div>
            ${cname ? `<div style="font-size:12px;color:var(--gray-600);margin-top:1px">공사명: ${cname}</div>` : ''}
            <div style="font-size:12px;color:var(--gray-500);margin-top:2px">
              ${t.client_name||''}${t.reporter_name?' · '+t.reporter_name:''} ${t.reporter_phone?`<a href="tel:${t.reporter_phone}" style="color:#1B365D">${t.reporter_phone}</a>`:''}
            </div>
          </div>
          <div style="font-size:11px;color:var(--gray-400);text-align:right;flex-shrink:0;line-height:1.7">
            ${t.record_id||''}
          </div>
        </div>
        ${noteHtml}
        ${action}
      </div>`;
  }

  function setTab(tab) { _tab = tab; _renderBody(); }

  function onSearch(val) {
    _q = val;
    _renderBody();
    // 초기화 버튼 표시 갱신
    const clr = document.querySelector('#dispatch-body')?.previousElementSibling?.querySelector('button');
    const wrap = document.querySelector('#dispatch-body')?.previousElementSibling;
    if (wrap) {
      const existing = wrap.querySelector('button[onclick*="clearSearch"]');
      if (_q || _centerFilter) {
        if (!existing) wrap.insertAdjacentHTML('beforeend', `<button class="btn btn-outline btn-sm" style="height:36px;white-space:nowrap" onclick="DispatchPage.clearSearch()">초기화</button>`);
      } else {
        existing?.remove();
      }
    }
  }

  function onCenterFilter(val) {
    _centerFilter = val;
    onSearch(_q);
  }

  function clearSearch() {
    _q = ''; _centerFilter = '';
    const s = document.getElementById('dispatch-search');
    const c = document.getElementById('dispatch-center-filter');
    if (s) s.value = '';
    if (c) c.value = '';
    _renderBody();
    document.querySelector('[onclick*="clearSearch"]')?.remove();
  }

  // ──────────────────────────────────────────────────
  //  배차 요청 모달 (O/D번호 입력 단계)
  // ──────────────────────────────────────────────────
  async function openRequestModal(transitId) {
    const t    = _cache.find(r => r.id === transitId);
    if (!t) return;
    const disp = t.dispatch?.[0] || {};
    const clientNote = (_notes[t.client_name] || []).join(' · ');
    const cname = _getCname(t.client_name, t.site_name);

    // 공사명 드롭다운 옵션
    const cnameOptions = Object.entries(_cnames)
      .filter(([k]) => k.startsWith(t.client_name+'|'))
      .map(([k, v]) => `<option value="${v}" ${(disp.construction_name||cname)===v?'selected':''}>${v}</option>`)
      .join('');

    Modal.open({
      title: '배차 요청',
      body: `
        <div style="font-size:12px;color:var(--gray-500);margin-bottom:6px">
          ${t.company} · ${t.site_name} ${t.type==='in'?'반입':'반출'} · 확정일 ${t.scheduled_date||'-'} · ${t.record_id||''}
        </div>
        ${clientNote ? `
        <div style="background:#FFFBEB;border:0.5px solid #FCD34D;border-radius:7px;padding:8px 11px;
          font-size:11px;color:#92400E;display:flex;gap:7px;margin-bottom:12px;line-height:1.6">
          <i class="ti ti-alert-triangle" style="font-size:14px;flex-shrink:0;margin-top:1px"></i>
          <div><strong>${t.client_name} 특이사항</strong> — ${clientNote}</div>
        </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label class="form-label">O/D번호 <span style="color:#E8192C">*</span></label>
            <input id="req-od" class="form-input" value="${disp.od_number||''}" placeholder="OD260606278">
          </div>
          <div>
            <label class="form-label">도착 희망시간</label>
            <input id="req-arrival" class="form-input" value="${disp.arrival_time||''}" placeholder="09:00">
          </div>
          <div style="grid-column:1/-1">
            <label class="form-label">공사명</label>
            <div style="display:flex;gap:6px">
              <select id="req-cname" class="form-input form-select" style="flex:1">
                <option value="">선택 또는 직접 입력</option>
                ${cnameOptions}
              </select>
              <input id="req-cname-text" class="form-input" style="flex:1"
                value="${disp.construction_name||cname||''}" placeholder="직접 입력">
            </div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:3px">
              선택 시 자동 입력 — 공사명 없으면 <button type="button" onclick="DispatchPage.Modal.close();DispatchPage.openCnameModal()" style="background:none;border:none;color:#1B365D;cursor:pointer;font-size:11px;padding:0;text-decoration:underline">공사명 관리</button>에서 등록
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">센터</label>
          <div style="display:flex;gap:6px">
            <select id="req-center-sel" class="form-input form-select" style="flex:1"
              onchange="DispatchPage._onCenterSelChange()">
              <option value="">선택</option>
              <option value="안성센터" ${(disp.center||'').includes('안성')?'selected':''}>안성센터</option>
              <option value="천안센터" ${(disp.center||'').includes('천안')?'selected':''}>천안센터</option>
              <option value="청주센터" ${(disp.center||'').includes('청주')?'selected':''}>청주센터</option>
              <option value="직접입력">직접 입력</option>
            </select>
            <input id="req-center-text" class="form-input" style="flex:1;display:none"
              value="${disp.center||''}" placeholder="센터명 직접 입력">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">비고 <span style="font-size:11px;color:var(--gray-400)">(표찰·등록 여부, 안전벨트 등)</span></label>
          <input id="req-note" class="form-input" value="${disp.note||''}"
            placeholder="예) 표찰O 등록O / 셀프카 안전벨트 필수">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" onclick="DispatchPage._saveRequest(${transitId},${disp.id||'null'})">배차 요청 저장</button>
      `,
    });

    // 드롭다운 선택 시 텍스트 필드 자동채우기
    setTimeout(() => {
      const sel = document.getElementById('req-cname');
      const txt = document.getElementById('req-cname-text');
      if (sel && txt) {
        sel.onchange = () => { if (sel.value) txt.value = sel.value; };
      }
    }, 100);
  }

  async function _saveRequest(transitId, dispatchId) {
    const od = document.getElementById('req-od')?.value?.trim();
    if (!od) { Toast.error('O/D번호를 입력해주세요.'); return; }

    const cnameText = document.getElementById('req-cname-text')?.value?.trim()
                   || document.getElementById('req-cname')?.value?.trim() || null;

    const centerSel  = document.getElementById('req-center-sel')?.value;
    const centerText = document.getElementById('req-center-text')?.value?.trim();
    const center     = centerSel === '직접입력' ? (centerText || null) : (centerSel || null);

    const payload = {
      transit_id:        transitId,
      od_number:         od,
      arrival_time:      document.getElementById('req-arrival')?.value?.trim() || null,
      construction_name: cnameText,
      center,
      note:              document.getElementById('req-note')?.value?.trim() || null,
      status:            'requested',
    };

    let error;
    if (dispatchId) {
      ({ error } = await _sb.from('dispatch').update(payload).eq('id', dispatchId));
    } else {
      ({ error } = await _sb.from('dispatch').insert(payload));
    }
    if (error) { Toast.error('저장 오류: '+(error.message||'')); return; }

    Modal.close();
    Toast.success('배차 요청 정보가 저장되었습니다.');
    loadList();
  }

  // ──────────────────────────────────────────────────
  //  배차 완료 모달 (차량·기사 정보 입력 단계)
  // ──────────────────────────────────────────────────
  async function openCompleteModal(transitId) {
    const t    = _cache.find(r => r.id === transitId);
    if (!t) return;
    const disp = t.dispatch?.[0] || {};
    if (!disp.id) { Toast.error('먼저 배차 요청을 완료해주세요.'); return; }
    const myCenter = Auth.getUser()?.center_name || '';

    const driverChips = _drivers.slice(0, 6).map(d =>
      `<div onclick="DispatchPage._fillDriver('${d.plate}','${d.name}','${d.phone}')"
        style="display:inline-flex;align-items:center;gap:4px;background:var(--gray-100);
        border:0.5px solid var(--gray-200);border-radius:6px;padding:3px 9px;
        font-size:11px;color:var(--gray-600);cursor:pointer;margin:2px">
        ${d.plate} · ${d.name}
      </div>`).join('');

    Modal.open({
      title: '배차 완료 입력',
      body: `
        <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px">
          ${t.company} · ${t.site_name} ${t.type==='in'?'반입':'반출'} · 확정일 ${t.scheduled_date||'-'}
        </div>
        ${disp.od_number ? `<div style="font-size:12px;font-family:monospace;color:var(--gray-700);margin-bottom:10px;font-weight:500">O/D ${disp.od_number}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label class="form-label">차량번호 <span style="color:#E8192C">*</span></label>
            <input id="cmp-plate" class="form-input" value="${disp.vehicle_plate||''}"
              placeholder="경기88자1330" oninput="DispatchPage._autoFillDriver(this.value)">
            <div style="margin-top:5px;display:flex;flex-wrap:wrap">${driverChips}</div>
          </div>
          <div>
            <label class="form-label">기사 성함 <span style="color:#E8192C">*</span></label>
            <input id="cmp-name" class="form-input" value="${disp.driver_name||''}" placeholder="홍길동">
          </div>
          <div>
            <label class="form-label">기사 연락처</label>
            <input id="cmp-phone" class="form-input" value="${disp.driver_phone||''}" placeholder="010-0000-0000">
          </div>
          <div>
            <label class="form-label">도착 예정시간</label>
            <input id="cmp-arrival" class="form-input" value="${disp.arrival_time||''}" placeholder="09:00">
          </div>
          <div>
            <label class="form-label">센터</label>
            <input id="cmp-center" class="form-input" value="${disp.center||myCenter}" placeholder="안성센터">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" onclick="DispatchPage._saveComplete(${transitId},${disp.id})">저장 · 반입/반출 자동반영</button>
      `,
    });
  }

  function _onCenterSelChange() {
    const sel  = document.getElementById('req-center-sel');
    const text = document.getElementById('req-center-text');
    if (!sel || !text) return;
    const isDirect = sel.value === '직접입력';
    text.style.display = isDirect ? '' : 'none';
    if (!isDirect) text.value = '';
  }

  function _autoFillDriver(plate) {
    const found = _drivers.find(d => d.plate === plate.trim());
    if (!found) return;
    const n = document.getElementById('cmp-name');
    const p = document.getElementById('cmp-phone');
    if (n && !n.value) n.value = found.name;
    if (p && !p.value) p.value = found.phone;
  }

  function _fillDriver(plate, name, phone) {
    const fp = document.getElementById('cmp-plate');
    const fn = document.getElementById('cmp-name');
    const fph = document.getElementById('cmp-phone');
    if (fp) { fp.value = plate; _autoFillDriver(plate); }
    if (fn) fn.value = name;
    if (fph) fph.value = phone;
  }

  async function _saveComplete(transitId, dispatchId) {
    const plate = document.getElementById('cmp-plate')?.value?.trim();
    const name  = document.getElementById('cmp-name')?.value?.trim();
    if (!plate || !name) { Toast.error('차량번호와 기사 성함은 필수입니다.'); return; }

    const phone  = document.getElementById('cmp-phone')?.value?.trim() || null;
    const payload = {
      vehicle_plate: plate,
      driver_name:   name,
      driver_phone:  phone,
      arrival_time:  document.getElementById('cmp-arrival')?.value?.trim() || null,
      center:        document.getElementById('cmp-center')?.value?.trim() || null,
      status:        'completed',
    };

    const { error } = await _sb.from('dispatch').update(payload).eq('id', dispatchId);
    if (error) { Toast.error('저장 오류: '+(error.message||'')); return; }

    // transit 카드에 배차 정보 동기화
    await _sb.from('transit').update({
      vehicle_info: `${plate}`,
      driver_info:  `${name}${phone?' '+phone:''}`,
    }).eq('id', transitId);

    // 기사 DB에 없으면 자동 추가
    if (!_drivers.find(d => d.plate === plate) && phone) {
      await _sb.from('drivers').insert({ plate, name, phone }).then(r => r).catch(() => {});
    }

    Modal.close();
    Toast.success('배차 정보가 저장되었습니다.');
    loadList();
  }

  // ──────────────────────────────────────────────────
  //  공사명 관리 모달
  // ──────────────────────────────────────────────────
  async function openCnameModal() {
    const { data: clients } = await _sb.from('clients').select('name').eq('active', true).order('name');
    const { data: rows }    = await _sb.from('construction_names').select('*').order('client_name').order('site_name');
    const clientOpts = (clients||[]).map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    Modal.open({
      title: '공사명 관리',
      body: `
        <div style="font-size:12px;color:var(--gray-500);margin-bottom:10px">
          발주처 + 현장명 조합에 공사명을 매핑합니다. 배차 요청 시 자동으로 표시됩니다.
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px" id="cname-list">
          ${(rows||[]).length === 0
            ? '<div style="text-align:center;padding:16px;color:var(--gray-400)">등록된 공사명이 없습니다</div>'
            : (rows||[]).map(r => `
              <div style="display:grid;grid-template-columns:80px 1fr 1fr auto;gap:6px;align-items:center;
                border:0.5px solid var(--gray-200);border-radius:8px;padding:8px 12px;font-size:12px">
                <span style="font-weight:500;color:#1B365D">${r.client_name}</span>
                <span style="color:var(--gray-600)">${r.site_name}</span>
                <span style="color:var(--gray-800)">${r.construction_name}</span>
                <button class="btn btn-sm" style="background:#FCEBEB;color:#A32D2D;border:none;white-space:nowrap"
                  onclick="DispatchPage._deleteCname(${r.id})">삭제</button>
              </div>`).join('')}
        </div>
        <div style="border-top:0.5px solid var(--gray-200);padding-top:12px">
          <div style="font-size:12px;font-weight:500;color:var(--gray-700);margin-bottom:8px">공사명 추가</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label class="form-label">발주처</label>
              <select id="cn-client" class="form-input form-select">
                <option value="">선택</option>
                ${clientOpts}
              </select>
            </div>
            <div>
              <label class="form-label">현장명</label>
              <input id="cn-site" class="form-input" placeholder="예) P5 복합동">
            </div>
            <div style="grid-column:1/-1">
              <label class="form-label">공사명</label>
              <input id="cn-name" class="form-input" placeholder="예) P5 삼성물산 신축공사">
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="DispatchPage._addCname()">추가</button>
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>`,
    });
  }

  async function _addCname() {
    const client = document.getElementById('cn-client')?.value?.trim();
    const site   = document.getElementById('cn-site')?.value?.trim();
    const name   = document.getElementById('cn-name')?.value?.trim();
    if (!client || !site || !name) { Toast.error('모든 항목을 입력해주세요.'); return; }
    const { error } = await _sb.from('construction_names').insert({ client_name: client, site_name: site, construction_name: name });
    if (error) { Toast.error('저장 오류'); return; }
    Toast.success('추가되었습니다.');
    Modal.close();
    openCnameModal();
  }

  async function _deleteCname(id) {
    if (!confirm('이 공사명을 삭제하시겠습니까?')) return;
    await _sb.from('construction_names').delete().eq('id', id);
    Toast.success('삭제되었습니다.');
    Modal.close();
    openCnameModal();
  }

  // ──────────────────────────────────────────────────
  //  발주처 특이사항 모달
  // ──────────────────────────────────────────────────
  async function openNotesModal() {
    const { data: clients } = await _sb.from('clients').select('name').eq('active', true).order('name');
    const { data: rows }    = await _sb.from('client_notes').select('*').order('client_name');
    const clientOpts = (clients||[]).map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    Modal.open({
      title: '발주처 특이사항',
      body: `
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          ${(rows||[]).length === 0
            ? '<div style="text-align:center;padding:16px;color:var(--gray-400)">등록된 특이사항이 없습니다</div>'
            : (rows||[]).map(n => `
              <div style="border:0.5px solid var(--gray-200);border-radius:8px;padding:10px 12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <span style="font-size:13px;font-weight:600;color:#1B365D">${n.client_name}</span>
                  <button class="btn btn-sm" style="background:#FCEBEB;color:#A32D2D;border:none"
                    onclick="DispatchPage._deleteNote(${n.id})">삭제</button>
                </div>
                <div style="font-size:12px;color:var(--gray-700);line-height:1.7">${n.content}</div>
              </div>`).join('')}
        </div>
        <div style="border-top:0.5px solid var(--gray-200);padding-top:12px">
          <div style="font-size:12px;font-weight:500;margin-bottom:8px">특이사항 추가</div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <select id="note-client" class="form-input form-select" style="flex:0 0 120px">
              <option value="">발주처 선택</option>
              ${clientOpts}
            </select>
            <input id="note-content" class="form-input" placeholder="특이사항 내용">
          </div>
          <button class="btn btn-primary btn-sm" onclick="DispatchPage._addNote()">추가</button>
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>`,
    });
  }

  async function _addNote() {
    const client  = document.getElementById('note-client')?.value?.trim();
    const content = document.getElementById('note-content')?.value?.trim();
    if (!client || !content) { Toast.error('발주처와 내용을 입력해주세요.'); return; }
    const { error } = await _sb.from('client_notes').insert({ client_name: client, content });
    if (error) { Toast.error('저장 오류'); return; }
    Toast.success('추가되었습니다.');
    Modal.close();
    openNotesModal();
  }

  async function _deleteNote(id) {
    if (!confirm('이 특이사항을 삭제하시겠습니까?')) return;
    await _sb.from('client_notes').delete().eq('id', id);
    Toast.success('삭제되었습니다.');
    Modal.close();
    openNotesModal();
  }

  // ──────────────────────────────────────────────────
  //  기사 DB 모달
  // ──────────────────────────────────────────────────
  async function openDriversModal() {
    const { data: rows } = await _sb.from('drivers').select('*').order('name');

    Modal.open({
      title: '배송기사 DB',
      body: `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:12px">
          ${(rows||[]).length === 0
            ? '<div style="color:var(--gray-400);font-size:12px">등록된 기사가 없습니다</div>'
            : (rows||[]).map(d => `
              <div style="border:0.5px solid var(--gray-200);border-radius:8px;padding:10px 12px;
                display:flex;align-items:center;justify-content:space-between;gap:8px">
                <div>
                  <div style="font-size:13px;font-weight:500">${d.name}</div>
                  <div style="font-size:11px;color:var(--gray-500);font-family:monospace">${d.plate}${d.phone?' · '+d.phone:''}</div>
                </div>
                <button class="btn btn-sm" style="background:#FCEBEB;color:#A32D2D;border:none"
                  onclick="DispatchPage._deleteDriver(${d.id})">삭제</button>
              </div>`).join('')}
        </div>
        <div style="border-top:0.5px solid var(--gray-200);padding-top:12px">
          <div style="font-size:12px;font-weight:500;margin-bottom:8px">기사 등록</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
            <input id="drv-plate" class="form-input" placeholder="차량번호">
            <input id="drv-name"  class="form-input" placeholder="기사명">
            <input id="drv-phone" class="form-input" placeholder="연락처">
          </div>
          <button class="btn btn-primary btn-sm" onclick="DispatchPage._addDriver()">등록</button>
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>`,
    });
  }

  async function _addDriver() {
    const plate = document.getElementById('drv-plate')?.value?.trim();
    const name  = document.getElementById('drv-name')?.value?.trim();
    const phone = document.getElementById('drv-phone')?.value?.trim();
    if (!plate || !name) { Toast.error('차량번호와 기사명은 필수입니다.'); return; }
    const { error } = await _sb.from('drivers').insert({ plate, name, phone });
    if (error) { Toast.error('저장 오류'); return; }
    Toast.success('등록되었습니다.');
    Modal.close();
    openDriversModal();
  }

  async function _deleteDriver(id) {
    if (!confirm('이 기사를 삭제하시겠습니까?')) return;
    await _sb.from('drivers').delete().eq('id', id);
    Toast.success('삭제되었습니다.');
    Modal.close();
    openDriversModal();
  }

  return {
    render, loadList, setTab, onSearch, onCenterFilter, clearSearch,
    openRequestModal, openCompleteModal,
    openCnameModal, openNotesModal, openDriversModal,
    _onCenterSelChange, _autoFillDriver, _fillDriver,
    _saveRequest, _saveComplete,
    _addCname, _deleteCname,
    _addNote, _deleteNote,
    _addDriver, _deleteDriver,
  };
})();
