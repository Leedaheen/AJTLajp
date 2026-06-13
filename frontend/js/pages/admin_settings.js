/**
 * 관리자설정 페이지 — 현장 및 프로젝트 관리
 */
const AdminSettingsPage = (() => {

  async function render() {
    document.getElementById('page-admin-settings').innerHTML = `
      <h2 class="section-title" style="margin-bottom:20px">관리자설정</h2>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;align-items:start">

        <!-- 현장 관리 -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0">현장 관리</h3>
            <button class="btn btn-primary btn-sm" onclick="AdminSettingsPage.openAddSite()">+ 현장 추가</button>
          </div>
          <div id="sites-list">
            <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
          </div>
        </div>

        <!-- 프로젝트 관리 -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0">프로젝트 관리</h3>
            <button class="btn btn-primary btn-sm" onclick="AdminSettingsPage.openAddProject()">+ 프로젝트 추가</button>
          </div>
          <div id="projects-list">
            <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
          </div>
        </div>

        <!-- 업체 관리 -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0">업체 관리</h3>
            <button class="btn btn-primary btn-sm" onclick="AdminSettingsPage.openAddCompany()">+ 업체 추가</button>
          </div>
          <div id="companies-list">
            <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
          </div>
        </div>

      </div>
    `;

    await Promise.all([_loadSites(), _loadProjects(), _loadCompanies()]);
  }

  // ── 현장 목록 ────────────────────────────────────────────
  async function _loadSites() {
    const el = document.getElementById('sites-list');
    if (!el) return;
    try {
      const list = await Api.get('/sites/all');
      if (!list.length) {
        el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">현장 없음</div>';
        return;
      }
      el.innerHTML = list.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 12px;border-bottom:1px solid var(--gray-100)">
          <div>
            <span style="font-weight:600;font-size:14px">${s.name}</span>
            <span style="margin-left:8px;font-size:12px;color:var(--gray-400)">${s.code}</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="badge" style="${s.active ? 'background:#d1fae5;color:#065f46' : 'background:#fee2e2;color:#991b1b'}">
              ${s.active ? '활성' : '비활성'}
            </span>
            <button class="btn btn-outline btn-sm"
              onclick="AdminSettingsPage.openEditSite(${s.id},'${_esc(s.code)}','${_esc(s.name)}',${s.active})">
              수정
            </button>
          </div>
        </div>
      `).join('');
    } catch {
      el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">불러오기 실패</div>';
    }
  }

  // ── 프로젝트 목록 ─────────────────────────────────────────
  async function _loadProjects() {
    const el = document.getElementById('projects-list');
    if (!el) return;
    try {
      const list = await Api.get('/projects/all');
      if (!list.length) {
        el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">프로젝트 없음</div>';
        return;
      }
      el.innerHTML = list.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 12px;border-bottom:1px solid var(--gray-100)">
          <div>
            <span style="font-weight:600;font-size:14px">${p.code}</span>
            <span style="margin-left:8px;font-size:13px;color:var(--gray-500)">${p.name}</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="badge" style="${p.active ? 'background:#d1fae5;color:#065f46' : 'background:#fee2e2;color:#991b1b'}">
              ${p.active ? '활성' : '비활성'}
            </span>
            <button class="btn btn-outline btn-sm"
              onclick="AdminSettingsPage.openEditProject(${p.id},'${_esc(p.code)}','${_esc(p.name)}',${p.active})">
              수정
            </button>
          </div>
        </div>
      `).join('');
    } catch {
      el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">불러오기 실패</div>';
    }
  }

  function _esc(str) { return (str||'').replace(/'/g,"\\'"); }

  // ── 업체 목록 ─────────────────────────────────────────────
  async function _loadCompanies() {
    const el = document.getElementById('companies-list');
    if (!el) return;
    try {
      const list = await Api.get('/companies/all');
      if (!list.length) {
        el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">업체 없음</div>';
        return;
      }
      el.innerHTML = list.map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 12px;border-bottom:1px solid var(--gray-100)">
          <div>
            <span style="font-weight:600;font-size:14px">${c.name}</span>
            ${c.site_id ? `<span style="margin-left:8px;font-size:12px;color:var(--gray-400)">${c.site_id}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="badge" style="${c.active ? 'background:#d1fae5;color:#065f46' : 'background:#fee2e2;color:#991b1b'}">
              ${c.active ? '활성' : '비활성'}
            </span>
            <button class="btn btn-outline btn-sm"
              onclick="AdminSettingsPage.openEditCompany(${c.id},'${_esc(c.name)}','${_esc(c.site_id||'')}',${c.active})">
              수정
            </button>
          </div>
        </div>
      `).join('');
    } catch {
      el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">불러오기 실패</div>';
    }
  }

  // ── 업체 추가 ─────────────────────────────────────────────
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
          <select id="co-site" class="form-input form-select">
            <option value="">전체 공통</option>
          </select>
          <div style="font-size:11px;color:var(--gray-400);margin-top:4px">
            특정 현장에만 속한 업체라면 선택하세요.
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-add-co">추가</button>
      `,
    });
    Api.get('/sites').then(sites => {
      const sel = document.getElementById('co-site');
      if (!sel) return;
      sites.forEach(s => {
        const o = document.createElement('option'); o.value = s.code; o.textContent = s.name;
        sel.appendChild(o);
      });
    }).catch(() => {});
    document.getElementById('btn-add-co').onclick = async () => {
      const name    = document.getElementById('co-name').value.trim();
      const site_id = document.getElementById('co-site').value || null;
      if (!name) { Toast.error('업체명을 입력해주세요.'); return; }
      const btn = document.getElementById('btn-add-co');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.post('/companies', { name, site_id, active: true });
        Modal.close();
        Toast.success('업체가 추가되었습니다.');
        _loadCompanies();
      } catch { btn.disabled = false; btn.textContent = '추가'; }
    };
  }

  // ── 업체 수정 ─────────────────────────────────────────────
  function openEditCompany(id, name, siteId, active) {
    Modal.open({
      title: `업체 수정 — ${name}`,
      body: `
        <div class="form-group">
          <label class="form-label">업체명</label>
          <input id="co-name-edit" class="form-input" value="${name}">
        </div>
        <div class="form-group">
          <label class="form-label">현장</label>
          <select id="co-site-edit" class="form-input form-select">
            <option value="">전체 공통</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">상태</label>
          <select id="co-active-edit" class="form-input form-select">
            <option value="true"  ${active  ? 'selected':''}>활성</option>
            <option value="false" ${!active ? 'selected':''}>비활성</option>
          </select>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-edit-co">저장</button>
      `,
    });
    Api.get('/sites').then(sites => {
      const sel = document.getElementById('co-site-edit');
      if (!sel) return;
      sites.forEach(s => {
        const o = document.createElement('option');
        o.value = s.code; o.textContent = s.name;
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
        Modal.close();
        Toast.success('업체 정보가 수정되었습니다.');
        _loadCompanies();
      } catch { btn.disabled = false; btn.textContent = '저장'; }
    };
  }

  // ── 현장 추가 ────────────────────────────────────────────
  function openAddSite() {
    Modal.open({
      title: '현장 추가',
      body: `
        <div class="form-group">
          <label class="form-label">현장 코드 <span style="color:var(--red)">*</span></label>
          <input id="site-code" class="form-input" placeholder="예: P6">
          <div style="font-size:11px;color:var(--gray-400);margin-top:4px">
            코드는 영문/숫자 조합으로 입력하세요.
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">현장명 <span style="color:var(--red)">*</span></label>
          <input id="site-name" class="form-input" placeholder="예: P6 복합동">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-add-site">추가</button>
      `,
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
        Modal.close();
        Toast.success('현장이 추가되었습니다.');
        _loadSites();
      } catch { btn.disabled = false; btn.textContent = '추가'; }
    };
  }

  // ── 현장 수정 ────────────────────────────────────────────
  function openEditSite(id, code, name, active) {
    Modal.open({
      title: `현장 수정 — ${name}`,
      body: `
        <div class="form-group">
          <label class="form-label">현장 코드</label>
          <input id="site-code-edit" class="form-input" value="${code}">
        </div>
        <div class="form-group">
          <label class="form-label">현장명</label>
          <input id="site-name-edit" class="form-input" value="${name}">
        </div>
        <div class="form-group">
          <label class="form-label">상태</label>
          <select id="site-active-edit" class="form-input form-select">
            <option value="true"  ${active  ? 'selected':''}>활성</option>
            <option value="false" ${!active ? 'selected':''}>비활성</option>
          </select>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-edit-site">저장</button>
      `,
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
        Modal.close();
        Toast.success('현장 정보가 수정되었습니다.');
        _loadSites();
      } catch { btn.disabled = false; btn.textContent = '저장'; }
    };
  }

  // ── 프로젝트 추가 ─────────────────────────────────────────
  function openAddProject() {
    Modal.open({
      title: '프로젝트 추가',
      body: `
        <div class="form-group">
          <label class="form-label">프로젝트 코드 <span style="color:var(--red)">*</span></label>
          <input id="proj-code" class="form-input" placeholder="예: Ph5">
        </div>
        <div class="form-group">
          <label class="form-label">프로젝트명 <span style="color:var(--red)">*</span></label>
          <input id="proj-name" class="form-input" placeholder="예: Phase 5">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-add-proj">추가</button>
      `,
    });
    document.getElementById('btn-add-proj').onclick = async () => {
      const code = document.getElementById('proj-code').value.trim();
      const name = document.getElementById('proj-name').value.trim();
      if (!code) { Toast.error('프로젝트 코드를 입력해주세요.'); return; }
      if (!name) { Toast.error('프로젝트명을 입력해주세요.'); return; }
      const btn = document.getElementById('btn-add-proj');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.post('/projects', { code, name, active: true });
        Modal.close();
        Toast.success('프로젝트가 추가되었습니다.');
        _loadProjects();
      } catch { btn.disabled = false; btn.textContent = '추가'; }
    };
  }

  // ── 프로젝트 수정 ─────────────────────────────────────────
  function openEditProject(id, code, name, active) {
    Modal.open({
      title: `프로젝트 수정 — ${code}`,
      body: `
        <div class="form-group">
          <label class="form-label">프로젝트 코드</label>
          <input id="proj-code-edit" class="form-input" value="${code}">
        </div>
        <div class="form-group">
          <label class="form-label">프로젝트명</label>
          <input id="proj-name-edit" class="form-input" value="${name}">
        </div>
        <div class="form-group">
          <label class="form-label">상태</label>
          <select id="proj-active-edit" class="form-input form-select">
            <option value="true"  ${active  ? 'selected':''}>활성</option>
            <option value="false" ${!active ? 'selected':''}>비활성</option>
          </select>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-edit-proj">저장</button>
      `,
    });
    document.getElementById('btn-edit-proj').onclick = async () => {
      const btn = document.getElementById('btn-edit-proj');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/projects/${id}`, {
          code:   document.getElementById('proj-code-edit').value.trim(),
          name:   document.getElementById('proj-name-edit').value.trim(),
          active: document.getElementById('proj-active-edit').value === 'true',
        });
        Modal.close();
        Toast.success('프로젝트 정보가 수정되었습니다.');
        _loadProjects();
      } catch { btn.disabled = false; btn.textContent = '저장'; }
    };
  }

  return {
    render,
    openAddSite, openEditSite,
    openAddProject, openEditProject,
    openAddCompany, openEditCompany,
  };
})();
