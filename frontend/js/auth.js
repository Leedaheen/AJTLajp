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
      try {
        const parsed = JSON.parse(preview);
        if (parsed && parsed.id && parsed.role) {
          _user = parsed;
          return true;
        }
      } catch (_) {}
      localStorage.removeItem('aj_user');
    }

    let session = null;
    try {
      const { data, error } = await _sb.auth.getSession();
      if (error) { console.warn('[Auth] getSession error:', error.message); return false; }
      session = data.session;
    } catch (e) {
      console.warn('[Auth] getSession threw:', e.message);
      return false;
    }
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
        App.onLoginSuccess();
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
  async function _showRoleModal(session) {
    // 발주처·현장·업체 목록 동적 로드
    const [{ data: clients = [] }, { data: sites = [] }, { data: companies = [] }] = await Promise.all([
      window._sb.from('clients').select('id,name').eq('active', true).order('sort_order').order('name'),
      window._sb.from('sites').select('id,name').eq('active', true).order('name'),
      window._sb.from('companies').select('id,name').eq('active', true).order('name'),
    ]);
    const clientOpts  = clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const siteOpts    = sites.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    const companyOpts = companies.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    Modal.open({
      title: '역할 및 현장 선택',
      body: `
        <p class="text-sm text-muted" style="margin-bottom:16px">
          사용하실 역할과 담당 현장을 선택해주세요.<br>
          협력사·AS기사·프로는 AJ관리자 승인 후 이용 가능합니다.
        </p>
        <div class="form-group">
          <label class="form-label">역할 선택 <span style="color:var(--red)">*</span></label>
          <select id="sel-role" class="form-input form-select">
            <option value="">-- 역할을 선택하세요 --</option>
            <option value="tech">기술인 (현장 작업자)</option>
            <option value="partner">협력사 담당자</option>
            <option value="pro">프로 (열람 전용)</option>
            <option value="aj">AJ관리자</option>
            <option value="as_tech">AS기사 (고장 수리 담당자)</option>
            <option value="aj_center">AJ센터 (배차 담당)</option>
          </select>
        </div>
        <div id="grp-client" class="form-group" style="display:none">
          <label class="form-label">소속 <span style="color:var(--red)">*</span></label>
          <select id="sel-client" class="form-input form-select">
            <option value="">-- 소속 선택 --</option>
            ${clientOpts}
          </select>
        </div>
        <div id="grp-center" class="form-group" style="display:none">
          <label class="form-label">담당 센터 <span style="color:var(--red)">*</span></label>
          <select id="sel-center" class="form-input form-select">
            <option value="">-- 센터 선택 --</option>
            <option value="안성센터">안성센터</option>
            <option value="천안센터">천안센터</option>
            <option value="청주센터">청주센터</option>
            <option value="기타">기타</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">담당 현장 <span style="color:var(--red)">*</span></label>
          <select id="sel-site" class="form-input form-select">
            ${siteOpts}
            <option value="ALL" id="opt-all" style="display:none">전체 (AJ관리자)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">이름 <span style="color:var(--red)">*</span></label>
          <input id="inp-name" class="form-input" placeholder="실명을 입력해주세요"
            value="${session.user.user_metadata?.full_name || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">업체명 <span style="color:var(--red)">*</span></label>
          <select id="sel-company" class="form-input form-select">
            <option value="">-- 업체 선택 --</option>
            ${companyOpts}
          </select>
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
      const role      = e.target.value;
      const optAll    = document.getElementById('opt-all');
      const selSite   = document.getElementById('sel-site');
      const grpClient = document.getElementById('grp-client');
      const grpCenter = document.getElementById('grp-center');

      // 소속 선택: 협력사·기술인·프로에게만 표시
      grpClient.style.display = ['tech','partner','pro'].includes(role) ? '' : 'none';

      // 센터 선택: AJ센터만
      grpCenter.style.display = role === 'aj_center' ? '' : 'none';

      // 현장 ALL: AJ관리자·AJ센터
      optAll.style.display = ['aj','aj_center'].includes(role) ? '' : 'none';
      if (['aj','aj_center'].includes(role)) selSite.value = 'ALL';
      else if (selSite.value === 'ALL') selSite.value = sites[0]?.name || '';
    });

    document.getElementById('btn-role-confirm').onclick = () => _submitProfile(session);
  }

  async function _submitProfile(session) {
    const role    = document.getElementById('sel-role').value;
    const siteId  = document.getElementById('sel-site').value;
    const name    = document.getElementById('inp-name').value.trim();
    const phone   = document.getElementById('inp-phone').value;
    const company = document.getElementById('sel-company').value;
    const client  = ['tech','partner','pro'].includes(role)
      ? (document.getElementById('sel-client')?.value || '') : '';
    const center  = role === 'aj_center'
      ? (document.getElementById('sel-center')?.value || '') : '';

    if (!role)    { Toast.error('역할을 선택해주세요.'); return; }
    if (!name)    { Toast.error('이름을 입력해주세요.'); return; }
    if (!company) { Toast.error('업체명을 선택해주세요.'); return; }
    if (['tech','partner','pro'].includes(role) && !client) {
      Toast.error('소속을 선택해주세요.'); return;
    }
    if (role === 'aj_center' && !center) {
      Toast.error('담당 센터를 선택해주세요.'); return;
    }

    const btn = document.getElementById('btn-role-confirm');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const needApproval = ['partner', 'as_tech', 'pro', 'aj_center'].includes(role);
    const { data, error } = await _sb.from('app_users').insert({
      id:          session.user.id,
      google_id:   session.user.user_metadata?.provider_id || session.user.id,
      email:       session.user.email,
      name,
      phone,
      role,
      site_id:     siteId,
      company,
      client_name: client || '',
      center_name: center || null,
      status:      needApproval ? 'pending' : 'active',
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

    // 1단계: RPC로 local_id → email 매핑 및 비밀번호 검증
    const { data: rpcResult, error: rpcErr } = await _sb.rpc('verify_admin_login', {
      p_local_id: adminId,
      p_password: password,
    });

    if (rpcErr || !rpcResult?.ok) {
      Toast.error('아이디 또는 비밀번호가 올바르지 않습니다.');
      btn.disabled = false;
      btn.textContent = '관리자 로그인';
      return;
    }

    // 2단계: Supabase 실제 세션으로 로그인 (RLS 동작에 필요)
    const { data: authData, error: authErr } = await _sb.auth.signInWithPassword({
      email:    rpcResult.email,
      password: password,
    });

    if (authErr || !authData?.session) {
      Toast.error('로그인 처리 중 오류가 발생했습니다.');
      btn.disabled = false;
      btn.textContent = '관리자 로그인';
      return;
    }

    // 3단계: app_users 프로필 로드
    const profile = await _loadProfile(authData.user.id);
    if (!profile) {
      Toast.error('관리자 프로필을 찾을 수 없습니다.');
      btn.disabled = false;
      btn.textContent = '관리자 로그인';
      return;
    }

    _user = profile;
    localStorage.removeItem('aj_user');
    Toast.success(`환영합니다, ${profile.name}님!`);
    Notifications.requestPermission();
    App.onLoginSuccess();
  }

  // ── 프로필 로드 ─────────────────────────────────────────────
  async function _loadProfile(supabaseUserId) {
    const { data } = await _sb
      .from('app_users')
      .select('*')
      .eq('id', supabaseUserId)
      .maybeSingle();
    return data || null;
  }

  return { init, getUser, isLoggedIn, logout, renderGoogleBtn, signInWithGoogle, adminLogin };
})();
