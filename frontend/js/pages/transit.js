/**
 * 반입/반출 관리 페이지
 */
const TransitPage = (() => {
  const SPEC_OPTIONS = ['6M','8M','10M','12M','14M','16M','16M굴절','18M','20M굴절'];
  const STATUS_MAP = {
    requested: { label:'신청 접수',  cls:'badge-pending' },
    scheduled: { label:'일정 확정',  cls:'badge-active'  },
    completed: { label:'완료',       style:'background:#1B365D;color:#fff' },
    cancelled: { label:'취소',       cls:'badge-rejected' },
  };
  const LS = 'transit_form_';

  let _currentTab = 'all';

  // ── localStorage 저장/불러오기 ───────────────────────────
  function _saveFormData() {
    [
      ['tr-company',       'company'],
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
    [
      ['tr-company',       'company',       'saved_company'],
      ['tr-reporter',      'reporter_name', null],
      ['tr-phone',         'reporter_phone',null],
      ['tr-manager',       'manager_name',  null],
      ['tr-manager-phone', 'manager_phone', null],
    ].forEach(([id, key, fallback]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const v = localStorage.getItem(LS + key) || (fallback ? localStorage.getItem(fallback) : '');
      if (v) el.value = v;
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

      <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--gray-200);padding-bottom:0">
        ${[['all','전체'],['requested','신청'],['scheduled','확정'],['completed','완료'],['cancelled','취소']]
          .map(([v,l]) => `
            <button onclick="TransitPage.switchTab('${v}')"
              style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;
              color:${_currentTab===v?'var(--navy)':'var(--gray-400)'};
              border-bottom:${_currentTab===v?'2px solid var(--navy)':'2px solid transparent'};margin-bottom:-2px">
              ${l}
            </button>`).join('')}
      </div>

      <div id="transit-list"></div>
    `;
    await loadList();
  }

  function switchTab(tab) { _currentTab = tab; render(); }

  // ── 목록 ────────────────────────────────────────────────
  async function loadList() {
    const c = document.getElementById('transit-list');
    c.innerHTML = '<div style="text-align:center;padding:32px"><span class="spinner"></span></div>';
    try {
      const p = new URLSearchParams({ limit: 100 });
      if (_currentTab !== 'all') p.set('status', _currentTab);
      const list = await Api.get(`/transit?${p}`);
      if (!list.length) { c.innerHTML = '<div class="empty-state"><div>신청 내역이 없습니다</div></div>'; return; }
      c.innerHTML = list.map(_renderCard).join('');
    } catch {
      c.innerHTML = '<div class="empty-state"><div>불러오기 실패</div></div>';
    }
  }

  function _renderCard(t) {
    const user  = Auth.getUser();
    const isAj  = user.role === 'aj';
    const st    = STATUS_MAP[t.status] || { label: t.status, cls: '' };
    const specs = (t.equip_specs || []).map(s => `${s.spec}×${s.qty}`).join(', ');
    const typeLabel = t.type === 'in' ? '반입' : '반출';
    // JSON.stringify를 안전하게 attribute에 넣기 위해 인코딩
    const specsAttr = encodeURIComponent(JSON.stringify(t.equip_specs || []));

    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <span class="badge ${st.cls||''}" ${st.style?`style="${st.style}"`:''}>
              ${typeLabel} · ${st.label}
            </span>
            <div style="font-size:16px;font-weight:700;color:var(--navy);margin-top:6px">${t.company}</div>
            <div class="text-sm text-muted" style="margin-top:2px">${t.site_name} · ${specs}</div>
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
            <span class="text-muted">${t.type==='in'?'반입':'반출'} 장비번호:</span>
            <span style="font-family:monospace;color:var(--navy);margin-left:4px">${t.aj_equip}</span>
          </div>
        ` : ''}

        ${isAj && t.status === 'requested' ? `
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="TransitPage.openScheduleForm(${t.id})">일정 확정</button>
            <button class="btn btn-danger btn-sm" onclick="TransitPage.openCancelForm(${t.id},'${t.company.replace(/'/g,"\\'")}')">취소</button>
          </div>
        ` : ''}
        ${isAj && t.status === 'scheduled' ? `
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm"
              onclick="TransitPage.openCompleteForm(${t.id},'${t.type}','${t.company.replace(/'/g,"\\'")}','${specsAttr}')">완료 처리</button>
            <button class="btn btn-outline btn-sm" onclick="TransitPage.openScheduleForm(${t.id})">일정 수정</button>
            <button class="btn btn-danger btn-sm" onclick="TransitPage.openCancelForm(${t.id},'${t.company.replace(/'/g,"\\'")}')">취소</button>
          </div>
        ` : ''}

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

  // ── 신규 신청 폼 ─────────────────────────────────────────
  function openNewForm() {
    Modal.open({
      title: '반입/반출 신청',
      body: `
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

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">현장 <span style="color:var(--red)">*</span></label>
            <select id="tr-site" class="form-input form-select">
              <option value="P4">P4 복합동</option>
              <option value="P5">P5 복합동</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">업체명 <span style="color:var(--red)">*</span></label>
            <input id="tr-company" class="form-input" placeholder="업체명">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">신청자 <span style="color:var(--red)">*</span></label>
            <input id="tr-reporter" class="form-input" placeholder="담당자 이름">
          </div>
          <div class="form-group">
            <label class="form-label">신청자 연락처 <span style="color:var(--red)">*</span></label>
            <input id="tr-phone" class="form-input" placeholder="010-0000-0000">
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
          <label class="form-label">반출 장비번호 <span style="color:var(--red)">*</span></label>
          <input id="tr-equip-nos" class="form-input" placeholder="GF123, GF516, GG112">
          <div style="font-size:11px;color:var(--gray-400);margin-top:4px">
            여러 대인 경우 쉼표(,)로 구분해 입력해주세요.
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
  }

  function _onTypeChange(type) {
    const label   = document.getElementById('tr-date-label');
    const specsEl = document.getElementById('tr-specs-section');
    const equipEl = document.getElementById('tr-equip-nos-section');
    if (label)   label.innerHTML = `희망 ${type === 'in' ? '반입' : '반출'} 날짜 <span style="color:var(--red)">*</span>`;
    if (specsEl) specsEl.style.display = type === 'in' ? '' : 'none';
    if (equipEl) equipEl.style.display = type === 'out' ? '' : 'none';
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

  async function _submitNewTransit() {
    const type    = document.querySelector('input[name="tr-type"]:checked')?.value;
    const siteId  = document.getElementById('tr-site').value;
    const company = document.getElementById('tr-company').value.trim();
    const reporter= document.getElementById('tr-reporter').value.trim();
    const phone   = document.getElementById('tr-phone').value.trim();
    const date    = document.getElementById('tr-date').value;

    if (!company || !reporter || !phone) { Toast.error('필수 항목을 모두 입력해주세요.'); return; }
    if (!date) { Toast.error(`희망 ${type === 'in' ? '반입' : '반출'} 날짜를 선택해주세요.`); return; }

    let equip_specs = [], equip_nos = '';

    if (type === 'in') {
      document.querySelectorAll('#tr-specs .spec-select').forEach(sel => {
        const qty = parseInt(sel.parentElement.querySelector('.spec-qty').value) || 1;
        equip_specs.push({ spec: sel.value, qty });
      });
      if (!equip_specs.length) { Toast.error('장비를 1개 이상 추가해주세요.'); return; }
    } else {
      equip_nos = document.getElementById('tr-equip-nos').value.trim();
      if (!equip_nos) { Toast.error('반출 장비번호를 입력해주세요.'); return; }
    }

    _saveFormData();

    const btn = document.getElementById('btn-submit-transit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      await Api.post('/transit', {
        type, site_id: siteId,
        site_name: siteId === 'P4' ? 'P4 복합동' : 'P5 복합동',
        company, equip_specs, equip_nos,
        reporter_name:  reporter,
        reporter_phone: phone,
        manager_name:   document.getElementById('tr-manager').value.trim(),
        manager_phone:  document.getElementById('tr-manager-phone').value.trim(),
        requested_date: date,
        note:           document.getElementById('tr-note').value.trim(),
      });
      Modal.close();
      Toast.success('신청이 완료되었습니다. AJ관리자 검토 후 일정이 확정됩니다.');
      loadList();
    } catch { btn.disabled = false; btn.textContent = '신청 완료'; }
  }

  // ── 일정 확정 (AJ) ───────────────────────────────────────
  function openScheduleForm(transitId) {
    Modal.open({
      title: '일정 확정 및 배차 입력',
      body: `
        <div class="form-group">
          <label class="form-label">확정 날짜 <span style="color:var(--red)">*</span></label>
          <input id="sc-date" type="date" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">배차 차량</label>
          <input id="sc-vehicle" class="form-input" placeholder="예: 5톤 트럭">
        </div>
        <div class="form-group">
          <label class="form-label">담당 기사 / 연락처</label>
          <input id="sc-driver" class="form-input" placeholder="예: 홍길동 / 010-0000-0000">
        </div>
        <div class="form-group">
          <label class="form-label">비고</label>
          <textarea id="sc-note" class="form-input" rows="2"></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-confirm-schedule">확정 저장</button>
      `,
    });
    document.getElementById('btn-confirm-schedule').onclick = async () => {
      const date = document.getElementById('sc-date').value;
      if (!date) { Toast.error('확정 날짜를 선택해주세요.'); return; }
      const btn = document.getElementById('btn-confirm-schedule');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/transit/${transitId}/schedule`, {
          scheduled_date: date,
          vehicle_info:   document.getElementById('sc-vehicle').value.trim(),
          driver_info:    document.getElementById('sc-driver').value.trim(),
          note:           document.getElementById('sc-note').value.trim(),
        });
        Modal.close();
        Toast.success('일정이 확정되었습니다. 협력사에게 알림이 발송됩니다.');
        loadList();
      } catch { btn.disabled = false; btn.textContent = '확정 저장'; }
    };
  }

  // ── 완료 처리 (AJ) ───────────────────────────────────────
  function openCompleteForm(transitId, type, company, specsEncoded) {
    const isIn     = type === 'in';
    const specs    = JSON.parse(decodeURIComponent(specsEncoded));
    const totalQty = specs.reduce((s, e) => s + (e.qty || 1), 0);
    const specsStr = specs.map(s => `${s.spec} ${s.qty}대`).join(' / ');

    Modal.open({
      title: `${isIn ? '반입' : '반출'} 완료 처리`,
      body: isIn ? `
        <p style="margin-bottom:14px">
          <strong>${company}</strong>의 반입을 완료 처리합니다.<br>
          <span class="text-sm text-muted">${specsStr} — 총 ${totalQty}대</span>
        </p>
        <div class="form-group">
          <label class="form-label">반입 장비번호 <span style="color:var(--red)">*</span></label>
          <input id="complete-equip-nos" class="form-input"
            placeholder="${Array.from({length:Math.min(totalQty,3)},(_,i)=>'GF'+(100+i)).join(', ')}${totalQty>3?', ...':''}">
          <div style="font-size:11px;color:var(--gray-400);margin-top:4px">
            ${totalQty}대 모두 입력 · 쉼표(,)로 구분
          </div>
        </div>
      ` : `
        <p style="margin-bottom:8px"><strong>${company}</strong>의 반출을 완료 처리합니다.</p>
        <p class="text-sm text-muted">신청 시 등록된 장비번호가 반출 완료 처리됩니다.</p>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-complete">완료 처리</button>
      `,
    });

    document.getElementById('btn-do-complete').onclick = async () => {
      let equip_nos = '';
      if (isIn) {
        equip_nos = document.getElementById('complete-equip-nos')?.value.trim();
        if (!equip_nos) { Toast.error('장비번호를 입력해주세요.'); return; }
        const count = equip_nos.split(',').map(s => s.trim()).filter(Boolean).length;
        if (count !== totalQty) {
          Toast.error(`장비번호 ${totalQty}대를 입력해주세요. (현재 ${count}대 입력됨)`);
          return;
        }
      }
      const btn = document.getElementById('btn-do-complete');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/transit/${transitId}/complete`, { equip_nos });
        Modal.close();
        Toast.success('완료 처리되었습니다.');
        loadList();
      } catch { btn.disabled = false; btn.textContent = '완료 처리'; }
    };
  }

  // ── 취소 (AJ) ────────────────────────────────────────────
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

  return {
    render, switchTab, loadList,
    openNewForm, addSpecRow, _onTypeChange,
    openScheduleForm, openCompleteForm, openCancelForm,
  };
})();
