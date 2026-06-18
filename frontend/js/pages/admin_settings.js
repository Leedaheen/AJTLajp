/**
 * 관리자설정 페이지
 */
const AdminSettingsPage = (() => {

  // ── 공통 스타일 ───────────────────────────────────────────
  const _ACCORD_SUMMARY = `
    display:flex;justify-content:space-between;align-items:center;
    padding:14px 16px;cursor:pointer;list-style:none;
    border-bottom:1px solid var(--gray-100);
  `;
  const _ACCORD_TITLE = `font-size:15px;font-weight:700;color:var(--navy);margin:0`;

  function _esc(str) { return (str || '').replace(/'/g, "\\'"); }

  // ── 렌더 ─────────────────────────────────────────────────
  async function render() {
    document.getElementById('page-admin-settings').innerHTML = `
      <h2 class="section-title" style="margin-bottom:20px">관리자설정</h2>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;align-items:start">

        <!-- 현장 관리 -->
        <details class="card" style="padding:0">
          <summary style="${_ACCORD_SUMMARY}">
            <h3 style="${_ACCORD_TITLE}">현장 관리</h3>
            <button class="btn btn-primary btn-sm"
              onclick="event.stopPropagation();AdminSettingsPage.openAddSite()">+ 현장 추가</button>
          </summary>
          <div id="sites-list" style="padding:8px 0">
            <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
          </div>
        </details>

        <!-- 프로젝트 관리 -->
        <details class="card" style="padding:0">
          <summary style="${_ACCORD_SUMMARY}">
            <h3 style="${_ACCORD_TITLE}">프로젝트 관리</h3>
            <button class="btn btn-primary btn-sm"
              onclick="event.stopPropagation();AdminSettingsPage.openAddProject()">+ 프로젝트 추가</button>
          </summary>
          <div id="projects-list" style="padding:8px 0">
            <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
          </div>
        </details>

        <!-- 업체 관리 -->
        <details class="card" style="padding:0">
          <summary style="${_ACCORD_SUMMARY}">
            <h3 style="${_ACCORD_TITLE}">업체 관리</h3>
            <button class="btn btn-primary btn-sm"
              onclick="event.stopPropagation();AdminSettingsPage.openAddCompany()">+ 업체 추가</button>
          </summary>
          <div id="companies-list" style="padding:8px 0">
            <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
          </div>
        </details>

        <!-- 사용층수 관리 -->
        <details class="card" style="padding:0">
          <summary style="${_ACCORD_SUMMARY}">
            <h3 style="${_ACCORD_TITLE}">사용층수 관리</h3>
            <button class="btn btn-primary btn-sm"
              onclick="event.stopPropagation();AdminSettingsPage.openAddFloor()">+ 층수 추가</button>
          </summary>
          <div id="floors-list" style="padding:8px">
            <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
          </div>
        </details>

      </div>

      <!-- 장비 모델 관리 (전체 너비) -->
      <details class="card" style="margin-top:16px;padding:0">
        <summary style="${_ACCORD_SUMMARY}">
          <h3 style="${_ACCORD_TITLE}">장비 모델 관리</h3>
          <button class="btn btn-primary btn-sm"
            onclick="event.stopPropagation();AdminSettingsPage.openAddEquipModel()">+ 모델 추가</button>
        </summary>
        <div id="equip-models-crud" style="padding:8px 0">
          <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
        </div>
      </details>

      <!-- 전체 장비 현황 엑셀 다운로드 -->
      <div class="card" style="margin-top:16px;display:flex;align-items:center;
                               justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <h3 style="${_ACCORD_TITLE}">전체 장비 현황</h3>
          <div style="font-size:12px;color:var(--gray-400);margin-top:4px">
            현재 등록된 전체 장비 데이터를 엑셀(CSV)로 내려받습니다.
          </div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="AdminSettingsPage.downloadAllEquipment()">
          ↓ 전체장비현황 엑셀 내려받기
        </button>
      </div>
    `;

    await Promise.all([
      _loadSites(), _loadProjects(), _loadCompanies(),
      _loadFloors(), _loadEquipModelsCrud(),
    ]);
  }

  // ─────────────────────────────────────────────────────────
  // 현장 관리
  // ─────────────────────────────────────────────────────────
  async function _loadSites() {
    const el = document.getElementById('sites-list');
    if (!el) return;
    try {
      const list = await Api.get('/sites/all');
      if (!list.length) { el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">현장 없음</div>'; return; }
      el.innerHTML = list.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 12px;border-bottom:1px solid var(--gray-100)">
          <div>
            <span style="font-weight:600;font-size:14px">${s.name}</span>
            <span style="margin-left:8px;font-size:12px;color:var(--gray-400)">${s.code}</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="badge" style="${s.active?'background:#d1fae5;color:#065f46':'background:#fee2e2;color:#991b1b'}">
              ${s.active?'활성':'비활성'}
            </span>
            <button class="btn btn-outline btn-sm"
              onclick="AdminSettingsPage.openEditSite(${s.id},'${_esc(s.code)}','${_esc(s.name)}',${s.active})">수정</button>
            <button onclick="AdminSettingsPage.deleteSite(${s.id},'${_esc(s.name)}')"
              style="background:none;border:none;cursor:pointer;color:var(--gray-400);font-size:18px;line-height:1;padding:2px 4px;border-radius:4px"
              onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--gray-400)'">×</button>
          </div>
        </div>
      `).join('');
    } catch { el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">불러오기 실패</div>'; }
  }

  function openAddSite() {
    Modal.open({
      title: '현장 추가',
      body: `
        <div class="form-group">
          <label class="form-label">현장 코드 <span style="color:var(--red)">*</span></label>
          <input id="site-code" class="form-input" placeholder="예: P6">
        </div>
        <div class="form-group">
          <label class="form-label">현장명 <span style="color:var(--red)">*</span></label>
          <input id="site-name" class="form-input" placeholder="예: P6 복합동">
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
               <button class="btn btn-primary btn-sm" id="btn-add-site">추가</button>`,
    });
    document.getElementById('btn-add-site').onclick = async () => {
      const code = document.getElementById('site-code').value.trim().toUpperCase();
      const name = document.getElementById('site-name').value.trim();
      if (!code) { Toast.error('현장 코드를 입력해주세요.'); return; }
      if (!name) { Toast.error('현장명을 입력해주세요.'); return; }
      const btn = document.getElementById('btn-add-site');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.post('/sites', { code, name, active: true });
        Modal.close(); Toast.success('현장이 추가되었습니다.'); _loadSites();
      } catch { btn.disabled = false; btn.textContent = '추가'; }
    };
  }

  function openEditSite(id, code, name, active) {
    Modal.open({
      title: `현장 수정 — ${name}`,
      body: `
        <div class="form-group"><label class="form-label">현장 코드</label>
          <input id="site-code-edit" class="form-input" value="${code}"></div>
        <div class="form-group"><label class="form-label">현장명</label>
          <input id="site-name-edit" class="form-input" value="${name}"></div>
        <div class="form-group"><label class="form-label">상태</label>
          <select id="site-active-edit" class="form-input form-select">
            <option value="true" ${active?'selected':''}>활성</option>
            <option value="false" ${!active?'selected':''}>비활성</option>
          </select></div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
               <button class="btn btn-primary btn-sm" id="btn-edit-site">저장</button>`,
    });
    document.getElementById('btn-edit-site').onclick = async () => {
      const btn = document.getElementById('btn-edit-site');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/sites/${id}`, {
          code:   document.getElementById('site-code-edit').value.trim().toUpperCase(),
          name:   document.getElementById('site-name-edit').value.trim(),
          active: document.getElementById('site-active-edit').value === 'true',
        });
        Modal.close(); Toast.success('현장 정보가 수정되었습니다.'); _loadSites();
      } catch { btn.disabled = false; btn.textContent = '저장'; }
    };
  }

  async function deleteSite(id, name) {
    if (!confirm(`현장 "${name}"을 삭제하시겠습니까?`)) return;
    try { await Api.del(`/sites/${id}`); Toast.success('삭제되었습니다.'); _loadSites(); }
    catch (e) { Toast.error('삭제 실패: ' + (e.message || '연결된 데이터를 먼저 정리해주세요.')); }
  }

  // ─────────────────────────────────────────────────────────
  // 프로젝트 관리 (코드만 사용, 이름 불필요)
  // ─────────────────────────────────────────────────────────
  async function _loadProjects() {
    const el = document.getElementById('projects-list');
    if (!el) return;
    try {
      const list = await Api.get('/projects/all');
      if (!list.length) { el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">프로젝트 없음</div>'; return; }
      el.innerHTML = list.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 12px;border-bottom:1px solid var(--gray-100)">
          <span style="font-weight:600;font-size:14px">${p.code}</span>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="badge" style="${p.active?'background:#d1fae5;color:#065f46':'background:#fee2e2;color:#991b1b'}">
              ${p.active?'활성':'비활성'}
            </span>
            <button class="btn btn-outline btn-sm"
              onclick="AdminSettingsPage.openEditProject(${p.id},'${_esc(p.code)}',${p.active})">수정</button>
            <button onclick="AdminSettingsPage.deleteProject(${p.id},'${_esc(p.code)}')"
              style="background:none;border:none;cursor:pointer;color:var(--gray-400);font-size:18px;line-height:1;padding:2px 4px;border-radius:4px"
              onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--gray-400)'">×</button>
          </div>
        </div>
      `).join('');
    } catch { el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">불러오기 실패</div>'; }
  }

  function openAddProject() {
    Modal.open({
      title: '프로젝트 추가',
      body: `
        <div class="form-group">
          <label class="form-label">프로젝트 코드 <span style="color:var(--red)">*</span></label>
          <input id="proj-code" class="form-input" placeholder="예: Ph5">
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
               <button class="btn btn-primary btn-sm" id="btn-add-proj">추가</button>`,
    });
    document.getElementById('btn-add-proj').onclick = async () => {
      const code = document.getElementById('proj-code').value.trim();
      if (!code) { Toast.error('프로젝트 코드를 입력해주세요.'); return; }
      const btn = document.getElementById('btn-add-proj');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.post('/projects', { code, name: code, active: true });
        Modal.close(); Toast.success('프로젝트가 추가되었습니다.'); _loadProjects();
      } catch { btn.disabled = false; btn.textContent = '추가'; }
    };
  }

  function openEditProject(id, code, active) {
    Modal.open({
      title: `프로젝트 수정 — ${code}`,
      body: `
        <div class="form-group"><label class="form-label">프로젝트 코드</label>
          <input id="proj-code-edit" class="form-input" value="${code}"></div>
        <div class="form-group"><label class="form-label">상태</label>
          <select id="proj-active-edit" class="form-input form-select">
            <option value="true" ${active?'selected':''}>활성</option>
            <option value="false" ${!active?'selected':''}>비활성</option>
          </select></div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
               <button class="btn btn-primary btn-sm" id="btn-edit-proj">저장</button>`,
    });
    document.getElementById('btn-edit-proj').onclick = async () => {
      const btn = document.getElementById('btn-edit-proj');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      const newCode = document.getElementById('proj-code-edit').value.trim();
      try {
        await Api.patch(`/projects/${id}`, {
          code:   newCode,
          name:   newCode,
          active: document.getElementById('proj-active-edit').value === 'true',
        });
        Modal.close(); Toast.success('프로젝트가 수정되었습니다.'); _loadProjects();
      } catch { btn.disabled = false; btn.textContent = '저장'; }
    };
  }

  async function deleteProject(id, code) {
    if (!confirm(`프로젝트 "${code}"을 삭제하시겠습니까?`)) return;
    try { await Api.del(`/projects/${id}`); Toast.success('삭제되었습니다.'); _loadProjects(); }
    catch (e) { Toast.error('삭제 실패: ' + (e.message || '오류가 발생했습니다.')); }
  }

  // ─────────────────────────────────────────────────────────
  // 업체 관리
  // ─────────────────────────────────────────────────────────
  async function _loadCompanies() {
    const el = document.getElementById('companies-list');
    if (!el) return;
    try {
      const list = await Api.get('/companies/all');
      if (!list.length) { el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">업체 없음</div>'; return; }
      el.innerHTML = list.map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 12px;border-bottom:1px solid var(--gray-100)">
          <div>
            <span style="font-weight:600;font-size:14px">${c.name}</span>
            ${c.site_id ? `<span style="margin-left:8px;font-size:12px;color:var(--gray-400)">${c.site_id}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="badge" style="${c.active?'background:#d1fae5;color:#065f46':'background:#fee2e2;color:#991b1b'}">
              ${c.active?'활성':'비활성'}
            </span>
            <button class="btn btn-outline btn-sm"
              onclick="AdminSettingsPage.openEditCompany(${c.id},'${_esc(c.name)}','${_esc(c.site_id||'')}',${c.active})">수정</button>
            <button onclick="AdminSettingsPage.deleteCompany(${c.id},'${_esc(c.name)}')"
              style="background:none;border:none;cursor:pointer;color:var(--gray-400);font-size:18px;line-height:1;padding:2px 4px;border-radius:4px"
              onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--gray-400)'">×</button>
          </div>
        </div>
      `).join('');
    } catch { el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">불러오기 실패</div>'; }
  }

  function openAddCompany() {
    Modal.open({
      title: '업체 추가',
      body: `
        <div class="form-group">
          <label class="form-label">업체명 <span style="color:var(--red)">*</span></label>
          <input id="co-name" class="form-input" placeholder="예: ㈜신보">
        </div>
        <div class="form-group">
          <label class="form-label">현장</label>
          <select id="co-site" class="form-input form-select"><option value="">전체 공통</option></select>
          <div style="font-size:11px;color:var(--gray-400);margin-top:4px">특정 현장에만 속한 업체라면 선택하세요.</div>
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
               <button class="btn btn-primary btn-sm" id="btn-add-co">추가</button>`,
    });
    Api.get('/sites').then(sites => {
      const sel = document.getElementById('co-site');
      if (!sel) return;
      sites.forEach(s => { const o = document.createElement('option'); o.value = s.code; o.textContent = s.name; sel.appendChild(o); });
    }).catch(() => {});
    document.getElementById('btn-add-co').onclick = async () => {
      const name = document.getElementById('co-name').value.trim();
      const site_id = document.getElementById('co-site').value || null;
      if (!name) { Toast.error('업체명을 입력해주세요.'); return; }
      const btn = document.getElementById('btn-add-co');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.post('/companies', { name, site_id, active: true });
        Modal.close(); Toast.success('업체가 추가되었습니다.'); _loadCompanies();
      } catch { btn.disabled = false; btn.textContent = '추가'; }
    };
  }

  function openEditCompany(id, name, siteId, active) {
    Modal.open({
      title: `업체 수정 — ${name}`,
      body: `
        <div class="form-group"><label class="form-label">업체명</label>
          <input id="co-name-edit" class="form-input" value="${name}"></div>
        <div class="form-group"><label class="form-label">현장</label>
          <select id="co-site-edit" class="form-input form-select"><option value="">전체 공통</option></select></div>
        <div class="form-group"><label class="form-label">상태</label>
          <select id="co-active-edit" class="form-input form-select">
            <option value="true" ${active?'selected':''}>활성</option>
            <option value="false" ${!active?'selected':''}>비활성</option>
          </select></div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
               <button class="btn btn-primary btn-sm" id="btn-edit-co">저장</button>`,
    });
    Api.get('/sites').then(sites => {
      const sel = document.getElementById('co-site-edit');
      if (!sel) return;
      sites.forEach(s => {
        const o = document.createElement('option'); o.value = s.code; o.textContent = s.name;
        if (s.code === siteId) o.selected = true;
        sel.appendChild(o);
      });
    }).catch(() => {});
    document.getElementById('btn-edit-co').onclick = async () => {
      const btn = document.getElementById('btn-edit-co');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/companies/${id}`, {
          name:    document.getElementById('co-name-edit').value.trim(),
          site_id: document.getElementById('co-site-edit').value || null,
          active:  document.getElementById('co-active-edit').value === 'true',
        });
        Modal.close(); Toast.success('업체 정보가 수정되었습니다.'); _loadCompanies();
      } catch { btn.disabled = false; btn.textContent = '저장'; }
    };
  }

  async function deleteCompany(id, name) {
    if (!confirm(`업체 "${name}"을 삭제하시겠습니까?`)) return;
    try { await Api.del(`/companies/${id}`); Toast.success('삭제되었습니다.'); _loadCompanies(); }
    catch (e) { Toast.error('삭제 실패: ' + (e.message || '오류가 발생했습니다.')); }
  }

  // ─────────────────────────────────────────────────────────
  // 사용층수 관리
  // ─────────────────────────────────────────────────────────
  async function _loadFloors() {
    const el = document.getElementById('floors-list');
    if (!el) return;
    try {
      const list = await Api.get('/floors/all');
      if (!list.length) {
        el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">등록된 층수 없음</div>';
        return;
      }
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:4px">
          ${list.map(f => `
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:6px 8px;border-radius:6px;font-size:13px;
                        background:${f.active?'var(--gray-50)':'#fff8f8'};
                        border:1px solid ${f.active?'var(--gray-200)':'#fca5a5'}">
              <span style="font-weight:600;color:${f.active?'var(--navy)':'var(--gray-400)'};font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</span>
              <div style="display:flex;gap:2px;flex-shrink:0;margin-left:4px">
                <button title="수정" onclick="AdminSettingsPage.openEditFloor(${f.id},'${_esc(f.name)}',${f.active})"
                  style="background:none;border:none;cursor:pointer;color:var(--gray-400);font-size:13px;padding:1px 3px"
                  onmouseover="this.style.color='var(--navy)'" onmouseout="this.style.color='var(--gray-400)'">✎</button>
                <button title="${f.active?'비활성화':'활성화'}" onclick="AdminSettingsPage.toggleFloor(${f.id},${f.active})"
                  style="background:none;border:none;cursor:pointer;font-size:11px;padding:1px 3px;
                         color:${f.active?'#16a34a':'#9ca3af'}">${f.active?'●':'○'}</button>
                <button title="삭제" onclick="AdminSettingsPage.deleteFloor(${f.id},'${_esc(f.name)}')"
                  style="background:none;border:none;cursor:pointer;color:var(--gray-400);font-size:15px;line-height:1;padding:1px 3px"
                  onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--gray-400)'">×</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch { el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">불러오기 실패</div>'; }
  }

  function openAddFloor() {
    Modal.open({
      title: '층수 추가',
      body: `
        <div class="form-group">
          <label class="form-label">층수명 <span style="color:var(--red)">*</span></label>
          <input id="floor-name" class="form-input" placeholder="예: 5F, 모듈동">
        </div>
        <div class="form-group">
          <label class="form-label">정렬 순서</label>
          <input id="floor-order" type="number" class="form-input" value="0" min="0">
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
               <button class="btn btn-primary btn-sm" id="btn-add-floor">추가</button>`,
    });
    document.getElementById('btn-add-floor').onclick = async () => {
      const name = document.getElementById('floor-name').value.trim();
      if (!name) { Toast.error('층수명을 입력해주세요.'); return; }
      const sort_order = parseInt(document.getElementById('floor-order').value) || 0;
      const btn = document.getElementById('btn-add-floor');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.post('/floors', { name, sort_order, active: true });
        Modal.close(); Toast.success('층수가 추가되었습니다.'); _loadFloors();
      } catch { btn.disabled = false; btn.textContent = '추가'; }
    };
  }

  function openEditFloor(id, name, active) {
    Modal.open({
      title: `층수 수정 — ${name}`,
      body: `
        <div class="form-group"><label class="form-label">층수명</label>
          <input id="floor-name-edit" class="form-input" value="${name}"></div>
        <div class="form-group"><label class="form-label">상태</label>
          <select id="floor-active-edit" class="form-input form-select">
            <option value="true" ${active?'selected':''}>활성</option>
            <option value="false" ${!active?'selected':''}>비활성</option>
          </select></div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
               <button class="btn btn-primary btn-sm" id="btn-edit-floor">저장</button>`,
    });
    document.getElementById('btn-edit-floor').onclick = async () => {
      const btn = document.getElementById('btn-edit-floor');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/floors/${id}`, {
          name:   document.getElementById('floor-name-edit').value.trim(),
          active: document.getElementById('floor-active-edit').value === 'true',
        });
        Modal.close(); Toast.success('층수가 수정되었습니다.'); _loadFloors();
      } catch { btn.disabled = false; btn.textContent = '저장'; }
    };
  }

  async function toggleFloor(id, currentActive) {
    try {
      await Api.patch(`/floors/${id}`, { active: !currentActive });
      _loadFloors();
    } catch { Toast.error('처리 실패'); }
  }

  async function deleteFloor(id, name) {
    if (!confirm(`"${name}"을 삭제하시겠습니까?`)) return;
    try { await Api.del(`/floors/${id}`); Toast.success('삭제되었습니다.'); _loadFloors(); }
    catch (e) { Toast.error('삭제 실패: ' + (e.message || '오류가 발생했습니다.')); }
  }

  // ─────────────────────────────────────────────────────────
  // 장비 모델 관리 CRUD
  // ─────────────────────────────────────────────────────────
  async function _loadEquipModelsCrud() {
    const el = document.getElementById('equip-models-crud');
    if (!el) return;
    try {
      const list = await Api.get('/equipment-models/all');
      if (!list.length) {
        el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">등록된 모델 없음</div>';
        return;
      }
      el.innerHTML = `
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--gray-100)">
              <th style="padding:8px 12px;text-align:left;font-weight:600">제원</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">모델명</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">작업높이</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">적재중량</th>
              <th style="padding:8px 12px;text-align:center;font-weight:600">상태</th>
              <th style="padding:8px 12px;text-align:right;font-weight:600"></th>
            </tr>
          </thead>
          <tbody>
            ${list.map(m => `
              <tr style="border-bottom:1px solid var(--gray-100);${!m.active?'opacity:0.5':''}">
                <td style="padding:8px 12px;color:var(--gray-600)">${m.spec||'-'}</td>
                <td style="padding:8px 12px;font-weight:600;color:var(--navy)">${m.model}</td>
                <td style="padding:8px 12px">
                  <span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:10px;font-size:12px">
                    ${m.work_height||'-'}
                  </span>
                </td>
                <td style="padding:8px 12px;color:var(--gray-600)">${m.load_capacity||'-'}</td>
                <td style="padding:8px 12px;text-align:center">
                  <button onclick="AdminSettingsPage.toggleEquipModel(${m.id},${m.active})"
                    class="badge" style="${m.active?'background:#d1fae5;color:#065f46':'background:#fee2e2;color:#991b1b'};cursor:pointer;border:none">
                    ${m.active?'활성':'비활성'}
                  </button>
                </td>
                <td style="padding:8px 12px;text-align:right;white-space:nowrap">
                  <button class="btn btn-outline btn-sm" style="margin-right:4px"
                    onclick="AdminSettingsPage.openEditEquipModel(${m.id},'${_esc(m.spec||'')}','${_esc(m.model)}','${_esc(m.work_height||'')}','${_esc(m.load_capacity||'')}',${m.active})">수정</button>
                  <button class="btn btn-danger btn-sm"
                    onclick="AdminSettingsPage.deleteEquipModel(${m.id},'${_esc(m.model)}')">삭제</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
        </div>
      `;
    } catch { el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">불러오기 실패</div>'; }
  }

  const SPEC_OPTIONS = ['6M','8M','10M','12M','14M','16M','16M굴절','18M','20M굴절'];

  function openAddEquipModel() {
    Modal.open({
      title: '장비 모델 추가',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">제원</label>
            <select id="em-spec" class="form-input form-select">
              <option value="">선택</option>
              ${SPEC_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">모델명 <span style="color:var(--red)">*</span></label>
            <input id="em-model" class="form-input" placeholder="예: GR20NS">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">작업높이</label>
            <input id="em-height" class="form-input" placeholder="예: 20.57M">
          </div>
          <div class="form-group">
            <label class="form-label">적재중량</label>
            <input id="em-load" class="form-input" placeholder="예: 227KG">
          </div>
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
               <button class="btn btn-primary btn-sm" id="btn-add-em">추가</button>`,
    });
    document.getElementById('btn-add-em').onclick = async () => {
      const model = document.getElementById('em-model').value.trim();
      if (!model) { Toast.error('모델명을 입력해주세요.'); return; }
      const btn = document.getElementById('btn-add-em');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.post('/equipment-models', {
          spec:          document.getElementById('em-spec').value || null,
          model,
          work_height:   document.getElementById('em-height').value.trim() || null,
          load_capacity: document.getElementById('em-load').value.trim() || null,
          active:        true,
        });
        Modal.close(); Toast.success('모델이 추가되었습니다.'); _loadEquipModelsCrud();
      } catch (e) {
        btn.disabled = false; btn.textContent = '추가';
        Toast.error(e.message?.includes('unique') ? '이미 등록된 모델명입니다.' : '추가 실패');
      }
    };
  }

  function openEditEquipModel(id, spec, model, workHeight, loadCapacity, active) {
    Modal.open({
      title: `모델 수정 — ${model}`,
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">제원</label>
            <select id="em-spec-edit" class="form-input form-select">
              <option value="">선택</option>
              ${SPEC_OPTIONS.map(s => `<option value="${s}" ${s===spec?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">모델명</label>
            <input id="em-model-edit" class="form-input" value="${model}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">작업높이</label>
            <input id="em-height-edit" class="form-input" value="${workHeight}">
          </div>
          <div class="form-group">
            <label class="form-label">적재중량</label>
            <input id="em-load-edit" class="form-input" value="${loadCapacity}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">상태</label>
          <select id="em-active-edit" class="form-input form-select">
            <option value="true" ${active?'selected':''}>활성</option>
            <option value="false" ${!active?'selected':''}>비활성</option>
          </select>
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
               <button class="btn btn-primary btn-sm" id="btn-edit-em">저장</button>`,
    });
    document.getElementById('btn-edit-em').onclick = async () => {
      const btn = document.getElementById('btn-edit-em');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/equipment-models/${id}`, {
          spec:          document.getElementById('em-spec-edit').value || null,
          model:         document.getElementById('em-model-edit').value.trim(),
          work_height:   document.getElementById('em-height-edit').value.trim() || null,
          load_capacity: document.getElementById('em-load-edit').value.trim() || null,
          active:        document.getElementById('em-active-edit').value === 'true',
        });
        Modal.close(); Toast.success('모델이 수정되었습니다.'); _loadEquipModelsCrud();
      } catch { btn.disabled = false; btn.textContent = '저장'; }
    };
  }

  async function toggleEquipModel(id, currentActive) {
    try { await Api.patch(`/equipment-models/${id}`, { active: !currentActive }); _loadEquipModelsCrud(); }
    catch { Toast.error('처리 실패'); }
  }

  async function deleteEquipModel(id, model) {
    if (!confirm(`"${model}" 모델을 삭제하시겠습니까?`)) return;
    try { await Api.del(`/equipment-models/${id}`); Toast.success('삭제되었습니다.'); _loadEquipModelsCrud(); }
    catch { Toast.error('삭제 실패'); }
  }

  // ─────────────────────────────────────────────────────────
  // 전체 장비 현황 엑셀 다운로드
  // ─────────────────────────────────────────────────────────
  async function downloadAllEquipment() {
    try {
      const { data: rows } = await _sb.from('equipment').select('*').order('equip_no');
      if (!rows?.length) { Toast.error('다운로드할 장비 데이터가 없습니다.'); return; }
      const headers = ['장비번호','제원','모델명','시리얼번호','현장','업체','상태','반입일','반출일'];
      const statusLabel = { in_use:'사용중', returned:'반출완료', transit:'이동중', stock:'재고' };
      const csv = [
        headers.join(','),
        ...rows.map(r => [
          r.equip_no||'', r.spec||'', r.model||'', r.serial_no||'',
          r.site_name||r.site_id||'', r.company||'',
          statusLabel[r.status]||r.status||'', r.in_date||'', r.out_date||'',
        ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
      ].join('\n');
      const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `전체장비현황_${new Date().toISOString().slice(0,10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      Toast.success(`${rows.length}건 다운로드 완료`);
    } catch { Toast.error('다운로드 실패'); }
  }

  return {
    render,
    openAddSite, openEditSite, deleteSite,
    openAddProject, openEditProject, deleteProject,
    openAddCompany, openEditCompany, deleteCompany,
    openAddFloor, openEditFloor, toggleFloor, deleteFloor,
    openAddEquipModel, openEditEquipModel, toggleEquipModel, deleteEquipModel,
    downloadAllEquipment,
  };
})();
