/**
 * 장비 관리 페이지
 */
const EquipmentPage = (() => {
  const SPEC_OPTIONS = ['6M','8M','10M','12M','14M','16M','16M굴절','18M','20M굴절'];
  const STATUS_MAP = {
    in_use:   { label:'사용중',   style:'background:#dbeafe;color:#1e40af' },
    transit:  { label:'이동중',   style:'background:#fef3c7;color:#92400e' },
    returned: { label:'반출완료', style:'background:#f3f4f6;color:#374151' },
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
        <input id="eq-search" type="text" class="search-input" style="flex:1;min-width:180px" placeholder="장비번호, 업체명 검색">
        <select id="eq-status" class="form-input form-select" style="width:120px">
          <option value="">전체 상태</option>
          <option value="in_use">사용중</option>
          <option value="returned">반출완료</option>
        </select>
        <select id="eq-spec" class="form-input form-select" style="width:120px">
          <option value="">전체 제원</option>
          ${SPEC_OPTIONS.map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
        <select id="eq-site" class="form-input form-select" style="width:120px">
          <option value="">전체 현장</option>
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
              <th>프로젝트</th>
              <th>업체</th>
              <th>상태</th>
              <th>반입일</th>
              <th>반출일</th>
              <th>QR / 관리</th>
            </tr>
          </thead>
          <tbody id="eq-tbody">
            <tr><td colspan="9" class="text-center"><span class="spinner" style="margin:12px auto;display:block"></span></td></tr>
          </tbody>
        </table>
      </div>
    `;

    // 현장 드롭다운 동적 로드
    _loadSiteFilter();

    document.getElementById('eq-search').addEventListener('keydown', e => {
      if (e.key === 'Enter') loadList();
    });

    await loadList();
    Realtime.on('equipment', 'equipment', loadList);
  }

  async function _loadSiteFilter() {
    try {
      const sites = await Api.get('/sites');
      const sel = document.getElementById('eq-site');
      if (!sel) return;
      sel.innerHTML = `<option value="">전체 현장</option>` +
        sites.map(s => `<option value="${s.code}">${s.name}</option>`).join('');
    } catch {}
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

    const colspan = 9;
    const tbody = document.getElementById('eq-tbody');
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center"><span class="spinner" style="margin:12px auto;display:block"></span></td></tr>`;

    try {
      const list = await Api.get(`/equipment?${params}`);
      _renderSummary(list);
      _renderTable(list);
    } catch {
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted">불러오기 실패</td></tr>`;
    }
  }

  function _renderSummary(list) {
    const counts = { in_use: 0, returned: 0 };
    list.forEach(e => { if (counts[e.status] !== undefined) counts[e.status]++; });
    const el = document.getElementById('eq-summary');
    if (!el) return;
    el.innerHTML = `
      <span class="badge" style="background:#dbeafe;color:#1e40af">사용중 ${counts.in_use}대</span>
      <span class="badge" style="background:#f3f4f6;color:#374151">반출완료 ${counts.returned}대</span>
      <span class="badge" style="background:var(--navy);color:#fff">전체 ${list.length}대</span>
    `;
  }

  function _renderTable(list) {
    const user  = Auth.getUser();
    const isAj  = user.role === 'aj';
    const tbody = document.getElementById('eq-tbody');
    const colspan = isAj ? 9 : 8;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted" style="padding:32px">장비 없음</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(e => {
      const st = STATUS_MAP[e.status] || { label: e.status, style:'' };
      return `
        <tr>
          <td><strong>${e.equip_no}</strong></td>
          <td>${e.spec || '-'}</td>
          <td>${e.site_name || e.site_id || '-'}</td>
          <td>${e.project || '-'}</td>
          <td>${e.company || '-'}</td>
          <td><span class="badge" style="${st.style}">${st.label}</span></td>
          <td class="text-sm">${e.in_date || '-'}</td>
          <td class="text-sm">${e.out_date || '-'}</td>
          <td style="white-space:nowrap">
            ${e.qr_code
              ? `<button class="btn btn-outline btn-sm" onclick="EquipmentPage.showQr(${e.id})">QR 보기</button>`
              : (isAj ? `<button class="btn btn-outline btn-sm" onclick="EquipmentPage.genQr(${e.id},'${(e.equip_no||'').replace(/'/g,"\\'")}')">QR 생성</button>` : '')
            }
            ${isAj ? `
              <button class="btn btn-outline btn-sm" style="margin-left:4px"
                onclick="EquipmentPage.openEditForm(${e.id},'${(e.equip_no||'').replace(/'/g,"\\'")}','${e.spec||''}','${e.site_id||''}','${(e.company||'').replace(/'/g,"\\'")}','${e.status}')">
                수정
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  // ── 장비 추가 (AJ) ──────────────────────────────────────
  async function openAddForm() {
    const sites = await Api.get('/sites').catch(() => [{code:'P4',name:'P4 복합동'},{code:'P5',name:'P5 복합동'}]);
    Modal.open({
      title: '장비 추가',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">장비번호 <span style="color:var(--red)">*</span></label>
            <input id="add-equip-no" class="form-input" placeholder="예: GK111">
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
              ${sites.map(s=>`<option value="${s.code}" data-name="${s.name}">${s.name}</option>`).join('')}
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
      const siteEl = document.getElementById('add-site');
      const siteId = siteEl.value;
      const siteName = siteEl.options[siteEl.selectedIndex]?.getAttribute('data-name') || siteId;
      const btn = document.getElementById('btn-do-add');
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
      try {
        await Api.post('/equipment', {
          equip_no,
          spec:      document.getElementById('add-spec').value,
          model:     document.getElementById('add-model').value.trim(),
          site_id:   siteId,
          site_name: siteName,
          company:   document.getElementById('add-company').value.trim(),
          status:    'in_use',
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
              <option value="in_use"   ${status==='in_use'  ?'selected':''}>사용중</option>
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
        const newStatus = document.getElementById('ed-status').value;
        const updateBody = {
          equip_no: document.getElementById('ed-equip-no').value.trim(),
          spec:     document.getElementById('ed-spec').value,
          status:   newStatus,
          company:  document.getElementById('ed-company').value.trim(),
        };
        // 반출완료로 변경 시 out_date 자동 기록
        if (newStatus === 'returned' && status !== 'returned') {
          updateBody.out_date = new Date().toISOString().slice(0, 10);
        }
        await Api.patch(`/equipment/${id}`, updateBody);
        Modal.close();
        Toast.success('장비 정보가 수정되었습니다.');
        loadList();
      } catch { btn.disabled=false; btn.textContent='저장'; }
    };
  }

  // ── QR 보기 (기존 qr_code 있을 때) ─────────────────────
  async function showQr(equipId) {
    try {
      const e = await Api.get(`/equipment/${equipId}`);
      QrScanner.showQrCode(e);
    } catch { Toast.error('장비 정보를 불러올 수 없습니다.'); }
  }

  // ── QR 생성 (AJ 전용, qr_code 없을 때) ──────────────────
  async function genQr(equipId, equipNo) {
    if (!confirm(`${equipNo} 장비에 QR코드를 생성하시겠습니까?`)) return;
    try {
      const qr_code = `AJ-${equipNo}`;
      await Api.patch(`/equipment/${equipId}`, { qr_code });
      Toast.success(`QR코드 생성 완료: ${qr_code}`);
      loadList();
    } catch { Toast.error('QR코드 생성에 실패했습니다.'); }
  }

  return { render, loadList, openAddForm, openEditForm, showQr, genQr };
})();
