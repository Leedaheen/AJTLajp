/**
 * 배차 관리 페이지
 * AJ관리자 전용 — 반입/반출 확정 건의 배차 정보 관리
 */
const DispatchPage = (() => {
  const _sb = window._sb;

  let _tab       = 'pending';   // pending | done | all
  let _cache     = [];
  let _drivers   = [];
  let _notes     = {};          // { client_name: [note, ...] }

  // ── 날짜 포맷 유틸
  function _fmt(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d)) return '-';
    const h = d.getHours();
    return `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')} ${h<12?'오전':'오후'} ${String(h%12||12).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  // ── 영업일 D-1 체크 (오늘 기준 다음 영업일이 scheduled_date인 경우)
  function _isDMinus1(dateStr) {
    if (!dateStr) return false;
    const target = new Date(dateStr);
    const now    = new Date();
    now.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    // 다음 영업일 계산
    const next = new Date(now);
    do { next.setDate(next.getDate()+1); } while (next.getDay()===0 || next.getDay()===6);
    return next.getTime() === target.getTime();
  }

  // ── render
  function render() {
    const el = document.getElementById('page-dispatch');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <div>
          <h1 class="page-title" style="margin:0">배차 관리</h1>
          <p class="page-subtitle" style="margin:4px 0 0;font-size:13px;color:var(--gray-500)">반입/반출 확정 건의 배차 정보를 관리합니다</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="DispatchPage.openNotesModal()">발주처 특이사항</button>
          <button class="btn btn-outline btn-sm" onclick="DispatchPage.openDriversModal()">기사 DB</button>
          <button class="btn btn-primary btn-sm" onclick="DispatchPage.openManualModal()">+ 배차 수동 등록</button>
        </div>
      </div>
      <div id="dispatch-body"><div class="text-center" style="padding:40px 0;color:var(--gray-400)">로딩 중...</div></div>
    `;
    loadList();
  }

  async function loadList() {
    // 1) drivers 캐시
    const { data: drv } = await _sb.from('drivers').select('*').order('name');
    _drivers = drv || [];

    // 2) 발주처 특이사항 캐시
    const { data: noteRows } = await _sb.from('client_notes').select('*');
    _notes = {};
    (noteRows || []).forEach(n => {
      if (!_notes[n.client_name]) _notes[n.client_name] = [];
      _notes[n.client_name].push(n.content);
    });

    // 3) transit 확정 건 + dispatch 조인
    const { data: rows, error } = await _sb
      .from('transit')
      .select('*, dispatch(*)')
      .in('status', ['confirmed','scheduled','completed'])
      .order('scheduled_date', { ascending: true });

    if (error) { console.error(error); return; }

    const clientFilter = App.getClientFilter();
    _cache = (rows || []).filter(r => !clientFilter || r.client_name === clientFilter);

    _renderBody();
  }

  function _renderBody() {
    const d1Items   = _cache.filter(r => !r.dispatch?.length && _isDMinus1(r.scheduled_date));
    const pending   = _cache.filter(r => !r.dispatch?.length);
    const done      = _cache.filter(r =>  r.dispatch?.length);

    const list = _tab === 'pending' ? pending
               : _tab === 'done'    ? done
               : _cache;

    const pendingCnt = pending.length;
    const d1Count    = d1Items.length;

    const el = document.getElementById('dispatch-body');
    if (!el) return;

    const alert = d1Count
      ? `<div style="background:#FFFBEB;border:0.5px solid #FCD34D;border-radius:8px;padding:9px 12px;
          font-size:12px;color:#92400E;display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <i class="ti ti-bell-ringing" style="font-size:15px;flex-shrink:0"></i>
          오늘 배차 신청 필요 — ${d1Items.map(r=>`<strong>${r.company} ${r.type==='in'?'반입':'반출'}(${r.scheduled_date})</strong>`).join(', ')} (영업일 D-1)
        </div>` : '';

    el.innerHTML = `
      ${alert}
      <div style="display:flex;gap:0;border-bottom:1px solid var(--gray-200);margin-bottom:12px">
        ${[['pending','배차 대기',pendingCnt],['done','배차 완료',done.length],['all','전체',_cache.length]].map(([t,lbl,cnt])=>`
          <div onclick="DispatchPage.setTab('${t}')"
            style="padding:8px 14px;font-size:12px;font-weight:500;cursor:pointer;
              border-bottom:2px solid ${_tab===t?'#1B365D':'transparent'};
              color:${_tab===t?'#1B365D':'var(--gray-500)'};margin-bottom:-1px">
            ${lbl}${cnt?' <span style="background:'+(_tab===t?'#E8192C':'var(--gray-300)')+';color:#fff;border-radius:10px;font-size:10px;padding:1px 6px;font-weight:700">'+cnt+'</span>':''}
          </div>`).join('')}
      </div>
      ${list.length === 0
        ? `<div class="text-center" style="padding:40px 0;color:var(--gray-400)">항목이 없습니다</div>`
        : list.map(_renderCard).join('')}
    `;
  }

  function _renderCard(t) {
    const disp = t.dispatch?.[0];
    const hasDisp = !!disp;
    const urgent  = !hasDisp && _isDMinus1(t.scheduled_date);
    const typeLabel = t.type === 'in' ? '반입' : '반출';
    const clientNote = (_notes[t.client_name] || []).join(' · ');

    const statusBadge = hasDisp
      ? `<span style="background:#D1FAE5;color:#065F46;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500">배차 완료</span>
         <span style="background:#EAF3DE;color:#3B6D11;font-size:10px;padding:1px 6px;border-radius:10px">반입/반출 자동반영</span>`
      : `<span style="background:#FEF3C7;color:#92400E;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500">배차 대기</span>
         ${urgent ? `<span style="background:#FCEBEB;color:#A32D2D;font-size:10px;padding:1px 7px;border-radius:10px">D-1 오늘 신청 필요</span>` : ''}`;

    const noteHtml = clientNote
      ? `<div style="background:#FFFBEB;border:0.5px solid #FCD34D;border-radius:7px;padding:8px 11px;
            font-size:11px;color:#92400E;display:flex;gap:7px;align-items:flex-start;line-height:1.6;margin-top:8px">
          <i class="ti ti-alert-triangle" style="font-size:14px;flex-shrink:0;margin-top:1px"></i>
          <div><strong>${t.client_name} 특이사항:</strong> ${clientNote}</div>
        </div>` : '';

    const dispInfo = hasDisp ? `
      <div style="display:grid;grid-template-columns:76px 1fr;gap:3px 10px;font-size:12px;margin-top:8px">
        ${disp.od_number ? `<span style="color:var(--gray-500)">O/D번호</span><span style="font-weight:500;font-family:monospace;font-size:11px">${disp.od_number}</span>` : ''}
        <span style="color:var(--gray-500)">기사</span><span style="font-weight:500">${disp.driver_name} <a href="tel:${disp.driver_phone}" style="color:#1B365D;font-weight:400">${disp.driver_phone}</a></span>
        <span style="color:var(--gray-500)">차량</span><span>${disp.vehicle_plate}</span>
        ${disp.arrival_time ? `<span style="color:var(--gray-500)">도착예정</span><span>${disp.arrival_time}</span>` : ''}
        ${disp.center     ? `<span style="color:var(--gray-500)">센터</span><span>${disp.center}</span>` : ''}
        ${disp.note       ? `<span style="color:var(--gray-500)">비고</span><span style="color:var(--gray-500)">${disp.note}</span>` : ''}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-outline btn-sm" onclick="DispatchPage.openDispatchModal(${t.id})">수정</button>
      </div>` : `
      <div style="display:flex;gap:8px;margin-top:8px">
        <div style="flex:1;background:var(--gray-100);border:0.5px solid var(--gray-200);border-radius:8px;
          padding:7px 11px;font-size:13px;color:var(--gray-400);cursor:pointer"
          onclick="DispatchPage.openDispatchModal(${t.id})">
          차량번호 검색 또는 직접 입력...
        </div>
        <button class="btn btn-primary btn-sm" onclick="DispatchPage.openDispatchModal(${t.id})">배차 입력</button>
      </div>`;

    return `
      <div class="card" style="margin-bottom:10px;${urgent?'border:1.5px solid #FCA5A5;':''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:4px">
              ${statusBadge}
              <span style="font-size:11px;color:var(--gray-400)">${typeLabel} · 확정일 ${t.scheduled_date||'-'}</span>
            </div>
            <div style="font-size:14px;font-weight:700;color:#1B365D">${t.company} · ${t.site_name||''}</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:2px">
              ${t.client_name||''}${t.reporter_name?' · '+t.reporter_name:''} ${t.reporter_phone?`<a href="tel:${t.reporter_phone}" style="color:#1B365D">${t.reporter_phone}</a>`:''}
            </div>
          </div>
          <div style="font-size:11px;color:var(--gray-400);text-align:right;flex-shrink:0;line-height:1.7">
            ${t.record_id||''}${disp?.od_number?'<br>'+disp.od_number:''}
          </div>
        </div>
        ${noteHtml}
        ${dispInfo}
      </div>`;
  }

  function setTab(tab) {
    _tab = tab;
    _renderBody();
  }

  // ── 배차 입력/수정 모달
  async function openDispatchModal(transitId) {
    const t = _cache.find(r => r.id === transitId);
    if (!t) return;
    const disp = t.dispatch?.[0] || {};
    const clientNote = (_notes[t.client_name] || []).join(' · ');

    const driverChips = _drivers.slice(0,5).map(d =>
      `<div class="chip" onclick="DispatchPage._fillDriver('${d.plate}','${d.name}','${d.phone}')"
        style="display:inline-flex;align-items:center;gap:4px;background:var(--gray-100);
        border:0.5px solid var(--gray-200);border-radius:6px;padding:3px 9px;
        font-size:11px;color:var(--gray-600);cursor:pointer;margin:2px">
        ${d.plate} · ${d.name}
      </div>`).join('');

    Modal.open({
      title: '배차 정보 입력',
      body: `
        <div style="font-size:12px;color:var(--gray-500);margin-bottom:6px">
          ${t.company} · ${t.site_name} ${t.type==='in'?'반입':'반출'} · 확정일 ${t.scheduled_date||'-'} · ${t.record_id||''}
        </div>
        ${clientNote ? `
        <div style="background:#FFFBEB;border:0.5px solid #FCD34D;border-radius:7px;padding:8px 11px;
          font-size:11px;color:#92400E;display:flex;gap:7px;margin-bottom:12px;line-height:1.6">
          <i class="ti ti-alert-triangle" style="font-size:14px;flex-shrink:0;margin-top:1px"></i>
          <div><strong>${t.client_name} 특이사항</strong> — ${clientNote}</div>
        </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label class="form-label">O/D번호</label>
            <input id="d-od" class="form-input" value="${disp.od_number||''}" placeholder="OD260606278">
          </div>
          <div>
            <label class="form-label">도착 예정시간</label>
            <input id="d-arrival" class="form-input" value="${disp.arrival_time||''}" placeholder="09:00">
          </div>
          <div>
            <label class="form-label">차량번호 <span style="color:#E8192C">*</span></label>
            <input id="d-plate" class="form-input" value="${disp.vehicle_plate||''}" placeholder="경기88자1330"
              oninput="DispatchPage._autoFillDriver(this.value)">
            <div style="margin-top:4px">${driverChips}</div>
          </div>
          <div>
            <label class="form-label">기사 성함 <span style="color:#E8192C">*</span></label>
            <input id="d-name" class="form-input" value="${disp.driver_name||''}" placeholder="홍길동">
          </div>
          <div>
            <label class="form-label">기사 연락처</label>
            <input id="d-phone" class="form-input" value="${disp.driver_phone||''}" placeholder="010-0000-0000">
          </div>
          <div>
            <label class="form-label">센터</label>
            <input id="d-center" class="form-input" value="${disp.center||''}" placeholder="안성센터">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">비고 (표찰·등록 여부 등)</label>
          <input id="d-note" class="form-input" value="${disp.note||''}" placeholder="예) 표찰O 등록O / 출발 전 연락 요망">
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" onclick="DispatchPage._saveDispatch(${transitId},${disp.id||'null'})">저장 · 반입/반출 자동반영</button>
      `,
    });
  }

  function _autoFillDriver(plate) {
    const found = _drivers.find(d => d.plate === plate.trim());
    if (!found) return;
    const n = document.getElementById('d-name');
    const p = document.getElementById('d-phone');
    if (n && !n.value) n.value = found.name;
    if (p && !p.value) p.value = found.phone;
  }

  function _fillDriver(plate, name, phone) {
    const dp = document.getElementById('d-plate');
    const dn = document.getElementById('d-name');
    const dph = document.getElementById('d-phone');
    if (dp) dp.value = plate;
    if (dn) dn.value = name;
    if (dph) dph.value = phone;
  }

  async function _saveDispatch(transitId, dispatchId) {
    const plate = document.getElementById('d-plate')?.value?.trim();
    const name  = document.getElementById('d-name')?.value?.trim();
    if (!plate || !name) { Toast.error('차량번호와 기사 성함은 필수입니다.'); return; }

    const payload = {
      transit_id:    transitId,
      od_number:     document.getElementById('d-od')?.value?.trim() || null,
      arrival_time:  document.getElementById('d-arrival')?.value?.trim() || null,
      vehicle_plate: plate,
      driver_name:   name,
      driver_phone:  document.getElementById('d-phone')?.value?.trim() || null,
      center:        document.getElementById('d-center')?.value?.trim() || null,
      note:          document.getElementById('d-note')?.value?.trim() || null,
    };

    let error;
    if (dispatchId) {
      ({ error } = await _sb.from('dispatch').update(payload).eq('id', dispatchId));
    } else {
      ({ error } = await _sb.from('dispatch').insert(payload));
      // transit에 배차 정보 동기화 (반입/반출 카드에서도 표시)
      await _sb.from('transit').update({
        vehicle_info: `${plate} · ${name}`,
        driver_info:  `${name} ${payload.driver_phone||''}`.trim(),
      }).eq('id', transitId);
    }

    if (error) { Toast.error('저장 오류: ' + (error.message||'')); return; }

    // 기사 DB에 없으면 자동 추가
    const exists = _drivers.find(d => d.plate === plate);
    if (!exists && name && payload.driver_phone) {
      await _sb.from('drivers').insert({ plate, name, phone: payload.driver_phone });
    }

    Modal.close();
    Toast.success('배차 정보가 저장되었습니다.');
    loadList();
  }

  // ── 수동 등록 모달
  function openManualModal() {
    Toast.info('반입/반출 관리에서 확정된 건만 배차 입력이 가능합니다.');
  }

  // ── 발주처 특이사항 모달
  async function openNotesModal() {
    const { data } = await _sb.from('client_notes').select('*').order('client_name');
    const rows = data || [];

    Modal.open({
      title: '발주처 특이사항',
      body: `
        <div style="display:flex;flex-direction:column;gap:8px" id="notes-list">
          ${rows.length === 0
            ? '<div style="text-align:center;padding:20px;color:var(--gray-400)">등록된 특이사항이 없습니다</div>'
            : rows.map(n => `
              <div style="border:0.5px solid var(--gray-200);border-radius:8px;padding:10px 12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <span style="font-size:13px;font-weight:600;color:#1B365D">${n.client_name}</span>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-outline btn-sm" onclick="DispatchPage.editNote(${n.id},'${n.client_name.replace(/'/g,"\\'")}','${n.content.replace(/'/g,"\\'")}')">수정</button>
                    <button class="btn btn-sm" style="background:#FCEBEB;color:#A32D2D;border:none"
                      onclick="DispatchPage.deleteNote(${n.id})">삭제</button>
                  </div>
                </div>
                <div style="font-size:12px;color:var(--gray-700);line-height:1.7">${n.content}</div>
              </div>`).join('')}
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:0.5px solid var(--gray-200)">
          <div style="font-size:12px;font-weight:500;color:var(--gray-700);margin-bottom:6px">새 특이사항 추가</div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <input id="note-client" class="form-input" style="flex:0 0 120px" placeholder="발주처명">
            <input id="note-content" class="form-input" placeholder="특이사항 내용">
          </div>
          <button class="btn btn-primary btn-sm" onclick="DispatchPage._addNote()">추가</button>
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>`,
    });
  }

  async function _addNote() {
    const client  = document.getElementById('note-client')?.value?.trim();
    const content = document.getElementById('note-content')?.value?.trim();
    if (!client || !content) { Toast.error('발주처명과 내용을 입력해주세요.'); return; }
    const { error } = await _sb.from('client_notes').insert({ client_name: client, content });
    if (error) { Toast.error('저장 오류'); return; }
    Toast.success('추가되었습니다.');
    Modal.close();
    openNotesModal();
  }

  async function editNote(id, client, content) {
    Modal.close();
    setTimeout(async () => {
      const newContent = prompt(`${client} 특이사항 수정:`, content);
      if (newContent === null) return;
      await _sb.from('client_notes').update({ content: newContent }).eq('id', id);
      Toast.success('수정되었습니다.');
      openNotesModal();
    }, 200);
  }

  async function deleteNote(id) {
    if (!confirm('이 특이사항을 삭제하시겠습니까?')) return;
    await _sb.from('client_notes').delete().eq('id', id);
    Toast.success('삭제되었습니다.');
    openNotesModal();
  }

  // ── 기사 DB 모달
  async function openDriversModal() {
    const { data } = await _sb.from('drivers').select('*').order('name');
    const rows = data || [];
    Modal.open({
      title: '배송기사 DB',
      body: `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:12px">
          ${rows.map(d => `
            <div style="border:0.5px solid var(--gray-200);border-radius:8px;padding:10px 12px;
              display:flex;align-items:center;justify-content:space-between;gap:8px">
              <div>
                <div style="font-size:13px;font-weight:500">${d.name}</div>
                <div style="font-size:11px;color:var(--gray-500);font-family:monospace">${d.plate} · ${d.phone||'-'}</div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="DispatchPage._deleteDriver(${d.id})">삭제</button>
            </div>`).join('') || '<div style="color:var(--gray-400);font-size:12px">등록된 기사가 없습니다</div>'}
        </div>
        <div style="border-top:0.5px solid var(--gray-200);padding-top:12px">
          <div style="font-size:12px;font-weight:500;margin-bottom:6px">기사 등록</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
            <input id="drv-plate" class="form-input" placeholder="차량번호">
            <input id="drv-name"  class="form-input" placeholder="기사명">
            <input id="drv-phone" class="form-input" placeholder="연락처">
          </div>
          <button class="btn btn-primary btn-sm" onclick="DispatchPage._addDriver()">등록</button>
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>`,
    });
  }

  async function _addDriver() {
    const plate = document.getElementById('drv-plate')?.value?.trim();
    const name  = document.getElementById('drv-name')?.value?.trim();
    const phone = document.getElementById('drv-phone')?.value?.trim();
    if (!plate || !name) { Toast.error('차량번호와 기사명은 필수입니다.'); return; }
    const { error } = await _sb.from('drivers').insert({ plate, name, phone });
    if (error) { Toast.error('저장 오류'); return; }
    Toast.success('등록되었습니다.');
    Modal.close();
    openDriversModal();
  }

  async function _deleteDriver(id) {
    if (!confirm('이 기사를 삭제하시겠습니까?')) return;
    await _sb.from('drivers').delete().eq('id', id);
    Toast.success('삭제되었습니다.');
    Modal.close();
    openDriversModal();
  }

  return {
    render, loadList, setTab,
    openDispatchModal, openNotesModal, openDriversModal, openManualModal,
    editNote, deleteNote,
    _autoFillDriver, _fillDriver, _saveDispatch,
    _addNote, _addDriver, _deleteDriver,
  };
})();
