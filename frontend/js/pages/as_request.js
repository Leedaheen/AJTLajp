/**
 * AS 요청 관리 페이지
 * - 기사 배정 없이 AS기사가 직접 처리
 * - 상태: 접수대기 → 처리중 → (자재수급중) → 처리완료 / 보류 / 취소
 */
const AsRequestPage = (() => {
  const FAULT_TYPES = ['배터리 불량','유압 불량','조향 불량','리프트 불량','타이어 파손','충전기 불량','기타'];

  const STATUS_MAP = {
    requested:        { label:'접수 대기',   cls:'badge-pending' },
    in_progress:      { label:'처리 중',     style:'background:#fef3c7;color:#92400e' },
    material_pending: { label:'자재 수급 중', style:'background:#ffedd5;color:#9a3412' },
    held:             { label:'보류',        style:'background:#f1f5f9;color:#475569' },
    completed:        { label:'처리 완료',   style:'background:#d1fae5;color:#065f46' },
    cancelled:        { label:'취소',        cls:'badge-rejected' },
  };

  let _currentTab = 'all';
  let _cache = {};  // id → request object

  // ── 렌더 ─────────────────────────────────────────────────
  async function render() {
    const user = Auth.getUser();
    const canRequest = ['tech','partner','aj','admin'].includes(user.role);

    document.getElementById('page-as-request').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 class="section-title" style="margin:0">AS 요청 관리</h2>
        ${canRequest ? `<button class="btn btn-primary btn-sm" onclick="AsRequestPage.openNewForm()">+ AS 신청</button>` : ''}
      </div>

      <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--gray-200);padding-bottom:0;flex-wrap:wrap">
        ${[
          ['all','전체'],['requested','접수대기'],['in_progress','처리중'],
          ['material_pending','자재수급'],['held','보류'],['completed','완료'],['cancelled','취소']
        ].map(([v,l]) => `
          <button onclick="AsRequestPage.switchTab('${v}')"
            style="padding:8px 14px;border:none;background:none;cursor:pointer;font-size:12px;font-weight:600;
            color:${_currentTab===v?'var(--navy)':'var(--gray-400)'};
            border-bottom:${_currentTab===v?'2px solid var(--navy)':'2px solid transparent'};margin-bottom:-2px">
            ${l}
          </button>`).join('')}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <input id="as-search" type="text" class="search-input" style="flex:1;min-width:180px"
          placeholder="장비번호, 업체명, 고장유형 검색"
          onkeydown="if(event.key==='Enter')AsRequestPage.loadList()">
        <select id="as-site-filter" class="form-input form-select" style="width:120px">
          <option value="">전체 현장</option>
          <option value="P4">P4 복합동</option>
          <option value="P5">P5 복합동</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="AsRequestPage.loadList()">검색</button>
      </div>

      <div id="as-list"></div>
    `;

    await loadList();
    Realtime.on('as-requests', 'as_requests', loadList);
  }

  function switchTab(tab) { _currentTab = tab; render(); }

  // ── 목록 로드 ────────────────────────────────────────────
  async function loadList() {
    const container = document.getElementById('as-list');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:32px"><span class="spinner"></span></div>';

    try {
      const params = new URLSearchParams({ limit: 100 });
      if (_currentTab !== 'all') params.set('status', _currentTab);
      const q    = document.getElementById('as-search')?.value.trim();
      const site = document.getElementById('as-site-filter')?.value;
      if (q)    params.set('q', q);
      if (site) params.set('site_id', site);

      const list = await Api.get(`/as-requests?${params}`);
      _cache = {};
      list.forEach(r => { _cache[r.id] = r; });

      if (!list.length) {
        container.innerHTML = '<div class="empty-state"><div>AS 요청 내역이 없습니다</div></div>';
        return;
      }
      container.innerHTML = list.map(_renderCard).join('');
    } catch {
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
    const canCancel = canAct || isCreator;
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

    // 완료/취소 타임스탬프 + 소요시간 (접수 시간은 카드 우상단에 이미 표시)
    const tsItems = [
      r.in_progress_at && `<span><span class="text-muted">처리시작:</span> ${fmt(r.in_progress_at)}</span>`,
      r.material_at    && `<span><span class="text-muted">자재수급:</span> ${fmt(r.material_at)}</span>`,
      r.held_at        && `<span><span class="text-muted">보류:</span> ${fmt(r.held_at)}</span>`,
      r.resolved_at    && `<span><span class="text-muted">완료:</span> ${fmt(r.resolved_at)}${fmtElapsed(r.elapsed_min) ? ` <strong style="color:var(--navy)">(소요 ${fmtElapsed(r.elapsed_min)})</strong>` : ''}</span>`,
      r.cancelled_at   && `<span><span class="text-muted">취소:</span> ${fmt(r.cancelled_at)}</span>`,
    ].filter(Boolean);

    // 버튼
    const btns = [];
    if (canAct) {
      if (r.status === 'requested') {
        btns.push(`<button class="btn btn-primary btn-sm" onclick="AsRequestPage.startWork(${r.id})">처리 시작</button>`);
        btns.push(`<button class="btn btn-outline btn-sm" onclick="AsRequestPage.openHoldForm(${r.id})">보류</button>`);
      }
      if (r.status === 'in_progress') {
        btns.push(`<button class="btn btn-outline btn-sm" onclick="AsRequestPage.setMaterial(${r.id})">자재수급중</button>`);
        btns.push(`<button class="btn btn-primary btn-sm" onclick="AsRequestPage.openResolveForm(${r.id})">처리 완료</button>`);
        btns.push(`<button class="btn btn-outline btn-sm" onclick="AsRequestPage.openHoldForm(${r.id})">보류</button>`);
      }
      if (r.status === 'material_pending') {
        btns.push(`<button class="btn btn-primary btn-sm" onclick="AsRequestPage.openResolveForm(${r.id})">처리 완료</button>`);
        btns.push(`<button class="btn btn-outline btn-sm" onclick="AsRequestPage.openHoldForm(${r.id})">보류</button>`);
      }
      if (r.status === 'held') {
        btns.push(`<button class="btn btn-primary btn-sm" onclick="AsRequestPage.resumeWork(${r.id})">처리 재개</button>`);
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

  // ── AS 신청 폼 ───────────────────────────────────────────
  function openNewForm() {
    Modal.open({
      title: 'AS 신청',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">현장 <span style="color:var(--red)">*</span></label>
            <select id="as-site" class="form-input form-select">
              <option value="P4">P4 복합동</option>
              <option value="P5">P5 복합동</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">업체명 <span style="color:var(--red)">*</span></label>
            <input id="as-company" class="form-input" placeholder="업체명">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">장비번호</label>
            <input id="as-equip-no" class="form-input" placeholder="예: GF592">
          </div>
          <div class="form-group">
            <label class="form-label">장비 제원</label>
            <input id="as-equip-spec" class="form-input" placeholder="예: 8M">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">층 <span style="color:var(--red)">*</span></label>
            <select id="as-floor" class="form-input form-select">
              <option value="">-- 선택 --</option>
              <option value="모듈동">모듈동</option>
              <option value="1F외곽">1F외곽</option>
              <option value="1F">1F</option>
              <option value="2F">2F</option>
              <option value="3F">3F</option>
              <option value="4F">4F</option>
              <option value="5F">5F</option>
              <option value="6F">6F</option>
              <option value="7F">7F</option>
              <option value="8F">8F</option>
              <option value="9F">9F</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">세부 위치</label>
            <input id="as-location-detail" class="form-input" placeholder="예: A구역, 동편">
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
    const user = Auth.getUser();
    if (user?.name)  document.getElementById('as-reporter').value = user.name;
    if (user?.phone) document.getElementById('as-phone').value    = user.phone;
    document.getElementById('btn-submit-as').onclick = _submitNewAs;
  }

  async function _submitNewAs() {
    const siteId   = document.getElementById('as-site').value;
    const company  = document.getElementById('as-company').value.trim();
    const floor    = document.getElementById('as-floor').value;
    const detail   = document.getElementById('as-location-detail').value.trim();
    const location = detail ? `${floor} ${detail}` : floor;
    const fault    = document.getElementById('as-fault').value;
    const desc     = document.getElementById('as-desc').value.trim();
    const reporter = document.getElementById('as-reporter').value.trim();
    const phone    = document.getElementById('as-phone').value.trim();

    if (!company || !floor || !desc || !reporter || !phone) {
      Toast.error('필수 항목을 모두 입력해주세요.'); return;
    }

    const btn = document.getElementById('btn-submit-as');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      await Api.post('/as-requests', {
        site_id:       siteId,
        site_name:     siteId === 'P4' ? 'P4 복합동' : 'P5 복합동',
        company,
        equip_no:      document.getElementById('as-equip-no').value.trim(),
        equip_spec:    document.getElementById('as-equip-spec').value.trim(),
        location,
        fault_type:    fault,
        description:   desc,
        reporter_name: reporter,
        reporter_phone:phone,
        created_by:    Auth.getUser()?.id,
      });
      Modal.close();
      Toast.success('AS 요청이 접수되었습니다.');
      loadList();
    } catch { btn.disabled = false; btn.textContent = '신청 완료'; }
  }

  // ── 처리 시작 ────────────────────────────────────────────
  async function startWork(reqId) {
    try {
      await Api.patch(`/as-requests/${reqId}/start`, {});
      Toast.success('처리 시작으로 변경되었습니다.');
      loadList();
    } catch {}
  }

  // ── 자재 수급 중 ─────────────────────────────────────────
  async function setMaterial(reqId) {
    if (!confirm('자재 수급 중으로 변경하시겠습니까?')) return;
    try {
      await Api.patch(`/as-requests/${reqId}/material`, {});
      Toast.success('자재 수급 중으로 변경되었습니다.');
      loadList();
    } catch {}
  }

  // ── 보류 ─────────────────────────────────────────────────
  function openHoldForm(reqId) {
    Modal.open({
      title: 'AS 보류 처리',
      body: `
        <div style="font-size:13px;color:var(--gray-500);margin-bottom:12px">
          장비가 위치에 없거나 신청자와 연락이 되지 않는 경우 보류할 수 있습니다.
        </div>
        <div class="form-group">
          <label class="form-label">보류 사유 <span style="color:var(--red)">*</span></label>
          <textarea id="hold-reason" class="form-input" rows="3"
            placeholder="보류 사유를 입력해주세요 (예: 장비 위치 변경됨, 신청자 연락 불가)"></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-outline btn-sm" id="btn-do-hold" style="border-color:var(--gray-400);color:var(--gray-600)">보류 처리</button>
      `,
    });
    document.getElementById('btn-do-hold').onclick = async () => {
      const reason = document.getElementById('hold-reason').value.trim();
      if (!reason) { Toast.error('보류 사유를 입력해주세요.'); return; }
      const btn = document.getElementById('btn-do-hold');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/as-requests/${reqId}/hold`, { hold_reason: reason });
        Modal.close();
        Toast.success('보류 처리되었습니다.');
        loadList();
      } catch { btn.disabled = false; btn.textContent = '보류 처리'; }
    };
  }

  // ── 처리 재개 (보류 → 처리중) ────────────────────────────
  async function resumeWork(reqId) {
    try {
      await Api.patch(`/as-requests/${reqId}/resume`, {});
      Toast.success('처리 재개로 변경되었습니다.');
      loadList();
    } catch {}
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
        loadList();
      } catch { btn.disabled = false; btn.textContent = '완료 저장'; }
    };
  }

  // ── 취소 폼 (사유 필수) ───────────────────────────────────
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
        loadList();
      } catch { btn.disabled = false; btn.textContent = '취소 처리'; }
    };
  }

  // ── QR 스캔으로 진입 (장비 정보 미리 채움) ───────────────
  function openNewFormWithEquip(equip) {
    openNewForm();
    setTimeout(() => {
      const siteEl    = document.getElementById('as-site');
      const equipNoEl = document.getElementById('as-equip-no');
      const specEl    = document.getElementById('as-equip-spec');
      const companyEl = document.getElementById('as-company');

      if (siteEl && equip.site_id)  { siteEl.value    = equip.site_id;  siteEl.disabled   = true; }
      if (equipNoEl && equip.equip_no) {
        equipNoEl.value    = equip.equip_no;
        equipNoEl.readOnly = true;
        equipNoEl.style.background = 'var(--gray-100)';
      }
      if (specEl && equip.spec) {
        specEl.value    = equip.spec;
        specEl.readOnly = true;
        specEl.style.background = 'var(--gray-100)';
      }
      if (companyEl && equip.company) {
        companyEl.value    = equip.company;
        companyEl.readOnly = true;
        companyEl.style.background = 'var(--gray-100)';
      }
    }, 80);
  }

  return {
    render, switchTab, loadList,
    openNewForm, openNewFormWithEquip,
    startWork, setMaterial, resumeWork,
    openHoldForm, openResolveForm, openCancelForm,
  };
})();
