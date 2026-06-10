/**
 * 인증 모듈
 * Google Identity Services(GSI)로 로그인하고 앱 JWT를 관리합니다.
 * 역할 선택 → 백엔드로 credential 전달 → 토큰 저장
 */

// Google Cloud Console에서 발급받은 클라이언트 ID로 교체하세요
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const Auth = (() => {
  let _user = null;

  // ── 초기화 ──────────────────────────────────────────────
  function init() {
    const token = localStorage.getItem('app_token');
    const user  = localStorage.getItem('app_user');
    if (token && user) {
      _user = JSON.parse(user);
      return true; // 이미 로그인됨
    }
    return false;
  }

  function getUser() { return _user; }

  function isLoggedIn() { return !!_user; }

  // ── 로그아웃 ─────────────────────────────────────────────
  function logout() {
    localStorage.removeItem('app_token');
    localStorage.removeItem('app_user');
    _user = null;
    App.showPage('login');
  }

  // ── Google 로그인 렌더링 ──────────────────────────────────
  function renderGoogleBtn(containerId) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: _onGoogleCredential,
      ux_mode: 'popup',
    });
    google.accounts.id.renderButton(
      document.getElementById(containerId),
      { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ko', width: 280 }
    );

    // 관리자 로그인 버튼 이벤트 연결
    document.getElementById('btn-admin-login')?.addEventListener('click', adminLogin);
    // Enter 키로도 로그인
    document.getElementById('admin-pw-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') adminLogin();
    });
  }

  // ── 관리자 ID/PW 로그인 ───────────────────────────────────
  async function adminLogin() {
    const adminId  = document.getElementById('admin-id-input').value.trim();
    const password = document.getElementById('admin-pw-input').value;

    if (!adminId || !password) {
      Toast.error('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    const btn = document.getElementById('btn-admin-login');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 로그인 중...';

    try {
      const res = await Api.post('/users/auth/admin', { admin_id: adminId, password });

      localStorage.setItem('app_token', res.token);
      localStorage.setItem('app_user', JSON.stringify(res.user));
      _user = res.user;

      Notifications.requestPermission();
      App.showPage('home');
      Toast.success(`환영합니다, ${res.user.name}님!`);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '관리자 로그인';
    }
  }

  // ── Google 콜백 → 역할 선택 모달 ─────────────────────────
  function _onGoogleCredential(response) {
    const credential = response.credential;
    Modal.open({
      title: '역할 및 현장 선택',
      body: `
        <p class="text-sm text-muted" style="margin-bottom:16px">
          사용하실 역할과 담당 현장을 선택해주세요.<br>
          협력사·AS기사는 AJ관리자 승인 후 이용 가능합니다.
        </p>
        <div class="form-group">
          <label class="form-label">역할 선택 <span style="color:var(--red)">*</span></label>
          <select id="sel-role" class="form-input form-select">
            <option value="">-- 역할을 선택하세요 --</option>
            <option value="tech">기술인 (현장 작업자)</option>
            <option value="partner">협력사 담당자</option>
            <option value="aj">AJ관리자</option>
            <option value="as_tech">AS기사 (고장 수리 담당자)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">담당 현장 <span style="color:var(--red)">*</span></label>
          <select id="sel-site" class="form-input form-select">
            <option value="P4">P4 복합동</option>
            <option value="P5">P5 복합동</option>
            <option value="ALL" id="opt-all" style="display:none">전체 (AJ관리자)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">업체명 <span style="color:var(--red)">*</span></label>
          <input id="inp-company" class="form-input" placeholder="소속 업체명">
        </div>
        <div class="form-group">
          <label class="form-label">연락처</label>
          <input id="inp-phone" type="tel" class="form-input" placeholder="010-0000-0000">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-role-confirm">확인</button>
      `,
    });

    // 역할에 따라 ALL 옵션 표시
    document.getElementById('sel-role').addEventListener('change', (e) => {
      const optAll  = document.getElementById('opt-all');
      const selSite = document.getElementById('sel-site');
      if (e.target.value === 'aj') {
        optAll.style.display = '';
        selSite.value = 'ALL';
      } else {
        optAll.style.display = 'none';
        if (selSite.value === 'ALL') selSite.value = 'P4';
      }
    });

    document.getElementById('btn-role-confirm').onclick = () =>
      _submitLogin(credential);
  }

  // ── 백엔드로 로그인 요청 ──────────────────────────────────
  async function _submitLogin(credential) {
    const role    = document.getElementById('sel-role').value;
    const siteId  = document.getElementById('sel-site').value;
    const phone   = document.getElementById('inp-phone').value;
    const company = document.getElementById('inp-company')?.value.trim();

    if (!role) { Toast.error('역할을 선택해주세요.'); return; }
    if (company) localStorage.setItem('saved_company', company);

    const btn = document.getElementById('btn-role-confirm');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const res = await Api.post('/users/auth/google', { credential, role, site_id: siteId, phone });
      Modal.close();

      if (res.status === 'pending') {
        App.showPage('pending');
        return;
      }
      if (res.status === 'rejected') {
        App.showPage('rejected', { reason: res.reject_reason });
        return;
      }

      // 로그인 성공
      localStorage.setItem('app_token', res.token);
      localStorage.setItem('app_user', JSON.stringify(res.user));
      _user = res.user;

      // PWA Push 구독 요청
      Notifications.requestPermission();

      App.showPage('home');
      Toast.success(`환영합니다, ${res.user.name}님!`);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '확인';
    }
  }

  return { init, getUser, isLoggedIn, logout, renderGoogleBtn };
})();
