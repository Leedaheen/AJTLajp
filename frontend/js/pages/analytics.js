/**
 * 분석 리포트 — 3개 독립 대시보드
 * AnalyticsEquipmentPage : 장비 사용내역 분석
 * AnalyticsAsPage         : AS 요청 분석
 * AnalyticsUsagePage      : 가동률 분석
 */

// ── 공통 유틸 ────────────────────────────────────────────────
const _PALETTE = ['#1B365D','#E8192C','#3d82c8','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316'];

function _makeSiteSel(onchange) {
  return `<select id="an-site" class="form-input form-select" style="width:120px" onchange="${onchange}">
    <option value="">전체 현장</option>
    <option value="P4">P4 복합동</option>
    <option value="P5">P5 복합동</option>
  </select>`;
}
function _makeDaysSel(onchange) {
  return `<select id="an-days" class="form-input form-select" style="width:110px" onchange="${onchange}">
    <option value="7">최근 7일</option>
    <option value="30" selected>최근 30일</option>
    <option value="90">최근 90일</option>
  </select>`;
}

function _anVals() {
  return {
    days: Number(document.getElementById('an-days')?.value || 30),
    site: document.getElementById('an-site')?.value || '',
  };
}
function _sinceDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
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
function _emptyChart(canvasId, msg = '데이터 없음') {
  const el = document.getElementById(canvasId);
  if (el) el.parentElement.insertAdjacentHTML('beforeend',
    `<div style="text-align:center;color:var(--gray-400);font-size:13px;padding:20px 0">${msg}</div>`);
}


// ════════════════════════════════════════════════════════════
// 1. 장비 사용내역 분석
// ════════════════════════════════════════════════════════════
const AnalyticsEquipmentPage = (() => {
  let _charts = {};

  function render() {
    const user = Auth.getUser();
    if (!['aj','admin'].includes(user.role)) {
      document.getElementById('page-analytics-equipment').innerHTML =
        `<div class="empty-state"><div>접근 권한이 없습니다.</div></div>`;
      return;
    }

    document.getElementById('page-analytics-equipment').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <h2 class="section-title" style="margin:0">장비 사용내역 분석</h2>
        <div style="display:flex;gap:8px">${_makeSiteSel('AnalyticsEquipmentPage.reload()')}</div>
      </div>
      <div id="an-eq-summary"></div>

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

  function reload() { _destroyCharts(_charts); _charts = {}; _loadData(); }

  async function _loadData() {
    const { site } = _anVals();

    let q = window._sb.from('equipment').select('*');
    if (site) q = q.eq('site_id', site);
    const { data: rows = [] } = await q;

    if (!rows.length) {
      document.getElementById('an-eq-summary').innerHTML =
        '<div class="empty-state" style="padding:20px"><div>장비 데이터 없음</div></div>';
      return;
    }

    const STATUS_LABEL = { stock:'재고', in_use:'사용중', transit:'이동중', returned:'반출완료' };
    const STATUS_STYLE = { stock:'background:#d1fae5;color:#065f46', in_use:'background:#dbeafe;color:#1e40af', returned:'background:#f3f4f6;color:#374151', transit:'background:#fef3c7;color:#92400e' };

    // 집계
    const byStatus = {}, bySpec = {}, bySite = {}, byCompany = {};
    rows.forEach(r => {
      const s = r.status || '?';
      byStatus[s] = (byStatus[s] || 0) + 1;
      const sp = r.spec || '미입력';
      bySpec[sp] = (bySpec[sp] || 0) + 1;
      const si = r.site_id || '미지정';
      bySite[si] = (bySite[si] || 0) + 1;
      const co = r.company || '미입력';
      byCompany[co] = (byCompany[co] || 0) + 1;
    });

    document.getElementById('an-eq-summary').innerHTML = _summaryCards([
      { label: '전체 장비',   value: rows.length,            unit: '대', color: '#1B365D' },
      { label: '현재 사용중', value: byStatus.in_use  || 0,  unit: '대', color: '#3d82c8' },
      { label: '재고',        value: byStatus.stock   || 0,  unit: '대', color: '#10b981' },
      { label: '반출완료',    value: byStatus.returned || 0, unit: '대', color: '#94a3b8' },
    ]);

    // 상태별 도넛
    const stKeys = Object.keys(byStatus);
    if (stKeys.length) {
      _charts.status = new Chart(document.getElementById('chart-eq-status'), {
        type: 'doughnut',
        data: { labels: stKeys.map(k => STATUS_LABEL[k] || k), datasets: [{ data: stKeys.map(k => byStatus[k]), backgroundColor: _PALETTE }] },
        options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
      });
    } else _emptyChart('chart-eq-status');

    // 제원별 바
    const spSorted = Object.entries(bySpec).sort((a, b) => b[1] - a[1]);
    if (spSorted.length) {
      _charts.spec = new Chart(document.getElementById('chart-eq-spec'), {
        type: 'bar',
        data: { labels: spSorted.map(([k]) => k), datasets: [{ data: spSorted.map(([, v]) => v), backgroundColor: _PALETTE, borderRadius: 4 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
      });
    } else _emptyChart('chart-eq-spec');

    // 현장별 도넛
    const siKeys = Object.keys(bySite);
    if (siKeys.length) {
      _charts.site = new Chart(document.getElementById('chart-eq-site'), {
        type: 'doughnut',
        data: { labels: siKeys, datasets: [{ data: siKeys.map(k => bySite[k]), backgroundColor: _PALETTE }] },
        options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
      });
    } else _emptyChart('chart-eq-site');

    // 업체별 수평 바 (상위 10)
    const coSorted = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (coSorted.length) {
      _charts.company = new Chart(document.getElementById('chart-eq-company'), {
        type: 'bar',
        data: { labels: coSorted.map(([k]) => k), datasets: [{ data: coSorted.map(([, v]) => v), backgroundColor: '#3d82c8', borderRadius: 4 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } },
      });
    } else _emptyChart('chart-eq-company');

    // 최근 반입 장비
    const recent = rows.filter(r => r.in_date).sort((a, b) => b.in_date.localeCompare(a.in_date)).slice(0, 10);
    document.getElementById('eq-recent-table').innerHTML = !recent.length
      ? '<div class="empty-state" style="padding:20px"><div>데이터 없음</div></div>'
      : `<table class="data-table"><thead><tr><th>장비번호</th><th>제원</th><th>업체</th><th>반입일</th><th>상태</th></tr></thead><tbody>
          ${recent.map(r => `<tr>
            <td>${r.equip_no || '-'}</td><td>${r.spec || '-'}</td><td>${r.company || '-'}</td><td>${r.in_date || '-'}</td>
            <td><span class="badge" style="${STATUS_STYLE[r.status] || ''}">${STATUS_LABEL[r.status] || r.status}</span></td>
          </tr>`).join('')}
        </tbody></table>`;
  }

  return { render, reload };
})();


// ════════════════════════════════════════════════════════════
// 2. AS 요청 분석
// ════════════════════════════════════════════════════════════
const AnalyticsAsPage = (() => {
  let _charts = {};

  function render() {
    const user = Auth.getUser();
    if (!['aj','admin'].includes(user.role)) {
      document.getElementById('page-analytics-as').innerHTML =
        `<div class="empty-state"><div>접근 권한이 없습니다.</div></div>`;
      return;
    }

    document.getElementById('page-analytics-as').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <h2 class="section-title" style="margin:0">AS 요청 분석</h2>
        <div style="display:flex;gap:8px">${_makeDaysSel('AnalyticsAsPage.reload()')}${_makeSiteSel('AnalyticsAsPage.reload()')}</div>
      </div>
      <div id="an-as-summary"></div>

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

  function reload() { _destroyCharts(_charts); _charts = {}; _loadData(); }

  async function _loadData() {
    const { days, site } = _anVals();
    const since = _sinceDate(days);

    let q = window._sb.from('as_requests').select('*').gte('requested_at', since).order('requested_at');
    if (site) q = q.eq('site_id', site);
    const { data: rows = [] } = await q;

    const STATUS_LABEL = { requested:'접수대기', in_progress:'처리중', material_pending:'자재수급', held:'보류', completed:'완료', cancelled:'취소' };

    // 집계
    const byFault = {}, byStatus = {}, byDate = {}, byTech = {};
    let resolvedCount = 0, elapsedTotal = 0;

    rows.forEach(r => {
      byFault[r.fault_type || '기타'] = (byFault[r.fault_type || '기타'] || 0) + 1;
      byStatus[r.status || '?'] = (byStatus[r.status || '?'] || 0) + 1;
      const d = (r.requested_at || '').slice(0, 10);
      if (d) byDate[d] = (byDate[d] || 0) + 1;
      const tech = r.tech_name || '미배정';
      byTech[tech] = (byTech[tech] || 0) + 1;
      if (r.status === 'completed' && r.elapsed_min) { resolvedCount++; elapsedTotal += r.elapsed_min; }
    });

    const pending = (byStatus.requested || 0) + (byStatus.in_progress || 0) + (byStatus.material_pending || 0);
    const avgElapsed = resolvedCount > 0 ? Math.round(elapsedTotal / resolvedCount) : 0;

    document.getElementById('an-as-summary').innerHTML = _summaryCards([
      { label: '총 접수',       value: rows.length,    unit: '건', color: '#E8192C' },
      { label: '처리 완료',     value: resolvedCount,  unit: '건', color: '#10b981' },
      { label: '평균 처리시간', value: avgElapsed,     unit: '분', color: '#f59e0b' },
      { label: '미처리',        value: pending,        unit: '건', color: '#E8192C' },
    ]);

    const fKeys = Object.entries(byFault).sort((a, b) => b[1] - a[1]);
    if (fKeys.length) {
      _charts.fault = new Chart(document.getElementById('chart-as-fault'), {
        type: 'doughnut',
        data: { labels: fKeys.map(([k]) => k), datasets: [{ data: fKeys.map(([, v]) => v), backgroundColor: _PALETTE }] },
        options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
      });
    } else _emptyChart('chart-as-fault');

    const stKeys = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
    if (stKeys.length) {
      _charts.status = new Chart(document.getElementById('chart-as-status'), {
        type: 'bar',
        data: { labels: stKeys.map(([k]) => STATUS_LABEL[k] || k), datasets: [{ data: stKeys.map(([, v]) => v), backgroundColor: _PALETTE, borderRadius: 4 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
      });
    } else _emptyChart('chart-as-status');

    const dates = Object.keys(byDate).sort();
    if (dates.length) {
      _charts.trend = new Chart(document.getElementById('chart-as-trend'), {
        type: 'line',
        data: { labels: dates, datasets: [{ label: 'AS 접수', data: dates.map(d => byDate[d]),
          borderColor: '#E8192C', backgroundColor: 'rgba(232,25,44,.08)', tension: .3, fill: true, pointRadius: 3 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { ticks: { maxTicksLimit: 12, font: { size: 10 } } } } },
      });
    } else _emptyChart('chart-as-trend');

    const techSorted = Object.entries(byTech).sort((a, b) => b[1] - a[1]);
    if (techSorted.length) {
      _charts.tech = new Chart(document.getElementById('chart-as-tech'), {
        type: 'bar',
        data: { labels: techSorted.map(([k]) => k), datasets: [{ data: techSorted.map(([, v]) => v), backgroundColor: '#1B365D', borderRadius: 4 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
      });
    } else _emptyChart('chart-as-tech');
  }

  return { render, reload };
})();


// ════════════════════════════════════════════════════════════
// 3. 가동률 분석
// ════════════════════════════════════════════════════════════
const AnalyticsUsagePage = (() => {
  let _charts = {};

  function render() {
    const user = Auth.getUser();
    if (!['aj','admin'].includes(user.role)) {
      document.getElementById('page-analytics-usage').innerHTML =
        `<div class="empty-state"><div>접근 권한이 없습니다.</div></div>`;
      return;
    }

    document.getElementById('page-analytics-usage').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <h2 class="section-title" style="margin:0">가동률 분석</h2>
        <div style="display:flex;gap:8px">${_makeDaysSel('AnalyticsUsagePage.reload()')}${_makeSiteSel('AnalyticsUsagePage.reload()')}</div>
      </div>
      <div id="an-us-summary"></div>

      <!-- 업체별 일별/월별 가동시간 -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="font-size:13px;font-weight:600;color:var(--gray-600)">업체별 가동시간 (h)</div>
          <div style="display:flex;gap:4px">
            <button id="btn-group-daily"  class="btn btn-primary btn-sm"  onclick="AnalyticsUsagePage.setGroup('daily')">일별</button>
            <button id="btn-group-monthly" class="btn btn-outline btn-sm" onclick="AnalyticsUsagePage.setGroup('monthly')">월별</button>
          </div>
        </div>
        <canvas id="chart-us-company" height="180"></canvas>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <!-- 제원별 가동시간 -->
        <div class="card">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">제원별 가동시간 (h)</div>
          <canvas id="chart-us-spec" height="240"></canvas>
        </div>
        <!-- 업체별 가동대수 / 총 보유대수 -->
        <div class="card">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--gray-600)">업체별 가동대수 / 총 보유대수 (%)</div>
          <canvas id="chart-us-utilization" height="240"></canvas>
        </div>
      </div>
    `;
    _loadData();
  }

  let _groupMode = 'daily';
  let _lastData = null;

  function setGroup(mode) {
    _groupMode = mode;
    document.getElementById('btn-group-daily').className  = `btn btn-sm ${mode === 'daily'   ? 'btn-primary' : 'btn-outline'}`;
    document.getElementById('btn-group-monthly').className = `btn btn-sm ${mode === 'monthly' ? 'btn-primary' : 'btn-outline'}`;
    if (_lastData) _drawCompanyChart(_lastData);
  }

  function reload() { _destroyCharts(_charts); _charts = {}; _loadData(); }

  function _drawCompanyChart({ logs, doneLogs }) {
    _charts.company?.destroy?.();
    const getPeriod = r => _groupMode === 'monthly' ? (r.date || '').slice(0, 7) : r.date;
    const allPeriods = [...new Set(doneLogs.map(getPeriod).filter(Boolean))].sort();
    const companies  = [...new Set(doneLogs.map(r => r.company || '미입력'))].slice(0, 8);

    const coMap = {};
    doneLogs.forEach(r => {
      const co = r.company || '미입력';
      const p  = getPeriod(r);
      if (!coMap[co]) coMap[co] = {};
      coMap[co][p] = (coMap[co][p] || 0) + Number(r.used_hours || 0);
    });

    if (!allPeriods.length) { _emptyChart('chart-us-company'); return; }

    _charts.company = new Chart(document.getElementById('chart-us-company'), {
      type: 'bar',
      data: {
        labels: allPeriods,
        datasets: companies.map((co, i) => ({
          label: co,
          data: allPeriods.map(p => Math.round((coMap[co]?.[p] || 0) * 10) / 10),
          backgroundColor: _PALETTE[i % _PALETTE.length],
          borderRadius: 2,
          stack: 'a',
        })),
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } },
        scales: {
          x: { stacked: true, ticks: { maxTicksLimit: 20, font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'h', font: { size: 11 } } },
        },
      },
    });
  }

  async function _loadData() {
    const { days, site } = _anVals();
    const since = _sinceDate(days);

    // usage_logs 조회
    let logQ = window._sb.from('usage_logs')
      .select('equip_no,company,date,used_hours,status,site_id')
      .gte('date', since);
    if (site) logQ = logQ.eq('site_id', site);
    const { data: logs = [] } = await logQ;

    const doneLogs   = logs.filter(r => r.status === 'done');
    const activeLogs = logs.filter(r => r.status === 'using');

    // equipment 조회 (spec 매핑 + 보유 집계)
    let eqQ = window._sb.from('equipment').select('equip_no,spec,company,status,site_id');
    if (site) eqQ = eqQ.eq('site_id', site);
    const { data: equips = [] } = await eqQ;

    const specByNo = {};
    equips.forEach(e => { if (e.equip_no) specByNo[e.equip_no] = e.spec || '미입력'; });

    // 요약 카드
    const totalHours = doneLogs.reduce((s, r) => s + Number(r.used_hours || 0), 0);
    const totalInUse = equips.filter(e => e.status === 'in_use').length;
    const usedEquips = new Set(doneLogs.map(r => r.equip_no).filter(Boolean));
    const utilRate   = totalInUse > 0 ? Math.round(usedEquips.size / totalInUse * 1000) / 10 : 0;

    document.getElementById('an-us-summary').innerHTML = _summaryCards([
      { label: '총 가동시간',  value: Math.round(totalHours * 10) / 10, unit: 'h',  color: '#1B365D' },
      { label: '기록 건수',    value: doneLogs.length,                  unit: '건', color: '#3d82c8' },
      { label: '현재 가동 중', value: activeLogs.length,                unit: '대', color: '#10b981' },
      { label: '기간 가동률',  value: utilRate,                         unit: '%',  color: '#f59e0b' },
    ]);

    _lastData = { logs, doneLogs };

    // Chart 1: 업체별 일별/월별 가동시간
    _drawCompanyChart({ logs, doneLogs });

    // Chart 2: 제원별 가동시간
    const bySpec = {};
    doneLogs.forEach(r => {
      const sp = specByNo[r.equip_no] || '미입력';
      bySpec[sp] = (bySpec[sp] || 0) + Number(r.used_hours || 0);
    });
    const specSorted = Object.entries(bySpec).sort((a, b) => b[1] - a[1]);

    if (specSorted.length) {
      _charts.spec = new Chart(document.getElementById('chart-us-spec'), {
        type: 'bar',
        data: {
          labels: specSorted.map(([k]) => k),
          datasets: [{ data: specSorted.map(([, v]) => Math.round(v * 10) / 10), backgroundColor: _PALETTE, borderRadius: 4 }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, title: { display: true, text: 'h', font: { size: 11 } } } },
        },
      });
    } else _emptyChart('chart-us-spec');

    // Chart 3: 업체별 가동대수 / 총 보유대수
    const usedByCompany = {};
    doneLogs.forEach(r => {
      const co = r.company || '미입력';
      if (!usedByCompany[co]) usedByCompany[co] = new Set();
      if (r.equip_no) usedByCompany[co].add(r.equip_no);
    });

    const totalByCompany = {};
    equips.filter(e => ['in_use','stock','transit'].includes(e.status)).forEach(e => {
      const co = e.company || '미입력';
      totalByCompany[co] = (totalByCompany[co] || 0) + 1;
    });

    const coList = [...new Set([...Object.keys(usedByCompany), ...Object.keys(totalByCompany)])]
      .sort((a, b) => (totalByCompany[b] || 0) - (totalByCompany[a] || 0))
      .slice(0, 10);

    if (coList.length) {
      const usedCounts  = coList.map(co => usedByCompany[co]?.size || 0);
      const totalCounts = coList.map(co => totalByCompany[co] || 0);

      _charts.utilization = new Chart(document.getElementById('chart-us-utilization'), {
        type: 'bar',
        data: {
          labels: coList,
          datasets: [
            { label: '가동 대수', data: usedCounts,  backgroundColor: '#3d82c8', borderRadius: 4 },
            { label: '총 보유 대수', data: totalCounts, backgroundColor: '#e2e8f0', borderRadius: 4 },
          ],
        },
        options: {
          indexAxis: 'y',
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const co = coList[ctx.dataIndex];
                  const used  = usedByCompany[co]?.size || 0;
                  const total = totalByCompany[co] || 0;
                  const pct   = total > 0 ? Math.round(used / total * 1000) / 10 : 0;
                  return ctx.datasetIndex === 0
                    ? `가동: ${used}대 (${pct}%)`
                    : `보유: ${total}대`;
                },
              },
            },
          },
          scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
        },
      });
    } else _emptyChart('chart-us-utilization');
  }

  return { render, reload, setGroup };
})();
