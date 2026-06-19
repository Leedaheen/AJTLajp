/**
 * 사용 기록 페이지
 * 가동 시작/종료는 QR 스캔을 통해서만 가능합니다.
 */
const UsageLogPage = (() => {
  const LS = 'usage_form_';

  function _saveField(key, val) { if (val) localStorage.setItem(LS + key, val); }
  function _load(key)           { return localStorage.getItem(LS + key) || ''; }

  // ── 렌더 ─────────────────────────────────────────────────
  async function render() {
    const user = Auth.getUser();
    const canStart = ['tech','partner','aj'].includes(user.role);
    const today = new Date().toISOString().slice(0, 10);

    // 현장/프로젝트 선택 옵션 로드
    const [{ data: sites = [] }, { data: projects = [] }] = await Promise.all([
      window._sb.from('sites').select('code,name').eq('active', true).order('name'),
      window._sb.from('projects').select('code,name').eq('active', true).order('name'),
    ]);

    const siteOptions = sites.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    const projOptions = projects.map(p => `<option value="${p.code}">${p.name}</option>`).join('');

    document.getElementById('page-usage-log').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h2 class="section-title" style="margin:0">장비 가동 내역</h2>
        ${canStart ? `
          <button class="btn btn-primary btn-sm" onclick="QrScanner.scanAndAct()" style="display:flex;align-items:center;gap:6px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <path d="M14 14h2v2h-2zm0 4h2v2h-2zm4-4h2v2h-2zm0 4h2v2h-2z"/>
            </svg>
            QR 스캔
          </button>
        ` : ''}
      </div>

      ${canStart ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style="font-size:13px;color:#1d4ed8">가동 시작·종료는 장비에 부착된 <strong>QR 코드 스캔</strong>으로만 기록됩니다.</span>
        </div>
      ` : ''}

      <!-- 요약 카드 -->
      <div id="usage-summary" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px"></div>

      <!-- 필터 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <input id="filter-date" type="date" class="form-input" value="${today}" style="width:160px">
        <select id="filter-site" class="form-input form-select" style="width:130px">
          <option value="">전체 현장</option>
          ${siteOptions}
        </select>
        <select id="filter-project" class="form-input form-select" style="width:140px">
          <option value="">전체 프로젝트</option>
          ${projOptions}
        </select>
        <input id="filter-equip" type="text" class="form-input" placeholder="장비번호 검색" style="width:150px">
        <button class="btn btn-primary btn-sm" onclick="UsageLogPage.loadList()">검색</button>
      </div>

      <!-- 가동 중 섹션 -->
      <div id="active-logs-section" style="margin-bottom:20px"></div>

      <!-- 전체 기록 -->
      <div class="card" style="overflow:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>장비번호</th>
              <th>현장</th>
              <th>업체</th>
              <th>층/위치</th>
              <th>기록자</th>
              <th>시작</th>
              <th>종료</th>
              <th>사용시간</th>
              <th>상태</th>
              ${canStart ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody id="log-tbody">
            <tr><td colspan="11" class="text-center">
              <span class="spinner" style="display:block;margin:16px auto"></span>
            </td></tr>
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('filter-date').addEventListener('change', () => { loadSummary(); loadList(); });
    document.getElementById('filter-site').addEventListener('change', () => { loadSummary(); loadList(); });
    document.getElementById('filter-project').addEventListener('change', () => { loadSummary(); loadList(); });
    document.getElementById('filter-equip').addEventListener('keydown', e => {
      if (e.key === 'Enter') loadList();
    });

    await Promise.all([loadSummary(), loadList()]);
    Realtime.on('usage-logs', 'usage_logs', loadList);
  }

  // ── 요약 ─────────────────────────────────────────────────
  async function loadSummary() {
    const date      = document.getElementById('filter-date')?.value || new Date().toISOString().slice(0,10);
    const siteId    = document.getElementById('filter-site')?.value || '';
    const projectId = document.getElementById('filter-project')?.value || '';
    const params = new URLSearchParams({ date });
    if (siteId)    params.set('site_id', siteId);
    if (projectId) params.set('project', projectId);

    try {
      const s = await Api.get(`/usage-logs/summary?${params}`);
      document.getElementById('usage-summary').innerHTML = `
        <div class="card" style="text-align:center;padding:16px">
          <div style="font-size:12px;color:var(--gray-400);margin-bottom:4px">총 사용 대수</div>
          <div style="font-size:28px;font-weight:700;color:var(--navy)">${s.total_in_use ?? 0}<span style="font-size:14px;margin-left:2px">대</span></div>
        </div>
        <div class="card" style="text-align:center;padding:16px">
          <div style="font-size:12px;color:var(--gray-400);margin-bottom:4px">일일 기록 건수</div>
          <div style="font-size:28px;font-weight:700;color:var(--navy)">${s.record_count}<span style="font-size:14px;margin-left:2px">건</span></div>
        </div>
        <div class="card" style="text-align:center;padding:16px">
          <div style="font-size:12px;color:var(--gray-400);margin-bottom:4px">전체 가동률</div>
          <div style="font-size:28px;font-weight:700;color:var(--navy)">${s.utilization ?? 0}<span style="font-size:14px;margin-left:2px">%</span></div>
        </div>
      `;
    } catch {
      document.getElementById('usage-summary').innerHTML = '';
    }
  }

  // ── 목록 ─────────────────────────────────────────────────
  async function loadList() {
    const date      = document.getElementById('filter-date')?.value || '';
    const siteId    = document.getElementById('filter-site')?.value || '';
    const projectId = document.getElementById('filter-project')?.value || '';
    const equip     = document.getElementById('filter-equip')?.value.trim() || '';

    const tbody = document.getElementById('log-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="11" class="text-center"><span class="spinner" style="display:block;margin:16px auto"></span></td></tr>';

    // 프로젝트 필터 시 해당 프로젝트 장비번호 목록을 먼저 조회
    let projectEquipNos = null;
    if (projectId) {
      const { data: eqs = [] } = await window._sb.from('equipment').select('equip_no').eq('project', projectId);
      projectEquipNos = eqs.map(e => e.equip_no).filter(Boolean);
    }

    const params = new URLSearchParams({ limit: 200 });
    if (date)   params.set('date', date);
    if (siteId) params.set('site_id', siteId);
    if (equip)  params.set('equip', equip);

    try {
      let list = await Api.get(`/usage-logs?${params}`);
      // 프로젝트 필터 클라이언트 적용
      if (projectEquipNos !== null) {
        list = list.filter(r => projectEquipNos.includes(r.equip_no));
      }
      const user = Auth.getUser();
      const canStart = ['tech','partner','aj'].includes(user.role);

      const myId = user.id;
      const myName = user.name;
      const active = list.filter(r =>
        r.status === 'using' &&
        (r.recorder_id === myId || r.recorder === myName)
      );
      _renderActiveSection(active, canStart);

      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted" style="padding:24px">기록이 없습니다</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(r => {
        const startStr = r.start_time ? new Date(r.start_time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '-';
        const endStr   = r.end_time   ? new Date(r.end_time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '-';
        return `
          <tr style="${r.status==='using'?'background:#f0f9ff':''}">
            <td class="text-sm">${r.date || '-'}</td>
            <td><strong>${r.equip_no || '-'}</strong></td>
            <td class="text-sm">${r.site_name || r.site_id || '-'}</td>
            <td class="text-sm">${r.company || '-'}</td>
            <td class="text-sm">${r.floor || '-'}</td>
            <td class="text-sm">${r.recorder || '-'}</td>
            <td class="text-sm">${startStr}</td>
            <td class="text-sm">${endStr}</td>
            <td style="font-weight:600;color:var(--navy)">
              ${r.status === 'using' ? '<span class="badge badge-active">가동중</span>' : `${r.used_hours || 0}h`}
            </td>
            <td>
              ${r.status === 'using'
                ? '<span class="badge badge-active">가동중</span>'
                : '<span class="badge" style="background:#f3f4f6;color:#374151">완료</span>'
              }
            </td>
            ${canStart ? `
              <td>
                ${r.status === 'using'
                  ? `<button class="btn btn-danger btn-sm" onclick="UsageLogPage.openEndForm(${r.id},'${r.equip_no}')">종료</button>`
                  : ''
                }
              </td>
            ` : '<td></td>'}
          </tr>
        `;
      }).join('');

      loadSummary();
    } catch {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">불러오기 실패</td></tr>';
    }
  }

  function _renderActiveSection(active, canStart) {
    const el = document.getElementById('active-logs-section');
    if (!el || !active.length) { if (el) el.innerHTML = ''; return; }

    el.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:8px">
        현재 가동 중 (${active.length}대)
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        ${active.map(r => {
          const startStr = r.start_time
            ? new Date(r.start_time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})
            : '-';
          return `
            <div class="card" style="padding:12px 16px;min-width:200px;border-left:3px solid var(--navy)">
              <div style="font-weight:700;font-size:14px;color:var(--navy)">${r.equip_no}</div>
              <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${r.site_name || r.site_id} · ${r.floor || '-'}</div>
              <div style="font-size:12px;margin-top:4px">시작: <strong>${startStr}</strong> · ${r.recorder}</div>
              ${canStart ? `
                <button class="btn btn-danger btn-sm" style="margin-top:8px;width:100%"
                  onclick="UsageLogPage.openEndForm(${r.id},'${r.equip_no}')">가동 종료</button>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ── 가동 시작 폼 (QR 스캔 후 호출) ──────────────────────
  // equip: equipment 오브젝트 (qr-scanner에서 전달)
  function openStartForm(equip) {
    const siteName  = equip?.site_name || (equip?.site_id === 'P4' ? 'P4 복합동' : equip?.site_id === 'P5' ? 'P5 복합동' : '');
    const floor     = equip?.floor || '';
    const company   = equip?.company || Auth.getUser()?.company || '';
    const roStyle   = 'background:var(--gray-50,#f9fafb);color:var(--gray-500);cursor:default';

    Modal.open({
      title: '가동 시작',
      body: `
        <!-- QR 스캔으로 식별된 장비 정보 -->
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px">
          <div style="font-weight:700;color:var(--navy);font-size:15px">${equip?.equip_no || '-'}</div>
          <div style="color:var(--gray-500);margin-top:2px">${equip?.spec || ''}${equip?.spec && siteName ? ' · ' : ''}${siteName}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">층/위치</label>
            <input id="sl-floor" class="form-input" value="${floor}" readonly style="${roStyle}">
          </div>
          <div class="form-group">
            <label class="form-label">팀명</label>
            <input id="sl-team" class="form-input" placeholder="예: 1팀" value="${_load('team')}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">기록자 <span style="color:var(--red)">*</span></label>
          <input id="sl-recorder" class="form-input" readonly style="${roStyle}"
            value="${Auth.getUser()?.name || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">업체명</label>
          <input id="sl-company" class="form-input" value="${company}" readonly style="${roStyle}">
        </div>
        <div style="font-size:12px;color:var(--gray-400);margin-top:4px">
          시작 시각은 지금 시각으로 자동 기록됩니다.
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-do-start">가동 시작</button>
      `,
    });

    document.getElementById('btn-do-start').onclick = async () => {
      const floorVal   = document.getElementById('sl-floor').value.trim();
      const recorder   = document.getElementById('sl-recorder').value.trim();
      const companyVal = document.getElementById('sl-company').value.trim();
      const team       = document.getElementById('sl-team').value.trim();

      if (!recorder) {
        Toast.error('기록자 정보가 없습니다. 다시 로그인해주세요.'); return;
      }

      _saveField('team', team);

      const btn = document.getElementById('btn-do-start');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

      try {
        await Api.post('/usage-logs/start', {
          site_id:     equip?.site_id || 'P4',
          company:     companyVal,
          equip_no:    equip?.equip_no || '',
          equip_id:    equip?.id || null,
          team_name:   team,
          floor:       floorVal,
          recorder,
          recorder_id: Auth.getUser()?.id,
          start_time:  new Date().toISOString(),
          date:        new Date().toISOString().slice(0, 10),
          status:      'using',
        });
        Modal.close();
        Toast.success(`${equip?.equip_no} 가동이 시작되었습니다.`);
        // 사용기록 페이지가 열려 있으면 갱신
        if (!document.getElementById('page-usage-log')?.classList.contains('hidden')) {
          loadList();
        }
      } catch {
        btn.disabled = false; btn.textContent = '가동 시작';
      }
    };
  }

  // ── 가동 종료 폼 ─────────────────────────────────────────
  function openEndForm(logId, equipNo) {
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    Modal.open({
      title: `가동 종료 — ${equipNo}`,
      body: `
        <div class="form-group">
          <label class="form-label">종료 시각</label>
          <input id="el-end-time" type="time" class="form-input" value="${nowTime}" readonly
            style="background:var(--gray-50,#f9fafb);color:var(--gray-400);cursor:default">
        </div>
        <div class="form-group">
          <label class="form-label">종료 사유</label>
          <select id="el-off-reason" class="form-input form-select">
            <option value="정상 종료">정상 종료</option>
            <option value="점심 휴식">점심 휴식</option>
            <option value="중간 휴식">중간 휴식</option>
            <option value="퇴근">퇴근</option>
            <option value="AS 대기">AS 대기</option>
            <option value="기타">기타</option>
          </select>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-danger btn-sm" id="btn-do-end">가동 종료</button>
      `,
    });

    document.getElementById('btn-do-end').onclick = async () => {
      const endTime = document.getElementById('el-end-time').value;
      if (!endTime) { Toast.error('종료 시각을 입력해주세요.'); return; }

      const btn = document.getElementById('btn-do-end');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

      try {
        const res = await Api.patch(`/usage-logs/${logId}/end`, {
          end_time:   endTime,
          off_reason: document.getElementById('el-off-reason').value,
        });
        Modal.close();
        Toast.success(`가동 종료 완료 · 사용시간 ${res.used_hours}h`);
        if (!document.getElementById('page-usage-log')?.classList.contains('hidden')) {
          loadList();
        }
      } catch { btn.disabled = false; btn.textContent = '가동 종료'; }
    };
  }

  return { render, loadList, loadSummary, openStartForm, openEndForm };
})();
