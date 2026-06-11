/**
 * 홈 대시보드 페이지
 * 반입반출 일정 / 장비 가동 현황 / AS 처리 현황을 3열로 표시합니다.
 * 권한 없는 역할의 이동 버튼은 비활성화됩니다.
 */
const HomePage = (() => {
  const ROLE_TRANSIT_ACCESS = ['partner', 'aj'];   // 반입반출 접근 가능
  const ROLE_EQUIP_ACCESS   = ['aj'];              // 장비 현황 접근 가능
  const ROLE_AS_ACCESS      = ['aj', 'as_tech', 'tech', 'partner']; // AS 접근 가능

  async function render() {
    const user = Auth.getUser();
    const el   = document.getElementById('page-home');
    el.innerHTML = `
      <h2 class="section-title">운영 현황 대시보드</h2>
      <div class="dashboard-grid">

        <!-- 반입반출 일정 -->
        <div class="card dashboard-card">
          <div class="dash-card-header">
            <span class="dash-label">반입/반출 일정</span>
          </div>
          <div id="dash-transit" class="dash-content">
            <div class="spinner" style="margin:20px auto;display:block"></div>
          </div>
          <button
            class="btn btn-primary btn-full btn-sm mt-2 dash-goto"
            id="btn-goto-transit"
            onclick="App.showPage('transit')"
            ${!ROLE_TRANSIT_ACCESS.includes(user.role) ? 'disabled title="접근 권한이 없습니다"' : ''}
          >
            ${!ROLE_TRANSIT_ACCESS.includes(user.role) ? '접근 권한 없음' : '바로가기 →'}
          </button>
        </div>

        <!-- 장비 가동 현황 -->
        <div class="card dashboard-card">
          <div class="dash-card-header">
            <span class="dash-label">장비 가동 현황</span>
          </div>
          <div id="dash-equip" class="dash-content">
            <div class="spinner" style="margin:20px auto;display:block"></div>
          </div>
          <button
            class="btn btn-primary btn-full btn-sm mt-2 dash-goto"
            id="btn-goto-equip"
            onclick="App.showPage('equipment')"
            ${!ROLE_EQUIP_ACCESS.includes(user.role) ? 'disabled title="접근 권한이 없습니다"' : ''}
          >
            ${!ROLE_EQUIP_ACCESS.includes(user.role) ? '접근 권한 없음' : '바로가기 →'}
          </button>
        </div>

        <!-- AS 처리 현황 -->
        <div class="card dashboard-card">
          <div class="dash-card-header">
            <span class="dash-label">AS 처리 현황</span>
          </div>
          <div id="dash-as" class="dash-content">
            <div class="spinner" style="margin:20px auto;display:block"></div>
          </div>
          <button
            class="btn btn-primary btn-full btn-sm mt-2 dash-goto"
            onclick="App.showPage('as-request')"
          >
            바로가기 →
          </button>
        </div>

      </div>
    `;

    _loadDashData();
  }

  async function _loadDashData() {
    await Promise.allSettled([
      _loadTransitSummary(),
      _loadEquipSummary(),
      _loadAsSummary(),
    ]);
  }

  async function _loadTransitSummary() {
    try {
      const data = await Api.get('/transit?limit=5', { silent: true });
      const scheduled  = data.filter(d => d.status === 'scheduled').length;
      const completed  = data.filter(d => d.status === 'completed').length;
      const requested  = data.filter(d => d.status === 'requested').length;

      document.getElementById('dash-transit').innerHTML = `
        <div class="dash-stat-row">
          <span class="dash-stat-label">신규 신청</span>
          <span class="dash-stat-value ${requested > 0 ? 'text-red' : ''}">${requested}건</span>
        </div>
        <div class="dash-stat-row">
          <span class="dash-stat-label">일정 확정</span>
          <span class="dash-stat-value">${scheduled}건</span>
        </div>
        <div class="dash-stat-row">
          <span class="dash-stat-label">오늘 완료</span>
          <span class="dash-stat-value">${completed}건</span>
        </div>
      `;
    } catch {
      document.getElementById('dash-transit').innerHTML = '<div class="text-muted text-sm text-center">불러오기 실패</div>';
    }
  }

  async function _loadEquipSummary() {
    try {
      const data = await Api.get('/equipment?status=in_use', { silent: true });
      const p4 = data.filter(e => e.site_id === 'P4').length;
      const p5 = data.filter(e => e.site_id === 'P5').length;

      document.getElementById('dash-equip').innerHTML = `
        <div class="dash-stat-row">
          <span class="dash-stat-label">P4 복합동 가동</span>
          <span class="dash-stat-value">${p4}대</span>
        </div>
        <div class="dash-stat-row">
          <span class="dash-stat-label">P5 복합동 가동</span>
          <span class="dash-stat-value">${p5}대</span>
        </div>
        <div class="dash-stat-row">
          <span class="dash-stat-label">전체 가동</span>
          <span class="dash-stat-value" style="font-size:18px;font-weight:700;color:var(--navy)">${p4+p5}대</span>
        </div>
      `;
    } catch {
      document.getElementById('dash-equip').innerHTML = '<div class="text-muted text-sm text-center">불러오기 실패</div>';
    }
  }

  async function _loadAsSummary() {
    try {
      const data = await Api.get('/as-requests?limit=100', { silent: true });
      const requested = data.filter(d => d.status === 'requested').length;
      const inProg    = data.filter(d => d.status === 'in_progress').length;
      const material  = data.filter(d => d.status === 'material_pending').length;

      document.getElementById('dash-as').innerHTML = `
        <div class="dash-stat-row">
          <span class="dash-stat-label">신규 요청</span>
          <span class="dash-stat-value ${requested > 0 ? 'text-red' : ''}">${requested}건</span>
        </div>
        <div class="dash-stat-row">
          <span class="dash-stat-label">처리 중</span>
          <span class="dash-stat-value">${inProg}건</span>
        </div>
        <div class="dash-stat-row">
          <span class="dash-stat-label">자재 수급 중</span>
          <span class="dash-stat-value">${material}건</span>
        </div>
      `;
    } catch {
      document.getElementById('dash-as').innerHTML = '<div class="text-muted text-sm text-center">불러오기 실패</div>';
    }
  }

  return { render };
})();
