/**
 * 앱 라우팅 및 초기화 모듈
 * 페이지 전환, 사이드바/하단 네비 상태 관리를 담당합니다.
 */
const App = (() => {
  const PAGES = ['home', 'transit', 'equipment', 'as-request', 'usage-log',
    'analytics-equipment', 'analytics-as', 'analytics-usage', 'admin', 'admin-settings', 'support'];

  const ACCESS = {
    tech:    ['home', 'as-request', 'usage-log', 'support'],
    partner: ['home', 'transit', 'equipment', 'as-request', 'usage-log', 'support'],
    pro:     ['home', 'transit', 'equipment', 'as-request', 'usage-log',
               'analytics-equipment', 'analytics-as', 'analytics-usage', 'support'],
    aj:      ['home', 'transit', 'equipment', 'as-request', 'usage-log',
               'analytics-equipment', 'analytics-as', 'analytics-usage',
               'admin', 'admin-settings', 'support'],
    as_tech: ['home', 'as-request', 'support'],
    admin:   ['home', 'transit', 'equipment', 'as-request', 'usage-log',
               'analytics-equipment', 'analytics-as', 'analytics-usage',
               'admin', 'admin-settings', 'support'],
  };

  // 더보기 시트 항목 정의
  const MORE_ITEMS = [
    { type: 'item',    page: 'as-request',          label: 'AS 요청',        abbr: 'AS',   bg: '#fef3c7' },
    { type: 'item',    page: 'equipment',           label: '장비 관리',      abbr: '장비', bg: '#dbeafe' },
    { type: 'section', label: '분석 리포트' },
    { type: 'item',    page: 'analytics-equipment', label: '장비 사용내역',  abbr: '장비', bg: '#ede9fe', sub: true },
    { type: 'item',    page: 'analytics-as',        label: 'AS 요청 분석',   abbr: 'AS',   bg: '#fef3c7', sub: true },
    { type: 'item',    page: 'analytics-usage',     label: '가동률 분석',    abbr: '가동', bg: '#d1fae5', sub: true },
    { type: 'divider' },
    { type: 'item',    page: 'admin',               label: '사용자 관리',    abbr: '관리', bg: '#fce7f3' },
    { type: 'item',    page: 'admin-settings',      label: '관리자설정',     abbr: '설정', bg: '#e0f2fe' },
    { type: 'item',    page: 'support',             label: '고객지원 게시판', abbr: '지원', bg: '#f0fdf4' },
  ];

  async function init() {
    // QR 파라미터가 있으면 OAuth 리다이렉트 전에 sessionStorage에 보존
    const qrParam = new URLSearchParams(window.location.search).get('qr');
    if (qrParam) {
      sessionStorage.setItem('pending_qr', qrParam);
      window.history.replaceState({}, '', window.location.pathname);
    }

    try {
      const loggedIn = await Auth.init();
      if (!loggedIn) { showPage('login'); return; }
      _buildLayout();
      _loadRolePerms();
      Notifications.loadNotifications();
      Notifications.subscribeRealtime();
      Storage.init();
      window.addEventListener('offline', () => Toast.error('오프라인 상태입니다.'));
      window.addEventListener('online',  () => Toast.success('인터넷에 연결되었습니다.'));

      // 보류 중인 QR 처리 (이미 로그인된 상태로 QR URL 진입 시)
      _handlePendingQr();
    } catch (e) {
      console.error('[App] init 오류:', e);
      showPage('login');
    }
  }

  function showPage(pageId, params = {}) {
    const user = Auth.getUser();

    if (pageId !== 'login' && pageId !== 'pending' && pageId !== 'rejected' && !user) {
      showPage('login'); return;
    }
    if (user && ACCESS[user.role] && !ACCESS[user.role].includes(pageId)
        && !['login','pending','rejected'].includes(pageId)) {
      Toast.error('접근 권한이 없습니다.'); return;
    }

    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');

    // 사이드바 active
    document.querySelectorAll('.sidebar-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });
    document.querySelectorAll('.sidebar-subitem').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });
    document.querySelectorAll('.bottom-nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });

    // 분석 아코디언 — 해당 페이지 진입 시 자동 펼치기
    const isAnalytics = pageId.startsWith('analytics');
    const parent  = document.getElementById('sidebar-analytics-parent');
    const submenu = document.getElementById('sidebar-analytics-submenu');
    if (parent && submenu && isAnalytics && !submenu.classList.contains('open')) {
      parent.classList.add('open');
      submenu.classList.add('open');
    }
    if (parent) parent.classList.toggle('open', isAnalytics || parent.classList.contains('open'));

    // 페이지 이동 시 이전 페이지 realtime 구독 해제
    Realtime.offPage();

    const renderers = {
      home:                  () => HomePage.render(),
      transit:               () => TransitPage.render(),
      equipment:             () => EquipmentPage.render(),
      'as-request':          () => AsRequestPage.render(),
      'usage-log':           () => UsageLogPage.render(),
      'analytics-equipment': () => AnalyticsEquipmentPage.render(),
      'analytics-as':        () => AnalyticsAsPage.render(),
      'analytics-usage':     () => AnalyticsUsagePage.render(),
      support:               () => SupportPage.render(),
      admin:                 () => AdminPage.render(),
      'admin-settings':      () => AdminSettingsPage.render(),
    };
    renderers[pageId]?.();
  }

  function _buildLayout() {
    const user = Auth.getUser();
    if (!user) return;

    document.getElementById('app-header').classList.remove('hidden');
    document.getElementById('header-site').textContent = user.site_id;
    document.getElementById('header-name').textContent = user.name;
    document.getElementById('app-layout').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    document.getElementById('fab-qr')?.classList.remove('hidden');

    _setSidebarAccess(user);
    _setBottomNavAccess(user);
  }

  function _setSidebarAccess(user) {
    document.querySelectorAll('.sidebar-item[data-page]').forEach(el => {
      const allowed = ACCESS[user.role]?.includes(el.dataset.page);
      el.classList.toggle('disabled', !allowed);
      if (!allowed) el.title = '접근 권한이 없습니다';
    });
    document.querySelectorAll('.sidebar-subitem').forEach(el => {
      el.classList.toggle('disabled', !ACCESS[user.role]?.includes(el.dataset.page));
    });
    // 분석 아코디언 부모 — 접근 불가 시 숨김
    const analyticsAllowed = ['analytics-equipment','analytics-as','analytics-usage']
      .some(p => ACCESS[user.role]?.includes(p));
    const parent  = document.getElementById('sidebar-analytics-parent');
    const submenu = document.getElementById('sidebar-analytics-submenu');
    if (parent)  parent.style.display  = analyticsAllowed ? '' : 'none';
    if (submenu) submenu.style.display = analyticsAllowed ? '' : 'none';

    // 관리자설정 사이드바 항목 — AJ·admin만 표시
    const settingsEl = document.querySelector('.sidebar-item[data-page="admin-settings"]');
    if (settingsEl) settingsEl.style.display = ['aj','admin'].includes(user.role) ? '' : 'none';
  }

  function _setBottomNavAccess(user) {
    document.querySelectorAll('.bottom-nav-item[data-page]').forEach(el => {
      el.classList.toggle('disabled', !ACCESS[user.role]?.includes(el.dataset.page));
    });
  }

  // ── 아코디언 토글 ────────────────────────────────────────
  function toggleAnalyticsMenu() {
    const parent  = document.getElementById('sidebar-analytics-parent');
    const submenu = document.getElementById('sidebar-analytics-submenu');
    const isOpen  = submenu.classList.contains('open');
    parent.classList.toggle('open', !isOpen);
    submenu.classList.toggle('open', !isOpen);
  }

  // ── 모바일 더보기 시트 ────────────────────────────────────
  function openMoreSheet() {
    const user  = Auth.getUser();
    const items = MORE_ITEMS.filter(it =>
      it.type !== 'item' || ACCESS[user.role]?.includes(it.page)
    );

    const cleaned = items.filter((it, i) => {
      if (it.type !== 'section' && it.type !== 'divider') return true;
      const next = items[i + 1];
      return next && next.type === 'item';
    });

    document.getElementById('sheet-items').innerHTML = cleaned.map(it => {
      if (it.type === 'section') {
        return `<div class="sheet-section">${it.label}</div>`;
      }
      if (it.type === 'divider') {
        return `<hr style="margin:6px 20px;border:none;border-top:1px solid var(--gray-100)">`;
      }
      return `
        <div class="sheet-item${it.sub ? ' sheet-item-sub' : ''}"
             onclick="App.showPage('${it.page}'); App.closeMoreSheet()">
          <div class="sheet-item-icon" style="background:${it.bg}">${it.abbr}</div>
          ${it.label}
        </div>`;
    }).join('');

    const backdrop = document.getElementById('sheet-backdrop');
    const sheet    = document.getElementById('more-sheet');
    backdrop.classList.add('open');
    sheet.classList.add('open');

    document.getElementById('btn-more')?.classList.add('active');
  }

  function closeMoreSheet() {
    document.getElementById('sheet-backdrop').classList.remove('open');
    document.getElementById('more-sheet').classList.remove('open');
    document.getElementById('btn-more')?.classList.remove('active');
  }

  // ── 알림 패널 ────────────────────────────────────────────
  function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    const isHidden = panel.classList.contains('hidden');

    if (isHidden) {
      panel.classList.remove('hidden');
      Notifications.loadNotifications();
      setTimeout(() => {
        document.addEventListener('click', _closeNotifOnOutside, { once: true, capture: true });
      }, 0);
    } else {
      _closeNotifPanel();
    }
  }

  function _closeNotifPanel() {
    document.getElementById('notif-panel')?.classList.add('hidden');
    document.removeEventListener('click', _closeNotifOnOutside, { capture: true });
  }

  function _closeNotifOnOutside(e) {
    const panel = document.getElementById('notif-panel');
    const btn   = document.querySelector('.notif-btn');
    if (panel && !panel.contains(e.target) && !btn?.contains(e.target)) {
      _closeNotifPanel();
    } else {
      setTimeout(() => {
        document.addEventListener('click', _closeNotifOnOutside, { once: true, capture: true });
      }, 0);
    }
  }

  /** sessionStorage에 보류 중인 QR이 있으면 액션 시트 표시, 없으면 홈 이동 */
  function _handlePendingQr() {
    const qr = sessionStorage.getItem('pending_qr');
    if (qr) {
      sessionStorage.removeItem('pending_qr');
      showPage('home');
      setTimeout(() => QrScanner.handleQrCode(qr), 400);
    } else {
      showPage('home');
    }
  }

  async function _loadRolePerms() {
    try {
      const { data } = await window._sb.from('role_permissions').select('role,menus');
      window._rolePerms = {};
      (data || []).forEach(r => { window._rolePerms[r.role] = r.menus; });
    } catch { window._rolePerms = {}; }
  }

  /** 로그인 완료 후 레이아웃 초기화 + 홈 이동 (QR URL 처리 포함) */
  function onLoginSuccess() {
    _buildLayout();
    _loadRolePerms();
    Notifications.loadNotifications();
    Notifications.subscribeRealtime();
    Storage.init();
    _handlePendingQr();
  }

  // ── 사용자 프로필 드롭다운 ──────────────────────────────────
  const ROLE_LABELS_MAP = { tech:'기술인', partner:'협력사 담당자', pro:'프로', aj:'AJ관리자', as_tech:'AS기사', admin:'관리자' };

  function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    if (!menu) return;
    const isOpen = menu.style.display !== 'none';
    if (isOpen) { menu.style.display = 'none'; return; }

    const user = Auth.getUser();
    const content = document.getElementById('user-menu-content');
    if (content && user) {
      content.innerHTML = `
        <div style="font-weight:700;font-size:15px;margin-bottom:4px">${user.name}</div>
        <div style="font-size:12px;color:#666;margin-bottom:2px">${user.email || ''}</div>
        ${user.company ? `<div style="font-size:12px;color:#666;margin-bottom:2px">소속: ${user.company}</div>` : ''}
        <div style="font-size:11px;color:#999;margin-top:4px;padding-top:4px;border-top:1px solid #f0f0f0">
          ${ROLE_LABELS_MAP[user.role] || user.role} · ${user.site_id || ''}
        </div>
      `;
    }
    menu.style.display = 'block';

    // 외부 클릭 시 닫기
    setTimeout(() => {
      document.addEventListener('click', _closeUserMenu, { once: true, capture: true });
    }, 0);
  }

  function _closeUserMenu(e) {
    const menu = document.getElementById('user-menu');
    const name = document.getElementById('header-name');
    if (menu && !menu.contains(e.target) && !name?.contains(e.target)) {
      menu.style.display = 'none';
    } else if (menu && menu.style.display !== 'none') {
      document.addEventListener('click', _closeUserMenu, { once: true, capture: true });
    }
  }

  return { init, showPage, onLoginSuccess, toggleAnalyticsMenu, openMoreSheet, closeMoreSheet, toggleNotifPanel, toggleUserMenu };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
