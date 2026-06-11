/**
 * 인증 모듈 — Supabase Auth 기반
 * Google OAuth 및 이메일/비밀번호(관리자) 로그인을 처리합니다.
 * 사용자 프로필(role, site_id)은 app_users 테이블에서 관리합니다.
 */
const Auth = (() => {
  let _user = null;

  // ── 초기화 ──────────────────────────────────────────────────
  async function init() {
    // 프리뷰 전용 세션 (로컬 테스트용)
    const preview = localStorage.getItem('aj_user');
    if (preview) {
      _user = JSON.parse(preview);
      return true;
    }

    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return false;

    const profile = await _loadProfile(session.user.id);
    if (!profile) return false;

    _user = profile;
    return profile.status === 'active';
  }

  function getUser()    { return _user; }
  function isLoggedIn() { return !!_user; }

  // ── 로그아웃 ────────────────────────────────────────────────
  async function logout() {
    localStorage.removeItem('aj_user');
    await _sb.auth.signOut();
    _user = null;
    location.reload();
  }

  // ── Google OAuth ─────────────────────────────────────────────
  function renderGoogleBtn(containerId) {
    const btn = document.getElementById(containerId);
    if (!btn) return;
    btn.innerHTML = `
      <button onclick="Auth.signInWithGoogle()"
        style="display:flex;align-items:center;gap:10px;padding:10px 24px;
        border:1px solid #dadce0;border-radius:8px;background:#fff;
        font-size:14px;font-weight:500;color:#3c4043;cursor:pointer;width:100%;
        justify-content:center;transition:box-shadow .15s"
        onmouseover="this.style.boxShadow='0 1px 4px rgba(0,0,0,.2)'"
        onmouseout="this.style.boxShadow='none'">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/></svg>
        Google로 로그인
      </button>`;

    document.getElementById('btn-admin-login')?.addEventListener('click', adminLogin);
    document.getElementById('admin-pw-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') adminLogin();
    });

    // OAuth 콜백 처리 (페이지 로드 시 세션 확인)
    _sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !_user) {
        await _afterOAuth(session);
      }
    });
  }

  async function signInWithGoogle() {
    await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  // ── OAuth 완료 후 처리 ───────────────────────────────────────
  async function _afterOAuth(session) {
    const existing = await _loadProfile(session.user.id);
    if (existing) {
      _user = existing;
      if (existing.status === 'active') {
        App.showPage('home');
      } else if (existing.status === 'pending') {
        App.showPage('pending');
      } else {
        App.showPage('rejected');
      }
      return;
    }
    // 신규 사용자 — 역할 선택 모달
    _showRoleModal(session);
  }

  // ── 역할 선택 모달 ───────────────────────────────────────────
  function _showRoleModal(session) {
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
          <input id="inp-company" class="form-input" placeholder="소속 업체명"
            value="${localStorage.getItem('saved_company') || ''}">
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

    document.getElementById('sel-role').addEventListener('change', e => {
      const optAll  = document.getElementById('opt-all');
      const selSite = document.getElementById('sel-site');
      optAll.style.display = e.target.value === 'aj' ? '' : 'none';
      if (e.target.value === 'aj') selSite.value = 'ALL';
      else if (selSite.value === 'ALL') selSite.value = 'P4';
    });

    document.getElementById('btn-role-confirm').onclick = () => _submitProfile(session);
  }

  async function _submitProfile(session) {
    const role    = document.getElementById('sel-role').value;
    const siteId  = document.getElementById('sel-site').value;
    const phone   = document.getElementById('inp-phone').value;
    const company = document.getElementById('inp-company').value.trim();

    if (!role)    { Toast.error('역할을 선택해주세요.'); return; }
    if (!company) { Toast.error('업체명을 입력해주세요.'); return; }

    const btn = document.getElementById('btn-role-confirm');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    localStorage.setItem('saved_company', company);

    const needApproval = ['partner', 'as_tech'].includes(role);
    const { data, error } = await _sb.from('app_users').insert({
      id:        session.user.id,
      google_id: session.user.user_metadata?.provider_id || session.user.id,
      email:     session.user.email,
      name:      session.user.user_metadata?.full_name || session.user.email.split('@')[0],
      phone,
      role,
      site_id:   siteId,
      company,
      status:    needApproval ? 'pending' : 'active',
    }).select().single();

    if (error) {
      Toast.error('등록 중 오류가 발생했습니다.');
      btn.disabled = false;
      btn.textContent = '확인';
      return;
    }

    Modal.close();
    _user = data;

    if (data.status === 'pending') {
      App.showPage('pending');
    } else {
      App.showPage('home');
      Toast.success(`환영합니다, ${data.name}님!`);
      Notifications.requestPermission();
    }
  }

  // ── 관리자 ID/PW 로그인 (Supabase 이메일 인증) ───────────────
  async function adminLogin() {
    const adminId  = document.getElementById('admin-id-input')?.value.trim();
    const password = document.getElementById('admin-pw-input')?.value;

    if (!adminId || !password) {
      Toast.error('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    const btn = document.getElementById('btn-admin-login');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 로그인 중...';

    // app_users 테이블에서 local_id로 조회 후 비밀번호 확인
    const { data: userRow, error } = await _sb
      .from('app_users')
      .select('*')
      .eq('local_id', adminId)
      .single();

    if (error || !userRow) {
      Toast.error('아이디 또는 비밀번호가 올바르지 않습니다.');
      btn.disabled = false;
      btn.textContent = '관리자 로그인';
      return;
    }

    // bcrypt 검증은 서버에서만 가능 — Edge Function 호출
    const { data: result, error: fnErr } = await _sb.functions.invoke('verify-admin', {
      body: { local_id: adminId, password },
    });

    if (fnErr || !result?.ok) {
      Toast.error('아이디 또는 비밀번호가 올바르지 않습니다.');
      btn.disabled = false;
      btn.textContent = '관리자 로그인';
      return;
    }

    _user = userRow;
    // 세션 대신 localStorage에 임시 저장 (Edge Function에서 토큰 발급 시 교체 가능)
    localStorage.setItem('aj_user', JSON.stringify(userRow));
    App.showPage('home');
    Toast.success(`환영합니다, ${userRow.name}님!`);
    Notifications.requestPermission();
  }

  // ── 프로필 로드 ─────────────────────────────────────────────
  async function _loadProfile(supabaseUserId) {
    const { data } = await _sb
      .from('app_users')
      .select('*')
      .eq('id', supabaseUserId)
      .single();
    return data || null;
  }

  return { init, getUser, isLoggedIn, logout, renderGoogleBtn, signInWithGoogle, adminLogin };
})();
