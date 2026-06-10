/**
 * 앱 라우팅 및 초기화 모듈
 * 페이지 전환, 사이드바/하단 네비 상태 관리를 담당합니다.
 */
const App = (() => {
  const PAGES = ['home', 'transit', 'equipment', 'as-request', 'usage-log', 'analytics', 'admin'];

  // 역할별 접근 가능 페이지
  const ACCESS = {
    tech:    ['home', 'as-request', 'usage-log'],
    partner: ['home', 'transit', 'as-request', 'usage-log'],
    aj:      ['home', 'transit', 'equipment', 'as-request', 'usage-log', 'analytics', 'admin'],
    as_tech: ['home', 'as-request'],
  };

  function init() {
    const loggedIn = Auth.init();
    if (!loggedIn) {
      showPage('login');
      return;
    }
    _buildLayout();
    showPage('home');
    Notifications.loadNotifications();

    // 오프라인/온라인 감지
    window.addEventListener('offline', () => Toast.error('오프라인 상태입니다.'));
    window.addEventListener('online',  () => Toast.success('인터넷에 연결되었습니다.'));
  }

  function showPage(pageId, params = {}) {
    const user = Auth.getUser();

    // 비로그인 상태
    if (pageId !== 'login' && pageId !== 'pending' && pageId !== 'rejected' && !user) {
      showPage('login');
      return;
    }

    // 권한 체크
    if (user && ACCESS[user.role] && !ACCESS[user.role].includes(pageId)
        && !['login','pending','rejected'].includes(pageId)) {
      Toast.error('접근 권한이 없습니다.');
      return;
    }

    // 모든 페이지 숨기기
    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));

    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');

    // 사이드바 활성 상태 갱신
    document.querySelectorAll('.sidebar-item, .bottom-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });

    // 페이지별 렌더 함수 호출
    const renderers = {
      home:       () => HomePage.render(),
      transit:    () => TransitPage.render(),
      equipment:  () => EquipmentPage.render(),
      admin:      () => AdminPage.render(),
    };
    renderers[pageId]?.();
  }

  function _buildLayout() {
    const user = Auth.getUser();
    if (!user) return;

    const header = document.getElementById('app-header');
    header.classList.remove('hidden');
    document.getElementById('header-site').textContent = user.site_id;
    document.getElementById('header-name').textContent = user.name;

    const layout = document.getElementById('app-layout');
    layout.classList.remove('hidden');

    const nav = document.getElementById('bottom-nav');
    nav.classList.remove('hidden');

    _setSidebarAccess(user);
    _setBottomNavAccess(user);
  }

  function _setSidebarAccess(user) {
    document.querySelectorAll('.sidebar-item').forEach(el => {
      const page = el.dataset.page;
      const allowed = !page || ACCESS[user.role]?.includes(page);
      el.classList.toggle('disabled', !allowed);
      if (!allowed) el.title = '접근 권한이 없습니다';
    });
  }

  function _setBottomNavAccess(user) {
    document.querySelectorAll('.bottom-nav-item').forEach(el => {
      const page = el.dataset.page;
      const allowed = !page || ACCESS[user.role]?.includes(page);
      el.classList.toggle('disabled', !allowed);
    });
  }

  function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      Notifications.loadNotifications();
    }
  }

  return { init, showPage, toggleNotifPanel };
})();

// 앱 시작
document.addEventListener('DOMContentLoaded', () => App.init());
