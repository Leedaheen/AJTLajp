/**
 * 관리자 페이지 — 사용자 승인/거절/역할 변경
 * AJ관리자만 접근 가능합니다.
 */
const AdminPage = (() => {
  const ROLE_LABELS = {
    tech: '기술인', partner: '협력사 담당자', aj: 'AJ관리자', as_tech: 'AS기사',
  };
  const STATUS_LABELS = {
    pending: '<span class="badge badge-pending">승인 대기</span>',
    active:  '<span class="badge badge-active">활성</span>',
    rejected: '<span class="badge badge-rejected">거절</span>',
  };

  async function render() {
    document.getElementById('page-admin').innerHTML = `
      <h2 class="section-title">사용자 관리</h2>

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
              <th>연락처</th>
              <th>상태</th>
              <th>가입일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody id="admin-user-tbody">
            <tr><td colspan="8" class="text-center"><div class="spinner" style="margin:12px auto;display:block"></div></td></tr>
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('admin-filter-status').addEventListener('change', loadUsers);
    document.getElementById('admin-search').addEventListener('input', _filterTable);

    await loadUsers();
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
        <td>${u.site_id}</td>
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
              <button class="btn btn-outline btn-sm" onclick="AdminPage.changeRole('${u.id}','${u.name}','${u.role}','${u.site_id}')">역할 변경</button>
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
        await Api.patch(`/users/${userId}/approve`, { action: 'approve' });
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
        await Api.patch(`/users/${userId}/approve`, { action: 'reject', reject_reason: reason });
        Modal.close();
        Toast.success(`${name}님이 거절되었습니다.`);
        loadUsers();
      } catch (e) { /* api.js에서 처리 */ }
    };
  }

  // ── 역할 변경 ────────────────────────────────────────────
  async function changeRole(userId, name, currentRole, currentSite) {
    Modal.open({
      title: `${name}님 역할 변경`,
      body: `
        <div class="form-group">
          <label class="form-label">역할</label>
          <select id="sel-new-role" class="form-input form-select">
            <option value="tech" ${currentRole==='tech'?'selected':''}>기술인</option>
            <option value="partner" ${currentRole==='partner'?'selected':''}>협력사 담당자</option>
            <option value="aj" ${currentRole==='aj'?'selected':''}>AJ관리자</option>
            <option value="as_tech" ${currentRole==='as_tech'?'selected':''}>AS기사</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">현장</label>
          <select id="sel-new-site" class="form-input form-select">
            <option value="P4" ${currentSite==='P4'?'selected':''}>P4 복합동</option>
            <option value="P5" ${currentSite==='P5'?'selected':''}>P5 복합동</option>
            <option value="ALL" ${currentSite==='ALL'?'selected':''}>전체 (AJ관리자)</option>
          </select>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-confirm-role">변경</button>
      `,
    });
    document.getElementById('btn-confirm-role').onclick = async () => {
      const role   = document.getElementById('sel-new-role').value;
      const siteId = document.getElementById('sel-new-site').value;
      try {
        await Api.patch(`/users/${userId}/role`, { role, site_id: siteId });
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

  return { render, loadUsers, approveUser, rejectUser, changeRole, openCredentialsModal };
})();
