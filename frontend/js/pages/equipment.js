/**
 * 장비 관리 페이지
 * - 장비 목록 (검색: 장비번호/업체명/제원/상태)
 * - QR 코드 표시
 * - AJ관리자: 장비 추가/수정
 */
const EquipmentPage = (() => {
  const SPEC_OPTIONS = ['6M','8M','10M','12M','14M','16M','16M굴절','18M','20M굴절'];
  const STATUS_MAP = {
    stock:    { label:'재고',    style:'background:#d1fae5;color:#065f46' },
    in_use:   { label:'사용중',  style:'background:#dbeafe;color:#1e40af' },
    transit:  { label:'이동중',  style:'background:#fef3c7;color:#92400e' },
    returned: { label:'반출완료',style:'background:#f3f4f6;color:#374151' },
  };

  async function render() {
    const user = Auth.getUser();
    const isAj = user.role === 'aj';

    document.getElementById('page-equipment').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 class="section-title" style="margin:0">장비 관리</h2>
        ${isAj ? `<button class="btn btn-primary btn-sm" onclick="EquipmentPage.openAddForm()">+ 장비 추가</button>` : ''}
      </div>

      <!-- 검색 / 필터 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <input id="eq-search" type="text" class="search-input" style="flex:1;min-width:180px" placeholder="장비번호, 업체명, 제원 검색">
        <select id="eq-status" class="form-input form-select" style="width:120px">
          <option value="">전체 상태</option>
          <option value="stock">재고</option>
          <option value="in_use">사용중</option>
          <option value="returned">반출완료</option>
        </select>
        <select id="eq-spec" class="form-input form-select" style="width:120px">
          <option value="">전체 제원</option>
          ${SPEC_OPTIONS.map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
        <select id="eq-site" class="form-input form-select" style="width:120px">
          <option value="">전체 현장</option>
          <option value="P4">P4 복합동</option>
          <option value="P5">P5 복합동</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="EquipmentPage.loadList()">검색</button>
      </div>

      <!-- 요약 뱃지 -->
      <div id="eq-summary" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap"></div>

      <!-- 목록 -->
      <div class="card" style="overflow:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>장비번호</th>
              <th>제원</th>
              <th>현장</th>
              <th>업체</th>
              <th>상태</th>
              <th>반입일</th>
              <th>QR코드</th>
              ${isAj ? '<th>관리</th>' : ''}
            </tr>
          </thead>
          <tbody id="eq-tbody">
            <tr><td colspan="8" class="text-center"><span class="spinner" style="margin:12px auto;display:block"></span></td></tr>
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('eq-search').addEventListener('keydown', e => {
      if (e.key === 'Enter') loadList();
    });

    await loadList();
  }

  async function loadList() {
    const q      = document.getElementById('eq-search')?.value.trim();
    const status = document.getElementById('eq-status')?.value;
    const spec   = document.getElementById('eq-spec')?.value;
    const siteId = document.getElementById('eq-site')?.value;

    const params = new URLSearchParams({ limit: 200 });
    if (status) params.set('status', status);
    if (spec)   params.set('spec', spec);
    if (siteId) params.set('site_id', siteId);
    if (q)      params.set('q', q);

    const tbody = document.getElementById('eq-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><span class="spinner" style="margin:12px auto;display:block"></span></td></tr>';

    try {
      const list = await Api.get(`/equipment?${params}`);
      _renderSummary(list);
      _renderTable(list);
    } catch {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">불러오기 실패</td></tr>';
    }
  }

  function _renderSummary(list) {
    const counts = { stock:0, in_use:0, returned:0 };
    list.forEach(e => { if (counts[e.status] !== undefined) counts[e.status]++; });
    const el = document.getElementById('eq-summary');
    if (!el) return;
    el.innerHTML = `
      <span class="badge" style="background:#d1fae5;color:#065f46">재고 ${counts.stock}대</span>
      <span class="badge" style="background:#dbeafe;color:#1e40af">사용중 ${counts.in_use}대</span>
      <span class="badge" style="background:#f3f4f6;color:#374151">반출완료 ${counts.returned}대</span>
      <span class="badge" style="background:var(--navy);color:#fff">전체 ${list.length}대</span>
    `;
  }

  function _renderTable(list) {
    const user = Auth.getUser();
    const isAj = user.role === 'aj';
    const tbody = document.getElementById('eq-tbody');

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding:32px">장비 없음</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(e => {
      const st = STATUS_MAP[e.status] || { label: e.status, style:'' };
      return `
        <tr>
          <td><strong>${e.equip_no}</strong></td>
          <td>${e.spec || '-'}</td>
          <td>${e.site_name || e.site_id || '-'}</td>
          <td>${e.company || '-'}</td>
          <td><span class="badge" style="${st.style}">${st.label}</span></td>
          <td class="text-sm">${e.in_date || '-'}</td>
          <td>
            ${e.qr_code
              ? `<span class="text-sm" style="font-family:monospace;color:var(--navy)">${e.qr_code}</span>`
              : '<span class="text-muted text-sm">-</span>'
            }
          </td>
          ${isAj ? `
            <td>
              <button class="btn btn-outline btn-sm" onclick="EquipmentPage.openEditForm(${e.id},'${e.equip_no}','${e.spec||''}','${e.site_id||''}','${e.company||''}','${e.status}')">수정</button>
            </td>
          ` : ''}
        </tr>
      `;
    }).join('');
  }

  // ── 장비 추가 (AJ) ──────────────────────────────────────
  function openAddForm() {
    Modal.open({
      title: '장비 추가',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">장비번호 <span style="color:var(--red)">*</span></label>
            <input id="add-equip-no" class="form-input" placeholder="예: P4-8M-A001">
          </div>
          <div class="form-group">
            <label class="form-label">제원 <span style="color:var(--red)">*</span></label>
            <select id="add-spec" class="form-input form-select">
              ${SPEC_OPTIONS.map(s=>`<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">현장</label>
            <select id="add-site" class="form-input form-select">
              <option value="P4">P4 복합동</option>
              <option value="P5">P5 복합동</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">업체명</label>
            <input id="add-company" class="form-input" placeholder="업체명">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">모델명</label>
          <input id="add-model" class="form-input" placeholder="모델명 (선택)">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-add">추가</button>
      `,
    });
    document.getElementById('btn-do-add').onclick = async () => {
      const equip_no = document.getElementById('add-equip-no').value.trim();
      if (!equip_no) { Toast.error('장비번호를 입력해주세요.'); return; }
      const siteId = document.getElementById('add-site').value;
      const btn = document.getElementById('btn-do-add');
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
      try {
        await Api.post('/equipment', {
          equip_no,
          spec:      document.getElementById('add-spec').value,
          model:     document.getElementById('add-model').value.trim(),
          site_id:   siteId,
          site_name: siteId==='P4' ? 'P4 복합동' : 'P5 복합동',
          company:   document.getElementById('add-company').value.trim(),
        });
        Modal.close();
        Toast.success('장비가 추가되었습니다.');
        loadList();
      } catch { btn.disabled=false; btn.textContent='추가'; }
    };
  }

  // ── 장비 수정 (AJ) ──────────────────────────────────────
  function openEditForm(id, equipNo, spec, siteId, company, status) {
    Modal.open({
      title: `장비 수정 — ${equipNo}`,
      body: `
        <div class="form-group">
          <label class="form-label">장비번호</label>
          <input id="ed-equip-no" class="form-input" value="${equipNo}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">제원</label>
            <select id="ed-spec" class="form-input form-select">
              ${SPEC_OPTIONS.map(s=>`<option value="${s}" ${s===spec?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">상태</label>
            <select id="ed-status" class="form-input form-select">
              <option value="stock" ${status==='stock'?'selected':''}>재고</option>
              <option value="in_use" ${status==='in_use'?'selected':''}>사용중</option>
              <option value="returned" ${status==='returned'?'selected':''}>반출완료</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">업체명</label>
          <input id="ed-company" class="form-input" value="${company}">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-edit">저장</button>
      `,
    });
    document.getElementById('btn-do-edit').onclick = async () => {
      const btn = document.getElementById('btn-do-edit');
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
      try {
        await Api.patch(`/equipment/${id}`, {
          equip_no: document.getElementById('ed-equip-no').value.trim(),
          spec:     document.getElementById('ed-spec').value,
          status:   document.getElementById('ed-status').value,
          company:  document.getElementById('ed-company').value.trim(),
        });
        Modal.close();
        Toast.success('장비 정보가 수정되었습니다.');
        loadList();
      } catch { btn.disabled=false; btn.textContent='저장'; }
    };
  }

  return { render, loadList, openAddForm, openEditForm };
})();
