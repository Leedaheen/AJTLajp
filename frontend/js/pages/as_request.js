/**
 * AS 요청 관리 페이지
 * - 상태: 접수대기 → 자재수급중 / 보류 / 처리완료
 * - AS 신청: QR 스캔 경유 (협력사는 수기 신청도 가능)
 */
const AsRequestPage = (() => {
  const FAULT_TYPES = ['배터리 불량','유압 불량','조향 불량','리프트 불량','타이어 파손','충전기 불량','기타'];
  const FLOOR_OPTS  = ['모듈동','1F외곽','1F','2F','3F','4F','5F','6F','7F','8F','9F'];

  const STATUS_MAP = {
    requested:        { label:'접수 대기',   cls:'badge-pending' },
    material_pending: { label:'자재 수급 중', style:'background:#ffedd5;color:#9a3412' },
    held:             { label:'보류',        style:'background:#f1f5f9;color:#475569' },
    completed:        { label:'처리 완료',   style:'background:#d1fae5;color:#065f46' },
    cancelled:        { label:'취소',        cls:'badge-rejected' },
  };

  let _currentTab = 'all';
  let _cache = {};
  let _loadGen = 0;

  const _TABS = [
    ['all','전체'],['requested','접수대기'],
    ['material_pending','자재수급'],['held','보류'],['completed','완료'],['cancelled','취소'],
  ];

  function _updateTabStyles() {
    _TABS.forEach(([v]) => {
      const btn = document.getElementById(`as-tab-${v}`);
      if (!btn) return;
      const on = v === _currentTab;
      btn.style.color        = on ? 'var(--navy)' : 'var(--gray-400)';
      btn.style.borderBottom = on ? '2px solid var(--navy)' : '2px solid transparent';
    });
  }

  // ── 렌더 ─────────────────────────────────────────────────
  async function render() {
    const user = Auth.getUser();
    // 협력사만 수기 AS 신청 가능. aj/admin은 관리 목적으로 허용.
    const canManualRequest = ['partner','aj','admin'].includes(user.role);

    document.getElementById('page-as-request').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 class="section-title" style="margin:0">AS 요청 관리</h2>
        <div style="display:flex;gap:8px">
          ${['aj','admin'].includes(user.role) ? `<button class="btn btn-outline btn-sm" onclick="AsRequestPage.openLogViewer()">로그 확인</button>` : ''}
          ${canManualRequest ? `<button class="btn btn-primary btn-sm" onclick="AsRequestPage.openNewForm()">+ AS 신청</button>` : ''}
        </div>
      </div>

      <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--gray-200);padding-bottom:0;flex-wrap:wrap">
        ${_TABS.map(([v, l]) => {
          const hasBadge = ['requested','material_pending','held'].includes(v);
          return `
          <button id="as-tab-${v}" onclick="AsRequestPage.switchTab('${v}')"
            style="padding:8px 14px;border:none;background:none;cursor:pointer;font-size:12px;font-weight:600;
            color:${_currentTab===v?'var(--navy)':'var(--gray-400)'};
            border-bottom:${_currentTab===v?'2px solid var(--navy)':'2px solid transparent'};margin-bottom:-2px;
            display:flex;align-items:center;gap:5px">
            ${l}${hasBadge ? `<span id="as-badge-${v}" style="display:none;background:var(--red);color:#fff;border-radius:10px;font-size:10px;padding:1px 6px;font-weight:700;min-width:18px;text-align:center"></span>` : ''}
          </button>`;
        }).join('')}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <input id="as-search" type="text" class="search-input" style="flex:1;min-width:160px"
          placeholder="장비번호, 업체명, 고장유형 검색"
          onkeydown="if(event.key==='Enter')AsRequestPage.loadList()">
        <select id="as-site-filter" class="form-input form-select" style="width:120px">
          <option value="">전체 현장</option>
          <option value="P4">P4 복합동</option>
          <option value="P5">P5 복합동</option>
        </select>
        <select id="as-floor-filter" class="form-input form-select" style="width:110px">
          <option value="">전체 층수</option>
          ${FLOOR_OPTS.map(f => `<option value="${f}">${f}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" onclick="AsRequestPage.loadList()">검색</button>
      </div>

      <div id="as-list"></div>
    `;

    await loadList();
    Realtime.on('as-requests', 'as_requests', loadList);
  }

  function switchTab(tab) {
    _currentTab = tab;
    _updateTabStyles();
    loadList();
  }

  // ── 탭 배지 카운트 ───────────────────────────────────────
  async function _loadTabCounts() {
    try {
      const { data } = await _sb.from('as_requests').select('status');
      if (!data) return;
      const counts = {};
      data.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
      ['requested', 'material_pending', 'held'].forEach(s => {
        const badge = document.getElementById(`as-badge-${s}`);
        if (!badge) return;
        const n = counts[s] || 0;
        badge.textContent = n;
        badge.style.display = n ? 'inline-block' : 'none';
      });
    } catch { /* 무시 */ }
  }

  // ── 목록 로드 ────────────────────────────────────────────
  async function loadList() {
    const gen = ++_loadGen;
    const container = document.getElementById('as-list');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:32px"><span class="spinner"></span></div>';

    try {
      const searchVal = document.getElementById('as-search')?.value.trim();
      const siteVal   = document.getElementById('as-site-filter')?.value;
      const floorVal  = document.getElementById('as-floor-filter')?.value;

      let q = _sb.from('as_requests').select('*').order('requested_at', { ascending: false }).limit(500);
      if (_currentTab !== 'all') q = q.eq('status', _currentTab);
      if (siteVal)   q = q.eq('site_id', siteVal);
      if (searchVal) {
        const sq = searchVal.replace(/[,%()]/g, '');
        if (sq) q = q.or(`equip_no.ilike.%${sq}%,company.ilike.%${sq}%,fault_type.ilike.%${sq}%`);
      }

      const { data: raw, error } = await q;
      if (error) throw error;
      if (gen !== _loadGen) return;

      // 클라이언트 이중 필터
      let list = _currentTab !== 'all'
        ? (raw || []).filter(r => r.status === _currentTab)
        : (raw || []);

      if (floorVal) {
        list = list.filter(r =>
          r.location === floorVal || (r.location || '').startsWith(floorVal + ' ')
        );
      }

      _cache = {};
      list.forEach(r => { _cache[r.id] = r; });

      if (!list.length) {
        container.innerHTML = '<div class="empty-state"><div>AS 요청 내역이 없습니다</div></div>';
        return;
      }
      container.innerHTML = list.map(_renderCard).join('');
      _loadTabCounts();
    } catch (e) {
      if (gen !== _loadGen) return;
      console.error('[as-request] loadList 오류:', e);
      container.innerHTML = '<div class="empty-state"><div>불러오기 실패</div></div>';
    }
  }

  // ── 카드 렌더 ────────────────────────────────────────────
  function _renderCard(r) {
    const user      = Auth.getUser();
    const isAj      = ['aj','admin'].includes(user.role);
    const isTech    = user.role === 'as_tech';
    const isCreator = r.created_by === user.id ||
                      (r.reporter_name === user.name && r.reporter_phone === user.phone);
    const canAct    = isAj || isTech;
    const canCancel = canAct || (isCreator && r.status === 'requested');
    const st        = STATUS_MAP[r.status] || { label: r.status, cls: '' };

    const fmt = ts => {
      if (!ts) return null;
      const d = new Date(ts);
      return isNaN(d) ? null : d.toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    };

    const fmtElapsed = min => {
      if (min == null) return null;
      const d = Math.floor(min / 1440);
      const h = Math.floor((min % 1440) / 60);
      const m = min % 60;
      if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
      if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
      return `${m}m`;
    };

    const tsItems = [
      r.in_progress_at && `<span><span class="text-muted">처리시작:</span> ${fmt(r.in_progress_at)}</span>`,
      r.material_at    && `<span><span class="text-muted">자재수급:</span> ${fmt(r.material_at)}</span>`,
      r.held_at        && `<span><span class="text-muted">보류:</span> ${fmt(r.held_at)}</span>`,
      r.resolved_at    && `<span><span class="text-muted">완료:</span> ${fmt(r.resolved_at)}${fmtElapsed(r.elapsed_min) ? ` <strong style="color:var(--navy)">(소요 ${fmtElapsed(r.elapsed_min)})</strong>` : ''}</span>`,
      r.cancelled_at   && `<span><span class="text-muted">취소:</span> ${fmt(r.cancelled_at)}</span>`,
    ].filter(Boolean);

    const btns = [];
    if (canAct) {
      // requested 또는 in_progress(레거시) 상태: 처리중 단계 없이 바로 다음 단계로
      if (r.status === 'requested' || r.status === 'in_progress') {
        btns.push(`<button class="btn btn-outline btn-sm" onclick="AsRequestPage.setMaterial(${r.id})">자재수급중</button>`);
        btns.push(`<button class="btn btn-outline btn-sm" onclick="AsRequestPage.openHoldForm(${r.id})">보류</button>`);
        btns.push(`<button class="btn btn-primary btn-sm" onclick="AsRequestPage.openResolveForm(${r.id})">처리 완료</button>`);
      }
      if (r.status === 'material_pending') {
        btns.push(`<button class="btn btn-primary btn-sm" onclick="AsRequestPage.openResolveForm(${r.id})">처리 완료</button>`);
        btns.push(`<button class="btn btn-outline btn-sm" onclick="AsRequestPage.openHoldForm(${r.id})">보류</button>`);
      }
      if (r.status === 'held') {
        btns.push(`<button class="btn btn-outline btn-sm" onclick="AsRequestPage.setMaterial(${r.id})">자재수급중</button>`);
        btns.push(`<button class="btn btn-primary btn-sm" onclick="AsRequestPage.openResolveForm(${r.id})">처리 완료</button>`);
      }
    }
    if (canCancel && !['completed','cancelled'].includes(r.status)) {
      btns.push(`<button class="btn btn-danger btn-sm" onclick="AsRequestPage.openCancelForm(${r.id})">취소</button>`);
    }

    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <span class="badge ${st.cls||''}" ${st.style?`style="${st.style}"`:''}>
              ${st.label}
            </span>
            <div style="font-size:16px;font-weight:700;color:var(--navy);margin-top:6px">${r.fault_type}</div>
            <div class="text-sm text-muted" style="margin-top:2px">${r.company} · ${r.site_name}</div>
          </div>
          <div style="text-align:right;font-size:12px;color:var(--gray-400)">
            ${fmt(r.requested_at) || '-'}
          </div>
        </div>

        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px">
          <div><span class="text-muted">위치:</span> ${r.location || '-'}</div>
          <div><span class="text-muted">장비:</span> ${r.equip_no || '-'}${r.equip_spec ? ` (${r.equip_spec})` : ''}</div>
          <div><span class="text-muted">신청자:</span> ${r.reporter_name}
            <a href="tel:${r.reporter_phone}" style="color:var(--navy)">(${r.reporter_phone})</a>
          </div>
          <div><span class="text-muted">처리기사:</span> ${r.tech_name || '-'}</div>
        </div>

        <div style="margin-top:10px;background:var(--gray-100);border-radius:8px;padding:10px;font-size:13px">
          <strong>증상:</strong> ${r.description}
          ${r.resolve_note ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--gray-200);color:#065f46"><strong>처리 결과:</strong> ${r.resolve_note}</div>` : ''}
          ${r.hold_reason  ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--gray-200);color:#475569"><strong>보류 사유:</strong> ${r.hold_reason}</div>` : ''}
          ${r.cancel_reason ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--gray-200);color:var(--red)"><strong>취소 사유:</strong> ${r.cancel_reason}</div>` : ''}
        </div>

        ${tsItems.length ? `
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--gray-400)">
            ${tsItems.join('')}
          </div>
        ` : ''}

        ${btns.length ? `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">${btns.join('')}</div>` : ''}
      </div>`;
  }

  // ── 협력사 수기 AS 신청 폼 ──────────────────────────────
  async function openNewForm() {
    const user = Auth.getUser();
    const userCompany = user?.company || '';
    const defaultSiteId = user?.site_id === 'ALL' ? 'P4' : (user?.site_id || 'P4');

    const sites = await Api.get('/sites').catch(() => [{ code: 'P4', name: 'P4 복합동' }, { code: 'P5', name: 'P5 복합동' }]);

    Modal.open({
      title: 'AS 신청',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">현장 <span style="color:var(--red)">*</span></label>
            <select id="as-site" class="form-input form-select" onchange="AsRequestPage._onAsCompanyChange()">
              ${sites.map(s => `<option value="${s.code}" data-name="${s.name}"${s.code === defaultSiteId ? ' selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">업체명</label>
            <input id="as-company" class="form-input" value="${userCompany}" readonly
              style="background:var(--gray-100);color:var(--gray-500);cursor:default">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">장비번호 <span style="color:var(--red)">*</span></label>
            <select id="as-equip-no" class="form-input form-select" onchange="AsRequestPage._onAsEquipChange()">
              <option value="">-- 업체 선택 후 장비 선택 --</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">장비 모델명</label>
            <input id="as-equip-spec" class="form-input" readonly
              style="background:var(--gray-100);color:var(--gray-500)" placeholder="장비 선택 시 자동 표시">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">사용층수</label>
            <input id="as-floor" class="form-input" readonly
              style="background:var(--gray-100);color:var(--gray-500)" placeholder="장비 선택 시 자동 표시">
          </div>
          <div class="form-group">
            <label class="form-label">세부 위치 <span style="color:var(--red)">*</span></label>
            <input id="as-location-detail" class="form-input" placeholder="예: A/10열, F/30열"
              oninput="this.value=this.value.toUpperCase()" style="text-transform:uppercase">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">고장 유형 <span style="color:var(--red)">*</span></label>
          <select id="as-fault" class="form-input form-select">
            ${FAULT_TYPES.map(f => `<option value="${f}">${f}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">증상 설명 <span style="color:var(--red)">*</span></label>
          <textarea id="as-desc" class="form-input" rows="3" placeholder="고장 증상을 상세히 설명해주세요"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">신청자</label>
            <input id="as-reporter" class="form-input" readonly
              style="background:var(--gray-100);color:var(--gray-500);cursor:default">
          </div>
          <div class="form-group">
            <label class="form-label">연락처</label>
            <input id="as-phone" class="form-input" readonly
              style="background:var(--gray-100);color:var(--gray-500);cursor:default">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-submit-as">신청 완료</button>
      `,
    });
    if (user?.name)  document.getElementById('as-reporter').value = user.name;
    if (user?.phone) document.getElementById('as-phone').value    = user.phone;
    document.getElementById('btn-submit-as').onclick = _submitNewAs;

    // 모달 렌더 후 초기 장비 목록 자동 로드
    _onAsCompanyChange();
  }

  // 현장 변경 → 장비 목록 재로드 (업체는 고정)
  async function _onAsSiteChange() {
    await _onAsCompanyChange();
  }

  // 현장/업체 기준 사용 장비 목록 로드 (업체는 사용자 프로필에서 고정)
  async function _onAsCompanyChange() {
    const siteId  = document.getElementById('as-site')?.value;
    const company = document.getElementById('as-company')?.value;
    const eqEl    = document.getElementById('as-equip-no');
    if (!eqEl) return;
    eqEl.innerHTML = '<option value="">-- 장비 선택 --</option>';
    const floorEl = document.getElementById('as-floor');
    const specEl  = document.getElementById('as-equip-spec');
    if (floorEl) floorEl.value = '';
    if (specEl)  specEl.value  = '';
    if (!company) return;

    eqEl.innerHTML = '<option value="">불러오는 중...</option>';
    try {
      const qs = new URLSearchParams({ site_id: siteId, company, statuses: 'in_use,transit', limit: 200 });
      const rows = await Api.get(`/equipment?${qs}`, { silent: true });
      eqEl.innerHTML = '<option value="">-- 장비 선택 --</option>';
      if (!rows?.length) {
        const o = document.createElement('option');
        o.disabled = true; o.textContent = '현장에 해당 업체 장비가 없습니다';
        eqEl.appendChild(o);
        return;
      }
      rows.forEach(e => {
        const o = document.createElement('option');
        o.value = e.equip_no;
        o.textContent = `${e.equip_no}${e.model ? '  (' + e.model + ')' : ''}`;
        o.dataset.model = e.model || '';
        eqEl.appendChild(o);
      });
    } catch {
      eqEl.innerHTML = '<option value="">-- 장비 선택 --</option>';
    }
  }

  // 장비 선택 → 층수/모델 자동 입력
  async function _onAsEquipChange() {
    const eqEl    = document.getElementById('as-equip-no');
    const equip_no = eqEl?.value;
    const model   = eqEl?.options[eqEl.selectedIndex]?.dataset?.model || '';
    const specEl  = document.getElementById('as-equip-spec');
    const floorEl = document.getElementById('as-floor');
    if (specEl)  specEl.value  = model;
    if (floorEl) floorEl.value = '';
    if (!equip_no) return;
    try {
      const { data: log } = await _sb.from('usage_logs')
        .select('floor')
        .eq('equip_no', equip_no)
        .eq('status', 'using')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (log?.floor && floorEl) floorEl.value = log.floor;
    } catch { /* 층수 자동입력 실패 시 무시 */ }
  }

  async function _submitNewAs() {
    const siteEl   = document.getElementById('as-site');
    const siteId   = siteEl?.value;
    const siteName = siteEl?.options[siteEl.selectedIndex]?.getAttribute('data-name') || siteId;
    const company  = document.getElementById('as-company')?.value;
    const equipNo  = document.getElementById('as-equip-no')?.value;
    const floor    = document.getElementById('as-floor')?.value;
    const detail   = document.getElementById('as-location-detail')?.value.trim().toUpperCase();
    const location = detail ? (floor ? `${floor} ${detail}` : detail) : floor;
    const fault    = document.getElementById('as-fault').value;
    const desc     = document.getElementById('as-desc').value.trim();
    const reporter = document.getElementById('as-reporter').value.trim();
    const phone    = document.getElementById('as-phone').value.trim();

    if (!company)  { Toast.error('업체를 선택해주세요.'); return; }
    if (!equipNo)  { Toast.error('장비번호를 선택해주세요.'); return; }
    if (!detail)   { Toast.error('세부 위치를 입력해주세요.'); return; }
    if (!desc || !reporter || !phone) { Toast.error('필수 항목을 모두 입력해주세요.'); return; }

    const btn = document.getElementById('btn-submit-as');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      await Api.post('/as-requests', {
        site_id:       siteId,
        site_name:     siteName,
        company,
        equip_no:      equipNo,
        equip_spec:    document.getElementById('as-equip-spec')?.value || '',
        location,
        fault_type:    fault,
        description:   desc,
        reporter_name: reporter,
        reporter_phone: phone,
        created_by:    Auth.getUser()?.id,
      });
      Modal.close();
      Toast.success('AS 요청이 접수되었습니다.');
      await loadList();
    } catch { btn.disabled = false; btn.textContent = '신청 완료'; }
  }

  // ── 자재 수급 중 ─────────────────────────────────────────
  async function setMaterial(reqId) {
    if (!confirm('자재 수급 중으로 변경하시겠습니까?')) return;
    try {
      await Api.patch(`/as-requests/${reqId}/material`, {});
      Toast.success('자재 수급 중으로 변경되었습니다.');
      await loadList();
    } catch (e) { Toast.error('상태 변경에 실패했습니다.'); console.error(e); }
  }

  // ── 보류 ─────────────────────────────────────────────────
  const _HOLD_PRESETS = ['신청인 연락 부재중', '신청 위치에 장비 없음', '기타 (직접 입력)'];

  function _onHoldPresetChange() {
    const sel = document.getElementById('hold-preset');
    const customWrap = document.getElementById('hold-custom-wrap');
    if (!sel || !customWrap) return;
    customWrap.style.display = sel.value === '기타 (직접 입력)' ? '' : 'none';
  }

  function openHoldForm(reqId) {
    Modal.open({
      title: 'AS 보류 처리',
      body: `
        <div class="form-group">
          <label class="form-label">보류 사유 <span style="color:var(--red)">*</span></label>
          <select id="hold-preset" class="form-input form-select"
            onchange="AsRequestPage._onHoldPresetChange()">
            <option value="">-- 사유 선택 --</option>
            ${_HOLD_PRESETS.map(p => `<option value="${p}">${p}</option>`).join('')}
          </select>
        </div>
        <div id="hold-custom-wrap" style="display:none" class="form-group">
          <label class="form-label">직접 입력 <span style="color:var(--red)">*</span></label>
          <textarea id="hold-custom" class="form-input" rows="2"
            placeholder="보류 사유를 직접 입력해주세요"></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-outline btn-sm" id="btn-do-hold"
          style="border-color:var(--gray-400);color:var(--gray-600)">보류 처리</button>
      `,
    });
    document.getElementById('btn-do-hold').onclick = async () => {
      const preset = document.getElementById('hold-preset').value;
      if (!preset) { Toast.error('보류 사유를 선택해주세요.'); return; }
      const reason = preset === '기타 (직접 입력)'
        ? (document.getElementById('hold-custom').value.trim())
        : preset;
      if (!reason) { Toast.error('직접 입력 사유를 입력해주세요.'); return; }
      const btn = document.getElementById('btn-do-hold');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/as-requests/${reqId}/hold`, { hold_reason: reason });
        Modal.close();
        Toast.success('보류 처리되었습니다.');
        await loadList();
      } catch (e) { btn.disabled = false; btn.textContent = '보류 처리'; Toast.error('상태 변경에 실패했습니다.'); console.error(e); }
    };
  }

  // ── 처리 완료 폼 ─────────────────────────────────────────
  function openResolveForm(reqId) {
    const user = Auth.getUser();
    Modal.open({
      title: 'AS 처리 완료',
      body: `
        <div class="form-group">
          <label class="form-label">담당 기사</label>
          <input id="resolve-tech" class="form-input" placeholder="기사 이름"
            value="${user?.name || ''}"
            style="${user?.name ? 'background:var(--gray-100);color:var(--gray-500);cursor:default' : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">처리 결과 <span style="color:var(--red)">*</span></label>
          <textarea id="resolve-note" class="form-input" rows="3"
            placeholder="수리 내용을 구체적으로 입력해주세요"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">사용 부품/자재 (선택)</label>
          <input id="resolve-material" class="form-input" placeholder="예: 유압 호스 1개, 오일 2L">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-resolve">완료 저장</button>
      `,
    });
    document.getElementById('btn-do-resolve').onclick = async () => {
      const note = document.getElementById('resolve-note').value.trim();
      if (!note) { Toast.error('처리 결과를 입력해주세요.'); return; }
      const btn = document.getElementById('btn-do-resolve');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/as-requests/${reqId}/resolve`, {
          resolve_note:  note,
          material_used: document.getElementById('resolve-material').value.trim(),
          tech_name:     document.getElementById('resolve-tech').value.trim(),
        });
        Modal.close();
        Toast.success('AS 처리 완료되었습니다.');
        await loadList();
      } catch (e) { btn.disabled = false; btn.textContent = '완료 저장'; console.error(e); }
    };
  }

  // ── 취소 폼 ───────────────────────────────────────────────
  function openCancelForm(reqId) {
    const r = _cache[reqId];
    Modal.open({
      title: 'AS 요청 취소',
      body: `
        ${r ? `<div style="background:var(--gray-100);padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px">
          <strong>${r.fault_type}</strong> · ${r.company}<br>
          <span class="text-muted">${r.location}</span>
        </div>` : ''}
        <div class="form-group">
          <label class="form-label">취소 사유 <span style="color:var(--red)">*</span></label>
          <textarea id="cancel-reason" class="form-input" rows="3"
            placeholder="취소 사유를 입력해주세요"></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">돌아가기</button>
        <button class="btn btn-danger btn-sm" id="btn-do-cancel">취소 처리</button>
      `,
    });
    document.getElementById('btn-do-cancel').onclick = async () => {
      const reason = document.getElementById('cancel-reason').value.trim();
      if (!reason) { Toast.error('취소 사유를 입력해주세요.'); return; }
      const btn = document.getElementById('btn-do-cancel');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/as-requests/${reqId}/cancel`, { cancel_reason: reason });
        Modal.close();
        Toast.success('취소 처리되었습니다.');
        await loadList();
      } catch (e) { btn.disabled = false; btn.textContent = '취소 처리'; console.error(e); }
    };
  }

  // ── AS 로그 뷰어 (AJ 전용) ───────────────────────────────
  let _asLogEntries = [];

  function _renderAsLog(filter = {}) {
    const { q = '', date = '', status = '' } = filter;
    const ql = q.toLowerCase();
    const filtered = _asLogEntries.filter(e => {
      if (ql && ![e.company, e.equip_no, e.fault_type, e.who, e.action].some(v => (v || '').toLowerCase().includes(ql))) return false;
      if (date && !(e.at || '').startsWith(date)) return false;
      if (status && e.status !== status) return false;
      return true;
    });

    const listEl = document.getElementById('as-log-list');
    if (!listEl) return;

    if (!filtered.length) {
      listEl.innerHTML = '<div class="empty-state" style="padding:24px 0"><div>검색 결과가 없습니다</div></div>';
      return;
    }

    const groups = {};
    filtered.forEach(e => {
      const day = (e.at || '').slice(0, 10) || '날짜 없음';
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    });

    listEl.innerHTML = Object.entries(groups).map(([day, items]) => `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;color:var(--gray-400);letter-spacing:0.05em;
                    padding:4px 0;border-bottom:1px solid var(--gray-200);margin-bottom:10px">${day}</div>
        ${items.map(e => {
          const time = e.at ? new Date(e.at).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' }) : '';
          return `
            <div style="display:flex;gap:12px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--gray-100)">
              <div style="min-width:38px;text-align:right;font-size:11px;color:var(--gray-400);padding-top:2px">${time}</div>
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span style="${e.badgeStyle};font-size:10px;padding:2px 7px;border-radius:4px;display:inline-block">${e.action}</span>
                  <span style="font-size:12px;font-weight:600;color:var(--navy)">${e.equip_no || '-'}</span>
                  <span style="font-size:11px;color:var(--gray-400)">${e.company || ''}</span>
                  ${e.who ? `<span style="font-size:11px;color:var(--gray-400)">· ${e.who}</span>` : ''}
                </div>
                <div style="font-size:12px;color:var(--gray-600);margin-top:3px">${e.detail || ''}</div>
              </div>
            </div>`;
        }).join('')}
      </div>
    `).join('');
  }

  function _applyAsLogFilter() {
    _renderAsLog({
      q:      document.getElementById('as-log-q')?.value      || '',
      date:   document.getElementById('as-log-date')?.value   || '',
      status: document.getElementById('as-log-status')?.value || '',
    });
  }

  async function openLogViewer() {
    _asLogEntries = [];
    Modal.open({
      title: 'AS 처리 로그',
      body: `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <input id="as-log-q" type="text" class="form-input" style="flex:1;min-width:130px"
            placeholder="장비번호, 업체명, 고장유형 검색"
            oninput="AsRequestPage._applyAsLogFilter()">
          <input id="as-log-date" type="date" class="form-input" style="width:130px"
            onchange="AsRequestPage._applyAsLogFilter()">
          <select id="as-log-status" class="form-input form-select" style="width:100px"
            onchange="AsRequestPage._applyAsLogFilter()">
            <option value="">전체</option>
            <option value="requested">접수</option>
            <option value="held">보류</option>
            <option value="material_pending">자재수급</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소</option>
          </select>
        </div>
        <div id="as-log-list" style="max-height:60vh;overflow-y:auto;padding-right:4px">
          <div style="text-align:center;padding:32px"><span class="spinner"></span></div>
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>`,
    });
    const box = document.querySelector('.modal-box');
    if (box) box.style.maxWidth = '680px';

    try {
      const list = await Api.get('/as-requests?limit=200');
      const STATUS_BADGE = {
        requested:        'background:#dbeafe;color:#1e40af',
        material_pending: 'background:#ffedd5;color:#9a3412',
        held:             'background:#f1f5f9;color:#475569',
        completed:        'background:#d1fae5;color:#065f46',
        cancelled:        'background:#fee2e2;color:#991b1b',
      };
      const STATUS_LABEL = {
        requested:'접수 대기', material_pending:'자재수급', held:'보류', completed:'처리완료', cancelled:'취소'
      };

      const entries = [];
      list.forEach(r => {
        const base = { company: r.company, equip_no: r.equip_no, fault_type: r.fault_type, status: r.status };

        entries.push({ ...base, at: r.requested_at, who: r.reporter_name, action: '접수',
          badgeStyle: STATUS_BADGE.requested,
          detail: `${r.fault_type} · ${r.location || '-'}` });

        if (r.material_at)
          entries.push({ ...base, at: r.material_at, who: r.tech_name, action: '자재수급',
            badgeStyle: STATUS_BADGE.material_pending,
            detail: `${r.fault_type} · ${r.location || '-'}` });

        if (r.held_at)
          entries.push({ ...base, at: r.held_at, who: r.tech_name, action: '보류',
            badgeStyle: STATUS_BADGE.held,
            detail: r.hold_reason || '-' });

        if (r.resolved_at)
          entries.push({ ...base, at: r.resolved_at, who: r.tech_name, action: '처리완료',
            badgeStyle: STATUS_BADGE.completed,
            detail: r.resolve_note || '-' });

        if (r.cancelled_at)
          entries.push({ ...base, at: r.cancelled_at, who: r.tech_name, action: '취소',
            badgeStyle: STATUS_BADGE.cancelled,
            detail: r.cancel_reason || '-' });
      });

      entries.sort((a, b) => (b.at || '') > (a.at || '') ? 1 : -1);
      _asLogEntries = entries;
      _renderAsLog();
    } catch {
      const el = document.getElementById('as-log-list');
      if (el) el.innerHTML = '<div class="empty-state"><div>로그를 불러오지 못했습니다</div></div>';
    }
  }

  // ── QR 스캔 경유 AS 신청 ─────────────────────────────────
  async function openNewFormWithEquip(equip) {
    // 중복 AS 요청 확인 (처리 진행 중인 건이 있으면 차단)
    const { data: dup } = await _sb.from('as_requests')
      .select('id,status,fault_type,reporter_name')
      .eq('equip_no', equip.equip_no)
      .in('status', ['requested','in_progress','material_pending','held'])
      .maybeSingle();

    if (dup) {
      const dupStatus = STATUS_MAP[dup.status]?.label || dup.status;
      Modal.open({
        title: 'AS 요청 중복',
        body: `
          <div style="text-align:center;padding:16px 0">
            <div style="font-size:15px;font-weight:700;color:var(--red);margin-bottom:14px">
              이미 접수된 AS 요청이 있습니다
            </div>
            <div style="background:var(--gray-100);border-radius:8px;padding:12px 14px;font-size:13px;text-align:left">
              <div style="margin-bottom:4px"><span class="text-muted">장비번호:</span> <strong>${equip.equip_no}</strong></div>
              <div style="margin-bottom:4px"><span class="text-muted">고장유형:</span> ${dup.fault_type || '-'}</div>
              <div style="margin-bottom:4px"><span class="text-muted">현재 상태:</span> ${dupStatus}</div>
              <div><span class="text-muted">신청자:</span> ${dup.reporter_name || '-'}</div>
            </div>
            <div style="margin-top:14px;font-size:13px;color:var(--gray-500)">
              중복 접수는 불가합니다.<br>AS 처리 완료 후 재신청해주세요.
            </div>
          </div>
        `,
        footer: `<button class="btn btn-primary btn-sm" onclick="Modal.close()">확인</button>`,
      });
      return;
    }

    // 현재 사용중인 기록에서 층수 자동 조회
    let autoFloor = '';
    try {
      const { data: log } = await _sb.from('usage_logs')
        .select('floor')
        .eq('equip_no', equip.equip_no)
        .eq('status', 'using')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (log?.floor) autoFloor = log.floor;
    } catch {}

    const user      = Auth.getUser();
    const siteName  = equip.site_name || (equip.site_id === 'P4' ? 'P4 복합동' : equip.site_id === 'P5' ? 'P5 복합동' : equip.site_id || '');
    const modelLabel = equip.spec || equip.model || '-';

    const floorField = autoFloor
      ? `<input id="as-qr-floor" class="form-input" value="${autoFloor}" readonly
           style="background:var(--gray-100);color:var(--gray-500)">`
      : `<select id="as-qr-floor" class="form-input form-select">
           <option value="">-- 선택 --</option>
           ${FLOOR_OPTS.map(f => `<option value="${f}">${f}</option>`).join('')}
         </select>`;

    Modal.open({
      title: 'AS 신청',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">현장명</label>
            <input class="form-input" value="${siteName}" readonly style="background:var(--gray-100);color:var(--gray-500)">
          </div>
          <div class="form-group">
            <label class="form-label">업체명</label>
            <input class="form-input" value="${equip.company || '-'}" readonly style="background:var(--gray-100);color:var(--gray-500)">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">장비번호</label>
            <input class="form-input" value="${equip.equip_no}" readonly style="background:var(--gray-100);color:var(--gray-500)">
          </div>
          <div class="form-group">
            <label class="form-label">장비 모델명</label>
            <input class="form-input" value="${modelLabel}" readonly style="background:var(--gray-100);color:var(--gray-500)">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">사용층수 <span style="color:var(--red)">*</span></label>
            ${floorField}
          </div>
          <div class="form-group">
            <label class="form-label">세부 위치</label>
            <input id="as-qr-detail" class="form-input" placeholder="예: A/10열, F/30열"
              oninput="this.value=this.value.toUpperCase()" style="text-transform:uppercase">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">고장 유형 <span style="color:var(--red)">*</span></label>
          <select id="as-qr-fault" class="form-input form-select">
            ${FAULT_TYPES.map(f => `<option value="${f}">${f}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">증상 설명 <span style="color:var(--red)">*</span></label>
          <textarea id="as-qr-desc" class="form-input" rows="3" placeholder="고장 증상을 상세히 설명해주세요"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">신청자</label>
            <input class="form-input" value="${user?.name || ''}" readonly style="background:var(--gray-100);color:var(--gray-500)">
          </div>
          <div class="form-group">
            <label class="form-label">연락처</label>
            <input class="form-input" value="${user?.phone || ''}" readonly style="background:var(--gray-100);color:var(--gray-500)">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-submit-as-qr">신청 완료</button>
      `,
    });

    document.getElementById('btn-submit-as-qr').onclick = () => _submitNewAsWithEquip(equip, user);
  }

  async function _submitNewAsWithEquip(equip, user) {
    const floor  = document.getElementById('as-qr-floor').value;
    const detail = document.getElementById('as-qr-detail').value.trim();
    const fault  = document.getElementById('as-qr-fault').value;
    const desc   = document.getElementById('as-qr-desc').value.trim();

    if (!floor) { Toast.error('사용층수를 선택해주세요.'); return; }
    if (!desc)  { Toast.error('증상 설명을 입력해주세요.'); return; }

    const location = detail ? `${floor} ${detail}` : floor;
    const siteName = equip.site_name || (equip.site_id === 'P4' ? 'P4 복합동' : 'P5 복합동');

    const btn = document.getElementById('btn-submit-as-qr');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      await Api.post('/as-requests', {
        site_id:        equip.site_id,
        site_name:      siteName,
        company:        equip.company || '',
        equip_no:       equip.equip_no,
        equip_id:       equip.id,
        equip_spec:     equip.spec || equip.model || '',
        location,
        fault_type:     fault,
        description:    desc,
        reporter_name:  user?.name || '',
        reporter_phone: user?.phone || '',
        created_by:     user?.id,
      });
      Modal.close();
      Toast.success('AS 요청이 접수되었습니다.');
      await loadList();
    } catch {
      btn.disabled = false;
      btn.textContent = '신청 완료';
    }
  }

  return {
    render, switchTab, loadList,
    openNewForm, openNewFormWithEquip,
    _onAsSiteChange, _onAsCompanyChange, _onAsEquipChange,
    setMaterial, openHoldForm, _onHoldPresetChange, openResolveForm, openCancelForm,
    openLogViewer, _applyAsLogFilter,
  };
})();
