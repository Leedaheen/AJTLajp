/**
 * 분석 리포트 — 3개 독립 대시보드
 * AnalyticsEquipmentPage : 장비 사용내역 분석
 * AnalyticsAsPage         : AS 요청 분석
 * AnalyticsUsagePage      : 사용 기록 분석
 */

// ── 공통 유틸 ────────────────────────────────────────────────
const _PALETTE = ['#1B365D','#E8192C','#3d82c8','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316'];
const _DAYS_SEL  = `<select id="an-days" class="form-input form-select" style="width:110px" onchange="__AN_FILTER()">
  <option value="7">최근 7일</option>
  <option value="30" selected>최근 30일</option>
  <option value="90">최근 90일</option>
</select>`;
const _SITE_SEL  = `<select id="an-site" class="form-input form-select" style="width:120px" onchange="__AN_FILTER()">
  <option value="">전체 현장</option>
  <option value="P4">P4 복합동</option>
  <option value="P5">P5 복합동</option>
</select>`;

function _anFilterVals() {
  return {
    days: Number(document.getElementById('an-days')?.value || 30),
    site: document.getElementById('an-site')?.value || '',
  };
}
function _anQs() {
  const {days, site} = _anFilterVals();
  return `days=${days}${site ? `&site_id=${site}` : ''}`;
}
function _destroyCharts(obj) {
  Object.values(obj).forEach(c => c?.destroy?.());
}
function _summaryCards(cards) {
  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
    ${cards.map(c => `
      <div class="card" style="text-align:center;padding:16px 12px">
        <div style="font-size:26px;font-weight:700;color:${c.color}">${c.value ?? '-'}<span style="font-size:13px;font-weight:400;margin-left:2px">${c.unit}</span></div>
        <div style="font-size:12px;color:var(--gray-500);margin-top:4px">${c.label}</div>
      </div>`).join('')}
  </div>`;
}


// ════════════════════════════════════════════════════════════
// 1. 장비 사용내역 분석
// ════════════════════════════════════════════════════════════
const AnalyticsEquipmentPage = (() => {
  let _charts = {};

  function render() {
    const user = Auth.getUser();
    if (user.role !== 'aj') {
      document.getElementById('page-analytics-equipment').innerHTML =
        `<div class="empty-state"><div>접근 권한이 없습니다.</div></div>`;
      return;
    }
    window.__AN_FILTER = onFilterChange;

    document.getElementById('page-analytics-equipment').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <h2 class="section-title" style="margin:0">장비 사용내역 분석</h2>
        <div style="display:flex;gap:8px">${_SITE_SEL}</div>
      </div>
      <div id="an-summary"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">상태별 장비 현황</div>
          <canvas id="chart-eq-status" height="220"></canvas>
        </div>
        <div class="card">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">제원별 보유 현황</div>
          <canvas id="chart-eq-spec" height="220"></canvas>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">현장별 배치 현황</div>
          <canvas id="chart-eq-site" height="200"></canvas>
        </div>
        <div class="card">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">업체별 보유 장비 수 (상위 10)</div>
          <canvas id="chart-eq-company" height="200"></canvas>
        </div>
      </div>
      <div class="card">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">최근 반입 장비</div>
        <div id="eq-recent-table"></div>
      </div>
    `;
    _loadData();
  }

  function onFilterChange() { _destroyCharts(_charts); _charts = {}; _loadData(); }

  async function _loadData() {
    const {site} = _anFilterVals();
    const qs = site ? `site_id=${site}` : '';
    const data = await Api.get(`/analytics/equipment${qs ? '?' + qs : ''}`);
    if (!data) return;

    const STATUS_LABEL = {stock:'재고', in_use:'사용중', transit:'이동중', returned:'반출완료'};

    document.getElementById('an-summary').innerHTML = _summaryCards([
      { label: '전체 장비',   value: data.total,                              unit: '대',  color: '#1B365D' },
      { label: '현재 사용중', value: data.by_status?.in_use  || 0,            unit: '대',  color: '#3d82c8' },
      { label: '재고',        value: data.by_status?.stock   || 0,            unit: '대',  color: '#10b981' },
      { label: '반출완료',    value: data.by_status?.returned || 0,           unit: '대',  color: '#94a3b8' },
    ]);

    // 상태별 도넛
    const stKeys = Object.keys(data.by_status);
    _charts.status = new Chart(document.getElementById('chart-eq-status'), {
      type: 'doughnut',
      data: {
        labels: stKeys.map(k => STATUS_LABEL[k] || k),
        datasets: [{ data: stKeys.map(k => data.by_status[k]), backgroundColor: _PALETTE }],
      },
      options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
    });

    // 제원별 바
    const spKeys = Object.keys(data.by_spec);
    _charts.spec = new Chart(document.getElementById('chart-eq-spec'), {
      type: 'bar',
      data: {
        labels: spKeys,
        datasets: [{ data: spKeys.map(k => data.by_spec[k]), backgroundColor: '#1B365D', borderRadius: 4 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });

    // 현장별 도넛
    const siKeys = Object.keys(data.by_site);
    _charts.site = new Chart(document.getElementById('chart-eq-site'), {
      type: 'doughnut',
      data: {
        labels: siKeys,
        datasets: [{ data: siKeys.map(k => data.by_site[k]), backgroundColor: _PALETTE }],
      },
      options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
    });

    // 업체별 수평 바
    const coKeys = Object.keys(data.by_company);
    _charts.company = new Chart(document.getElementById('chart-eq-company'), {
      type: 'bar',
      data: {
        labels: coKeys,
        datasets: [{ data: coKeys.map(k => data.by_company[k]), backgroundColor: '#3d82c8', borderRadius: 4 }],
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });

    // 최근 반입 테이블
    const STATUS_STYLE = { stock:'background:#d1fae5;color:#065f46', in_use:'background:#dbeafe;color:#1e40af', returned:'background:#f3f4f6;color:#374151', transit:'background:#fef3c7;color:#92400e' };
    document.getElementById('eq-recent-table').innerHTML = !data.recent?.length
      ? '<div class="empty-state" style="padding:20px"><div>데이터 없음</div></div>'
      : `<table class="data-table"><thead><tr><th>장비번호</th><th>제원</th><th>업체</th><th>반입일</th><th>상태</th></tr></thead><tbody>
          ${data.recent.map(r => `<tr>
            <td>${r.equip_no}</td><td>${r.spec || '-'}</td><td>${r.company || '-'}</td><td>${r.in_date || '-'}</td>
            <td><span class="badge" style="${STATUS_STYLE[r.status] || ''}">${STATUS_LABEL[r.status] || r.status}</span></td>
          </tr>`).join('')}
        </tbody></table>`;
  }

  return { render, onFilterChange };
})();


// ════════════════════════════════════════════════════════════
// 2. AS 요청 분석
// ════════════════════════════════════════════════════════════
const AnalyticsAsPage = (() => {
  let _charts = {};

  function render() {
    const user = Auth.getUser();
    if (user.role !== 'aj') {
      document.getElementById('page-analytics-as').innerHTML =
        `<div class="empty-state"><div>접근 권한이 없습니다.</div></div>`;
      return;
    }
    window.__AN_FILTER = onFilterChange;

    document.getElementById('page-analytics-as').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <h2 class="section-title" style="margin:0">AS 요청 분석</h2>
        <div style="display:flex;gap:8px">${_DAYS_SEL}${_SITE_SEL}</div>
      </div>
      <div id="an-summary"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">고장유형별 건수</div>
          <canvas id="chart-as-fault" height="220"></canvas>
        </div>
        <div class="card">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">처리상태별 건수</div>
          <canvas id="chart-as-status" height="220"></canvas>
        </div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">날짜별 AS 접수 추이</div>
        <canvas id="chart-as-trend" height="160"></canvas>
      </div>
      <div class="card">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">기사별 처리 건수</div>
        <canvas id="chart-as-tech" height="160"></canvas>
      </div>
    `;
    _loadData();
  }

  function onFilterChange() { _destroyCharts(_charts); _charts = {}; _loadData(); }

  async function _loadData() {
    const data = await Api.get(`/analytics/as?${_anQs()}`);
    if (!data) return;

    const STATUS_LABEL = { pending:'접수대기', assigned:'기사배정', in_progress:'처리중', resolved:'완료', cancelled:'취소' };

    document.getElementById('an-summary').innerHTML = _summaryCards([
      { label: '총 접수',       value: data.total,             unit: '건',  color: '#E8192C' },
      { label: '처리 완료',     value: data.resolved_count,    unit: '건',  color: '#10b981' },
      { label: '평균 처리시간', value: data.avg_elapsed_min,   unit: '분',  color: '#f59e0b' },
      { label: '미처리',
        value: (data.by_status?.pending||0) + (data.by_status?.assigned||0) + (data.by_status?.in_progress||0),
        unit: '건', color: '#E8192C' },
    ]);

    const faultKeys = Object.keys(data.by_fault);
    _charts.fault = new Chart(document.getElementById('chart-as-fault'), {
      type: 'doughnut',
      data: { labels: faultKeys, datasets: [{ data: faultKeys.map(k=>data.by_fault[k]), backgroundColor: _PALETTE }] },
      options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
    });

    const stKeys = Object.keys(data.by_status);
    _charts.status = new Chart(document.getElementById('chart-as-status'), {
      type: 'bar',
      data: {
        labels: stKeys.map(k => STATUS_LABEL[k] || k),
        datasets: [{ data: stKeys.map(k=>data.by_status[k]), backgroundColor: _PALETTE, borderRadius: 4 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });

    const dates = Object.keys(data.by_date);
    _charts.trend = new Chart(document.getElementById('chart-as-trend'), {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{ label: 'AS 접수', data: dates.map(d=>data.by_date[d]),
          borderColor: '#E8192C', backgroundColor: 'rgba(232,25,44,.08)', tension: .3, fill: true, pointRadius: 3 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { ticks: { maxTicksLimit: 10, font: { size: 10 } } } } },
    });

    const techKeys = Object.keys(data.by_tech);
    _charts.tech = new Chart(document.getElementById('chart-as-tech'), {
      type: 'bar',
      data: {
        labels: techKeys,
        datasets: [{ data: techKeys.map(k=>data.by_tech[k]), backgroundColor: '#1B365D', borderRadius: 4 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });
  }

  return { render, onFilterChange };
})();


// ════════════════════════════════════════════════════════════
// 3. 사용 기록 분석
// ════════════════════════════════════════════════════════════
const AnalyticsUsagePage = (() => {
  let _charts = {};

  function render() {
    const user = Auth.getUser();
    if (user.role !== 'aj') {
      document.getElementById('page-analytics-usage').innerHTML =
        `<div class="empty-state"><div>접근 권한이 없습니다.</div></div>`;
      return;
    }
    window.__AN_FILTER = onFilterChange;

    document.getElementById('page-analytics-usage').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <h2 class="section-title" style="margin:0">사용 기록 분석</h2>
        <div style="display:flex;gap:8px">${_DAYS_SEL}${_SITE_SEL}</div>
      </div>
      <div id="an-summary"></div>

      <div class="card" style="margin-bottom:16px">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">날짜별 총 가동시간 (h)</div>
        <canvas id="chart-us-trend" height="160"></canvas>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">제원별 가동시간 (h)</div>
          <canvas id="chart-us-spec" height="220"></canvas>
        </div>
        <div class="card">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">업체별 가동시간 (h, 상위 10)</div>
          <canvas id="chart-us-company" height="220"></canvas>
        </div>
      </div>
    `;
    _loadData();
  }

  function onFilterChange() { _destroyCharts(_charts); _charts = {}; _loadData(); }

  async function _loadData() {
    const data = await Api.get(`/analytics/usage?${_anQs()}`);
    if (!data) return;

    document.getElementById('an-summary').innerHTML = _summaryCards([
      { label: '총 가동시간',  value: data.total_hours,    unit: 'h',  color: '#1B365D' },
      { label: '총 사용 건수', value: data.total_records,  unit: '건', color: '#3d82c8' },
      { label: '현재 가동 중', value: data.active_now,     unit: '대', color: '#10b981' },
      { label: '일 평균 가동', value: data.total_records ? Math.round(data.total_hours / 30 * 10) / 10 : 0, unit: 'h', color: '#f59e0b' },
    ]);

    const dates = Object.keys(data.by_date);
    _charts.trend = new Chart(document.getElementById('chart-us-trend'), {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{ label: '가동시간(h)', data: dates.map(d=>data.by_date[d]),
          borderColor: '#1B365D', backgroundColor: 'rgba(27,54,93,.08)', tension: .3, fill: true, pointRadius: 3 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { ticks: { maxTicksLimit: 10, font: { size: 10 } } } } },
    });

    const spKeys = Object.keys(data.by_spec);
    _charts.spec = new Chart(document.getElementById('chart-us-spec'), {
      type: 'doughnut',
      data: { labels: spKeys, datasets: [{ data: spKeys.map(k=>data.by_spec[k]), backgroundColor: _PALETTE }] },
      options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
    });

    const coKeys = Object.keys(data.by_company).slice(0, 10);
    _charts.company = new Chart(document.getElementById('chart-us-company'), {
      type: 'bar',
      data: {
        labels: coKeys,
        datasets: [{ data: coKeys.map(k=>data.by_company[k]), backgroundColor: '#3d82c8', borderRadius: 4 }],
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
    });
  }

  return { render, onFilterChange };
})();
