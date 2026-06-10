/**
 * 반입/반출 관리 페이지
 * - 신청 목록 (탭: 전체/신청/확정/완료/취소)
 * - 신청서 작성 (협력사·AJ)
 * - 일정 확정 + 배차 입력 (AJ)
 * - 완료 처리 / 취소 (AJ)
 * - 변경 이력 확인
 */
const TransitPage = (() => {
  const SPEC_OPTIONS = ['6M','8M','10M','12M','14M','16M','16M굴절','18M','20M굴절'];
  const STATUS_MAP = {
    requested:  { label:'신청 접수',  cls:'badge-pending' },
    scheduled:  { label:'일정 확정',  cls:'badge-active'  },
    confirmed:  { label:'확인 완료',  cls:'badge-active'  },
    completed:  { label:'완료',       cls:'',  style:'background:#1B365D;color:#fff' },
    cancelled:  { label:'취소',       cls:'badge-rejected'},
  };
  const TYPE_LABEL = { in:'반입', out:'반출' };

  let _currentTab = 'all';

  // ── 렌더 ─────────────────────────────────────────────────
  async function render() {
    const user = Auth.getUser();
    const isAj = user.role === 'aj';
    const isPartner = user.role === 'partner';

    document.getElementById('page-transit').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 class="section-title" style="margin:0">반입/반출 관리</h2>
        ${(isAj || isPartner) ? `<button class="btn btn-primary btn-sm" onclick="TransitPage.openNewForm()">+ 신규 신청</button>` : ''}
      </div>

      <!-- 탭 -->
      <div class="tab-bar" style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--gray-200);padding-bottom:0">
        ${[
          ['all','전체'],['requested','신청'],['scheduled','확정'],
          ['completed','완료'],['cancelled','취소']
        ].map(([v,l]) => `
          <button class="tab-btn ${_currentTab===v?'active':''}" data-tab="${v}"
            onclick="TransitPage.switchTab('${v}')"
            style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;
            color:${_currentTab===v?'var(--navy)':'var(--gray-400)'};
            border-bottom:${_currentTab===v?'2px solid var(--navy)':'2px solid transparent'};
            margin-bottom:-2px">
            ${l}
          </button>
        `).join('')}
      </div>

      <!-- 목록 -->
      <div id="transit-list"></div>
    `;

    await loadList();
  }

  function switchTab(tab) {
    _currentTab = tab;
    render();
  }

  // ── 목록 로드 ────────────────────────────────────────────
  async function loadList() {
    const container = document.getElementById('transit-list');
    container.innerHTML = '<div style="text-align:center;padding:32px"><span class="spinner"></span></div>';

    try {
      const params = new URLSearchParams({ limit: 100 });
      if (_currentTab !== 'all') params.set('status', _currentTab);
      const list = await Api.get(`/transit?${params}`);

      if (!list.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div>신청 내역이 없습니다</div></div>';
        return;
      }

      container.innerHTML = list.map(t => _renderCard(t)).join('');
    } catch {
      container.innerHTML = '<div class="empty-state"><div>불러오기 실패</div></div>';
    }
  }

  function _renderCard(t) {
    const user = Auth.getUser();
    const isAj = user.role === 'aj';
    const st   = STATUS_MAP[t.status] || { label: t.status, cls: '' };
    const specs = (t.equip_specs || []).map(s => `${s.spec}×${s.qty}`).join(', ');

    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <span class="badge ${st.cls}" ${st.style?`style="${st.style}"`:''}>
              ${TYPE_LABEL[t.type]||t.type} · ${st.label}
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

        <!-- AJ 액션 버튼 -->
        ${isAj && t.status === 'requested' ? `
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="TransitPage.openScheduleForm(${t.id})">일정 확정</button>
            <button class="btn btn-danger btn-sm" onclick="TransitPage.openCancelForm(${t.id},'${t.company}')">취소</button>
          </div>
        ` : ''}
        ${isAj && t.status === 'scheduled' ? `
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="TransitPage.completeTransit(${t.id},'${TYPE_LABEL[t.type]}','${t.company}')">완료 처리</button>
            <button class="btn btn-outline btn-sm" onclick="TransitPage.openScheduleForm(${t.id})">일정 수정</button>
            <button class="btn btn-danger btn-sm" onclick="TransitPage.openCancelForm(${t.id},'${t.company}')">취소</button>
          </div>
        ` : ''}

        <!-- 변경 이력 -->
        ${(t.change_log && t.change_log.length) ? `
          <details style="margin-top:12px">
            <summary style="font-size:12px;color:var(--gray-400);cursor:pointer">변경 이력 ${t.change_log.length}건</summary>
            <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
              ${t.change_log.map(c => `
                <div style="font-size:11px;background:var(--gray-100);padding:6px 10px;border-radius:6px">
                  <strong>${c.who}</strong> · ${c.when}<br>
                  ${c.before} → <strong>${c.after}</strong>
                </div>
              `).join('')}
            </div>
          </details>
        ` : ''}
      </div>
    `;
  }

  // ── 신규 신청 폼 ─────────────────────────────────────────
  function openNewForm(type = 'in') {
    Modal.open({
      title: '반입/반출 신청',
      body: `
        <div class="form-group">
          <label class="form-label">신청 종류 <span style="color:var(--red)">*</span></label>
          <div style="display:flex;gap:10px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="radio" name="tr-type" value="in" ${type==='in'?'checked':''}>반입
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="radio" name="tr-type" value="out" ${type==='out'?'checked':''}>반출
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
            <label class="form-label">담당자 <span style="color:var(--red)">*</span></label>
            <input id="tr-reporter" class="form-input" placeholder="담당자 이름">
          </div>
          <div class="form-group">
            <label class="form-label">연락처 <span style="color:var(--red)">*</span></label>
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
          <label class="form-label">희망 반입 날짜</label>
          <input id="tr-date" type="date" class="form-input">
        </div>

        <!-- 장비 제원 -->
        <div class="form-group">
          <label class="form-label">장비 제원 및 수량 <span style="color:var(--red)">*</span></label>
          <div id="tr-specs"></div>
          <button type="button" class="btn btn-outline btn-sm" style="margin-top:8px" onclick="TransitPage.addSpecRow()">+ 장비 추가</button>
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

    // 첫 번째 제원 행 추가
    document.getElementById('tr-specs').innerHTML = '';
    addSpecRow();

    document.getElementById('btn-submit-transit').onclick = submitNewTransit;
  }

  function addSpecRow() {
    const container = document.getElementById('tr-specs');
    const row = document.createElement('div');
    row.className = 'spec-row';
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';
    row.innerHTML = `
      <select class="form-input form-select spec-select" style="flex:1">
        ${SPEC_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <input type="number" class="form-input spec-qty" value="1" min="1" max="99" style="width:70px;text-align:center">
      <span style="font-size:13px;color:var(--gray-400)">대</span>
      <button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px">×</button>
    `;
    container.appendChild(row);
  }

  async function submitNewTransit() {
    const type    = document.querySelector('input[name="tr-type"]:checked')?.value;
    const siteId  = document.getElementById('tr-site').value;
    const company = document.getElementById('tr-company').value.trim();
    const reporter= document.getElementById('tr-reporter').value.trim();
    const phone   = document.getElementById('tr-phone').value.trim();
    const date    = document.getElementById('tr-date').value;
    const note    = document.getElementById('tr-note').value.trim();

    if (!type || !company || !reporter || !phone) {
      Toast.error('필수 항목을 모두 입력해주세요.'); return;
    }

    const specRows = document.querySelectorAll('.spec-row');
    const equip_specs = [];
    for (const row of specRows) {
      const spec = row.querySelector('.spec-select').value;
      const qty  = parseInt(row.querySelector('.spec-qty').value) || 1;
      equip_specs.push({ spec, qty });
    }
    if (!equip_specs.length) { Toast.error('장비를 1개 이상 추가해주세요.'); return; }

    const btn = document.getElementById('btn-submit-transit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      await Api.post('/transit', {
        type, site_id: siteId,
        site_name: siteId === 'P4' ? 'P4 복합동' : 'P5 복합동',
        company, equip_specs,
        reporter_name: reporter, reporter_phone: phone,
        manager_name: document.getElementById('tr-manager').value.trim(),
        manager_phone: document.getElementById('tr-manager-phone').value.trim(),
        requested_date: date, note,
      });
      Modal.close();
      Toast.success('신청이 완료되었습니다. AJ관리자 검토 후 일정이 확정됩니다.');
      loadList();
    } catch {
      btn.disabled = false;
      btn.textContent = '신청 완료';
    }
  }

  // ── 일정 확정 폼 (AJ) ────────────────────────────────────
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
          <textarea id="sc-note" class="form-input" rows="2" placeholder="전달 사항 입력"></textarea>
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
      } catch { btn.disabled=false; btn.textContent='확정 저장'; }
    };
  }

  // ── 완료 처리 (AJ) ───────────────────────────────────────
  async function completeTransit(transitId, typeLabel, company) {
    Modal.open({
      title: `${typeLabel} 완료 처리`,
      body: `
        <p>${company}의 <strong>${typeLabel}</strong>을 완료 처리하시겠습니까?</p>
        ${typeLabel==='반입' ? '<p class="text-sm text-muted" style="margin-top:8px">장비별 QR코드가 자동 생성됩니다.</p>' : '<p class="text-sm text-muted" style="margin-top:8px">장비 QR코드가 삭제되고 반출일이 기록됩니다.</p>'}
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-complete">완료 처리</button>
      `,
    });
    document.getElementById('btn-do-complete').onclick = async () => {
      const btn = document.getElementById('btn-do-complete');
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
      try {
        await Api.patch(`/transit/${transitId}/complete`, {});
        Modal.close();
        Toast.success('완료 처리되었습니다.');
        loadList();
      } catch { btn.disabled=false; btn.textContent='완료 처리'; }
    };
  }

  // ── 취소 폼 ─────────────────────────────────────────────
  function openCancelForm(transitId, company) {
    Modal.open({
      title: `신청 취소 — ${company}`,
      body: `
        <div class="form-group">
          <label class="form-label">취소 사유 <span style="color:var(--red)">*</span></label>
          <textarea id="inp-cancel-reason" class="form-input" rows="3" placeholder="취소 사유를 입력해주세요"></textarea>
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
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
      try {
        await Api.patch(`/transit/${transitId}/cancel`, { cancelled_reason: reason });
        Modal.close();
        Toast.success('취소 처리되었습니다.');
        loadList();
      } catch { btn.disabled=false; btn.textContent='취소 처리'; }
    };
  }

  return { render, switchTab, loadList, openNewForm, addSpecRow, openScheduleForm, completeTransit, openCancelForm };
})();
