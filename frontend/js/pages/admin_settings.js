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

      <!-- 제원표 관리 (전체 너비) -->
      <div class="card" style="margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0">장비 제원표</h3>
          <button class="btn btn-primary btn-sm" onclick="AdminSettingsPage.openAddSpec()">+ 제원 추가</button>
        </div>
        <div id="specs-list">
          <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
        </div>
      </div>

      <!-- 장비 모델 현황 (전체 너비) -->
      <div class="card" style="margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0">장비 모델 현황</h3>
          <button class="btn btn-outline btn-sm" onclick="AdminSettingsPage.reloadEquipModels()">새로고침</button>
        </div>
        <div id="equip-models-list">
          <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
        </div>
      </div>
    `;

    await Promise.all([_loadSites(), _loadProjects(), _loadCompanies(), _loadSpecs(), _loadEquipModels()]);
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
            <button onclick="AdminSettingsPage.deleteSite(${s.id},'${_esc(s.name)}')"
              style="background:none;border:none;cursor:pointer;color:var(--gray-400);
                     font-size:18px;line-height:1;padding:2px 4px;border-radius:4px"
              title="삭제" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--gray-400)'">
              ×
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
            <button onclick="AdminSettingsPage.deleteProject(${p.id},'${_esc(p.code)}')"
              style="background:none;border:none;cursor:pointer;color:var(--gray-400);
                     font-size:18px;line-height:1;padding:2px 4px;border-radius:4px"
              title="삭제" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--gray-400)'">
              ×
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
            <button onclick="AdminSettingsPage.deleteCompany(${c.id},'${_esc(c.name)}')"
              style="background:none;border:none;cursor:pointer;color:var(--gray-400);
                     font-size:18px;line-height:1;padding:2px 4px;border-radius:4px"
              title="삭제" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--gray-400)'">
              ×
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

  // ── 삭제 함수들 ──────────────────────────────────────────
  async function deleteSite(id, name) {
    if (!confirm(`현장 "${name}"을 삭제하시겠습니까?\n연결된 데이터가 있으면 삭제되지 않을 수 있습니다.`)) return;
    try {
      await Api.del(`/sites/${id}`);
      Toast.success('현장이 삭제되었습니다.');
      _loadSites();
    } catch (e) {
      Toast.error('삭제 실패: ' + (e.message || '연결된 데이터를 먼저 정리해주세요.'));
    }
  }

  async function deleteProject(id, code) {
    if (!confirm(`프로젝트 "${code}"을 삭제하시겠습니까?`)) return;
    try {
      await Api.del(`/projects/${id}`);
      Toast.success('프로젝트가 삭제되었습니다.');
      _loadProjects();
    } catch (e) {
      Toast.error('삭제 실패: ' + (e.message || '연결된 데이터를 먼저 정리해주세요.'));
    }
  }

  async function deleteCompany(id, name) {
    if (!confirm(`업체 "${name}"을 삭제하시겠습니까?`)) return;
    try {
      await Api.del(`/companies/${id}`);
      Toast.success('업체가 삭제되었습니다.');
      _loadCompanies();
    } catch (e) {
      Toast.error('삭제 실패: ' + (e.message || '오류가 발생했습니다.'));
    }
  }

  // ── 장비 모델 현황 ───────────────────────────────────────
  async function _loadEquipModels() {
    const el = document.getElementById('equip-models-list');
    if (!el) return;
    try {
      const { data: rows } = await _sb.from('equipment')
        .select('equip_no,model,serial_no,spec,site_name,company,status,in_date')
        .order('model', { ascending: true, nullsFirst: false });

      if (!rows?.length) {
        el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">장비 데이터 없음</div>';
        return;
      }

      // 모델별 그룹핑
      const groups = {};
      rows.forEach(r => {
        const key = r.model || '(모델 미입력)';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });

      const statusLabel = { in_use:'사용중', returned:'반출완료', stock:'재고', transit:'이동중' };

      el.innerHTML = Object.entries(groups).map(([modelName, items]) => `
        <div style="margin-bottom:20px">
          <div style="font-size:13px;font-weight:700;color:var(--navy);padding:6px 10px;
                      background:var(--gray-100);border-radius:6px;margin-bottom:8px">
            ${modelName} <span style="font-weight:400;color:var(--gray-500)">(${items.length}대)</span>
          </div>
          <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="color:var(--gray-500)">
                <th style="padding:5px 10px;text-align:left;font-weight:600">장비번호</th>
                <th style="padding:5px 10px;text-align:left;font-weight:600">시리얼번호</th>
                <th style="padding:5px 10px;text-align:left;font-weight:600">제원</th>
                <th style="padding:5px 10px;text-align:left;font-weight:600">현장</th>
                <th style="padding:5px 10px;text-align:left;font-weight:600">업체</th>
                <th style="padding:5px 10px;text-align:left;font-weight:600">반입일</th>
                <th style="padding:5px 10px;text-align:left;font-weight:600">상태</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(r => `
                <tr style="border-bottom:1px solid var(--gray-100)">
                  <td style="padding:6px 10px;font-weight:600;color:var(--navy)">${r.equip_no}</td>
                  <td style="padding:6px 10px;font-family:monospace;color:var(--gray-600)">${r.serial_no || '-'}</td>
                  <td style="padding:6px 10px">${r.spec || '-'}</td>
                  <td style="padding:6px 10px">${r.site_name || '-'}</td>
                  <td style="padding:6px 10px">${r.company || '-'}</td>
                  <td style="padding:6px 10px">${r.in_date || '-'}</td>
                  <td style="padding:6px 10px">
                    <span style="font-size:11px;padding:2px 7px;border-radius:10px;
                      background:${r.status==='in_use'?'#dbeafe':r.status==='returned'?'#f3f4f6':'#fef9c3'};
                      color:${r.status==='in_use'?'#1e40af':r.status==='returned'?'#6b7280':'#92400e'}">
                      ${statusLabel[r.status] || r.status}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          </div>
        </div>
      `).join('');
    } catch (e) {
      el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">불러오기 실패</div>';
      console.error('[EquipModels]', e);
    }
  }

  function reloadEquipModels() { _loadEquipModels(); }

  // ── 제원표 관리 ──────────────────────────────────────────
  async function _loadSpecs() {
    const el = document.getElementById('specs-list');
    if (!el) return;
    try {
      const list = await Api.get('/equipment-specs');
      if (!list.length) {
        el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">등록된 제원이 없습니다.</div>';
        return;
      }
      el.innerHTML = `
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--gray-100)">
              <th style="padding:8px 12px;text-align:left;font-weight:600">모델명</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">제조사</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">작업높이</th>
              <th style="padding:8px 12px;text-align:right;font-weight:600"></th>
            </tr>
          </thead>
          <tbody>
            ${list.map(s => `
              <tr style="border-bottom:1px solid var(--gray-100)">
                <td style="padding:8px 12px;font-weight:600;color:var(--navy)">${s.model}</td>
                <td style="padding:8px 12px;color:var(--gray-600)">${s.manufacturer || '-'}</td>
                <td style="padding:8px 12px">
                  <span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600">
                    ${s.work_height || '-'}
                  </span>
                </td>
                <td style="padding:8px 12px;text-align:right">
                  <button class="btn btn-outline btn-sm" style="margin-right:4px"
                    onclick="AdminSettingsPage.openEditSpec(${s.id},'${(s.model||'').replace(/'/g,"\\'")}','${(s.manufacturer||'').replace(/'/g,"\\'")}','${s.work_height||''}')">수정</button>
                  <button class="btn btn-danger btn-sm"
                    onclick="AdminSettingsPage.deleteSpec(${s.id},'${(s.model||'').replace(/'/g,"\\'")}')">삭제</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
        </div>
      `;
    } catch {
      el.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:16px">불러오기 실패</div>';
    }
  }

  const WORK_HEIGHT_OPTIONS = ['6M','8M','10M','12M','14M','16M','16M굴절','18M','20M굴절'];

  function openAddSpec() {
    Modal.open({
      title: '제원 추가',
      body: `
        <div class="form-group">
          <label class="form-label">모델명 <span style="color:var(--red)">*</span></label>
          <input id="spec-model" class="form-input" placeholder="예: GR20NS">
        </div>
        <div class="form-group">
          <label class="form-label">제조사</label>
          <input id="spec-mfr" class="form-input" placeholder="예: Genie, JLG, Skyjack">
        </div>
        <div class="form-group">
          <label class="form-label">작업높이</label>
          <select id="spec-height" class="form-input form-select">
            <option value="">선택</option>
            ${WORK_HEIGHT_OPTIONS.map(h => `<option value="${h}">${h}</option>`).join('')}
          </select>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-add-spec">추가</button>
      `,
    });
    document.getElementById('btn-do-add-spec').onclick = async () => {
      const model = document.getElementById('spec-model').value.trim();
      if (!model) { Toast.error('모델명을 입력해주세요.'); return; }
      const btn = document.getElementById('btn-do-add-spec');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.post('/equipment-specs', {
          model,
          manufacturer: document.getElementById('spec-mfr').value.trim() || null,
          work_height:  document.getElementById('spec-height').value || null,
        });
        Modal.close();
        Toast.success('제원이 추가되었습니다.');
        _loadSpecs();
      } catch (e) {
        btn.disabled = false; btn.textContent = '추가';
        Toast.error(e.message?.includes('unique') ? '이미 등록된 모델명입니다.' : '추가 실패');
      }
    };
  }

  function openEditSpec(id, model, manufacturer, workHeight) {
    Modal.open({
      title: '제원 수정',
      body: `
        <div class="form-group">
          <label class="form-label">모델명 <span style="color:var(--red)">*</span></label>
          <input id="spec-model" class="form-input" value="${model}">
        </div>
        <div class="form-group">
          <label class="form-label">제조사</label>
          <input id="spec-mfr" class="form-input" value="${manufacturer}">
        </div>
        <div class="form-group">
          <label class="form-label">작업높이</label>
          <select id="spec-height" class="form-input form-select">
            <option value="">선택</option>
            ${WORK_HEIGHT_OPTIONS.map(h => `<option value="${h}" ${h===workHeight?'selected':''}>${h}</option>`).join('')}
          </select>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-edit-spec">저장</button>
      `,
    });
    document.getElementById('btn-do-edit-spec').onclick = async () => {
      const newModel = document.getElementById('spec-model').value.trim();
      if (!newModel) { Toast.error('모델명을 입력해주세요.'); return; }
      const btn = document.getElementById('btn-do-edit-spec');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        await Api.patch(`/equipment-specs/${id}`, {
          model:        newModel,
          manufacturer: document.getElementById('spec-mfr').value.trim() || null,
          work_height:  document.getElementById('spec-height').value || null,
        });
        Modal.close();
        Toast.success('제원이 수정되었습니다.');
        _loadSpecs();
      } catch (e) {
        btn.disabled = false; btn.textContent = '저장';
        Toast.error(e.message?.includes('unique') ? '이미 등록된 모델명입니다.' : '저장 실패');
      }
    };
  }

  async function deleteSpec(id, model) {
    if (!confirm(`"${model}" 제원을 삭제하시겠습니까?`)) return;
    try {
      await Api.del(`/equipment-specs/${id}`);
      Toast.success('삭제되었습니다.');
      _loadSpecs();
    } catch { Toast.error('삭제 실패'); }
  }

  return {
    render,
    openAddSite, openEditSite, deleteSite,
    openAddProject, openEditProject, deleteProject,
    openAddCompany, openEditCompany, deleteCompany,
    reloadEquipModels,
    openAddSpec, openEditSpec, deleteSpec,
  };
})();
