/**
 * 앱 라우팅 및 초기화 모듈
 * 페이지 전환, 사이드바/하단 네비 상태 관리를 담당합니다.
 */
const App = (() => {
  const PAGES = ['home', 'transit', 'equipment', 'as-request', 'usage-log',
    'analytics-equipment', 'analytics-as', 'analytics-usage', 'admin', 'admin-settings', 'support'];

  const ACCESS = {
    tech:    ['home', 'as-request', 'usage-log', 'support'],
    partner: ['home', 'transit', 'as-request', 'usage-log', 'support'],
    aj:      ['home', 'transit', 'equipment', 'as-request', 'usage-log',
               'analytics-equipment', 'analytics-as', 'analytics-usage',
               'admin', 'admin-settings', 'support'],
    as_tech: ['home', 'as-request', 'support'],
  };

  // 더보기 시트 항목 정의
  const MORE_ITEMS = [
    { type: 'item',    page: 'equipment',           label: '장비 관리',      abbr: '장비', bg: '#dbeafe' },
    { type: 'section', label: '분석 리포트' },
    { type: 'item',    page: 'analytics-equipment', label: '장비 사용내역',  abbr: '장비', bg: '#ede9fe', sub: true },
    { type: 'item',    page: 'analytics-as',        label: 'AS 요청 분석',   abbr: 'AS',   bg: '#fef3c7', sub: true },
    { type: 'item',    page: 'analytics-usage',     label: '사용 기록 분석', abbr: '사용', bg: '#d1fae5', sub: true },
    { type: 'divider' },
    { type: 'item',    page: 'admin',               label: '사용자 관리',    abbr: '관리', bg: '#fce7f3' },
    { type: 'item',    page: 'admin-settings',      label: '관리자설정',     abbr: '설정', bg: '#e0f2fe' },
    { type: 'item',    page: 'support',             label: '고객지원 게시판', abbr: '지원', bg: '#f0fdf4' },
  ];

  async function init() {
    try {
      const loggedIn = await Auth.init();
      if (!loggedIn) { showPage('login'); return; }
      _buildLayout();
      showPage('home');
      Notifications.loadNotifications();
      Notifications.subscribeRealtime();
      Storage.init();
      window.addEventListener('offline', () => Toast.error('오프라인 상태입니다.'));
      window.addEventListener('online',  () => Toast.success('인터넷에 연결되었습니다.'));
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

    // 관리자설정 사이드바 항목 — AJ만 표시
    const settingsEl = document.querySelector('.sidebar-item[data-page="admin-settings"]');
    if (settingsEl) settingsEl.style.display = user.role === 'aj' ? '' : 'none';
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

  /** 로그인 완료 후 레이아웃 초기화 + 홈 이동 (QR URL 처리 포함) */
  function onLoginSuccess() {
    _buildLayout();
    Notifications.loadNotifications();
    Notifications.subscribeRealtime();
    Storage.init();

    // URL에 ?qr= 파라미터가 있으면 액션 시트 표시, 없으면 홈 이동
    const qrParam = new URLSearchParams(window.location.search).get('qr');
    if (qrParam) {
      // URL 파라미터 제거 (히스토리 오염 방지)
      window.history.replaceState({}, '', window.location.pathname);
      showPage('home');
      setTimeout(() => QrScanner.handleQrCode(qrParam), 300);
    } else {
      showPage('home');
    }
  }

  return { init, showPage, onLoginSuccess, toggleAnalyticsMenu, openMoreSheet, closeMoreSheet, toggleNotifPanel };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
