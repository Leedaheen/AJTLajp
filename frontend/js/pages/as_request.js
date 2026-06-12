/**
 * AS 요청 관리 페이지
 * - 신청 목록 (탭: 전체/접수대기/배정/처리중/완료/취소)
 * - AS 신청 폼 (tech·partner·aj)
 * - 기사 배정 (aj)
 * - 처리시작 / 완료 처리 (as_tech·aj)
 */
const AsRequestPage = (() => {
  const FAULT_TYPES = ['배터리 불량','유압 불량','조향 불량','리프트 불량','타이어 파손','충전기 불량','기타'];
  const STATUS_MAP = {
    requested:        { label:'접수 대기',   cls:'badge-pending' },
    assigned:         { label:'기사 배정',   style:'background:#ede9fe;color:#5b21b6' },
    in_progress:      { label:'처리 중',     style:'background:#fef3c7;color:#92400e' },
    material_pending: { label:'자재 수급 중', style:'background:#ffedd5;color:#9a3412' },
    completed:        { label:'처리 완료',   style:'background:#d1fae5;color:#065f46' },
    cancelled:        { label:'취소',        cls:'badge-rejected' },
  };

  let _currentTab = 'all';

  // ── 렌더 ─────────────────────────────────────────────────
  async function render() {
    const user = Auth.getUser();
    const canRequest = ['tech','partner','aj'].includes(user.role);

    document.getElementById('page-as-request').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 class="section-title" style="margin:0">AS 요청 관리</h2>
        ${canRequest ? `<button class="btn btn-primary btn-sm" onclick="AsRequestPage.openNewForm()">+ AS 신청</button>` : ''}
      </div>

      <div class="tab-bar" style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--gray-200);padding-bottom:0;flex-wrap:wrap">
        ${[
          ['all','전체'],['requested','접수대기'],['assigned','배정'],
          ['in_progress','처리중'],['material_pending','자재수급'],['completed','완료'],['cancelled','취소']
        ].map(([v,l]) => `
          <button class="tab-btn ${_currentTab===v?'active':''}" data-tab="${v}"
            onclick="AsRequestPage.switchTab('${v}')"
            style="padding:8px 14px;border:none;background:none;cursor:pointer;font-size:12px;font-weight:600;
            color:${_currentTab===v?'var(--navy)':'var(--gray-400)'};
            border-bottom:${_currentTab===v?'2px solid var(--navy)':'2px solid transparent'};
            margin-bottom:-2px">
            ${l}
          </button>
        `).join('')}
      </div>

      <!-- 검색 필터 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <input id="as-search" type="text" class="search-input" style="flex:1;min-width:180px"
          placeholder="장비번호, 업체명, 고장유형 검색"
          onkeydown="if(event.key==='Enter')AsRequestPage.loadList()">
        <select id="as-site" class="form-input form-select" style="width:120px">
          <option value="">전체 현장</option>
          <option value="P4">P4 복합동</option>
          <option value="P5">P5 복합동</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="AsRequestPage.loadList()">검색</button>
      </div>

      <div id="as-list"></div>
    `;

    await loadList();
  }

  function switchTab(tab) {
    _currentTab = tab;
    render();
  }

  // ── 목록 로드 ────────────────────────────────────────────
  async function loadList() {
    const container = document.getElementById('as-list');
    container.innerHTML = '<div style="text-align:center;padding:32px"><span class="spinner"></span></div>';

    try {
      const params = new URLSearchParams({ limit: 100 });
      if (_currentTab !== 'all') params.set('status', _currentTab);
      const q = document.getElementById('as-search')?.value.trim();
      const site = document.getElementById('as-site')?.value;
      if (q)    params.set('q', q);
      if (site) params.set('site_id', site);
      const list = await Api.get(`/as-requests?${params}`);

      if (!list.length) {
        container.innerHTML = '<div class="empty-state"><div>AS 요청 내역이 없습니다</div></div>';
        return;
      }
      container.innerHTML = list.map(r => _renderCard(r)).join('');
    } catch {
      container.innerHTML = '<div class="empty-state"><div>불러오기 실패</div></div>';
    }
  }

  function _renderCard(r) {
    const user = Auth.getUser();
    const isAj = user.role === 'aj';
    const isTech = user.role === 'as_tech';
    const st = STATUS_MAP[r.status] || { label: r.status, cls: '' };

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
            ${new Date(r.created_at).toLocaleDateString('ko-KR')}
          </div>
        </div>

        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px">
          <div><span class="text-muted">위치:</span> ${r.location}</div>
          <div><span class="text-muted">장비:</span> ${r.equip_no || '-'} ${r.equip_spec ? `(${r.equip_spec})` : ''}</div>
          <div><span class="text-muted">신청자:</span> ${r.reporter_name} (${r.reporter_phone})</div>
          <div><span class="text-muted">담당기사:</span> ${r.tech_name || '미배정'} ${r.tech_phone ? `(${r.tech_phone})` : ''}</div>
        </div>

        <div style="margin-top:10px;background:var(--gray-100);border-radius:8px;padding:10px;font-size:13px">
          <strong>증상:</strong> ${r.description}
          ${r.resolve_note ? `<div style="margin-top:6px;color:var(--navy)"><strong>처리 결과:</strong> ${r.resolve_note}</div>` : ''}
        </div>

        <!-- 액션 버튼 -->
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          ${isAj && r.status === 'requested' ? `
            <button class="btn btn-primary btn-sm" onclick="AsRequestPage.openAssignForm(${r.id})">기사 배정</button>
            <button class="btn btn-danger btn-sm" onclick="AsRequestPage.cancelRequest(${r.id})">취소</button>
          ` : ''}
          ${isAj && r.status === 'assigned' ? `
            <button class="btn btn-outline btn-sm" onclick="AsRequestPage.openAssignForm(${r.id})">배정 변경</button>
            <button class="btn btn-danger btn-sm" onclick="AsRequestPage.cancelRequest(${r.id})">취소</button>
          ` : ''}
          ${(isAj || isTech) && r.status === 'assigned' ? `
            <button class="btn btn-outline btn-sm" onclick="AsRequestPage.startWork(${r.id})">처리 시작</button>
          ` : ''}
          ${(isAj || isTech) && (r.status === 'in_progress' || r.status === 'material_pending') ? `
            <button class="btn btn-primary btn-sm" onclick="AsRequestPage.openResolveForm(${r.id})">완료 처리</button>
          ` : ''}
        </div>
      </div>
    `;
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
            <input id="as-equip-no" class="form-input" placeholder="예: P4-8M-A001">
          </div>
          <div class="form-group">
            <label class="form-label">장비 제원</label>
            <input id="as-equip-spec" class="form-input" placeholder="예: 8M">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">위치 (층/구역) <span style="color:var(--red)">*</span></label>
          <input id="as-location" class="form-input" placeholder="예: 5층 A구역">
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
            <label class="form-label">신청자 <span style="color:var(--red)">*</span></label>
            <input id="as-reporter" class="form-input" placeholder="이름">
          </div>
          <div class="form-group">
            <label class="form-label">연락처 <span style="color:var(--red)">*</span></label>
            <input id="as-phone" class="form-input" placeholder="010-0000-0000">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-submit-as">신청 완료</button>
      `,
    });
    document.getElementById('btn-submit-as').onclick = submitNewAs;
  }

  async function submitNewAs() {
    const siteId   = document.getElementById('as-site').value;
    const company  = document.getElementById('as-company').value.trim();
    const location = document.getElementById('as-location').value.trim();
    const fault    = document.getElementById('as-fault').value;
    const desc     = document.getElementById('as-desc').value.trim();
    const reporter = document.getElementById('as-reporter').value.trim();
    const phone    = document.getElementById('as-phone').value.trim();

    if (!company || !location || !desc || !reporter || !phone) {
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
      });
      Modal.close();
      Toast.success('AS 요청이 접수되었습니다. AJ관리자가 기사를 배정합니다.');
      loadList();
    } catch { btn.disabled=false; btn.textContent='신청 완료'; }
  }

  // ── 기사 배정 (AJ) ───────────────────────────────────────
  async function openAssignForm(reqId) {
    let techs = [];
    try {
      const users = await Api.get('/users?role=as_tech&status=active');
      techs = users;
    } catch { techs = []; }

    Modal.open({
      title: 'AS 기사 배정',
      body: `
        <div class="form-group">
          <label class="form-label">AS 기사 선택 <span style="color:var(--red)">*</span></label>
          ${techs.length ? `
            <select id="assign-tech" class="form-input form-select">
              <option value="">-- 기사 선택 --</option>
              ${techs.map(t => `<option value="${t.id}" data-name="${t.name}" data-phone="${t.phone||''}">${t.name} (${t.phone||'연락처 없음'})</option>`).join('')}
            </select>
          ` : `
            <p class="text-sm text-muted">등록된 AS 기사가 없습니다.</p>
            <div style="margin-top:12px">
              <input id="assign-tech-name" class="form-input" placeholder="기사 이름" style="margin-bottom:8px">
              <input id="assign-tech-phone" class="form-input" placeholder="연락처">
            </div>
          `}
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-assign">배정 완료</button>
      `,
    });

    document.getElementById('btn-do-assign').onclick = async () => {
      let techId, techName, techPhone;

      if (techs.length) {
        const sel = document.getElementById('assign-tech');
        const opt = sel.options[sel.selectedIndex];
        if (!sel.value) { Toast.error('기사를 선택해주세요.'); return; }
        techId    = sel.value;
        techName  = opt.dataset.name;
        techPhone = opt.dataset.phone;
      } else {
        techName  = document.getElementById('assign-tech-name')?.value.trim();
        techPhone = document.getElementById('assign-tech-phone')?.value.trim();
        techId    = techName; // fallback
        if (!techName) { Toast.error('기사 이름을 입력해주세요.'); return; }
      }

      const btn = document.getElementById('btn-do-assign');
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
      try {
        await Api.patch(`/as-requests/${reqId}/assign`, { tech_id: techId, tech_name: techName, tech_phone: techPhone });
        Modal.close();
        Toast.success('기사가 배정되었습니다. 담당 기사에게 알림이 전송됩니다.');
        loadList();
      } catch { btn.disabled=false; btn.textContent='배정 완료'; }
    };
  }

  // ── 처리 시작 ────────────────────────────────────────────
  async function startWork(reqId) {
    try {
      await Api.patch(`/as-requests/${reqId}/start`, {});
      Toast.success('처리 시작으로 변경되었습니다.');
      loadList();
    } catch {}
  }

  // ── 완료 처리 폼 ─────────────────────────────────────────
  function openResolveForm(reqId) {
    Modal.open({
      title: 'AS 완료 처리',
      body: `
        <div class="form-group">
          <label class="form-label">처리 결과 <span style="color:var(--red)">*</span></label>
          <textarea id="resolve-note" class="form-input" rows="3" placeholder="수리 내용을 입력해주세요"></textarea>
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
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
      try {
        await Api.patch(`/as-requests/${reqId}/resolve`, {
          resolve_note:  note,
          material_used: document.getElementById('resolve-material').value.trim(),
        });
        Modal.close();
        Toast.success('AS가 완료 처리되었습니다. 신청자에게 알림이 전송됩니다.');
        loadList();
      } catch { btn.disabled=false; btn.textContent='완료 저장'; }
    };
  }

  // ── 취소 ─────────────────────────────────────────────────
  async function cancelRequest(reqId) {
    if (!confirm('이 AS 요청을 취소하시겠습니까?')) return;
    try {
      await Api.patch(`/as-requests/${reqId}/cancel`, {});
      Toast.success('취소되었습니다.');
      loadList();
    } catch {}
  }

  return { render, switchTab, loadList, openNewForm, openAssignForm, startWork, openResolveForm, cancelRequest };
})();
