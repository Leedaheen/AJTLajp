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

  // ── 렌더 ─────────────────────────────────────────────────
  async function render() {
    const user = Auth.getUser();
    const canRequest = ['partner','aj'].includes(user.role);

    document.getElementById('page-transit').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 class="section-title" style="margin:0">반입/반출 관리</h2>
        ${canRequest ? `<button class="btn btn-primary btn-sm" onclick="TransitPage.openNewForm()">+ 신규 신청</button>` : ''}
      </div>

      <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--gray-200);padding-bottom:0;flex-wrap:wrap">
        ${[['all','전체'],['requested','신청'],['scheduled','협력사확인'],['confirmed','확정'],['completed','완료'],['cancelled','취소']]
          .map(([v,l]) => `
            <button onclick="TransitPage.switchTab('${v}')"
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

  function switchTab(tab) { _currentTab = tab; render(); }

  // ── 목록 ────────────────────────────────────────────────
  async function loadList() {
    const c = document.getElementById('transit-list');
    if (!c) return;
    c.innerHTML = '<div style="text-align:center;padding:32px"><span class="spinner"></span></div>';
    try {
      const p = new URLSearchParams({ limit: 100 });
      if (_currentTab !== 'all') p.set('status', _currentTab);
      const list = await Api.get(`/transit?${p}`);
      _transitCache = {};
      list.forEach(t => { _transitCache[t.id] = t; });
      if (!list.length) { c.innerHTML = '<div class="empty-state"><div>신청 내역이 없습니다</div></div>'; return; }
      c.innerHTML = list.map(_renderCard).join('');
    } catch {
      c.innerHTML = '<div class="empty-state"><div>불러오기 실패</div></div>';
    }
  }

  function _renderCard(t) {
    const user      = Auth.getUser();
    const isAj      = user.role === 'aj';
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
          <button class="btn btn-danger btn-sm" onclick="TransitPage.openCancelForm(${t.id},'${safeCompany}')">취소</button>
        `;
      } else if (t.status === 'confirmed') {
        btns = `
          <button class="btn btn-primary btn-sm"
            onclick="TransitPage.openCompleteForm(${t.id},'${t.type}','${safeCompany}','${specsAttr}')">
            ${typeLabel}완료
          </button>
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
      <div class="card" style="margin-bottom:12px">
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
          <div><span class="text-muted">배차:</span> ${t.driver_info || '-'}</div>
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
            <input id="tr-equip-nos" class="form-input" style="display:none;margin-top:6px"
              placeholder="GF123, GF516, GG112 (쉼표로 구분)">
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
      const manual  = document.getElementById('tr-equip-nos')?.value.trim() || '';
      const manualList = manual ? manual.split(',').map(s => s.trim()).filter(Boolean) : [];
      const combined = [...new Set([...checked, ...manualList])];
      if (!combined.length) { Toast.error('반출할 장비를 선택하거나 입력해주세요.'); return; }
      equip_nos = combined.join(', ');
    }

    _saveFormData();

    const btn = document.getElementById('btn-submit-transit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      await Api.post('/transit', {
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
      });
      Modal.close();
      Toast.success('신청이 완료되었습니다. AJ관리자 검토 후 일정이 확정됩니다.');
      loadList();
    } catch { btn.disabled = false; btn.textContent = '신청 완료'; }
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
            value="${t.aj_equip || ''}">
          <div style="font-size:11px;color:var(--gray-400);margin-top:4px">
            쉼표(,)로 구분. 예: GK111, GF123
          </div>
        </div>
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

    document.getElementById('btn-confirm-schedule').onclick = async () => {
      const date     = document.getElementById('sc-date').value;
      const equipNos = document.getElementById('sc-equip-nos').value.trim();
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
        loadList();
      } catch { btn.disabled = false; btn.textContent = '확정'; }
    };
  }

  // ── 협력사 일정 확인완료 ──────────────────────────────────
  async function confirmSchedule(transitId) {
    if (!confirm('일정을 확인하고 승인하시겠습니까?')) return;
    try {
      await Api.patch(`/transit/${transitId}/partner-confirm`, {});
      Toast.success('일정 확인 완료. 확정 상태로 변경되었습니다.');
      loadList();
    } catch {}
  }

  // ── 완료 처리 (AJ) ───────────────────────────────────────
  function openCompleteForm(transitId, type, company, specsEncoded) {
    const t     = _transitCache[transitId];
    const isIn  = type === 'in';
    const specs = JSON.parse(decodeURIComponent(specsEncoded));

    // 반입 장비번호 목록 (일정 확정 시 입력된 번호)
    const equipNos = (t?.aj_equip || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    // 기본 spec 결정: equip_specs에서 spec 목록 추출
    const specPool = [];
    specs.forEach(s => { for (let i = 0; i < (s.qty || 1); i++) specPool.push(s.spec); });

    Modal.open({
      title: `${isIn ? '반입' : '반출'} 완료 처리`,
      body: isIn ? `
        <p style="margin-bottom:14px">
          <strong>${company}</strong>의 반입을 완료 처리합니다.<br>
          <span class="text-sm text-muted">각 장비번호별 제원을 확인해주세요.</span>
        </p>
        ${equipNos.length ? `
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--gray-100)">
                <th style="padding:8px 10px;text-align:left;font-weight:600">장비번호</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600">제원</th>
              </tr>
            </thead>
            <tbody>
              ${equipNos.map((no, i) => `
                <tr style="border-bottom:1px solid var(--gray-100)">
                  <td style="padding:8px 10px;font-family:monospace">${no}</td>
                  <td style="padding:6px 10px">
                    <select id="spec-row-${i}" class="form-input form-select" style="padding:4px 8px">
                      ${SPEC_OPTIONS.map(s => `<option value="${s}" ${(specPool[i]||specPool[0]||'8M')===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        ` : `
          <div class="form-group">
            <label class="form-label">반입 장비번호 <span style="color:var(--red)">*</span></label>
            <input id="complete-equip-nos" class="form-input" placeholder="GF123, GF124 (쉼표로 구분)">
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
        loadList();
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
        finalEquipNos = nosEl.value.trim().split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    for (let i = 0; i < finalEquipNos.length; i++) {
      const equip_no = finalEquipNos[i];
      const specEl   = document.getElementById(`spec-row-${i}`);
      const spec     = specEl?.value || specPool[i] || specPool[0] || '';

      try {
        // 기존 레코드 확인
        const existing = await Api.get(`/equipment?equip_no=${encodeURIComponent(equip_no)}`, { silent: true });
        const found    = Array.isArray(existing) ? existing.find(e => e.equip_no === equip_no) : null;

        const qr_code  = `AJ-${equip_no}`;
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

        if (found) {
          await Api.patch(`/equipment/${found.id}`, { ...equipData, qr_code: found.qr_code || qr_code });
        } else {
          await Api.post('/equipment', {
            ...equipData,
            record_id: `EQ-${equip_no}-${Date.now()}`,
          });
        }
      } catch (e) { console.warn('[EquipIn] upsert failed:', equip_no, e); }
    }
  }

  // 반출 완료 처리 — transit 상태 변경 + 장비 반출완료 처리
  async function _doCompleteOut(transitId, t, equipNos) {
    await Api.patch(`/transit/${transitId}/complete`, {});

    const today = new Date().toISOString().slice(0, 10);
    for (const equip_no of equipNos) {
      try {
        const existing = await Api.get(`/equipment?equip_no=${encodeURIComponent(equip_no)}`, { silent: true });
        const found    = Array.isArray(existing) ? existing.find(e => e.equip_no === equip_no) : null;
        if (found) {
          await Api.patch(`/equipment/${found.id}`, { status: 'returned', out_date: today });
        }
      } catch (e) { console.warn('[EquipOut] update failed:', equip_no, e); }
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
        loadList();
      } catch { btn.disabled = false; btn.textContent = '취소 처리'; }
    };
  }

  // ── 서류확인 (안전점검 결과서 출력) ──────────────────────
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

  const _INSPECT_ITEMS = [
    { section: '1. 공통사항', items: [
      { label: '조립부품으로부터 1.5M 이내의 방벽이 있을 것', result: 'O' },
      { label: '볼트, 이중잠금고리 등 체결장치 및 각종 장치의 정상 여부 확인', result: '—' },
      { label: '안전장치가 정상적으로 작동하며 올바르게 설치되어 있을 것', result: '—' },
    ]},
    { section: '2. 차대 및 타이어(만충기)', items: [
      { label: '(1)차체 및 타이어: 외관상 균열, 손상 및 마모의 이상이 없을 것', result: 'O' },
      { label: '(2)동력(배터리): 외부 충격 없이 외관상 균열·손상이 없고 히드로스·파이프·볼브류 연결부위 누유가 없을 것', result: 'O' },
      { label: '외부 충격 없이 프레임·볼트류를 점검하고 균열, 손상 및 마모가 없고 가동이 원활할 것', result: 'O' },
      { label: '적용하중 한계를 초과하는 물체를 적재하지 않으며 가동이 원활할 것', result: 'O' },
      { label: '추진자의 단락, 손상 및 단자 부위의 이물질이 없고 배선단부의 전해물로 인한 부식이 없을 것', result: 'O' },
    ]},
    { section: '3. 연장구조물(마스트)', items: [
      { label: '(1)구조부: 장비를 들어올릴 경우 상단에서 안전구조물을 고정할 수 있는 고정방법이 구비될 것', result: 'O' },
      { label: '구조물의 균열, 변형 및 손상이 없고 전지부 균열과 고정부가 적합하며 각 높이 부위의 누유가 없을 것', result: 'O' },
    ]},
    { section: '4. 작업대', items: [
      { label: '(1)난간 및 수직 보호조치: 난간 높이 1.0m 이상, 발판 높이 0.15m 이상, 중간 난간대 간격 0.55m 이내 구조일 것', result: 'O' },
      { label: '(2)출입사다리: 바닥면으로부터 0.4m 초과 시 출입사다리가 설치되어 있을 것', result: '—' },
    ]},
    { section: '5. 제어장치', items: [
      { label: '조작방향에 따른 제어 작동이 올바르게 이루어지며 자동복귀 방식(데드맨 스위치)을 채용할 것', result: 'O' },
      { label: '유압 과부하를 방지하기 위한 안전밸브 등 안전장치를 갖출 것', result: 'O' },
      { label: '교체 필요 시 제어 스위치 버튼의 라벨링이 명확히 표시되어 있을 것', result: 'O' },
    ]},
    { section: '6. 표시', items: [
      { label: '(1)경고 표시: 제조자, 모델명(형식번호), 제조년도, 최대작업높이, 정격하중, 경고·주의사항, 비상인전장치 사용법 등 표시 있을 것', result: 'O' },
      { label: '경고대에는 정격하중, 허용한도단위수, 최대작업높이(최대작업높이인 경우 취급이 필요할 것)를 표시할 것', result: 'O' },
      { label: '안전장치의 위치 및 사용법을 표시할 것', result: 'O' },
    ]},
    { section: '7. 전동 및 조명장치 등', items: [
      { label: '전동 및 조명장치: 전기장치의 절연, 배선, 접지 등을 점검하고 이상이 없을 것', result: 'O' },
      { label: '계기장치: 전조(주차등) 및 배터리 충전상태 표시가 정확히 작동할 것', result: '—' },
      { label: '경보기 및 경보장치의 기기는 기술적 범위 이내일 것', result: 'O' },
    ]},
    { section: '8. 안전장치', items: [
      { label: '(1)자동안전장치: 작업대가 경사진 상태에서 이동 시 주행속도를 자동으로 제한하는 장치가 있을 것', result: 'O' },
      { label: '(2)과부하방지장치: 작업대 위 인원 및 적재물의 총 하중이 정격하중 초과 시 경보하는 장치가 있을 것', result: 'O' },
      { label: '(3)비상안전장치: 비상 시 지상에서 작업대를 하강시킬 수 있는 비상용 수동조작 장치가 있을 것', result: 'O' },
      { label: '(4)비상인전장치: 비상 시 작업자가 안전하게 대피할 수 있도록 비상 안전장치가 설치되어 있을 것', result: 'O' },
    ]},
  ];

  function openDocumentForm(transitId) {
    const t = _transitCache[transitId];
    if (!t) { Toast.error('정보를 불러올 수 없습니다. 목록을 새로고침하세요.'); return; }

    const equipNos = (t.aj_equip || '').split(',').map(s => s.trim()).filter(Boolean);
    const specPool = [];
    (t.equip_specs || []).forEach(s => { for (let i = 0; i < (s.qty || 1); i++) specPool.push(s.spec); });

    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');

    const targets = equipNos.length > 0 ? equipNos : [''];
    const pages = targets.map((no, i) => {
      const spec = specPool[i] || specPool[0] || '';
      const info = _SPEC_INFO[spec] || { height: '-', load: '-', model: spec };
      return _buildInspectionPage(t, no, spec, info, today);
    });

    const html = `<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8">
<title>고소작업대(T/L) 안전점검 결과서</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size:10pt; color:#000; background:#fff; }
  .page { width:190mm; margin:10mm auto; page-break-after:always; }
  .page:last-child { page-break-after:auto; }
  h1 { text-align:center; font-size:14pt; font-weight:bold; border:2px solid #000; padding:8px; margin-bottom:6px; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #000; padding:4px 6px; font-size:9pt; vertical-align:middle; }
  th { background:#f0f0f0; text-align:center; font-weight:bold; }
  .label-cell { background:#f5f5f5; font-weight:bold; width:90px; text-align:center; }
  .section-row td { background:#dde3ee; font-weight:bold; font-size:9.5pt; }
  .result-cell { text-align:center; width:36px; font-size:11pt; font-weight:bold; }
  .print-btn { display:block; margin:10px auto; padding:8px 24px; background:#1B365D; color:#fff; border:none; border-radius:6px; font-size:11pt; cursor:pointer; }
  @media print {
    .print-btn { display:none; }
    body { margin:0; }
    .page { margin:0; width:100%; }
  }
</style>
</head><body>
${pages.join('')}
<button class="print-btn" onclick="window.print()">인쇄</button>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { Toast.error('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
    win.document.write(html);
    win.document.close();
  }

  function _buildInspectionPage(t, equipNo, spec, info, today) {
    const siteLabel = t.site_name || t.site_id || '-';

    const sectionRows = _INSPECT_ITEMS.map(sec => `
      <tr class="section-row"><td colspan="3">${sec.section}</td></tr>
      ${sec.items.map(item => `
        <tr>
          <td colspan="2" style="font-size:8.5pt">${item.label}</td>
          <td class="result-cell">${item.result}</td>
        </tr>`).join('')}
    `).join('');

    return `
<div class="page">
  <h1>고소작업대(T/L) 안전점검 결과서</h1>
  <table style="margin-bottom:6px">
    <tr>
      <td class="label-cell">사업장명</td>
      <td colspan="3">${t.company || '-'}</td>
      <td class="label-cell">형식</td>
      <td colspan="3">수직상승형고소작업대</td>
    </tr>
    <tr>
      <td class="label-cell">제조사</td>
      <td colspan="3">AJ네트웍스㈜</td>
      <td class="label-cell">사용장소</td>
      <td colspan="3">${siteLabel}${t.project ? ' ' + t.project : ''}</td>
    </tr>
    <tr>
      <td class="label-cell">동력전달방식</td>
      <td colspan="3">배터리충전식</td>
      <td class="label-cell">형식번호</td>
      <td colspan="3">${info.model || spec}</td>
    </tr>
    <tr>
      <td class="label-cell">운전방식</td>
      <td colspan="3">자주식</td>
      <td class="label-cell">분행속도</td>
      <td colspan="3">3.2Km/h</td>
    </tr>
    <tr>
      <td class="label-cell">최대작업높이/정격하중</td>
      <td colspan="3">${info.height} / ${info.load}</td>
      <td class="label-cell">차량번호</td>
      <td colspan="3">${equipNo || '-'}</td>
    </tr>
    <tr>
      <td class="label-cell">제조년월일</td>
      <td>-</td>
      <td class="label-cell">안전점검일시</td>
      <td>${today}</td>
      <td class="label-cell">결업부서</td>
      <td>AJ네트웍스㈜</td>
      <td class="label-cell">검사자</td>
      <td></td>
    </tr>
  </table>

  <table>
    <thead>
      <tr>
        <th style="width:90px">검사 항목</th>
        <th>검사 내용</th>
        <th style="width:36px">검사결과</th>
      </tr>
    </thead>
    <tbody>
      ${sectionRows}
      <tr>
        <td class="label-cell">안전자 의견</td>
        <td colspan="2" style="height:40px"></td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top:6px;font-size:8pt;color:#333">
    ※ 검사결과 표시: 양호 O, 조정(판단) ×, 교환 □, 해당(결해) —, 폐기 △, 해당없음 -
  </div>
</div>`;
  }

  return {
    render, switchTab, loadList,
    openNewForm, addSpecRow,
    _onTypeChange, _onSiteChange, _onCompanyChange,
    _onEquipCheck, _toggleManualInput,
    _onDocFileChange,
    openScheduleForm, confirmSchedule,
    openCompleteForm, openCancelForm,
    openDocumentForm,
  };
})();
