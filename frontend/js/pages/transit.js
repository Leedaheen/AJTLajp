/**
 * 반입/반출 관리 페이지
 */
const TransitPage = (() => {
  const SPEC_OPTIONS = ['6M','8M','10M','12M','14M','16M','16M굴절','18M','20M굴절'];
  const STATUS_MAP = {
    requested:  { label:'신청 접수',    cls:'badge-pending'  },
    scheduled:  { label:'협력사 확인중', cls:'badge-active'   },
    confirmed:  { label:'일정 확정',    style:'background:#1B365D;color:#fff' },
    completed:  { label:'완료',         style:'background:#065f46;color:#fff' },
    cancelled:  { label:'취소',         cls:'badge-rejected'  },
  };
  const LS = 'transit_form_';

  let _currentTab = 'all';
  let _transitCache = {};  // id → transit object
  let _loadGen = 0;

  // ── localStorage 저장/불러오기 ───────────────────────────
  function _saveFormData() {
    [
      ['tr-reporter',      'reporter_name'],
      ['tr-phone',         'reporter_phone'],
      ['tr-manager',       'manager_name'],
      ['tr-manager-phone', 'manager_phone'],
    ].forEach(([id, key]) => {
      const v = document.getElementById(id)?.value.trim();
      if (v) localStorage.setItem(LS + key, v);
    });
  }

  function _autoFill() {
    const user = Auth.getUser();
    // 가입 정보 우선 → localStorage 보완
    const defaults = {
      reporter_name:  user?.name  || '',
      reporter_phone: user?.phone || '',
    };
    [
      ['tr-reporter',      'reporter_name'],
      ['tr-phone',         'reporter_phone'],
      ['tr-manager',       'manager_name'],
      ['tr-manager-phone', 'manager_phone'],
    ].forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = defaults[key] || localStorage.getItem(LS + key) || '';
    });
  }

  const _TABS = [
    ['all','전체'],['requested','신청'],['scheduled','협력사확인'],
    ['confirmed','확정'],['completed','완료'],['cancelled','취소'],
  ];

  function _updateTabStyles() {
    _TABS.forEach(([v]) => {
      const btn = document.getElementById(`tr-tab-${v}`);
      if (!btn) return;
      const on = v === _currentTab;
      btn.style.color       = on ? 'var(--navy)' : 'var(--gray-400)';
      btn.style.borderBottom = on ? '2px solid var(--navy)' : '2px solid transparent';
    });
  }

  // ── 렌더 ─────────────────────────────────────────────────
  async function render() {
    const user = Auth.getUser();
    const isAj = ['aj', 'admin'].includes(user.role);
    const canRequest = ['partner','aj','admin'].includes(user.role);

    document.getElementById('page-transit').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 class="section-title" style="margin:0">반입/반출 관리</h2>
        <div style="display:flex;gap:8px">
          ${isAj ? `<button class="btn btn-outline btn-sm" onclick="TransitPage.openLogViewer()">로그 확인</button>` : ''}
          ${canRequest ? `<button class="btn btn-primary btn-sm" onclick="TransitPage.openNewForm()">+ 신규 신청</button>` : ''}
        </div>
      </div>

      <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--gray-200);padding-bottom:0;flex-wrap:wrap">
        ${_TABS.map(([v, l]) => `
          <button id="tr-tab-${v}" onclick="TransitPage.switchTab('${v}')"
            style="padding:8px 14px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;
            color:${_currentTab===v?'var(--navy)':'var(--gray-400)'};
            border-bottom:${_currentTab===v?'2px solid var(--navy)':'2px solid transparent'};margin-bottom:-2px">
            ${l}
          </button>`).join('')}
      </div>

      <div id="transit-list"></div>
    `;
    await loadList();
    Realtime.on('transit', 'transit', loadList);
  }

  function switchTab(tab) {
    _currentTab = tab;
    _updateTabStyles();
    loadList();
  }

  // ── 목록 ────────────────────────────────────────────────
  async function loadList() {
    const gen = ++_loadGen;
    const c = document.getElementById('transit-list');
    if (!c) return;
    c.innerHTML = '<div style="text-align:center;padding:32px"><span class="spinner"></span></div>';
    try {
      let q = _sb.from('transit').select('*').order('created_at', { ascending: false }).limit(100);
      if (_currentTab !== 'all') {
        q = q.eq('status', _currentTab);
      }
      const { data: list, error } = await q;
      if (error) throw error;
      if (gen !== _loadGen) return;
      _transitCache = {};
      (list || []).forEach(t => { _transitCache[t.id] = t; });
      if (!list?.length) { c.innerHTML = '<div class="empty-state"><div>신청 내역이 없습니다</div></div>'; return; }
      c.innerHTML = list.map(_renderCard).join('');
    } catch (e) {
      if (gen !== _loadGen) return;
      console.error('[transit] loadList 오류:', e);
      c.innerHTML = '<div class="empty-state"><div>불러오기 실패</div></div>';
    }
  }

  function _renderCard(t) {
    const user      = Auth.getUser();
    const isAj      = ['aj', 'admin'].includes(user.role);
    const isPartner = user.role === 'partner';
    const st        = STATUS_MAP[t.status] || { label: t.status, cls: '' };
    const specs     = (t.equip_specs || []).map(s => `${s.spec}×${s.qty}`).join(', ');
    const typeLabel = t.type === 'in' ? '반입' : '반출';
    const specsAttr = encodeURIComponent(JSON.stringify(t.equip_specs || []));
    const safeCompany = (t.company || '').replace(/'/g, "\\'");

    // 버튼 표시 로직
    let btns = '';
    if (isAj) {
      if (t.status === 'requested') {
        btns = `
          <button class="btn btn-primary btn-sm" onclick="TransitPage.openScheduleForm(${t.id})">일정 확정</button>
          <button class="btn btn-danger btn-sm" onclick="TransitPage.openCancelForm(${t.id},'${safeCompany}')">취소</button>
        `;
      } else if (t.status === 'scheduled') {
        btns = `
          <span style="font-size:12px;color:var(--gray-400);padding:6px 10px;border:1px solid var(--gray-200);border-radius:6px">
            협력사 일정 확인 대기중
          </span>
          <button class="btn btn-outline btn-sm" onclick="TransitPage.openScheduleForm(${t.id})">일정 수정</button>
          ${t.aj_equip ? `<button class="btn btn-outline btn-sm" onclick="TransitPage.openEquipInfoForm(${t.id})">장비정보 수정</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="TransitPage.openCancelForm(${t.id},'${safeCompany}')">취소</button>
        `;
      } else if (t.status === 'confirmed') {
        btns = `
          <button class="btn btn-primary btn-sm"
            onclick="TransitPage.openCompleteForm(${t.id},'${t.type}','${safeCompany}','${specsAttr}')">
            ${typeLabel}완료
          </button>
          <button class="btn btn-outline btn-sm" onclick="TransitPage.openDispatchForm(${t.id})">배차정보 등록</button>
          ${t.aj_equip ? `<button class="btn btn-outline btn-sm" onclick="TransitPage.openEquipInfoForm(${t.id})">장비정보 수정</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="TransitPage.openQrPrint(${t.id})">QR 보기/인쇄</button>
          <button class="btn btn-outline btn-sm" onclick="TransitPage.openDocumentForm(${t.id})">서류확인</button>
          <button class="btn btn-danger btn-sm" onclick="TransitPage.openCancelForm(${t.id},'${safeCompany}')">취소</button>
        `;
      }
    } else if (isPartner) {
      if (t.status === 'requested') {
        btns = `<button class="btn btn-danger btn-sm" onclick="TransitPage.openCancelForm(${t.id},'${safeCompany}')">취소</button>`;
      } else if (t.status === 'scheduled') {
        btns = `
          <button class="btn btn-primary btn-sm" onclick="TransitPage.confirmSchedule(${t.id})">
            일정 확인완료
          </button>
        `;
      } else if (t.status === 'confirmed') {
        btns = `<button class="btn btn-outline btn-sm" onclick="TransitPage.openDocumentForm(${t.id})">서류확인</button>`;
      }
    }

    return `
      <div class="card" id="transit-card-${t.id}" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <span class="badge ${st.cls||''}" ${st.style?`style="${st.style}"`:''}>
              ${typeLabel} · ${st.label}
            </span>
            <div style="font-size:16px;font-weight:700;color:var(--navy);margin-top:6px">${t.company}</div>
            <div class="text-sm text-muted" style="margin-top:2px">
              ${t.site_name}${t.project ? ' · ' + t.project : ''}${specs ? ' · ' + specs : ''}
            </div>
          </div>
          <div style="text-align:right;font-size:12px;color:var(--gray-400)">
            ${new Date(t.created_at).toLocaleDateString('ko-KR')}
          </div>
        </div>

        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px">
          <div><span class="text-muted">희망일:</span> ${t.requested_date || '-'}</div>
          <div><span class="text-muted">확정일:</span> ${t.scheduled_date || '-'}</div>
          <div><span class="text-muted">신청자:</span> ${t.reporter_name} (${t.reporter_phone})</div>
          <div><span class="text-muted">배차:</span> ${[t.vehicle_info, t.driver_info].filter(Boolean).join(' / ') || '-'}</div>
        </div>

        ${t.aj_equip ? `
          <div style="margin-top:8px;font-size:13px;padding:8px 10px;background:var(--gray-100);border-radius:6px">
            <span class="text-muted">장비번호:</span>
            <span style="font-family:monospace;color:var(--navy);margin-left:4px">${t.aj_equip}</span>
          </div>
        ` : ''}

        ${t.status === 'scheduled' && t.scheduled_date !== t.requested_date ? `
          <div style="margin-top:8px;font-size:12px;padding:6px 10px;background:#fef3c7;border-radius:6px;color:#92400e">
            희망일(${t.requested_date})과 다른 날짜로 확정되었습니다. 확인 후 승인해주세요.
          </div>
        ` : ''}

        ${btns ? `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">${btns}</div>` : ''}

        ${(t.change_log && t.change_log.length) ? `
          <details style="margin-top:12px">
            <summary style="font-size:12px;color:var(--gray-400);cursor:pointer">변경 이력 ${t.change_log.length}건</summary>
            <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
              ${t.change_log.map(c => `
                <div style="font-size:11px;background:var(--gray-100);padding:6px 10px;border-radius:6px">
                  <strong>${c.who}</strong> · ${c.when}<br>${c.before} → <strong>${c.after}</strong>
                </div>`).join('')}
            </div>
          </details>
        ` : ''}
      </div>
    `;
  }

  // ── 신규 신청 폼 (sites/projects/companies 동적 로드) ───────
  async function openNewForm() {
    const [sites, projects] = await Promise.all([
      Api.get('/sites').catch(() => [{code:'P4',name:'P4 복합동'},{code:'P5',name:'P5 복합동'}]),
      Api.get('/projects').catch(() => [{code:'Ph1',name:'Phase 1'},{code:'Ph2',name:'Phase 2'},{code:'Ph3',name:'Phase 3'},{code:'Ph4',name:'Phase 4'}]),
    ]);

    Modal.open({
      title: '반입/반출 신청',
      body: `
        <!-- 사용계획서 자동입력 -->
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:600;color:#166534;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            사용계획서 자동입력
          </div>
          <div style="font-size:12px;color:#166534;margin-bottom:10px">
            삼성 승인 사용계획서 이미지(JPG/PNG) 또는 PDF를 업로드하면 내용이 자동으로 입력됩니다.
          </div>
          <label id="doc-upload-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="file" id="doc-file-input" accept="image/*,.pdf" style="display:none"
              onchange="TransitPage._onDocFileChange(this)">
            <span class="btn btn-outline btn-sm" style="border-color:#16a34a;color:#16a34a;pointer-events:none">
              파일 선택
            </span>
            <span id="doc-file-name" style="font-size:12px;color:#555">선택된 파일 없음</span>
          </label>
          <div id="doc-parse-status" style="margin-top:8px;font-size:12px;color:#166534;display:none"></div>
        </div>

        <div class="form-group">
          <label class="form-label">신청 종류 <span style="color:var(--red)">*</span></label>
          <div style="display:flex;gap:20px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="radio" name="tr-type" value="in" checked onchange="TransitPage._onTypeChange('in')"> 반입
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="radio" name="tr-type" value="out" onchange="TransitPage._onTypeChange('out')"> 반출
            </label>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">현장 <span style="color:var(--red)">*</span></label>
            <select id="tr-site" class="form-input form-select"
              onchange="TransitPage._onSiteChange()">
              ${sites.map(s => `<option value="${s.code}" data-name="${s.name}">${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">프로젝트 <span style="color:var(--red)">*</span></label>
            <select id="tr-project" class="form-input form-select">
              <option value="">-- 선택 --</option>
              ${projects.map(p => `<option value="${p.code}">${p.code} · ${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">업체명 <span style="color:var(--red)">*</span></label>
            <select id="tr-company" class="form-input form-select"
              onchange="TransitPage._onCompanyChange()">
              <option value="">-- 업체 선택 --</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">신청자</label>
            <input id="tr-reporter" class="form-input" readonly
              style="background:var(--gray-100);color:var(--gray-500);cursor:default">
          </div>
          <div class="form-group">
            <label class="form-label">신청자 연락처</label>
            <input id="tr-phone" class="form-input" readonly
              style="background:var(--gray-100);color:var(--gray-500);cursor:default">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">양중담당자</label>
            <input id="tr-manager" class="form-input" placeholder="이름">
          </div>
          <div class="form-group">
            <label class="form-label">양중담당자 연락처</label>
            <input id="tr-manager-phone" class="form-input" placeholder="010-0000-0000">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" id="tr-date-label">희망 반입 날짜 <span style="color:var(--red)">*</span></label>
          <input id="tr-date" type="date" class="form-input">
        </div>

        <div id="tr-specs-section" class="form-group">
          <label class="form-label">장비 제원 및 수량 <span style="color:var(--red)">*</span></label>
          <div id="tr-specs"></div>
          <button type="button" class="btn btn-outline btn-sm" style="margin-top:8px"
            onclick="TransitPage.addSpecRow()">+ 장비 추가</button>
        </div>

        <div id="tr-equip-nos-section" class="form-group" style="display:none">
          <label class="form-label">반출 장비 선택 <span style="color:var(--red)">*</span></label>

          <!-- 체크리스트 — 업체+현장 선택 시 자동 로드 -->
          <div id="tr-equip-checklist"
            style="border:1px solid var(--gray-200);border-radius:8px;
                   max-height:220px;overflow-y:auto;background:#fff">
            <div style="text-align:center;padding:20px;color:var(--gray-400);font-size:13px">
              현장과 업체를 선택하면 장비 목록이 표시됩니다.
            </div>
          </div>

          <!-- 선택 요약 -->
          <div id="tr-equip-selected-summary"
            style="margin-top:8px;min-height:28px;padding:6px 10px;
                   background:var(--gray-100);border-radius:6px;font-size:12px;
                   color:var(--gray-500)">
            선택된 장비 없음
          </div>

          <!-- 직접 입력 폴백 -->
          <div style="margin-top:6px">
            <button type="button" onclick="TransitPage._toggleManualInput()"
              style="font-size:11px;color:var(--gray-400);background:none;border:none;
                     cursor:pointer;text-decoration:underline;padding:0">
              목록에 없으면 직접 입력
            </button>
            <input id="tr-equip-nos" class="form-input" style="display:none;margin-top:6px;text-transform:uppercase"
              placeholder="GF123, GF516, GG112 (쉼표로 구분)"
              oninput="this.value=this.value.toUpperCase()">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">비고</label>
          <textarea id="tr-note" class="form-input" rows="2" placeholder="특이사항 입력"></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-submit-transit">신청 완료</button>
      `,
    });

    _autoFill();
    document.getElementById('tr-specs').innerHTML = '';
    addSpecRow();
    document.getElementById('btn-submit-transit').onclick = _submitNewTransit;

    // 업체 목록 초기 로드 (현장 기본값 기준)
    _loadCompanyOptions();
  }

  function _onTypeChange(type) {
    const label   = document.getElementById('tr-date-label');
    const specsEl = document.getElementById('tr-specs-section');
    const equipEl = document.getElementById('tr-equip-nos-section');
    if (label)   label.innerHTML = `희망 ${type === 'in' ? '반입' : '반출'} 날짜 <span style="color:var(--red)">*</span>`;
    if (specsEl) specsEl.style.display = type === 'in' ? '' : 'none';
    if (equipEl) equipEl.style.display = type === 'out' ? '' : 'none';
    // 반출 선택 시 장비 목록 로드 시도
    if (type === 'out') _loadEquipChecklist();
  }

  // ── 현장 변경 → 업체 목록 재로드 ────────────────────────
  async function _onSiteChange() {
    await _loadCompanyOptions();
    _loadEquipChecklist();
  }

  // ── 업체 변경 → 장비 체크리스트 재로드 ──────────────────
  function _onCompanyChange() {
    _loadEquipChecklist();
  }

  // ── 업체 드롭다운 채우기 ──────────────────────────────────
  async function _loadCompanyOptions() {
    const siteEl = document.getElementById('tr-site');
    const coEl   = document.getElementById('tr-company');
    if (!coEl) return;
    const siteId = siteEl?.value || '';
    try {
      const list = await Api.get(`/companies${siteId ? `?site_id=${siteId}` : ''}`);
      const prev = coEl.value;
      coEl.innerHTML = '<option value="">-- 업체 선택 --</option>';
      list.forEach(c => {
        const o = document.createElement('option');
        o.value = c.name; o.textContent = c.name;
        if (c.name === prev) o.selected = true;
        coEl.appendChild(o);
      });
    } catch { /* DB에 업체 없으면 빈 목록 유지 */ }
  }

  // ── 반출 장비 체크리스트 로드 ────────────────────────────
  async function _loadEquipChecklist() {
    const type    = document.querySelector('input[name="tr-type"]:checked')?.value;
    if (type !== 'out') return;

    const siteEl = document.getElementById('tr-site');
    const coEl   = document.getElementById('tr-company');
    const listEl = document.getElementById('tr-equip-checklist');
    if (!listEl) return;

    const siteId  = siteEl?.value || '';
    const company = coEl?.value || '';

    if (!siteId || !company) {
      listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:13px">현장과 업체를 선택하면 장비 목록이 표시됩니다.</div>';
      _updateSelectedSummary([]);
      return;
    }

    listEl.innerHTML = '<div style="text-align:center;padding:16px"><span class="spinner"></span></div>';

    try {
      const qs = new URLSearchParams({ site_id: siteId, company, statuses: 'in_use,transit', limit: 200 });
      const rows = await Api.get(`/equipment?${qs}`, { silent: true });

      if (!rows || !rows.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:13px">현재 현장에 해당 업체의 장비가 없습니다.</div>';
        _updateSelectedSummary([]);
        return;
      }

      listEl.innerHTML = rows.map(e => `
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                      cursor:pointer;border-bottom:1px solid var(--gray-100);
                      transition:background 0.1s" class="equip-check-row"
               onmouseover="this.style.background='var(--gray-50)'"
               onmouseout="this.style.background=''">
          <input type="checkbox" value="${e.equip_no}" class="equip-checkbox"
            onchange="TransitPage._onEquipCheck()"
            style="width:16px;height:16px;cursor:pointer;accent-color:var(--navy)">
          <span style="font-family:monospace;font-weight:600;color:var(--navy);font-size:14px">${e.equip_no}</span>
          <span class="badge" style="background:var(--gray-100);color:var(--gray-600);font-size:11px">${e.spec || '-'}</span>
          <span style="margin-left:auto;font-size:11px;color:${e.status==='in_use'?'#065f46':'#92400e'}">
            ${e.status === 'in_use' ? '사용중' : '이동중'}
          </span>
        </label>
      `).join('');

    } catch {
      listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:13px">장비 목록 조회 실패</div>';
    }
  }

  // ── 체크박스 변경 시 선택 요약 업데이트 ─────────────────
  function _onEquipCheck() {
    const checked = [...document.querySelectorAll('.equip-checkbox:checked')].map(cb => cb.value);
    _updateSelectedSummary(checked);
  }

  function _updateSelectedSummary(selected) {
    const el = document.getElementById('tr-equip-selected-summary');
    if (!el) return;
    if (!selected.length) {
      el.style.color = 'var(--gray-400)';
      el.textContent = '선택된 장비 없음';
    } else {
      el.style.color = 'var(--navy)';
      el.textContent = `선택됨 ${selected.length}대: ${selected.join(', ')}`;
    }
  }

  // ── 직접 입력 토글 ────────────────────────────────────────
  function _toggleManualInput() {
    const inp = document.getElementById('tr-equip-nos');
    if (!inp) return;
    inp.style.display = inp.style.display === 'none' ? '' : 'none';
    if (inp.style.display !== 'none') inp.focus();
  }

  function addSpecRow() {
    const container = document.getElementById('tr-specs');
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';
    row.innerHTML = `
      <select class="form-input form-select spec-select" style="flex:1">
        ${SPEC_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <input type="number" class="form-input spec-qty" value="1" min="1" max="99"
        style="width:70px;text-align:center">
      <span style="font-size:13px;color:var(--gray-400)">대</span>
      <button type="button" onclick="this.parentElement.remove()"
        style="background:none;border:none;color:var(--red);cursor:pointer;font-size:20px;line-height:1">×</button>
    `;
    container.appendChild(row);
  }

  // ── 사용계획서 파일 선택 이벤트 ─────────────────────────
  async function _onDocFileChange(input) {
    const file = input.files?.[0];
    if (!file) return;

    const nameEl   = document.getElementById('doc-file-name');
    const statusEl = document.getElementById('doc-parse-status');
    if (nameEl) nameEl.textContent = file.name;
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '문서 분석 중...'; }

    try {
      const res = await Api.uploadFile('parse-doc', file);
      if (res?.success && res.data) {
        _applyParsedData(res.data);
        if (statusEl) statusEl.textContent = '자동입력 완료. 내용을 확인하고 필요 시 수정해주세요.';
      }
    } catch {
      if (statusEl) statusEl.textContent = '인식 실패. 선명한 이미지로 다시 시도해주세요.';
    }
  }

  // ── 파싱 결과를 폼 필드에 자동 채움 ─────────────────────
  function _applyParsedData(d) {
    // 업체명 — select에서 일치하는 옵션 선택, 없으면 옵션 추가
    if (d.company) {
      const el = document.getElementById('tr-company');
      if (el) {
        const found = [...el.options].find(o => o.value === d.company);
        if (found) {
          el.value = d.company;
        } else {
          const o = document.createElement('option');
          o.value = d.company; o.textContent = d.company;
          el.appendChild(o);
          el.value = d.company;
        }
        _loadEquipChecklist();
      }
    }

    // 현장 코드
    if (d.site_code) {
      const el = document.getElementById('tr-site');
      if (el) {
        const opt = [...el.options].find(o => o.value === d.site_code);
        if (opt) el.value = d.site_code;
      }
    }

    // 장비 제원/수량
    if (Array.isArray(d.specs) && d.specs.length > 0) {
      const container = document.getElementById('tr-specs');
      if (container) {
        container.innerHTML = '';
        d.specs.forEach(s => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';
          row.innerHTML = `
            <select class="form-input form-select spec-select" style="flex:1">
              ${SPEC_OPTIONS.map(sp => `<option value="${sp}" ${sp === s.spec ? 'selected' : ''}>${sp}</option>`).join('')}
            </select>
            <input type="number" class="form-input spec-qty" value="${s.qty || 1}" min="1" max="99"
              style="width:70px;text-align:center">
            <span style="font-size:13px;color:var(--gray-400)">대</span>
            <button type="button" onclick="this.parentElement.remove()"
              style="background:none;border:none;color:var(--red);cursor:pointer;font-size:20px;line-height:1">×</button>
          `;
          container.appendChild(row);
        });
      }
    }

    // 희망 반입 날짜 (요청기간 시작일)
    if (d.start_date) {
      const el = document.getElementById('tr-date');
      if (el) el.value = d.start_date;
    }

    // 비고 — 작업내용 + 사용장소 + 요청기간
    const noteParts = [];
    if (d.work_content) noteParts.push(`작업내용: ${d.work_content}`);
    if (d.location)     noteParts.push(`사용장소: ${d.location}`);
    if (d.start_date && d.end_date) noteParts.push(`요청기간: ${d.start_date} ~ ${d.end_date}`);

    if (noteParts.length) {
      const el = document.getElementById('tr-note');
      if (el) el.value = noteParts.join('\n');
    }

    // 양중담당자 위치 (층 정보)
    if (d.floor) {
      const el = document.getElementById('tr-manager-location');
      if (el && !el.value) el.value = d.floor;
    }

    Toast.success('사용계획서 내용이 자동으로 입력되었습니다.');
  }

  async function _submitNewTransit() {
    const type    = document.querySelector('input[name="tr-type"]:checked')?.value;
    const siteEl  = document.getElementById('tr-site');
    const siteId  = siteEl?.value;
    const siteName= siteEl?.options[siteEl?.selectedIndex]?.getAttribute('data-name') || siteId;
    const project = document.getElementById('tr-project')?.value;
    const company = document.getElementById('tr-company').value.trim();
    const reporter= document.getElementById('tr-reporter').value.trim();
    const phone   = document.getElementById('tr-phone').value.trim();
    const date    = document.getElementById('tr-date').value;

    if (!company) { Toast.error('업체를 선택해주세요.'); return; }
    if (!reporter || !phone) { Toast.error('필수 항목을 모두 입력해주세요.'); return; }
    if (!project) { Toast.error('프로젝트를 선택해주세요.'); return; }
    if (!date) { Toast.error(`희망 ${type === 'in' ? '반입' : '반출'} 날짜를 선택해주세요.`); return; }

    let equip_specs = [], equip_nos = '';

    if (type === 'in') {
      document.querySelectorAll('#tr-specs .spec-select').forEach(sel => {
        const qty = parseInt(sel.parentElement.querySelector('.spec-qty').value) || 1;
        equip_specs.push({ spec: sel.value, qty });
      });
      if (!equip_specs.length) { Toast.error('장비를 1개 이상 추가해주세요.'); return; }
    } else {
      // 체크리스트 선택값 우선, 없으면 직접 입력값
      const checked = [...document.querySelectorAll('.equip-checkbox:checked')].map(cb => cb.value);
      const manual  = document.getElementById('tr-equip-nos')?.value.trim().toUpperCase() || '';
      const manualList = manual ? manual.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];
      const combined = [...new Set([...checked, ...manualList])];
      if (!combined.length) { Toast.error('반출할 장비를 선택하거나 입력해주세요.'); return; }
      equip_nos = combined.join(', ');
    }

    _saveFormData();

    const btn = document.getElementById('btn-submit-transit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      const saved = await Api.post('/transit', {
        record_id:      `TR-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        type,
        site_id:        siteId,
        site_name:      siteName,
        project,
        company,
        equip_specs:    type === 'in' ? equip_specs : [],
        aj_equip:       type === 'out' ? equip_nos : null,
        reporter_name:  reporter,
        reporter_phone: phone,
        manager_name:   document.getElementById('tr-manager').value.trim(),
        manager_phone:  document.getElementById('tr-manager-phone').value.trim(),
        requested_date: date,
        note:           document.getElementById('tr-note').value.trim(),
        created_by:     Auth.getUser()?.id,
        status:         'requested',
      });
      Modal.close();
      Toast.success('신청이 완료되었습니다. AJ관리자 검토 후 일정이 확정됩니다.');

      // 탭 전환
      _currentTab = 'requested';
      _updateTabStyles();

      // 새 레코드를 즉시 DOM에 표시 (loadList 완료 전에도 보임)
      if (saved) {
        _transitCache[saved.id] = saved;
        const c = document.getElementById('transit-list');
        if (c) c.innerHTML = _renderCard(saved);
      }

      await loadList();
    } catch (e) { btn.disabled = false; btn.textContent = '신청 완료'; console.error('[transit] 신청 실패:', e); }
  }

  // ── 일정 확정 (AJ) ───────────────────────────────────────
  function openScheduleForm(transitId) {
    const t = _transitCache[transitId];
    if (!t) { Toast.error('정보를 불러올 수 없습니다. 목록을 새로고침하세요.'); return; }
    const typeLabel = t.type === 'in' ? '반입' : '반출';

    Modal.open({
      title: `${typeLabel} 일정 확정`,
      body: `
        <div style="background:var(--gray-100);padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px">
          <strong>${t.company}</strong> · ${t.site_name}${t.project ? ' · ' + t.project : ''}<br>
          희망일: <strong>${t.requested_date || '-'}</strong>
          ${(t.equip_specs||[]).length ? `<br>제원: ${(t.equip_specs||[]).map(s=>`${s.spec}×${s.qty}`).join(', ')}` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">확정 날짜 <span style="color:var(--red)">*</span></label>
          <input id="sc-date" type="date" class="form-input" value="${t.requested_date || ''}">
          <div style="font-size:11px;color:var(--gray-400);margin-top:4px">
            희망일과 다르게 설정하면 협력사 확인 후 최종 확정됩니다.
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">장비번호 <span style="color:var(--red)">*</span></label>
          <input id="sc-equip-nos" class="form-input"
            placeholder="GK111, GF123, GG456"
            value="${(t.aj_equip || '').toUpperCase()}"
            oninput="this.value=this.value.toUpperCase()" style="text-transform:uppercase">
          <div style="font-size:11px;color:var(--gray-400);margin-top:4px">
            쉼표(,)로 구분. 입력 완료 후 아래 목록에서 모델명/시리얼번호를 입력하세요.
          </div>
        </div>
        <div id="sc-equip-detail-list"></div>
        <div class="form-group">
          <label class="form-label">배차 차량</label>
          <input id="sc-vehicle" class="form-input"
            placeholder="예: 5톤 트럭 12가3456"
            value="${t.vehicle_info || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">담당 기사 / 연락처</label>
          <input id="sc-driver" class="form-input"
            placeholder="예: 홍길동 / 010-0000-0000"
            value="${t.driver_info || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">비고</label>
          <textarea id="sc-note" class="form-input" rows="2">${t.note || ''}</textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-confirm-schedule">확정</button>
      `,
    });

    // 장비번호 blur 시 자동 목록 생성
    setTimeout(() => {
      const nosInput = document.getElementById('sc-equip-nos');
      if (!nosInput) return;
      nosInput.addEventListener('blur', () => TransitPage._onScEquipRegister());
      // 기존 장비번호가 있으면 즉시 자동 생성
      if (t.aj_equip) TransitPage._onScEquipRegister();
    }, 100);

    document.getElementById('btn-confirm-schedule').onclick = async () => {
      const date     = document.getElementById('sc-date').value;
      const equipNos = document.getElementById('sc-equip-nos').value.trim().toUpperCase();
      if (!date)     { Toast.error('확정 날짜를 선택해주세요.'); return; }
      if (!equipNos) { Toast.error('장비번호를 입력해주세요.'); return; }

      const dateChanged = date !== t.requested_date;
      const newStatus   = dateChanged ? 'scheduled' : 'confirmed';

      const btn = document.getElementById('btn-confirm-schedule');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

      try {
        await Api.patch(`/transit/${transitId}/schedule`, {
          scheduled_date: date,
          aj_equip:       equipNos,
          vehicle_info:   document.getElementById('sc-vehicle').value.trim(),
          driver_info:    document.getElementById('sc-driver').value.trim(),
          note:           document.getElementById('sc-note').value.trim(),
          status:         newStatus,
        });

        // 장비 모델/시리얼 정보를 equipment 테이블에 upsert (실패해도 메인 흐름 유지)
        try {
          const nosList = equipNos.split(',').map(s => s.trim()).filter(Boolean);
          for (let i = 0; i < nosList.length; i++) {
            const equip_no         = nosList[i];
            const model            = document.getElementById(`sc-model-${i}`)?.value.trim().toUpperCase() || null;
            const serial_no        = document.getElementById(`sc-serial-${i}`)?.value.trim() || null;
            const manufacture_year = document.getElementById(`sc-year-${i}`)?.value.trim() || null;
            if (!model && !serial_no && !manufacture_year) continue;
            const equipBody = { model, serial_no };
            if (manufacture_year) equipBody.manufacture_year = manufacture_year;
            const { data: upd } = await _sb.from('equipment')
              .update(equipBody)
              .eq('equip_no', equip_no)
              .select('id');
            if (!upd?.length) {
              const insertBody = {
                equip_no, model, serial_no,
                site_id: t.site_id, site_name: t.site_name,
                company: t.company, transit_id: transitId,
                status: 'transit', record_id: `EQ-${equip_no}-${Date.now()}`,
              };
              if (manufacture_year) insertBody.manufacture_year = manufacture_year;
              await _sb.from('equipment').insert(insertBody);
            }
          }
        } catch (equipErr) {
          console.warn('[Schedule] 장비 정보 저장 실패 (무시):', equipErr.message);
        }

        // 날짜가 다른 경우 협력사에게 앱 내 알림 발송
        if (dateChanged && t.created_by) {
          await Api.post('/notifications', {
            target_id:  t.created_by,
            type:       'transit',
            title:      `[일정 변경] ${t.company}`,
            body:       `희망일 ${t.requested_date} → 확정일 ${date}. 앱에서 일정을 확인하고 승인해주세요.`,
            ref_id:     String(transitId),
            is_read:    false,
          }, { silent: true });
        }

        Modal.close();
        Toast.success(dateChanged
          ? '일정이 저장되었습니다. 협력사 확인 후 최종 확정됩니다.'
          : '일정이 확정되었습니다.');
        await loadList();
      } catch (e) { btn.disabled = false; btn.textContent = '확정'; console.error('[Schedule]', e); }
    };
  }

  // 장비번호 목록 생성 버튼 핸들러
  async function _onScEquipRegister() {
    const nos = (document.getElementById('sc-equip-nos')?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const container = document.getElementById('sc-equip-detail-list');
    if (!container) return;
    if (!nos.length) { Toast.error('장비번호를 먼저 입력해주세요.'); return; }

    container.innerHTML = `<div style="text-align:center;padding:12px"><span class="spinner"></span></div>`;

    // 기존 장비 데이터 조회 (모델/시리얼/제조년 pre-fill)
    const { data: existing } = await _sb.from('equipment')
      .select('equip_no,model,serial_no,manufacture_year')
      .in('equip_no', nos);
    const existMap = {};
    (existing || []).forEach(r => { existMap[r.equip_no] = r; });

    // 모델명 자동완성 목록 — equipment_specs + 기존 장비 입력값 합산
    const [{ data: specRows }, { data: equipModelRows }] = await Promise.all([
      _sb.from('equipment_specs').select('model').order('model'),
      _sb.from('equipment').select('model').not('model', 'is', null).neq('model', ''),
    ]);
    const models = [...new Set([
      ...(specRows || []).map(r => r.model),
      ...(equipModelRows || []).map(r => r.model),
    ].filter(Boolean))].sort();

    container.innerHTML = `
      <datalist id="sc-model-list">
        ${models.map(m => `<option value="${m}">`).join('')}
      </datalist>
      <div style="margin-bottom:10px;padding:12px;background:var(--gray-50,#f9fafb);border:1px solid var(--gray-200);border-radius:8px">
        <div style="font-size:12px;font-weight:600;color:var(--navy);margin-bottom:10px">
          장비 ${nos.length}대 — 모델명 / 시리얼번호 / 제조년 입력
        </div>
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:1px solid var(--gray-200)">
              <th style="padding:6px 10px;text-align:left;font-weight:600;color:var(--gray-600)">장비번호</th>
              <th style="padding:6px 10px;text-align:left;font-weight:600;color:var(--gray-600)">모델명</th>
              <th style="padding:6px 10px;text-align:left;font-weight:600;color:var(--gray-600)">시리얼번호</th>
              <th style="padding:6px 10px;text-align:left;font-weight:600;color:var(--gray-600)">제조년</th>
            </tr>
          </thead>
          <tbody>
            ${nos.map((no, i) => {
              const ex = existMap[no] || {};
              return `
                <tr style="border-bottom:1px solid var(--gray-100)">
                  <td style="padding:7px 10px;font-family:monospace;font-weight:600;color:var(--navy);white-space:nowrap">${no}</td>
                  <td style="padding:5px 8px">
                    <input id="sc-model-${i}" class="form-input" list="sc-model-list"
                      value="${(ex.model || '').toUpperCase()}"
                      placeholder="예: GR20NS"
                      oninput="this.value=this.value.toUpperCase()"
                      style="padding:5px 8px;font-size:13px;text-transform:uppercase">
                  </td>
                  <td style="padding:5px 8px">
                    <input id="sc-serial-${i}" class="form-input"
                      value="${ex.serial_no || ''}"
                      placeholder="예: GJ512-001"
                      style="padding:5px 8px;font-size:13px;font-family:monospace">
                  </td>
                  <td style="padding:5px 8px">
                    <input id="sc-year-${i}" class="form-input"
                      value="${ex.manufacture_year || ''}"
                      placeholder="예: 2021"
                      style="padding:5px 8px;font-size:13px;width:80px">
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
        </div>
      </div>
    `;
  }

  // ── 장비정보 수정 (확정/배차 후) ─────────────────────────
  async function openEquipInfoForm(transitId) {
    const t = _transitCache[transitId];
    if (!t || !t.aj_equip) { Toast.error('장비번호 정보가 없습니다.'); return; }

    const nos = t.aj_equip.split(',').map(s => s.trim()).filter(Boolean);

    // 기존 장비 데이터 조회
    const [{ data: existing }, { data: modelRows }] = await Promise.all([
      _sb.from('equipment').select('equip_no,model,serial_no,manufacture_year').in('equip_no', nos),
      _sb.from('equipment').select('model').not('model', 'is', null).neq('model', ''),
    ]);
    const existMap = {};
    (existing || []).forEach(r => { existMap[r.equip_no] = r; });
    const models = [...new Set((modelRows || []).map(r => r.model).filter(Boolean))].sort();

    Modal.open({
      title: '장비정보 수정',
      body: `
        <datalist id="eif-model-list">
          ${models.map(m => `<option value="${m}">`).join('')}
        </datalist>
        <div style="margin-bottom:12px;font-size:13px;color:var(--gray-500)">
          <strong style="color:var(--navy)">${t.company}</strong> · ${t.site_name}
          · 장비 ${nos.length}대
        </div>
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:420px">
          <thead>
            <tr style="background:var(--gray-100)">
              <th style="padding:8px 10px;text-align:left;font-weight:600">장비번호</th>
              <th style="padding:8px 10px;text-align:left;font-weight:600">모델명</th>
              <th style="padding:8px 10px;text-align:left;font-weight:600">시리얼번호</th>
              <th style="padding:8px 10px;text-align:left;font-weight:600">제조년</th>
            </tr>
          </thead>
          <tbody>
            ${nos.map((no, i) => {
              const ex = existMap[no] || {};
              return `
                <tr style="border-bottom:1px solid var(--gray-100)">
                  <td style="padding:8px 10px;font-family:monospace;font-weight:600;color:var(--navy);white-space:nowrap">${no}</td>
                  <td style="padding:5px 8px">
                    <input id="eif-model-${i}" class="form-input" list="eif-model-list"
                      value="${(ex.model || '').toUpperCase().replace(/"/g, '&quot;')}"
                      placeholder="예: GR20NS"
                      oninput="this.value=this.value.toUpperCase()"
                      style="padding:5px 8px;font-size:13px;text-transform:uppercase">
                  </td>
                  <td style="padding:5px 8px">
                    <input id="eif-serial-${i}" class="form-input"
                      value="${(ex.serial_no || '').replace(/"/g, '&quot;')}"
                      placeholder="예: GJ512-001"
                      style="padding:5px 8px;font-size:13px;font-family:monospace">
                  </td>
                  <td style="padding:5px 8px">
                    <input id="eif-year-${i}" class="form-input"
                      value="${(ex.manufacture_year || '').replace(/"/g, '&quot;')}"
                      placeholder="예: 2021"
                      style="padding:5px 8px;font-size:13px;width:80px">
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-save-equip-info">저장</button>
      `,
    });

    document.getElementById('btn-save-equip-info').onclick = async () => {
      const btn = document.getElementById('btn-save-equip-info');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        for (let i = 0; i < nos.length; i++) {
          const equip_no       = nos[i];
          const model          = document.getElementById(`eif-model-${i}`)?.value.trim().toUpperCase() || null;
          const serial_no      = document.getElementById(`eif-serial-${i}`)?.value.trim() || null;
          const manufacture_year = document.getElementById(`eif-year-${i}`)?.value.trim() || null;

          const { data: upd } = await _sb.from('equipment')
            .update({ model, serial_no, manufacture_year })
            .eq('equip_no', equip_no)
            .select('id');

          // 장비 레코드가 아직 없으면 INSERT (transit 상태)
          if (!upd?.length) {
            await _sb.from('equipment').insert({
              equip_no,
              model,
              serial_no,
              manufacture_year,
              site_id:    t.site_id,
              site_name:  t.site_name,
              company:    t.company,
              transit_id: transitId,
              status:     'transit',
              record_id:  `EQ-${equip_no}-${Date.now()}`,
            });
          }
        }
        Modal.close();
        Toast.success('장비정보가 저장되었습니다.');
      } catch (e) {
        btn.disabled = false; btn.textContent = '저장';
        Toast.error('저장 실패: ' + (e.message || '오류가 발생했습니다.'));
      }
    };
  }

  // ── 협력사 일정 확인완료 ──────────────────────────────────
  async function confirmSchedule(transitId) {
    if (!confirm('일정을 확인하고 승인하시겠습니까?')) return;
    try {
      await Api.patch(`/transit/${transitId}/partner-confirm`, {});
      Toast.success('일정 확인 완료. 확정 상태로 변경되었습니다.');
      await loadList();
    } catch (e) { Toast.error('처리에 실패했습니다.'); console.error('[confirmSchedule]', e); }
  }

  // ── 완료 처리 (AJ) ───────────────────────────────────────
  async function openCompleteForm(transitId, type, company, specsEncoded) {
    const t     = _transitCache[transitId];
    const isIn  = type === 'in';
    const specs = JSON.parse(decodeURIComponent(specsEncoded));

    // 반입 장비번호 목록 (일정 확정 시 입력된 번호)
    const equipNos = (t?.aj_equip || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    // 기본 spec 결정: equip_specs에서 spec 목록 추출
    const specPool = [];
    specs.forEach(s => { for (let i = 0; i < (s.qty || 1); i++) specPool.push(s.spec); });

    // 모델명 자동완성 목록
    const models = isIn ? await Api.get('/equipment/models').catch(() => []) : [];

    Modal.open({
      title: `${isIn ? '반입' : '반출'} 완료 처리`,
      body: isIn ? `
        <datalist id="complete-model-list">
          ${models.map(m=>`<option value="${m}">`).join('')}
        </datalist>
        <p style="margin-bottom:14px">
          <strong>${company}</strong>의 반입을 완료 처리합니다.<br>
          <span class="text-sm text-muted">각 장비번호별 제원, 모델명, 시리얼번호를 입력해주세요.</span>
        </p>
        ${equipNos.length ? `
          <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:520px">
            <thead>
              <tr style="background:var(--gray-100)">
                <th style="padding:8px 10px;text-align:left;font-weight:600">장비번호</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600">제원</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600">모델명</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600">시리얼번호</th>
              </tr>
            </thead>
            <tbody>
              ${equipNos.map((no, i) => `
                <tr style="border-bottom:1px solid var(--gray-100)">
                  <td style="padding:8px 10px;font-family:monospace;white-space:nowrap">${no}</td>
                  <td style="padding:6px 10px">
                    <select id="spec-row-${i}" class="form-input form-select" style="padding:4px 8px;min-width:80px">
                      ${SPEC_OPTIONS.map(s => `<option value="${s}" ${(specPool[i]||specPool[0]||'8M')===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                  </td>
                  <td style="padding:6px 10px">
                    <input id="model-row-${i}" class="form-input" list="complete-model-list"
                      placeholder="모델명" oninput="this.value=this.value.toUpperCase()"
                      style="padding:4px 8px;min-width:100px;text-transform:uppercase">
                  </td>
                  <td style="padding:6px 10px">
                    <input id="serial-row-${i}" class="form-input"
                      placeholder="시리얼번호" style="padding:4px 8px;min-width:110px;font-family:monospace">
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          </div>
        ` : `
          <div class="form-group">
            <label class="form-label">반입 장비번호 <span style="color:var(--red)">*</span></label>
            <input id="complete-equip-nos" class="form-input" placeholder="GF123, GF124 (쉼표로 구분)" oninput="this.value=this.value.toUpperCase()" style="text-transform:uppercase">
          </div>
        `}
      ` : `
        <p style="margin-bottom:8px"><strong>${company}</strong>의 반출을 완료 처리합니다.</p>
        ${equipNos.length ? `
          <div style="padding:10px;background:var(--gray-100);border-radius:8px;font-size:13px;font-family:monospace">
            ${equipNos.join(', ')}
          </div>
          <p class="text-sm text-muted" style="margin-top:8px">
            위 장비들이 반출완료 처리됩니다.
          </p>
        ` : `<p class="text-sm text-muted">신청 시 등록된 장비번호가 반출 완료 처리됩니다.</p>`}
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-complete">완료 처리</button>
      `,
    });

    document.getElementById('btn-do-complete').onclick = async () => {
      const btn = document.getElementById('btn-do-complete');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        if (isIn) {
          await _doCompleteIn(transitId, t, equipNos, specs);
        } else {
          await _doCompleteOut(transitId, t, equipNos);
        }
        Modal.close();
        Toast.success('완료 처리되었습니다.');
        await loadList();
      } catch (e) {
        btn.disabled = false; btn.textContent = '완료 처리';
        console.error('[Complete]', e);
      }
    };
  }

  // 반입 완료 처리 — transit 상태 변경 + 장비 레코드 생성
  async function _doCompleteIn(transitId, t, equipNos, specs) {
    await Api.patch(`/transit/${transitId}/complete`, {});

    const today = new Date().toISOString().slice(0, 10);
    const specPool = [];
    specs.forEach(s => { for (let i = 0; i < (s.qty || 1); i++) specPool.push(s.spec); });

    // 장비번호가 모달에서 직접 입력된 경우 처리
    let finalEquipNos = equipNos;
    if (!finalEquipNos.length) {
      const nosEl = document.getElementById('complete-equip-nos');
      if (nosEl?.value.trim()) {
        finalEquipNos = nosEl.value.trim().toUpperCase().split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      }
    }

    for (let i = 0; i < finalEquipNos.length; i++) {
      const equip_no = finalEquipNos[i];
      const specEl   = document.getElementById(`spec-row-${i}`);
      const spec     = specEl?.value || specPool[i] || specPool[0] || '';
      const model    = document.getElementById(`model-row-${i}`)?.value.trim().toUpperCase()  || null;
      const serial_no = document.getElementById(`serial-row-${i}`)?.value.trim() || null;

      try {
        const qr_code = `AJ-${equip_no}`;
        const equipData = {
          equip_no,
          spec,
          site_id:    t.site_id,
          site_name:  t.site_name,
          company:    t.company,
          project:    t.project,
          status:     'in_use',
          in_date:    t.scheduled_date || today,
          transit_id: transitId,
          qr_code,
        };
        // 모델/시리얼은 이미 일정확정 시 저장되어 있을 수 있으나, 완료폼에서 직접 입력한 값 우선
        if (model)     equipData.model     = model;
        if (serial_no) equipData.serial_no = serial_no;

        // equip_no 기준 UPDATE 먼저 (일정확정 시 transit 상태로 미리 생성된 레코드 처리)
        const { data: updByNo, error: upNoErr } = await _sb.from('equipment')
          .update(equipData)
          .eq('equip_no', equip_no)
          .select('id');
        if (upNoErr) throw upNoErr;

        // equip_no 매칭 없으면 신규 INSERT
        if (!updByNo?.length) {
          const { error: insErr } = await _sb.from('equipment')
            .insert({ ...equipData, record_id: `EQ-${equip_no}-${Date.now()}` });
          if (insErr) throw insErr;
        }
      } catch (e) { console.warn('[EquipIn] upsert failed:', equip_no, e.message); }
    }
  }

  // 반출 완료 처리 — transit 상태 변경 + 장비 반출완료 처리
  async function _doCompleteOut(transitId, t, equipNos) {
    await Api.patch(`/transit/${transitId}/complete`, {});

    const today = new Date().toISOString().slice(0, 10);
    for (const equip_no of equipNos) {
      try {
        // qr_code 기준 UPDATE — SELECT RLS 우회, UPDATE 정책(aj 전체) 적용
        const qr_code = `AJ-${equip_no}`;
        const { data: updated, error: upErr } = await _sb.from('equipment')
          .update({ status: 'returned', out_date: today, qr_code: null })
          .eq('qr_code', qr_code)
          .select('id');
        if (upErr) throw upErr;

        // qr_code 매칭 실패 시 equip_no로 재시도 (QR도 함께 삭제)
        if (!updated?.length) {
          const { error: upErr2 } = await _sb.from('equipment')
            .update({ status: 'returned', out_date: today, qr_code: null })
            .eq('equip_no', equip_no);
          if (upErr2) throw upErr2;
        }
      } catch (e) { console.warn('[EquipOut] update failed:', equip_no, e); }
    }
  }

  // ── 배차정보 등록 (AJ) ───────────────────────────────────
  function openDispatchForm(transitId) {
    const t = _transitCache[transitId];
    if (!t) { Toast.error('정보를 불러올 수 없습니다. 목록을 새로고침하세요.'); return; }

    Modal.open({
      title: '배차정보 등록',
      body: `
        <div style="background:var(--gray-100);padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px">
          <strong>${t.company}</strong> · ${t.site_name} · 확정일 ${t.scheduled_date || '-'}
        </div>
        <div class="form-group">
          <label class="form-label">배차 차량</label>
          <input id="dp-vehicle" class="form-input"
            placeholder="예: 5톤 트럭 12가3456"
            value="${t.vehicle_info || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">담당 기사 / 연락처</label>
          <input id="dp-driver" class="form-input"
            placeholder="예: 홍길동 / 010-0000-0000"
            value="${t.driver_info || ''}">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-save-dispatch">저장</button>
      `,
    });

    document.getElementById('btn-save-dispatch').onclick = async () => {
      const vehicle = document.getElementById('dp-vehicle').value.trim();
      const driver  = document.getElementById('dp-driver').value.trim();
      const btn = document.getElementById('btn-save-dispatch');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/transit/${transitId}/dispatch`, {
          vehicle_info: vehicle,
          driver_info:  driver,
        }, { silent: true });
        Modal.close();
        Toast.success('배차정보가 저장되었습니다.');
        await loadList();
      } catch (e) {
        console.error('[dispatch] 저장 실패:', e);
        btn.disabled = false; btn.textContent = '저장';
        Toast.error('배차정보 저장에 실패했습니다. 권한을 확인하거나 다시 시도해주세요.');
      }
    };
  }

  // ── QR 생성 및 인쇄 (AJ) ──────────────────────────────────
  async function openQrPrint(transitId) {
    const t = _transitCache[transitId];
    if (!t) { Toast.error('정보를 불러올 수 없습니다. 목록을 새로고침하세요.'); return; }

    const equipNos = (t.aj_equip || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    if (!equipNos.length) {
      Toast.error('등록된 장비번호가 없습니다. 일정 확정 시 장비번호를 입력해주세요.');
      return;
    }

    // 장비 레코드에서 시리얼번호 조회
    const { data: equipRows } = await _sb.from('equipment')
      .select('equip_no,serial_no,in_date')
      .in('equip_no', equipNos);
    const equipMap = {};
    (equipRows || []).forEach(r => { equipMap[r.equip_no] = r; });

    const origin   = window.location.origin;
    const pathname = window.location.pathname;
    const inDate   = t.scheduled_date || t.completed_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    const siteLine = [t.site_name, t.company].filter(Boolean).join(' · ');

    const pages = equipNos.map((no, idx) => {
      const qrCode   = `AJ-${no}`;
      const qrUrl    = `${origin}${pathname}?qr=${encodeURIComponent(qrCode)}`;
      const serialNo = equipMap[no]?.serial_no || '';
      const recordIn = equipMap[no]?.in_date || inDate;

      return `
        <div style="page-break-after:always;display:flex;flex-direction:column;align-items:center;
                    justify-content:center;height:100vh;font-family:'Malgun Gothic',sans-serif;padding:40px">
          <div style="font-size:14px;color:#666;margin-bottom:16px">AJ렌탈 고소작업대</div>
          <div id="qr-transit-${idx}" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;display:inline-block;margin-bottom:24px"></div>
          <div style="font-size:22px;font-weight:700;color:#1B365D;margin-bottom:8px">${no}</div>
          ${siteLine   ? `<div style="font-size:15px;font-weight:700;color:#1B365D;margin-bottom:4px">${siteLine}</div>` : ''}
          ${serialNo   ? `<div style="font-size:15px;font-weight:700;color:#1B365D;margin-bottom:4px;font-family:monospace">${serialNo}</div>` : ''}
          <div style="font-size:15px;font-weight:700;color:#1B365D">반입일: ${recordIn}</div>
          <script>window['_qurl_t${idx}']='${qrUrl.replace(/\\/g, '\\\\').replace(/'/g,"\\'")}'; <\/script>
        </div>
      `;
    }).join('');

    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { Toast.error('팝업 차단을 해제해주세요.'); return; }
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>QR코드 — ${t.company}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { background:#fff; }
          @media print {
            @page { size: A4; margin: 0; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>${pages}
        <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
        <script>
          window.onload = () => {
            ${equipNos.map((no, i) => `
              new QRCode(document.getElementById('qr-transit-${i}'), {
                text: window['_qurl_t${i}'],
                width: 280, height: 280,
                colorDark: '#1B365D', colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
              });
            `).join('')}
            setTimeout(() => window.print(), 600);
          };
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  }

  // ── 로그 뷰어 (AJ 전용) ──────────────────────────────────
  async function openLogViewer() {
    Modal.open({
      title: '반입/반출 변경 로그',
      body: '<div style="text-align:center;padding:32px"><span class="spinner"></span></div>',
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>`,
    });
    // 모달 박스 너비 확장
    const box = document.querySelector('.modal-box');
    if (box) box.style.maxWidth = '680px';

    try {
      const list = await Api.get('/transit?limit=100');
      const entries = [];

      list.forEach(t => {
        const typeLabel = t.type === 'in' ? '반입' : '반출';
        const st = STATUS_MAP[t.status] || { label: t.status };

        // 신청 생성 로그
        entries.push({
          at:      t.created_at,
          transit: t,
          typeLabel,
          action:  '신청 접수',
          detail:  `${t.company} · ${t.site_name}${t.project ? ' · ' + t.project : ''} · 희망일 ${t.requested_date || '-'}`,
          badge:   'badge-pending',
          badgeText: `${typeLabel} 신청`,
        });

        // change_log 항목들
        (t.change_log || []).forEach(c => {
          entries.push({
            at:       c.when,
            transit:  t,
            typeLabel,
            action:   c.after || c.before,
            detail:   `${c.before} → ${c.after}`,
            who:      c.who,
            badge:    'badge-active',
            badgeText: `${typeLabel} 변경`,
          });
        });

        // 상태별 타임스탬프 로그
        if (t.partner_confirmed_at) {
          entries.push({
            at:       t.partner_confirmed_at,
            transit:  t,
            typeLabel,
            action:   '협력사 일정 확인완료',
            detail:   `확정일 ${t.scheduled_date}`,
            badge:    '',
            badgeStyle: 'background:#1B365D;color:#fff',
            badgeText:  `${typeLabel} 확정`,
          });
        }
        if (t.completed_at) {
          entries.push({
            at:       t.completed_at,
            transit:  t,
            typeLabel,
            action:   `${typeLabel} 완료 처리`,
            detail:   `확정일 ${t.scheduled_date || '-'} · 장비 ${t.aj_equip || '-'}`,
            badge:    '',
            badgeStyle: 'background:#065f46;color:#fff',
            badgeText:  `${typeLabel} 완료`,
          });
        }
        if (t.status === 'cancelled' && t.cancelled_reason) {
          entries.push({
            at:       t.created_at, // cancelled_at 없으므로 대체
            transit:  t,
            typeLabel,
            action:   '취소',
            detail:   `사유: ${t.cancelled_reason}`,
            badge:    'badge-rejected',
            badgeText: `${typeLabel} 취소`,
          });
        }
      });

      // 최신순 정렬
      entries.sort((a, b) => (b.at || '') > (a.at || '') ? 1 : -1);

      const body = document.querySelector('.modal-body');
      if (!body) return;

      if (!entries.length) {
        body.innerHTML = '<div class="empty-state"><div>변경 이력이 없습니다</div></div>';
        return;
      }

      // 날짜별 그룹핑
      const groups = {};
      entries.forEach(e => {
        const day = (e.at || '').slice(0, 10) || '날짜 없음';
        if (!groups[day]) groups[day] = [];
        groups[day].push(e);
      });

      body.innerHTML = `
        <div style="max-height:65vh;overflow-y:auto;padding-right:4px">
          ${Object.entries(groups).map(([day, items]) => `
            <div style="margin-bottom:20px">
              <div style="font-size:11px;font-weight:700;color:var(--gray-400);
                          letter-spacing:0.05em;padding:4px 0;
                          border-bottom:1px solid var(--gray-200);margin-bottom:10px">
                ${day}
              </div>
              ${items.map(e => {
                const time = e.at ? new Date(e.at).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' }) : '';
                const badgeAttr = e.badgeStyle
                  ? `style="${e.badgeStyle};font-size:10px;padding:2px 7px;border-radius:4px;display:inline-block"`
                  : `class="badge ${e.badge}" style="font-size:10px;padding:2px 7px"`;
                return `
                  <div style="display:flex;gap:12px;align-items:flex-start;padding:8px 0;
                               border-bottom:1px solid var(--gray-100)">
                    <div style="min-width:38px;text-align:right;font-size:11px;
                                color:var(--gray-400);padding-top:2px">${time}</div>
                    <div style="flex:1">
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        <span ${badgeAttr}>${e.badgeText}</span>
                        <span style="font-size:12px;font-weight:600;color:var(--navy)">${e.transit.company}</span>
                        <span style="font-size:11px;color:var(--gray-400)">${e.transit.site_name}</span>
                        ${e.who ? `<span style="font-size:11px;color:var(--gray-400)">· ${e.who}</span>` : ''}
                      </div>
                      <div style="font-size:12px;color:var(--gray-600);margin-top:3px">${e.detail}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `).join('')}
        </div>
      `;
    } catch {
      const body = document.querySelector('.modal-body');
      if (body) body.innerHTML = '<div class="empty-state"><div>로그를 불러오지 못했습니다</div></div>';
    }
  }

  // ── 취소 (AJ / 협력사) ───────────────────────────────────
  function openCancelForm(transitId, company) {
    Modal.open({
      title: `신청 취소 — ${company}`,
      body: `
        <div class="form-group">
          <label class="form-label">취소 사유 <span style="color:var(--red)">*</span></label>
          <textarea id="inp-cancel-reason" class="form-input" rows="3"
            placeholder="취소 사유를 입력해주세요"></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">돌아가기</button>
        <button class="btn btn-danger btn-sm" id="btn-do-cancel">취소 처리</button>
      `,
    });
    document.getElementById('btn-do-cancel').onclick = async () => {
      const reason = document.getElementById('inp-cancel-reason').value.trim();
      if (!reason) { Toast.error('취소 사유를 입력해주세요.'); return; }
      const btn = document.getElementById('btn-do-cancel');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/transit/${transitId}/cancel`, { cancelled_reason: reason });
        Modal.close();
        Toast.success('취소 처리되었습니다.');
        await loadList();
      } catch (e) { btn.disabled = false; btn.textContent = '취소 처리'; console.error(e); }
    };
  }

  // ── 서류확인 (안전점검 결과서 + 반입 전 체크리스트 출력) ──
  const _SPEC_INFO = {
    '6M':      { height: '6.06M',  load: '227KG', model: 'GS1930' },
    '8M':      { height: '9.93M',  load: '227KG', model: 'GS2632' },
    '10M':     { height: '11.75M', load: '318KG', model: 'GS3246' },
    '12M':     { height: '13.93M', load: '350KG', model: 'GS4047' },
    '14M':     { height: '15.9M',  load: '350KG', model: 'GS4655' },
    '16M':     { height: '15.72M', load: '227KG', model: 'E450AJ' },
    '16M굴절': { height: '15.72M', load: '227KG', model: 'E450AJ' },
    '18M':     { height: '17.72M', load: '227KG', model: 'E600JP' },
    '20M굴절': { height: '20.57M', load: '227KG', model: 'E800AJ' },
  };

  // 안전점검 결과서 점검 항목 (PDF 원본 기준)
  const _INSPECT_SECTIONS = [
    { title: '1. 공통사항', rows: [
      { part: '⑴ 등록번호표 등', content: '제조일로부터 15년 이내의 장비일 것', result: 'O' },
      { part: '', content: '붐대, 아웃트리거, 용접부등 비파괴 검사 성적서 비치되어 있을것', result: '—' },
      { part: '', content: '운전원은 장비의 운전 및 안전에 대한 교육을 받은 유경험자이고 보험(자차 등)에 가입되어 있을것', result: '—' },
    ]},
    { title: '2. 차대와 타이어(안정기)', rows: [
      { part: '⑴ 차체 및 타이어(안정기)', content: '차체의 균열, 변형, 손상 및 부식이 없을것', result: '' },
      { part: '', content: '타이어의 이상마모 및 변형이 없고 구동축에서 견고하게 고정되어 있고 림부의 체결볼트, 너트 등이 견고하게 체결될 것', result: 'O' },
      { part: '⑵ 동력원', content: '유압펌프와 모터는 설치상태가 견고하고 작동상태에서 심한 진동과 이상음이 없을 것', result: 'O' },
      { part: '', content: '유압실린더, 유압호스, 파이프, 밸브, 탱크등 연결부는 균열, 손상 및 마멸이 없고 기름누출이 없을 것', result: '—' },
      { part: '', content: '작동유 탱크는 적정 유량을 유지하고 작동유의 오염이 없을 것', result: 'O' },
      { part: '', content: '축전지의 단락, 손상 및 단자 부식이 없고 배선부분은 과열에 의한 열화가 없을 것', result: '' },
    ]},
    { title: '3. 연장구조물(마스트)', rows: [
      { part: '⑴ 구조부', content: '정비를 위해 일정 상승 위치에서 연장 구조물을 고정할 수 있는 고정받침대를 구비할 것', result: 'O' },
      { part: '', content: '구조물의 균열, 변형 및 손상이 없고 힌지부 연결핀 고정상태가 양호하고 잠금밸브(카운터밸런스밸브)는 정상 작동되고 배관 연결부 등의 누유가 없을 것', result: 'O' },
    ]},
    { title: '4. 작업대', rows: [
      { part: '⑴ 낙하 및 추락 방호 조치', content: '작업대의 난간높이 1.0m 이상, 발끝막이판 높이 0.15m 이상(출입구는 0.1m 이상)이고 상부난간대와 발끝막이판 사이 0.55m이내의 중간대 설치할 것', result: 'O' },
      { part: '', content: '바닥면은 배수가 가능하고 미끄럼 방지 구조일 것', result: '' },
      { part: '⑵ 접근사다리', content: '작업대 바닥높이가 지면에서 0.4m 초과시 접근사다리를 설치할 것', result: 'O' },
    ]},
    { title: '5. 제어장치', rows: [
      { part: '⑴ 제어장치', content: '조작한 경우에만 작동하고 해제하면 자동으로 중립위치로 복귀하고 작동방향을 문자나 기호로 명확하게 표시되어 있을 것', result: 'O' },
      { part: '', content: '우발 동작을 방지하기 위한 상호 연동장치를 설치할 것 (조종레버의 인에이블 스위치와 발판식 인에이블 스위치)', result: '' },
    ]},
    { title: '6. 표시', rows: [
      { part: '⑴ 경고 표시', content: '명판에는 제조자명, 모델명(형식번호), 제조번호, 제조년월, 최대작업높이, 정격하중, 허용탑승인원수, 최대허용풍속, 최대허용경사, 동력원 사양, 안전인증 표시등을 표시할 것', result: '' },
      { part: '', content: '작업대에는 정격하중, 허용탑승인원수, 최대허용풍속(옥내용인 경우 제외)을 표시할 것', result: 'O' },
      { part: '', content: '비상안전장치의 위치 및 사용법을 표시할 것', result: '' },
    ]},
    { title: '7. 점등 및 조명장치 등', rows: [
      { part: '⑴ 점등 및 조명장치 등', content: '전조등, 미등, 측등, 계기판등, 후퇴등, 차폭등, 번호등, 방향지시등, 제동등, 작업등, 속도표시등등 설치된 점등 및 조명장치는 정위치에 견고하게 부착되어 손상이 없어야 하며 점등상태가 양호할 것', result: 'O' },
      { part: '⑵ 계기장치', content: '연료계, 유량계, 회전계, 압력계등 설치된 계기장치는 작동상태가 양호할 것', result: '—' },
      { part: '⑶ 경음기 및 경보장치', content: '경음기 및 경보장치의 음의 크기는 기준의 범위 이내일 것', result: 'O' },
    ]},
    { title: '8. 안전장치', rows: [
      { part: '⑴ 자동안전장치', content: '작업대가 상승한 상태로 차대 이동시 주행속도를 자동으로 제한하는 장치가 있을 것', result: 'O' },
      { part: '⑵ 경사표시장치 (전복방지장치)', content: '차대의 경사 허용 한도(제작자 기준) 초과시 상승 및 주행이 불가능 하도록 할 것 (음향 신호 발생)', result: 'O' },
      { part: '⑶ 비상정지장치', content: '비상정지용 누름버튼은 적색이며 머리부분이 돌출되고 수동으로 복귀되는 형식일 것', result: 'O' },
      { part: '⑷ 비상안전장치', content: '동력공급이 차단되었을 때, 안전하게 작업대를 빠져 나올 수 있는 위치로 작업대를 복귀시킬 수 있는 비상 안전장치를 설치할 것', result: 'O' },
    ]},
  ];

  // 반입 전 체크리스트 항목 (PDF 원본 기준)
  const _CHECKLIST_LEFT = [
    { group: '▣입고검사', items: [
      { no:1,  label:'장비외관상태',            std:'육안' },
      { no:2,  label:'스위치류 작동, 외관상태',   std:'작동' },
      { no:3,  label:'주행전.후진',              std:'5.25V이상' },
      { no:4,  label:'리프트업 주행(주행차단)',    std:'10mm이상' },
      { no:5,  label:'고속.저속 주행',            std:'작동' },
      { no:6,  label:'조향 좌.우회전',           std:'작동' },
      { no:7,  label:'리프트업.다운',             std:'작동' },
      { no:8,  label:'엔진시동',                 std:'작동' },
      { no:9,  label:'소음 및 보조지지대 작동',   std:'작동' },
    ]},
    { group: '▣세차', items: [
      { no:10, label:'이물질제거',    std:'육안' },
      { no:11, label:'세차',          std:'육안' },
      { no:12, label:'차체파손 유,무', std:'육안' },
      { no:13, label:'에어건조',      std:'육안' },
    ]},
    { group: '▣도장', items: [
      { no:14, label:'도장',                std:'육안' },
      { no:15, label:'차체파손 유,무',        std:'육안' },
      { no:16, label:'관리번호(제조번호)확인', std:'작동' },
      { no:17, label:'스티커 부착상태',        std:'육안' },
    ]},
    { group: '▣유압', items: [
      { no:18, label:'유압 오일양(리프트하강후)',  std:'육안' },
      { no:19, label:'리프트실린더(작동/누유)',     std:'육안' },
      { no:20, label:'비상하강',                  std:'육안' },
      { no:21, label:'누유(블록/호스/니쁠)',        std:'작동' },
      { no:22, label:'브레이크(작동/누유)',         std:'작동' },
      { no:23, label:'스티어링(작동/누유)',         std:'작동' },
      { no:24, label:'주행모터(작동/누유)',         std:'육안' },
      { no:25, label:'주행해제(프리휠링벨브)',      std:'작동' },
      { no:26, label:'비상펌프작동',              std:'작동' },
    ]},
    { group: '▣전기장치', items: [
      { no:27, label:'전기배선상태',                     std:'육안' },
      { no:28, label:'콘트롤박스(작동/스티커) ▣옵션장착', std:'작동' },
      { no:29, label:'연결잭(감지봉/풋스위치)',            std:'육안' },
      { no:30, label:'과상승방지봉',                      std:'육안' },
      { no:31, label:'주행차단',                         std:'작동' },
      { no:32, label:'풋스위치',                         std:'육안' },
      { no:33, label:'작동알람',                         std:'육안' },
      { no:34, label:'충전플러그',                       std:'육안' },
      { no:35, label:'충전기작동값26A이하',               std:'20.6A' },
    ]},
  ];

  const _CHECKLIST_RIGHT = [
    { group: '▣전기장치', items: [
      { no:36, label:'배터리, 장비 연결잭',      std:'육안' },
      { no:37, label:'배터리 터미널 조임',        std:'육안' },
      { no:38, label:'배터리비중/부하시험(v)',     std:'5.25V이상' },
      { no:39, label:'배터리증류수극판위10MM',     std:'10mm이상 보충 정상' },
      { no:40, label:'하부리프트작동',            std:'작동' },
      { no:41, label:'경광등',                   std:'작동' },
      { no:42, label:'노면접지',                 std:'육안' },
    ]},
    { group: '▣차체', items: [
      { no:43, label:'도장/세차상태',      std:'육안' },
      { no:44, label:'바퀴조임상태',       std:'육안' },
      { no:45, label:'엑슬킹핀',          std:'육안' },
      { no:46, label:'허브어셈블리',       std:'육안' },
      { no:47, label:'타이어 마모정도',    std:'육안' },
      { no:48, label:'하부도어 잠금장치',  std:'육안' },
      { no:49, label:'씨져핀 이상',        std:'육안' },
      { no:50, label:'씨져 외관',          std:'육안' },
      { no:51, label:'폿홀시스템',         std:'육안' },
      { no:52, label:'확장대 작동',        std:'작동' },
      { no:53, label:'확장대 로울러',      std:'육안' },
      { no:54, label:'확장대 고정핀',      std:'육안' },
      { no:55, label:'안전고리(체인/도어)', std:'육안' },
      { no:56, label:'그리스 주입',        std:'육안' },
    ]},
    { group: '▣출고정비', items: [
      { no:57, label:'주행(전진/후진)',      std:'작동' },
      { no:58, label:'리프트(상승/하강)',    std:'작동' },
      { no:59, label:'주행차단(현장기준)',   std:'작동' },
      { no:60, label:'감지봉작동',          std:'육안' },
      { no:61, label:'외관상태',            std:'육안' },
      { no:62, label:'배터리충전상태',       std:'육안' },
      { no:63, label:'폿홀시스템',          std:'작동' },
      { no:64, label:'옵션작동(기능적)',     std:'작동' },
    ]},
    { group: '▣옵션장착', items: [
      { no:65, label:'보호망(함석 외)',         std:'육안' },
      { no:66, label:'협착난간대',             std:'육안' },
      { no:67, label:'타이어 세척',            std:'육안' },
      { no:68, label:'충격흡수',              std:'육안' },
      { no:69, label:'용접보호판',            std:'육안' },
      { no:70, label:'부착물(스티커)',          std:'육안' },
      { no:71, label:'낙하물방지턱(현장기준)',   std:'작동' },
    ]},
  ];

  async function openDocumentForm(transitId) {
    const t = _transitCache[transitId];
    if (!t) { Toast.error('정보를 불러올 수 없습니다. 목록을 새로고침하세요.'); return; }

    const equipNos = (t.aj_equip || '').split(',').map(s => s.trim()).filter(Boolean);
    const specPool = [];
    (t.equip_specs || []).forEach(s => { for (let i = 0; i < (s.qty || 1); i++) specPool.push(s.spec); });

    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    // 장비번호로 model 조회, model로 equipment_specs 조회
    let equipDataMap = {};
    if (equipNos.length > 0) {
      const { data: equipRows } = await _sb.from('equipment')
        .select('equip_no,model,manufacture_year')
        .in('equip_no', equipNos);
      (equipRows || []).forEach(r => { equipDataMap[r.equip_no] = r; });

      const modelNames = [...new Set((equipRows || []).map(r => r.model).filter(Boolean))];
      if (modelNames.length > 0) {
        const { data: specRows } = await _sb.from('equipment_specs')
          .select('model,work_height')
          .in('model', modelNames);
        (specRows || []).forEach(r => {
          Object.values(equipDataMap).forEach(eq => {
            if (eq.model === r.model) eq._work_height = r.work_height;
          });
        });
      }
    }

    const targets = equipNos.length > 0 ? equipNos : [''];
    const pages = targets.map((no, i) => {
      const equipData = equipDataMap[no] || {};
      const workHeight = equipData._work_height || specPool[i] || specPool[0] || '';
      const info = _SPEC_INFO[workHeight] || { height: workHeight || '-', load: '227KG', model: '' };
      info._mfgYear = equipData.manufacture_year || '';
      return _buildInspectionPage(t, no, info, today) + _buildChecklistPage(no, info);
    });

    const html = `<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8">
<title>고소작업대 안전서류</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Malgun Gothic','맑은 고딕',Arial,sans-serif;font-size:9pt;color:#000;background:#fff}
  .page{width:190mm;height:270mm;margin:6mm auto;page-break-after:always;overflow:hidden}
  .page:last-child{page-break-after:auto}
  h1,h2{text-align:center;font-size:12pt;font-weight:bold;border:2px solid #000;padding:4px;margin-bottom:4px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #666;padding:2px 4px;font-size:7.8pt;vertical-align:middle}
  .lbl{background:#ebebeb;font-weight:bold;text-align:center;white-space:nowrap;font-size:7.5pt}
  .sec{background:#cdd5e6;font-weight:bold;font-size:8pt}
  .res{text-align:center;width:30px;font-size:10pt;font-weight:bold}
  .chk-hdr{background:#d0d8e8;font-weight:bold;text-align:center;font-size:7.5pt;padding:2px}
  .print-btn{display:block;margin:14px auto;padding:8px 28px;background:#1B365D;color:#fff;border:none;border-radius:6px;font-size:11pt;cursor:pointer;font-family:inherit}
  @page{size:A4 portrait;margin:12mm 10mm}
  @media print{.print-btn{display:none}body{margin:0}.page{margin:0;width:100%;height:auto}}
</style>
</head><body>
${pages.join('')}
<button class="print-btn" onclick="window.print()">인쇄</button>
</body></html>`;

    const win = window.open('', '_blank', 'width=960,height=800');
    if (!win) { Toast.error('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
    win.document.write(html);
    win.document.close();
  }

  function _buildInspectionPage(t, equipNo, info, today) {
    const site = t.site_name || t.site_id || '-';
    const bodyRows = _INSPECT_SECTIONS.map(sec => {
      const hdr = `<tr><td colspan="4" class="sec">${sec.title}</td></tr>`;
      const rows = sec.rows.map(r => `
        <tr>
          <td class="lbl" style="width:88px">${r.part}</td>
          <td style="font-size:7.8pt">${r.content}</td>
          <td class="res">${r.result}</td>
          <td style="width:40px"></td>
        </tr>`).join('');
      return hdr + rows;
    }).join('');

    return `
<div class="page">
  <h1>고소작업대(T/L) 안전점검 결과서</h1>
  <table style="margin-bottom:4px">
    <tr>
      <td class="lbl" style="width:70px">사업장명</td><td colspan="3">${t.company || '-'}</td>
      <td class="lbl" style="width:40px">형식</td><td>수직상승형고소작업대</td>
      <td class="lbl" style="width:60px">제조사(렌탈사)</td><td>AJ네트웍스㈜</td>
    </tr>
    <tr>
      <td class="lbl">사용장소</td><td colspan="3">${site}${t.project ? ' ' + t.project : ''}</td>
      <td class="lbl">동력전달방식</td><td>배터리충전식</td>
      <td class="lbl">형식번호</td><td></td>
    </tr>
    <tr>
      <td class="lbl">운전방식</td><td>자주식</td>
      <td class="lbl" style="width:50px">운행속도</td><td>3.2Km/h</td>
      <td class="lbl">작업대최대높이/적재용량</td><td colspan="3"><strong>${info.height} / ${info.load}</strong></td>
    </tr>
    <tr>
      <td class="lbl">차량번호</td><td><strong>${equipNo || '-'}</strong></td>
      <td class="lbl">제조년월일</td><td>${info._mfgYear || ''}</td>
      <td class="lbl">안전점검년월일</td><td colspan="3"></td>
    </tr>
    <tr>
      <td class="lbl">안전점검일시</td><td>${today}</td>
      <td class="lbl">점검부서</td><td>AJ네트웍스㈜</td>
      <td class="lbl">점검자</td><td colspan="3"></td>
    </tr>
  </table>
  <table>
    <thead>
      <tr>
        <th style="width:88px">검 사 부 분</th>
        <th>검 사 항 목</th>
        <th style="width:30px">검사결과</th>
        <th style="width:40px">조치사항</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      <tr><td class="lbl">검사자 의견</td><td colspan="3" style="height:32px"></td></tr>
    </tbody>
  </table>
  <div style="margin-top:3px;font-size:7.5pt">
    * 검사결과 표시 : 양호 ○, 조정(보완)△, 교환□, 제작(설치)Φ, 폐기×, 해당무
  </div>
</div>`;
  }

  function _buildChecklistPage(equipNo, info) {
    const model = info.model || '-';

    function renderGroups(groups) {
      return groups.map(g => {
        const hdr = `<tr><td colspan="5" class="chk-hdr">${g.group}</td></tr>
          <tr style="background:#f0f0f0;font-size:7.5pt;font-weight:bold">
            <td style="width:20px;text-align:center">NO.</td>
            <td>내 용</td>
            <td style="width:54px;text-align:center">검사기준</td>
            <td style="width:18px;text-align:center">불량</td>
            <td style="width:18px;text-align:center">양호</td>
          </tr>`;
        const rows = g.items.map(it => `
          <tr>
            <td style="text-align:center;font-size:8pt">${it.no}</td>
            <td style="font-size:7.8pt">${it.label}</td>
            <td style="font-size:7.5pt;text-align:center">${it.std}</td>
            <td></td>
            <td style="text-align:center">○</td>
          </tr>`).join('');
        return hdr + rows;
      }).join('');
    }

    return `
<div class="page">
  <h2>(모델명:${model}&nbsp;&nbsp;반입 전 CHECK LIST&nbsp;&nbsp;관리번호: ${equipNo || '-'})</h2>
  <table><tr>
    <td style="width:50%;vertical-align:top;border:none;padding-right:3px">
      <table>${renderGroups(_CHECKLIST_LEFT)}</table>
    </td>
    <td style="width:50%;vertical-align:top;border:none;padding-left:3px">
      <table>${renderGroups(_CHECKLIST_RIGHT)}</table>
    </td>
  </tr></table>
  <div style="margin-top:5px;font-size:7.5pt;border:1px solid #aaa;padding:3px 7px">
    ※ 주의 : 1. 기준은 출고시에 점검 체크 기준이며 배터리 충전 상태에 따라 성능이 달라질 수 있습니다.<br>
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2. 사용중 배터리의 충전상태 장비의 노후 상태에 따라 속도의 차이가 발생할 수 있습니다.
  </div>
</div>`;
  }

  return {
    render, switchTab, loadList,
    openNewForm, addSpecRow,
    _onTypeChange, _onSiteChange, _onCompanyChange,
    _onEquipCheck, _toggleManualInput, _onScEquipRegister,
    _onDocFileChange,
    openScheduleForm, confirmSchedule, openEquipInfoForm,
    openCompleteForm, openCancelForm,
    openDispatchForm, openQrPrint,
    openDocumentForm, openLogViewer,
  };
})();
