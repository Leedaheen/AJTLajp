/**
 * 장비 관리 페이지
 */
const EquipmentPage = (() => {
  const SPEC_OPTIONS = ['6M','8M','10M','12M','14M','16M','16M굴절','18M','20M굴절'];
  const STATUS_MAP = {
    in_use:   { label:'사용중',   style:'background:#dbeafe;color:#1e40af' },
    transit:  { label:'반입예정', style:'background:#fef3c7;color:#92400e' },
    returned: { label:'반출완료', style:'background:#f3f4f6;color:#374151' },
  };

  // 현재 로드된 전체 목록 캐시 (체크박스 일괄처리용)
  let _listCache = [];
  // 필터 무관 전체 카운트 (뱃지에 항상 전체 수량 표시)
  let _totalCounts = null;
  // 반출 예정 장비번호 세트
  let _outTransitEquips = new Set();

  async function render() {
    const user = Auth.getUser();
    const isAj = ['aj', 'admin'].includes(user.role);

    document.getElementById('page-equipment').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 class="section-title" style="margin:0">장비 관리</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${isAj ? `
            <button id="btn-bulk-qr" class="btn btn-outline btn-sm hidden" onclick="EquipmentPage.openBulkQr()">
              선택 QR 보기/인쇄
            </button>
            <button class="btn btn-outline btn-sm" onclick="EquipmentPage.downloadExcel()" title="필터링된 목록 엑셀 다운로드">
              ↓ 엑셀
            </button>
            <button class="btn btn-outline btn-sm" onclick="EquipmentPage.openBulkUpload()">대량 업로드</button>
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
              <th>장비번호 / 모델 / 시리얼</th>
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

    await Promise.all([_loadTotals(), loadList()]);
    Realtime.on('equipment', 'equipment', () => { _loadTotals(); loadList(); });
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
      const [list] = await Promise.all([
        Api.get(`/equipment?${params}`),
        _loadOutTransitEquips(),
      ]);
      _listCache = list;
      _renderSummary();
      _renderTable(list);
    } catch {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">불러오기 실패</td></tr>`;
    }
  }

  async function _loadOutTransitEquips() {
    try {
      const { data } = await _sb.from('transit')
        .select('aj_equip')
        .eq('type', 'out')
        .in('status', ['requested', 'scheduled', 'confirmed']);
      _outTransitEquips = new Set();
      (data || []).forEach(row => {
        if (!row.aj_equip) return;
        row.aj_equip.split(',').forEach(no => {
          const n = no.trim().toUpperCase();
          if (n) _outTransitEquips.add(n);
        });
      });
    } catch {}
  }

  // status 값으로 eq-status 드롭다운 세팅 후 목록 재로드 (뱃지 클릭)
  function filterByStatus(status) {
    const sel = document.getElementById('eq-status');
    if (sel) sel.value = status;
    loadList();
  }

  async function _loadTotals() {
    try {
      const all = await Api.get('/equipment?limit=5000');
      _totalCounts = {
        in_use:   all.filter(e => e.status === 'in_use').length,
        returned: all.filter(e => e.status === 'returned').length,
        total:    all.length,
      };
      _renderSummary();
    } catch {}
  }

  function _renderSummary() {
    const counts = _totalCounts || { in_use: 0, returned: 0, total: 0 };
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
        전체 ${counts.total}대
      </span>
    `;
  }

  function _renderTable(list) {
    const user  = Auth.getUser();
    const isAj  = ['aj', 'admin'].includes(user.role);
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
          <td>
            <strong>${e.equip_no}</strong>
            ${(e.model || e.serial_no) ? `
              <div style="font-size:11px;color:var(--gray-400);margin-top:2px;line-height:1.6">
                ${e.model ? `<span>${e.model}</span>` : ''}
                ${e.serial_no ? `<span style="font-family:monospace;margin-left:${e.model?'4px':'0'}">${e.serial_no}</span>` : ''}
              </div>` : ''}
          </td>
          <td>${e.spec || '-'}</td>
          <td>${e.site_name || e.site_id || '-'}</td>
          <td>${e.project || '-'}</td>
          <td>${e.company || '-'}</td>
          <td>
            <span class="badge" style="${st.style}">${st.label}</span>
            ${_outTransitEquips.has((e.equip_no || '').toUpperCase()) ? `<span class="badge" style="background:#fce7f3;color:#9d174d;margin-left:4px">반출예정</span>` : ''}
          </td>
          <td class="text-sm">${e.in_date || '-'}</td>
          <td class="text-sm">${e.out_date || '-'}</td>
          <td style="white-space:nowrap">
            ${(e.qr_code || isAj)
              ? `<button class="btn btn-outline btn-sm" onclick="EquipmentPage.${e.qr_code ? 'showQr' : 'genQr'}(${e.id},'${(e.equip_no||'').replace(/'/g,"\\'")}')">QR 보기</button>`
              : ''
            }
            ${isAj ? `
              <button class="btn btn-outline btn-sm" style="margin-left:4px"
                onclick="EquipmentPage.openEditForm(${e.id})">
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
    const origin   = window.location.origin;
    const pathname = window.location.pathname;

    const itemsHtml = list.map(e => {
      const qrUrl = `${origin}${pathname}?qr=${encodeURIComponent(e.qr_code)}`;
      return `
        <div class="qr-card">
          <div class="qr-title">${e.equip_no}</div>
          <div id="qr-${e.id}" class="qr-img"></div>
          <div class="qr-sub">${e.spec || ''} · ${e.site_name || e.site_id || ''}</div>
          <div class="qr-hint">스캔 시 앱으로 바로 연결</div>
          <script>window['_qurl_${e.id}']='${qrUrl.replace(/'/g,"\\'")}'; <\/script>
        </div>
      `;
    }).join('');

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
          .qr-sub   { font-size: 12px; color: #555; margin-bottom: 2px; }
          .qr-hint  { font-size: 11px; color: #999; }
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
                text: window['_qurl_${e.id}'],
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
    const [sites, models, companies] = await Promise.all([
      Api.get('/sites').catch(() => [{code:'P4',name:'P4 복합동'},{code:'P5',name:'P5 복합동'}]),
      Api.get('/equipment/models').catch(() => []),
      Api.get('/companies').catch(() => []),
    ]);
    Modal.open({
      title: '장비 추가',
      body: `
        <datalist id="add-model-list">
          ${models.map(m=>`<option value="${m}">`).join('')}
        </datalist>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">장비번호 <span style="color:var(--red)">*</span></label>
            <input id="add-equip-no" class="form-input" placeholder="예: GK111" oninput="this.value=this.value.toUpperCase()" style="text-transform:uppercase">
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
            <label class="form-label">현장 <span style="color:var(--red)">*</span></label>
            <select id="add-site" class="form-input form-select">
              <option value="">-- 현장 선택 --</option>
              ${sites.map(s=>`<option value="${s.code}" data-name="${s.name}">${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">업체명 <span style="color:var(--red)">*</span></label>
            <select id="add-company" class="form-input form-select">
              <option value="">-- 업체 선택 --</option>
              ${companies.map(c=>`<option value="${c.name}">${c.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">모델명 <span style="color:var(--red)">*</span></label>
            <input id="add-model" class="form-input" list="add-model-list" placeholder="예: GR20NS" oninput="this.value=this.value.toUpperCase()" style="text-transform:uppercase">
          </div>
          <div class="form-group">
            <label class="form-label">시리얼번호</label>
            <input id="add-serial" class="form-input" placeholder="예: GJ512-001" style="font-family:monospace">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-add">추가</button>
      `,
    });
    document.getElementById('btn-do-add').onclick = async () => {
      const equip_no  = document.getElementById('add-equip-no').value.trim().toUpperCase();
      if (!equip_no) { Toast.error('장비번호를 입력해주세요.'); return; }
      const siteEl    = document.getElementById('add-site');
      const siteId    = siteEl.value;
      if (!siteId) { Toast.error('현장을 선택해주세요.'); return; }
      const siteName  = siteEl.options[siteEl.selectedIndex]?.getAttribute('data-name') || siteId;
      const company   = document.getElementById('add-company').value;
      if (!company) { Toast.error('업체명을 선택해주세요.'); return; }
      const model     = document.getElementById('add-model').value.trim().toUpperCase();
      if (!model) { Toast.error('모델명을 입력해주세요.'); return; }
      const serial_no = document.getElementById('add-serial').value.trim() || null;

      const btn = document.getElementById('btn-do-add');
      btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
      try {
        const dup = await _checkDuplicate(equip_no, serial_no);
        if (dup.equipNoDup) { Toast.error(`장비번호 ${equip_no}는 이미 등록된 번호입니다.`); btn.disabled=false; btn.textContent='추가'; return; }
        if (dup.serialNoDup) { Toast.error(`시리얼번호 ${serial_no}는 이미 등록된 번호입니다.`); btn.disabled=false; btn.textContent='추가'; return; }

        await Api.post('/equipment', {
          equip_no,
          spec:      document.getElementById('add-spec').value,
          model:     model || null,
          serial_no,
          site_id:   siteId,
          site_name: siteName,
          company,
          status:    'in_use',
        });
        Modal.close();
        Toast.success('장비가 추가되었습니다.');
        loadList();
      } catch { btn.disabled=false; btn.textContent='추가'; }
    };
  }

  // ── 대량 업로드 (AJ) ─────────────────────────────────────
  function openBulkUpload() {
    Modal.open({
      title: '장비 대량 업로드',
      body: `
        <div style="margin-bottom:16px">
          <p style="font-size:13px;color:var(--gray-600);margin-bottom:10px">
            엑셀 양식을 다운받아 입력 후 CSV 파일로 업로드하세요.
          </p>
          <button class="btn btn-outline btn-sm" onclick="EquipmentPage._downloadBulkTemplate()">
            ↓ 양식 다운로드 (CSV)
          </button>
        </div>
        <div>
          <label class="form-label">CSV 파일 업로드 <span style="color:var(--red)">*</span></label>
          <input id="bulk-file" type="file" accept=".csv"
            style="display:block;width:100%;padding:8px;border:1px dashed var(--gray-300);
            border-radius:8px;font-size:13px;cursor:pointer;background:var(--gray-50)">
          <div style="margin-top:6px;font-size:11px;color:var(--gray-400)">
            헤더: 장비번호, 제원, 현장코드, 현장명, 업체명, 모델명, 시리얼번호
          </div>
        </div>
        <div id="bulk-preview" style="margin-top:12px"></div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-bulk-upload" disabled>업로드</button>
      `,
    });

    let _parsed = [];
    document.getElementById('bulk-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          document.getElementById('bulk-preview').innerHTML = '<p style="color:var(--red);font-size:13px">데이터가 없습니다.</p>';
          return;
        }
        // skip header
        _parsed = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          return {
            equip_no:  (cols[0] || '').toUpperCase(),
            spec:      cols[1] || '',
            site_id:   cols[2] || '',
            site_name: cols[3] || '',
            company:   cols[4] || '',
            model:     (cols[5] || '').toUpperCase() || null,
            serial_no: cols[6] || null,
            status:    'in_use',
          };
        }).filter(r => r.equip_no);

        const errors = _parsed.filter(r => !r.spec || !r.site_id || !r.company || !r.model);
        const preview = document.getElementById('bulk-preview');
        preview.innerHTML = `
          <div style="font-size:13px;color:var(--gray-600);margin-bottom:6px">
            유효 데이터: <strong>${_parsed.length}</strong>행
            ${errors.length ? `<span style="color:var(--red);margin-left:8px">(필수값 누락 ${errors.length}행 — 업로드 시 제외됨)</span>` : ''}
          </div>
          <div style="max-height:200px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:6px">
            <table style="width:100%;font-size:12px;border-collapse:collapse">
              <thead style="background:var(--gray-100)">
                <tr>${['장비번호','제원','현장코드','업체명','모델명'].map(h=>`<th style="padding:5px 8px;text-align:left">${h}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${_parsed.slice(0, 20).map(r => `<tr style="border-top:1px solid var(--gray-100)">
                  <td style="padding:4px 8px;font-family:monospace">${r.equip_no}</td>
                  <td style="padding:4px 8px">${r.spec}</td>
                  <td style="padding:4px 8px">${r.site_id}</td>
                  <td style="padding:4px 8px">${r.company}</td>
                  <td style="padding:4px 8px">${r.model || ''}</td>
                </tr>`).join('')}
                ${_parsed.length > 20 ? `<tr><td colspan="5" style="padding:6px 8px;color:var(--gray-400);text-align:center">... 외 ${_parsed.length - 20}행</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        `;
        const btn = document.getElementById('btn-bulk-upload');
        if (btn) btn.disabled = (_parsed.length === 0);
      };
      reader.readAsText(file, 'UTF-8');
    });

    document.getElementById('btn-bulk-upload').onclick = async () => {
      const valid = _parsed.filter(r => r.equip_no && r.spec && r.site_id && r.company && r.model);
      if (!valid.length) { Toast.error('업로드할 유효 데이터가 없습니다.'); return; }
      const btn = document.getElementById('btn-bulk-upload');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        // 기존 활성 장비(반출 제외)의 equip_no / serial_no 일괄 조회
        const { data: existing } = await _sb.from('equipment')
          .select('equip_no,serial_no')
          .neq('status', 'returned');
        const existNos     = new Set((existing || []).map(r => r.equip_no).filter(Boolean));
        const existSerials = new Set((existing || []).map(r => r.serial_no).filter(Boolean));

        const dupNos     = valid.filter(r => existNos.has(r.equip_no)).map(r => r.equip_no);
        const dupSerials = valid.filter(r => r.serial_no && existSerials.has(r.serial_no)).map(r => r.serial_no);

        if (dupNos.length || dupSerials.length) {
          const msgs = [];
          if (dupNos.length)     msgs.push(`중복 장비번호: ${dupNos.join(', ')}`);
          if (dupSerials.length) msgs.push(`중복 시리얼번호: ${dupSerials.join(', ')}`);
          Toast.error(msgs.join('\n'));
          btn.disabled = false; btn.textContent = '업로드';
          return;
        }

        const { error } = await _sb.from('equipment').insert(
          valid.map(r => ({ ...r, record_id: `EQ-${r.equip_no}-${Date.now()}-${Math.random().toString(36).slice(2,5)}` }))
        );
        if (error) throw error;
        Modal.close();
        Toast.success(`${valid.length}대가 등록되었습니다.`);
        loadList();
      } catch (e) {
        btn.disabled = false; btn.textContent = '업로드';
        Toast.error(e.message || '업로드에 실패했습니다.');
      }
    };
  }

  // 반출 제외 활성 장비 중 equip_no / serial_no 중복 여부 확인
  // excludeId: 수정 시 자기 자신 제외
  async function _checkDuplicate(equip_no, serial_no, excludeId = null) {
    const conds = [];
    if (equip_no)  conds.push(`equip_no.eq.${equip_no}`);
    if (serial_no) conds.push(`serial_no.eq.${serial_no}`);
    if (!conds.length) return { equipNoDup: false, serialNoDup: false };

    let q = _sb.from('equipment')
      .select('id,equip_no,serial_no')
      .neq('status', 'returned')
      .or(conds.join(','));
    if (excludeId) q = q.neq('id', excludeId);

    const { data } = await q;
    const rows = data || [];
    return {
      equipNoDup:  equip_no  ? rows.some(r => r.equip_no  === equip_no)  : false,
      serialNoDup: serial_no ? rows.some(r => r.serial_no === serial_no) : false,
    };
  }

  function _downloadBulkTemplate() {
    const header = '장비번호,제원,현장코드,현장명,업체명,모델명,시리얼번호';
    const example = 'GK111,8M,P4,P4 복합동,샘플업체,GR20NS,SN-001';
    const blob = new Blob(['﻿' + header + '\n' + example + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '장비_대량업로드_양식.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ── 장비 수정 (AJ) ──────────────────────────────────────
  async function openEditForm(id) {
    const e = _listCache.find(x => x.id === id);
    if (!e) { Toast.error('장비 정보를 찾을 수 없습니다.'); return; }
    const models = await Api.get('/equipment/models').catch(() => []);
    const { equipNo, spec, siteId, company, status, model, serial_no } = {
      equipNo:   e.equip_no  || '',
      spec:      e.spec      || '',
      siteId:    e.site_id   || '',
      company:   e.company   || '',
      status:    e.status    || 'in_use',
      model:     e.model     || '',
      serial_no: e.serial_no || '',
    };
    Modal.open({
      title: `장비 수정 — ${equipNo}`,
      body: `
        <datalist id="ed-model-list">
          ${models.map(m=>`<option value="${m}">`).join('')}
        </datalist>
        <div class="form-group">
          <label class="form-label">장비번호</label>
          <input id="ed-equip-no" class="form-input" value="${equipNo}" oninput="this.value=this.value.toUpperCase()" style="text-transform:uppercase">
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
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">모델명</label>
            <input id="ed-model" class="form-input" list="ed-model-list" value="${model}" placeholder="예: GR20NS" oninput="this.value=this.value.toUpperCase()" style="text-transform:uppercase">
          </div>
          <div class="form-group">
            <label class="form-label">시리얼번호</label>
            <input id="ed-serial" class="form-input" value="${serial_no}" placeholder="예: GJ512-001" style="font-family:monospace">
          </div>
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
        const newEquipNo  = document.getElementById('ed-equip-no').value.trim().toUpperCase();
        const newSerialNo = document.getElementById('ed-serial').value.trim() || null;
        const newStatus   = document.getElementById('ed-status').value;

        // 반출완료로 바꾸는 경우엔 중복 체크 생략 (반출된 장비는 중복 허용)
        if (newStatus !== 'returned') {
          const dup = await _checkDuplicate(newEquipNo, newSerialNo, id);
          if (dup.equipNoDup) { Toast.error(`장비번호 ${newEquipNo}는 이미 등록된 번호입니다.`); btn.disabled=false; btn.textContent='저장'; return; }
          if (dup.serialNoDup) { Toast.error(`시리얼번호 ${newSerialNo}는 이미 등록된 번호입니다.`); btn.disabled=false; btn.textContent='저장'; return; }
        }

        const updateBody = {
          equip_no:  newEquipNo,
          spec:      document.getElementById('ed-spec').value,
          status:    newStatus,
          company:   document.getElementById('ed-company').value.trim(),
          model:     document.getElementById('ed-model').value.trim().toUpperCase() || null,
          serial_no: newSerialNo,
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

  function downloadExcel() {
    const rows = _listCache;
    if (!rows.length) { Toast.error('다운로드할 데이터가 없습니다.'); return; }
    const headers = ['장비번호','제원','모델명','시리얼번호','현장','업체','상태','반입일','반출일'];
    const statusLabel = { in_use:'사용중', returned:'반출완료', transit:'이동중', stock:'재고' };
    const csv = [
      headers.join(','),
      ...rows.map(e => [
        e.equip_no||'', e.spec||'', e.model||'', e.serial_no||'',
        e.site_name||e.site_id||'', e.company||'',
        statusLabel[e.status]||e.status||'', e.in_date||'', e.out_date||'',
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    ].join('\n');
    const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `장비현황_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    Toast.success(`${rows.length}건 다운로드 완료`);
  }

  return { render, loadList, filterByStatus, _updateBulkBtn, openBulkQr, openAddForm, openBulkUpload, _downloadBulkTemplate, openEditForm, showQr, genQr, downloadExcel };
})();
