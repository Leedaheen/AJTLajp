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

  // 현재 로드된 전체 목록 캐시 (체크박스 일괄처리용)
  let _listCache = [];

  async function render() {
    const user = Auth.getUser();
    const isAj = user.role === 'aj';

    document.getElementById('page-equipment').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 class="section-title" style="margin:0">장비 관리</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${isAj ? `
            <button id="btn-bulk-qr" class="btn btn-outline btn-sm hidden" onclick="EquipmentPage.openBulkQr()">
              선택 QR 생성
            </button>
            <button class="btn btn-primary btn-sm" onclick="EquipmentPage.openAddForm()">+ 장비 추가</button>
          ` : ''}
        </div>
      </div>

      <!-- 요약 뱃지 (클릭 필터링) -->
      <div id="eq-summary" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap"></div>

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

      <!-- 목록 -->
      <div class="card" style="overflow:auto">
        <table class="data-table">
          <thead>
            <tr>
              ${isAj ? `<th style="width:36px"><input type="checkbox" id="eq-check-all" title="전체 선택"></th>` : ''}
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
            <tr><td colspan="10" class="text-center"><span class="spinner" style="margin:12px auto;display:block"></span></td></tr>
          </tbody>
        </table>
      </div>
    `;

    _loadSiteFilter();

    document.getElementById('eq-search').addEventListener('keydown', e => {
      if (e.key === 'Enter') loadList();
    });

    if (isAj) {
      document.getElementById('eq-check-all').addEventListener('change', e => {
        document.querySelectorAll('.eq-row-check').forEach(cb => { cb.checked = e.target.checked; });
        _updateBulkBtn();
      });
    }

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

    const tbody = document.getElementById('eq-tbody');
    tbody.innerHTML = `<tr><td colspan="10" class="text-center"><span class="spinner" style="margin:12px auto;display:block"></span></td></tr>`;

    try {
      const list = await Api.get(`/equipment?${params}`);
      _listCache = list;
      _renderSummary(list);
      _renderTable(list);
    } catch {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">불러오기 실패</td></tr>`;
    }
  }

  // status 값으로 eq-status 드롭다운 세팅 후 목록 재로드 (뱃지 클릭)
  function filterByStatus(status) {
    const sel = document.getElementById('eq-status');
    if (sel) sel.value = status;
    loadList();
  }

  function _renderSummary(list) {
    const counts = { in_use: 0, returned: 0 };
    list.forEach(e => { if (counts[e.status] !== undefined) counts[e.status]++; });
    const el = document.getElementById('eq-summary');
    if (!el) return;

    const badgeStyle = 'cursor:pointer;user-select:none;transition:opacity 0.15s';
    el.innerHTML = `
      <span class="badge" style="background:#dbeafe;color:#1e40af;${badgeStyle}"
        onclick="EquipmentPage.filterByStatus('in_use')" title="사용중만 보기">
        사용중 ${counts.in_use}대
      </span>
      <span class="badge" style="background:#f3f4f6;color:#374151;${badgeStyle}"
        onclick="EquipmentPage.filterByStatus('returned')" title="반출완료만 보기">
        반출완료 ${counts.returned}대
      </span>
      <span class="badge" style="background:var(--navy);color:#fff;${badgeStyle}"
        onclick="EquipmentPage.filterByStatus('')" title="전체 보기">
        전체 ${list.length}대
      </span>
    `;
  }

  function _renderTable(list) {
    const user  = Auth.getUser();
    const isAj  = user.role === 'aj';
    const tbody = document.getElementById('eq-tbody');

    // 전체선택 체크박스 초기화
    const allCb = document.getElementById('eq-check-all');
    if (allCb) allCb.checked = false;
    _updateBulkBtn();

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding:32px">장비 없음</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(e => {
      const st = STATUS_MAP[e.status] || { label: e.status, style:'' };
      return `
        <tr>
          ${isAj ? `
            <td style="text-align:center">
              <input type="checkbox" class="eq-row-check" data-id="${e.id}" data-equip-no="${e.equip_no||''}"
                data-has-qr="${e.qr_code ? '1' : '0'}" onchange="EquipmentPage._updateBulkBtn()">
            </td>
          ` : ''}
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

  // 체크된 항목이 있을 때 일괄 QR 생성 버튼 표시
  function _updateBulkBtn() {
    const btn = document.getElementById('btn-bulk-qr');
    if (!btn) return;
    const checked = document.querySelectorAll('.eq-row-check:checked');
    if (checked.length > 0) {
      btn.classList.remove('hidden');
      btn.textContent = `선택 QR 생성 (${checked.length}대)`;
    } else {
      btn.classList.add('hidden');
    }
  }

  // ── 일괄 QR 생성 ─────────────────────────────────────────
  async function openBulkQr() {
    const checked = [...document.querySelectorAll('.eq-row-check:checked')];
    if (!checked.length) return;

    // 체크된 장비 목록 수집
    const targets = checked.map(cb => ({
      id:       cb.dataset.id,
      equip_no: cb.dataset.equipNo,
      hasQr:    cb.dataset.hasQr === '1',
    }));

    const noQr    = targets.filter(t => !t.hasQr);
    const hasQrList = targets.filter(t => t.hasQr);

    Modal.open({
      title: `QR 일괄 생성 — ${targets.length}대`,
      body: `
        <div style="margin-bottom:14px">
          ${noQr.length > 0 ? `
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;margin-bottom:10px">
              <div style="font-size:13px;font-weight:600;color:#1d4ed8;margin-bottom:6px">QR 신규 생성 (${noQr.length}대)</div>
              <div style="font-size:13px;color:#374151;line-height:1.8">
                ${noQr.map(t => `<span style="font-family:monospace;background:#dbeafe;padding:2px 6px;border-radius:4px;margin-right:4px">${t.equip_no}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          ${hasQrList.length > 0 ? `
            <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:10px 14px">
              <div style="font-size:13px;font-weight:600;color:#92400e;margin-bottom:6px">이미 QR 있음 (인쇄만 가능) (${hasQrList.length}대)</div>
              <div style="font-size:13px;color:#374151;line-height:1.8">
                ${hasQrList.map(t => `<span style="font-family:monospace;background:#fef3c7;padding:2px 6px;border-radius:4px;margin-right:4px">${t.equip_no}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        <div style="font-size:13px;color:var(--gray-500)">
          생성 완료 후 선택 장비 전체의 QR PDF를 인쇄할 수 있습니다.
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-bulk-qr">
          ${noQr.length > 0 ? 'QR 생성 후 인쇄' : 'QR 인쇄'}
        </button>
      `,
    });

    document.getElementById('btn-do-bulk-qr').onclick = async () => {
      const btn = document.getElementById('btn-do-bulk-qr');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 처리 중...';

      try {
        // QR 없는 장비들 순차 생성
        for (const t of noQr) {
          await Api.patch(`/equipment/${t.id}`, { qr_code: `AJ-${t.equip_no}` });
        }

        // 최신 장비 정보 전체 조회 (qr_code 포함)
        const updatedList = await Promise.all(
          targets.map(t => Api.get(`/equipment/${t.id}`))
        );

        Modal.close();
        loadList();
        _printBulkQr(updatedList);
      } catch {
        btn.disabled = false; btn.textContent = 'QR 생성 후 인쇄';
        Toast.error('일부 장비 처리에 실패했습니다.');
      }
    };
  }

  // 선택 장비 QR PDF 일괄 인쇄
  function _printBulkQr(list) {
    const itemsHtml = list.map(e => `
      <div class="qr-card">
        <div class="qr-title">${e.equip_no}</div>
        <div id="qr-${e.id}" class="qr-img"></div>
        <div class="qr-sub">${e.spec || ''} · ${e.site_name || e.site_id || ''}</div>
        <div class="qr-code">${e.qr_code}</div>
      </div>
    `).join('');

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { Toast.error('팝업 차단을 해제해주세요.'); return; }

    win.document.write(`
      <!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <title>QR 일괄 인쇄 — ${list.length}대</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: sans-serif; padding: 20px; background: #fff; }
          h1 { color: #1B365D; font-size: 18px; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          @media print {
            h1 { display: none; }
            .grid { gap: 10px; }
          }
          .qr-card {
            border: 2px solid #1B365D; border-radius: 12px;
            padding: 20px 16px; text-align: center;
            page-break-inside: avoid;
          }
          .qr-title { font-size: 16px; font-weight: 700; color: #1B365D; margin-bottom: 12px; }
          .qr-img   { display: flex; justify-content: center; margin-bottom: 10px; }
          .qr-sub   { font-size: 12px; color: #555; margin-bottom: 4px; }
          .qr-code  { font-family: monospace; font-size: 11px; color: #999; }
          .print-btn {
            margin-bottom: 20px; padding: 10px 28px;
            background: #1B365D; color: #fff; border: none;
            border-radius: 8px; font-size: 14px; cursor: pointer;
          }
          @media print { .print-btn { display: none; } }
        </style>
      </head><body>
        <button class="print-btn" onclick="window.print()">인쇄</button>
        <h1>AJ 고소작업대 QR 코드 — ${list.length}대</h1>
        <div class="grid">${itemsHtml}</div>
        <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
        <script>
          window.onload = () => {
            ${list.map(e => `
              new QRCode(document.getElementById('qr-${e.id}'), {
                text: '${e.qr_code}',
                width: 160, height: 160,
                colorDark: '#1B365D', colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
              });
            `).join('')}
            setTimeout(() => window.print(), 600);
          };
        <\/script>
      </body></html>
    `);
    win.document.close();
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

  // ── QR 보기 ──────────────────────────────────────────────
  async function showQr(equipId) {
    try {
      const e = await Api.get(`/equipment/${equipId}`);
      QrScanner.showQrCode(e);
    } catch { Toast.error('장비 정보를 불러올 수 없습니다.'); }
  }

  // ── QR 생성 (단일) ───────────────────────────────────────
  async function genQr(equipId, equipNo) {
    if (!confirm(`${equipNo} 장비에 QR코드를 생성하시겠습니까?`)) return;
    try {
      const qr_code = `AJ-${equipNo}`;
      await Api.patch(`/equipment/${equipId}`, { qr_code });
      loadList();
      const updated = await Api.get(`/equipment/${equipId}`);
      QrScanner.showQrCode(updated);
    } catch { Toast.error('QR코드 생성에 실패했습니다.'); }
  }

  return { render, loadList, filterByStatus, _updateBulkBtn, openBulkQr, openAddForm, openEditForm, showQr, genQr };
})();
