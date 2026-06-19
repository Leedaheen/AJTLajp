/**
 * 관리자 페이지 — 사용자 승인/거절/역할 변경
 * AJ관리자만 접근 가능합니다.
 */
const AdminPage = (() => {
  const ROLE_LABELS = {
    tech: '기술인', partner: '협력사 담당자', aj: 'AJ관리자', as_tech: 'AS기사', pro: '프로',
  };
  const STATUS_LABELS = {
    pending: '<span class="badge badge-pending">승인 대기</span>',
    active:  '<span class="badge badge-active">활성</span>',
    rejected: '<span class="badge badge-rejected">거절</span>',
  };

  // ── 역할별 권한/알림 설정 ──────────────────────────────────
  const _PERM_ROLES = ['tech','partner','pro','as_tech','aj'];
  const _PERM_ROLE_LABELS = { tech:'기술인', partner:'협력사', pro:'프로', as_tech:'AS기사', aj:'AJ관리자' };
  const _PERM_MENUS = [
    { group:'홈',        name:'홈 대시보드',    key:'home',           noEdit:true },
    { group:'반입/반출', name:'일정 조회',      key:'transit_view',   noEdit:true,  notifLabel:'일정 변경' },
    { group:'반입/반출', name:'신청 / 처리',    key:'transit_edit',                 notifLabel:'신청 접수' },
    { group:'장비 관리', name:'장비 조회',      key:'equip_view',     noEdit:true,  notifLabel:'장비 변동' },
    { group:'장비 관리', name:'장비 편집 / QR', key:'equip_edit',                   notifLabel:'등록/삭제' },
    { group:'AS 요청',   name:'AS 조회',        key:'as_view',        noEdit:true,  notifLabel:'AS 접수' },
    { group:'AS 요청',   name:'AS 처리',        key:'as_edit',                      notifLabel:'처리 완료' },
    { group:'사용 기록', name:'기록 조회',      key:'usage_view',     noEdit:true,  notifLabel:'기록 등록' },
    { group:'사용 기록', name:'기록 등록',      key:'usage_edit',                   notifLabel:'등록 완료' },
    { group:'분석',      name:'분석 리포트',    key:'analytics',      noEdit:true },
    { group:'관리자',    name:'사용자 관리',    key:'admin_users',    noEdit:true,  notifLabel:'가입 신청' },
    { group:'관리자',    name:'관리자 설정',    key:'admin_settings', noEdit:true },
  ];
  const _EDIT_STATES = [
    { label:'편집 없음', cls:'peb-s0' },
    { label:'전체 수정', cls:'peb-s1' },
    { label:'현장만',    cls:'peb-s2' },
    { label:'업체만',    cls:'peb-s3' },
  ];
  const _PERM_DEFAULTS = {
    tech:    { home:{v:1,e:0,n:0}, transit_view:{v:0,e:0,n:0}, transit_edit:{v:0,e:0,n:0}, equip_view:{v:1,e:0,n:0}, equip_edit:{v:0,e:0,n:0}, as_view:{v:1,e:0,n:1}, as_edit:{v:1,e:2,n:1}, usage_view:{v:1,e:0,n:0}, usage_edit:{v:1,e:2,n:0}, analytics:{v:0,e:0,n:0}, admin_users:{v:0,e:0,n:0}, admin_settings:{v:0,e:0,n:0} },
    partner: { home:{v:1,e:0,n:0}, transit_view:{v:1,e:0,n:1}, transit_edit:{v:1,e:3,n:1}, equip_view:{v:1,e:0,n:0}, equip_edit:{v:0,e:0,n:0}, as_view:{v:1,e:0,n:0}, as_edit:{v:1,e:3,n:1}, usage_view:{v:1,e:0,n:0}, usage_edit:{v:1,e:3,n:0}, analytics:{v:0,e:0,n:0}, admin_users:{v:0,e:0,n:0}, admin_settings:{v:0,e:0,n:0} },
    pro:     { home:{v:1,e:0,n:0}, transit_view:{v:1,e:0,n:0}, transit_edit:{v:0,e:0,n:0}, equip_view:{v:1,e:0,n:0}, equip_edit:{v:0,e:0,n:0}, as_view:{v:1,e:0,n:0}, as_edit:{v:0,e:0,n:0}, usage_view:{v:1,e:0,n:0}, usage_edit:{v:0,e:0,n:0}, analytics:{v:1,e:0,n:0}, admin_users:{v:0,e:0,n:0}, admin_settings:{v:0,e:0,n:0} },
    as_tech: { home:{v:1,e:0,n:0}, transit_view:{v:0,e:0,n:0}, transit_edit:{v:0,e:0,n:0}, equip_view:{v:1,e:0,n:0}, equip_edit:{v:0,e:0,n:0}, as_view:{v:1,e:0,n:1}, as_edit:{v:1,e:2,n:1}, usage_view:{v:0,e:0,n:0}, usage_edit:{v:0,e:0,n:0}, analytics:{v:0,e:0,n:0}, admin_users:{v:0,e:0,n:0}, admin_settings:{v:0,e:0,n:0} },
    aj:      { home:{v:1,e:0,n:0}, transit_view:{v:1,e:0,n:1}, transit_edit:{v:1,e:1,n:1}, equip_view:{v:1,e:0,n:0}, equip_edit:{v:1,e:1,n:0}, as_view:{v:1,e:0,n:1}, as_edit:{v:1,e:1,n:1}, usage_view:{v:1,e:0,n:0}, usage_edit:{v:1,e:1,n:0}, analytics:{v:1,e:0,n:0}, admin_users:{v:1,e:0,n:1}, admin_settings:{v:1,e:0,n:0} },
  };
  let _permState = {};
  let _permRole  = 'tech';

  async function render() {
    const user = Auth.getUser();
    const isAdmin = user?.role === 'admin';

    document.getElementById('page-admin').innerHTML = `
      <h2 class="section-title">사용자 관리</h2>

      ${isAdmin ? `
      <div style="margin-bottom:16px;display:flex;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" style="display:flex;align-items:center;gap:6px"
          onclick="AdminPage.openPermModal()">
          역할별 권한 / 알림 설정
          <span style="font-size:10px;padding:1px 6px;background:#fef3c7;color:#92400e;border-radius:8px;border:0.5px solid #fcd34d;font-weight:600">admin</span>
        </button>
      </div>
      ` : ''}

      <!-- 관리자 계정 설정 카드 -->
      <div class="card" style="margin-bottom:20px;border-left:4px solid var(--navy)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--navy)">관리자 계정 설정</div>
            <div class="text-sm text-muted" style="margin-top:3px">관리자 로그인 아이디와 비밀번호를 변경합니다.</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="AdminPage.openCredentialsModal()">계정 정보 변경</button>
        </div>
      </div>

      <div class="search-bar">
        <select id="admin-filter-status" class="form-input form-select" style="max-width:160px">
          <option value="">전체</option>
          <option value="pending">승인 대기</option>
          <option value="active">활성</option>
          <option value="rejected">거절</option>
        </select>
        <input id="admin-search" type="text" class="search-input" placeholder="이름·이메일 검색">
      </div>

      <div class="card" style="overflow:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>역할</th>
              <th>현장</th>
              <th>소속</th>
              <th>연락처</th>
              <th>상태</th>
              <th>가입일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody id="admin-user-tbody">
            <tr><td colspan="9" class="text-center"><div class="spinner" style="margin:12px auto;display:block"></div></td></tr>
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('admin-filter-status').addEventListener('change', loadUsers);
    document.getElementById('admin-search').addEventListener('input', _filterTable);

    if (isAdmin) {
      await Promise.all([loadUsers(), _loadPerms()]);
    } else {
      await loadUsers();
    }
  }

  // ── 권한 설정 팝업 ────────────────────────────────────────
  function openPermModal() {
    Modal.open({
      title: '역할별 권한 / 알림 설정',
      body: `
        <style>
          .peb-s0{background:var(--gray-100);color:var(--gray-500);border:0.5px solid var(--gray-200)}
          .peb-s1{background:#dbeafe;color:#1e3a8a;border:0.5px solid #93c5fd}
          .peb-s2{background:#d1fae5;color:#065f46;border:0.5px solid #6ee7b7}
          .peb-s3{background:#fef3c7;color:#92400e;border:0.5px solid #fcd34d}
          .perm-edit-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;user-select:none;white-space:nowrap;transition:opacity .1s}
          .perm-edit-badge:hover{opacity:.8}
          .perm-role-btn{padding:5px 13px;border-radius:20px;font-size:12px;cursor:pointer;border:1px solid var(--gray-200);background:var(--white);color:var(--gray-500)}
          .perm-role-btn.active{background:var(--navy);color:#fff;border-color:var(--navy);font-weight:600}
          .perm-tbl{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
          .perm-tbl th{font-size:11px;font-weight:600;color:var(--gray-400);padding:8px 10px;background:var(--gray-50);border-bottom:1px solid var(--gray-100);text-align:center}
          .perm-tbl th.lft{text-align:left}
          .perm-tbl td{padding:8px 10px;border-bottom:1px solid var(--gray-100);vertical-align:middle;text-align:center}
          .perm-tbl td.lft{text-align:left;font-size:13px}
          .perm-tbl tr:hover td{background:var(--gray-50)}
          .perm-grp td{font-size:10px;font-weight:700;color:var(--gray-400);background:var(--gray-50);padding:4px 10px;text-align:left;letter-spacing:.06em;text-transform:uppercase}
          .perm-toggle{position:relative;width:32px;height:18px;display:inline-block}
          .perm-toggle input{opacity:0;width:0;height:0}
          .perm-slider{position:absolute;inset:0;background:var(--gray-200);border-radius:18px;cursor:pointer;transition:.2s}
          .perm-slider:before{content:'';position:absolute;width:12px;height:12px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
          .perm-toggle input:checked+.perm-slider{background:var(--navy)}
          .perm-toggle input:checked+.perm-slider:before{transform:translateX(14px)}
          .perm-toggle input:disabled+.perm-slider{opacity:.25;cursor:not-allowed}
          .perm-legend{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 10px}
          .perm-leg{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--gray-500)}
          .perm-dot{width:9px;height:9px;border-radius:50%}
        </style>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px" id="perm-role-bar">
          ${_PERM_ROLES.map((r,i) => `
            <button class="perm-role-btn${i===0?' active':''}"
              onclick="AdminPage.permSwitchRole(this,'${r}')">${_PERM_ROLE_LABELS[r]}</button>
          `).join('')}
        </div>
        <div class="perm-legend">
          <span class="perm-leg"><span class="perm-dot" style="background:#9ca3af"></span>편집 없음</span>
          <span class="perm-leg"><span class="perm-dot" style="background:#3b82f6"></span>전체 수정</span>
          <span class="perm-leg"><span class="perm-dot" style="background:#10b981"></span>담당 현장만</span>
          <span class="perm-leg"><span class="perm-dot" style="background:#f59e0b"></span>담당 업체만</span>
        </div>
        <div style="overflow:auto;border:1px solid var(--gray-100);border-radius:8px">
          <table class="perm-tbl">
            <thead>
              <tr>
                <th class="lft" style="width:35%">메뉴</th>
                <th style="width:11%">열람</th>
                <th style="width:32%">편집 권한</th>
                <th style="width:22%">알림</th>
              </tr>
            </thead>
            <tbody id="perm-tbody"></tbody>
          </table>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>
        <button class="btn btn-primary btn-sm" id="btn-save-perms" onclick="AdminPage.savePermissions()">저장</button>
      `,
    });
    const box = document.querySelector('.modal-box');
    if (box) box.style.maxWidth = '640px';
    _permRole = 'tech';
    _renderPermTable('tech');
  }

  // ── 권한 설정 로드 ────────────────────────────────────────
  async function _loadPerms() {
    try {
      const { data } = await window._sb.from('role_permissions').select('role,menus');
      _permState = {};
      _PERM_ROLES.forEach(r => {
        const row = (data || []).find(d => d.role === r);
        _permState[r] = row?.menus || JSON.parse(JSON.stringify(_PERM_DEFAULTS[r]));
      });
    } catch {
      _PERM_ROLES.forEach(r => {
        _permState[r] = JSON.parse(JSON.stringify(_PERM_DEFAULTS[r]));
      });
    }
    _permRole = 'tech';
    _renderPermTable('tech');
  }

  function _renderPermTable(role) {
    const tbody = document.getElementById('perm-tbody');
    if (!tbody) return;
    const p = _permState[role] || {};
    let html = '', lastGroup = '';
    _PERM_MENUS.forEach(m => {
      if (m.group !== lastGroup) {
        html += `<tr class="perm-grp"><td colspan="4">${m.group}</td></tr>`;
        lastGroup = m.group;
      }
      const d   = p[m.key] || { v:0, e:0, n:0 };
      const es  = _EDIT_STATES[d.e] || _EDIT_STATES[0];
      const dis = !d.v;
      html += `<tr>
        <td class="lft">${m.name}</td>
        <td>
          <input type="checkbox" style="width:14px;height:14px;accent-color:var(--navy);cursor:pointer"
            id="pv_${m.key}" ${d.v ? 'checked' : ''}
            onchange="AdminPage.permOnView('${m.key}')">
        </td>
        <td>
          ${m.noEdit
            ? `<span style="font-size:11px;color:var(--gray-300)">—</span>`
            : `<span id="peb_${m.key}" class="perm-edit-badge ${es.cls}"
                data-state="${d.e}"
                onclick="AdminPage.permCycleEdit('${m.key}')">${es.label}</span>`
          }
        </td>
        <td>
          ${m.notifLabel
            ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                 <label class="perm-toggle">
                   <input type="checkbox" id="pn_${m.key}" ${d.n ? 'checked' : ''} ${dis ? 'disabled' : ''}>
                   <span class="perm-slider"></span>
                 </label>
                 <span style="font-size:10px;color:var(--gray-400)">${m.notifLabel}</span>
               </div>`
            : `<span style="font-size:11px;color:var(--gray-300)">—</span>`
          }
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  }

  function _savePermFromDom(role) {
    if (!_permState[role]) return;
    _PERM_MENUS.forEach(m => {
      const v = document.getElementById('pv_' + m.key)?.checked ? 1 : 0;
      const ebEl = document.getElementById('peb_' + m.key);
      const e = ebEl ? parseInt(ebEl.dataset.state || '0') : 0;
      const n = document.getElementById('pn_' + m.key)?.checked ? 1 : 0;
      _permState[role][m.key] = { v, e, n };
    });
  }

  function permSwitchRole(btn, role) {
    _savePermFromDom(_permRole);
    _permRole = role;
    document.querySelectorAll('.perm-role-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _renderPermTable(role);
  }

  function permCycleEdit(key) {
    const badge = document.getElementById('peb_' + key);
    if (!badge) return;
    const cur = parseInt(badge.dataset.state || '0');
    const next = (cur + 1) % 4;
    badge.dataset.state = next;
    badge.className = 'perm-edit-badge ' + _EDIT_STATES[next].cls;
    badge.textContent = _EDIT_STATES[next].label;
    const vEl = document.getElementById('pv_' + key);
    if (next > 0 && vEl) vEl.checked = true;
    _updateNotifDisabled(key, next > 0 || (vEl?.checked));
  }

  function permOnView(key) {
    const vEl = document.getElementById('pv_' + key);
    if (!vEl?.checked) {
      const badge = document.getElementById('peb_' + key);
      if (badge) { badge.dataset.state = '0'; badge.className = 'perm-edit-badge peb-s0'; badge.textContent = '편집 없음'; }
    }
    _updateNotifDisabled(key, vEl?.checked);
  }

  function _updateNotifDisabled(key, enabled) {
    const n = document.getElementById('pn_' + key);
    if (!n) return;
    n.disabled = !enabled;
    if (!enabled) n.checked = false;
  }

  async function savePermissions() {
    _savePermFromDom(_permRole);
    const btn = document.getElementById('btn-save-perms');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
    try {
      const rows = _PERM_ROLES.map(role => ({
        role,
        menus: _permState[role] || _PERM_DEFAULTS[role],
        updated_at: new Date().toISOString(),
      }));
      const { error } = await window._sb.from('role_permissions').upsert(rows, { onConflict: 'role' });
      if (error) throw error;
      window._rolePerms = {};
      rows.forEach(r => { window._rolePerms[r.role] = r.menus; });
      Toast.success('권한 설정이 저장되었습니다.');
      Modal.close();
    } catch (e) {
      Toast.error('저장 실패: ' + (e.message || '오류가 발생했습니다.'));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '저장'; }
    }
  }

  async function loadUsers() {
    const status = document.getElementById('admin-filter-status').value;
    try {
      const users = await Api.get(`/users${status ? `?status=${status}` : ''}`);
      _renderTable(users);
    } catch (e) {
      document.getElementById('admin-user-tbody').innerHTML =
        '<tr><td colspan="8" class="text-center text-muted">불러오기 실패</td></tr>';
    }
  }

  function _renderTable(users) {
    const tbody = document.getElementById('admin-user-tbody');
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:32px">사용자 없음</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr data-name="${u.name}" data-email="${u.email}">
        <td><strong>${u.name}</strong></td>
        <td class="text-sm text-muted">${u.email}</td>
        <td>${ROLE_LABELS[u.role] || u.role}</td>
        <td>${u.site_id || '-'}</td>
        <td class="text-sm">${u.company || '-'}</td>
        <td>${u.phone || '-'}</td>
        <td>${STATUS_LABELS[u.status] || u.status}</td>
        <td class="text-sm text-muted">${new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${u.status === 'pending' ? `
              <button class="btn btn-primary btn-sm" onclick="AdminPage.approveUser('${u.id}','${u.name}')">승인</button>
              <button class="btn btn-danger btn-sm" onclick="AdminPage.rejectUser('${u.id}','${u.name}')">거절</button>
            ` : ''}
            ${u.status === 'active' ? `
              <button class="btn btn-outline btn-sm" onclick="AdminPage.changeRole('${u.id}','${u.name}','${u.role}','${u.site_id}','${u.company||''}')">역할 변경</button>
            ` : ''}
            ${u.status === 'rejected' ? `
              <button class="btn btn-outline btn-sm" onclick="AdminPage.approveUser('${u.id}','${u.name}')">재승인</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  function _filterTable() {
    const q = document.getElementById('admin-search').value.toLowerCase();
    document.querySelectorAll('#admin-user-tbody tr').forEach(tr => {
      const name  = (tr.dataset.name  || '').toLowerCase();
      const email = (tr.dataset.email || '').toLowerCase();
      tr.style.display = (name.includes(q) || email.includes(q)) ? '' : 'none';
    });
  }

  // ── 승인 ────────────────────────────────────────────────
  async function approveUser(userId, name) {
    Modal.open({
      title: `${name}님 승인`,
      body: `<p>${name}님의 가입을 승인하시겠습니까?</p>`,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-confirm-approve">승인</button>
      `,
    });
    document.getElementById('btn-confirm-approve').onclick = async () => {
      try {
        await Api.patch(`/users/${userId}/approve`, { action: 'approve', approved_at: new Date().toISOString() });
        Modal.close();
        Toast.success(`${name}님이 승인되었습니다.`);
        loadUsers();
      } catch (e) { /* api.js에서 처리 */ }
    };
  }

  // ── 거절 ────────────────────────────────────────────────
  async function rejectUser(userId, name) {
    Modal.open({
      title: `${name}님 거절`,
      body: `
        <p style="margin-bottom:12px">${name}님의 가입을 거절합니다.</p>
        <div class="form-group">
          <label class="form-label">거절 사유 <span style="color:var(--red)">*</span></label>
          <input id="inp-reject-reason" class="form-input" placeholder="예: 소속 확인 불가, 담당자 문의 후 재신청">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-danger btn-sm" id="btn-confirm-reject">거절</button>
      `,
    });
    document.getElementById('btn-confirm-reject').onclick = async () => {
      const reason = document.getElementById('inp-reject-reason').value.trim();
      if (!reason) { Toast.error('거절 사유를 입력해주세요.'); return; }
      try {
        await Api.patch(`/users/${userId}/approve`, { action: 'reject', reject_reason: reason, approved_at: null });
        Modal.close();
        Toast.success(`${name}님이 거절되었습니다.`);
        loadUsers();
      } catch (e) { /* api.js에서 처리 */ }
    };
  }

  // ── 역할 변경 ────────────────────────────────────────────
  async function changeRole(userId, name, currentRole, currentSite, currentCompany) {
    const [sitesRes, clientsRes] = await Promise.all([
      Api.get('/sites').catch(() => []),
      window._sb.from('clients').select('id,name').eq('active', true).order('sort_order').order('name').catch(() => ({ data: [] })),
    ]);
    const sites   = Array.isArray(sitesRes) ? sitesRes : (sitesRes?.data || []);
    const clients = clientsRes?.data || [];

    const siteOpts = [
      ...sites.map(s => `<option value="${s.name}" ${currentSite===s.name?'selected':''}>${s.name}</option>`),
      `<option value="ALL" ${currentSite==='ALL'?'selected':''}>전체 (AJ관리자)</option>`,
    ].join('');

    const clientOpts = [
      `<option value="">-</option>`,
      ...clients.map(c => `<option value="${c.name}" ${currentCompany===c.name?'selected':''}>${c.name}</option>`),
    ].join('');

    Modal.open({
      title: `${name}님 역할 변경`,
      body: `
        <div class="form-group">
          <label class="form-label">역할</label>
          <select id="sel-new-role" class="form-input form-select">
            <option value="tech"    ${currentRole==='tech'   ?'selected':''}>기술인</option>
            <option value="partner" ${currentRole==='partner'?'selected':''}>협력사 담당자</option>
            <option value="pro"     ${currentRole==='pro'    ?'selected':''}>프로</option>
            <option value="aj"      ${currentRole==='aj'     ?'selected':''}>AJ관리자</option>
            <option value="as_tech" ${currentRole==='as_tech'?'selected':''}>AS기사</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">현장</label>
          <select id="sel-new-site" class="form-input form-select">${siteOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">소속 (발주처)</label>
          <select id="sel-new-company" class="form-input form-select">${clientOpts}</select>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-confirm-role">변경</button>
      `,
    });
    document.getElementById('btn-confirm-role').onclick = async () => {
      const role    = document.getElementById('sel-new-role').value;
      const siteId  = document.getElementById('sel-new-site').value;
      const company = document.getElementById('sel-new-company').value;
      try {
        await Api.patch(`/users/${userId}/role`, { role, site_id: siteId, company });
        Modal.close();
        Toast.success('역할이 변경되었습니다.');
        loadUsers();
      } catch (e) { /* api.js에서 처리 */ }
    };
  }

  // ── 관리자 계정 ID/PW 변경 ──────────────────────────────────
  function openCredentialsModal() {
    Modal.open({
      title: '관리자 계정 정보 변경',
      body: `
        <p class="text-sm text-muted" style="margin-bottom:16px">
          현재 비밀번호 확인 후 아이디·비밀번호를 변경할 수 있습니다.<br>
          변경하지 않을 항목은 비워두세요.
        </p>
        <div class="form-group">
          <label class="form-label">현재 비밀번호 <span style="color:var(--red)">*</span></label>
          <input id="inp-cur-pw" type="password" class="form-input" placeholder="현재 비밀번호 입력">
        </div>
        <hr class="divider">
        <div class="form-group">
          <label class="form-label">새 아이디 (변경 시 입력)</label>
          <input id="inp-new-id" type="text" class="form-input" placeholder="새 아이디">
        </div>
        <div class="form-group">
          <label class="form-label">새 비밀번호 (변경 시 입력)</label>
          <input id="inp-new-pw" type="password" class="form-input" placeholder="새 비밀번호 (4자 이상)">
        </div>
        <div class="form-group">
          <label class="form-label">새 비밀번호 확인</label>
          <input id="inp-new-pw2" type="password" class="form-input" placeholder="새 비밀번호 재입력">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-save-cred">변경 저장</button>
      `,
    });

    document.getElementById('btn-save-cred').onclick = async () => {
      const curPw  = document.getElementById('inp-cur-pw').value;
      const newId  = document.getElementById('inp-new-id').value.trim();
      const newPw  = document.getElementById('inp-new-pw').value;
      const newPw2 = document.getElementById('inp-new-pw2').value;

      if (!curPw) { Toast.error('현재 비밀번호를 입력해주세요.'); return; }
      if (newPw && newPw !== newPw2) { Toast.error('새 비밀번호가 일치하지 않습니다.'); return; }
      if (newPw && newPw.length < 4) { Toast.error('비밀번호는 4자 이상이어야 합니다.'); return; }
      if (!newId && !newPw) { Toast.error('변경할 아이디 또는 비밀번호를 입력해주세요.'); return; }

      const btn = document.getElementById('btn-save-cred');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';

      try {
        await Api.patch('/users/me/credentials', {
          current_password: curPw,
          new_admin_id: newId || undefined,
          new_password: newPw || undefined,
        });
        Modal.close();
        Toast.success('계정 정보가 변경되었습니다.');
      } catch (e) {
        btn.disabled = false;
        btn.textContent = '변경 저장';
      }
    };
  }

  return { render, loadUsers, approveUser, rejectUser, changeRole, openCredentialsModal,
           openPermModal, permSwitchRole, permCycleEdit, permOnView, savePermissions };
})();
