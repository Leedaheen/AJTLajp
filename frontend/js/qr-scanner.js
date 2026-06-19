/**
 * QR 스캐너 모듈
 * jsQR 라이브러리로 카메라에서 QR 코드를 인식하고
 * 장비 조회 → 사용 시작/종료/AS 요청 액션 메뉴를 표시합니다.
 */
const QrScanner = (() => {
  let _video       = null;
  let _canvas      = null;
  let _ctx         = null;
  let _stream      = null;
  let _animId      = null;
  let _callback    = null;
  let _scanning    = false;
  let _currentEquip = null;

  // ── 스캔 시작 (콜백 방식) ────────────────────────────────
  function scan(callback) {
    _callback = callback;
    _openScanModal();
  }

  // ── 스캔 후 자동 액션 (메인 진입점) ─────────────────────
  function scanAndAct() {
    scan(async (qrData) => {
      const qrCode = _extractQrCode(qrData);
      await handleQrCode(qrCode);
    });
  }

  // URL 또는 순수 코드 문자열에서 qr_code 식별자 추출
  // 예: "https://app.com/?qr=AJ-GK111" → "AJ-GK111"
  // 예: "AJ-GK111" → "AJ-GK111"
  function _extractQrCode(raw) {
    try {
      const url = new URL(raw);
      const param = url.searchParams.get('qr');
      if (param) return param;
    } catch {}
    return raw;
  }

  // QR 코드 식별자로 장비 조회 후 액션 시트 표시 (외부에서도 호출 가능)
  async function handleQrCode(qrCode) {
    try {
      const equip = await Api.get(`/equipment/qr/${encodeURIComponent(qrCode)}`);
      if (!equip) {
        // 반출 완료로 QR이 삭제된 장비인지 확인
        if (qrCode.startsWith('AJ-')) {
          const equipNo = qrCode.slice(3);
          const { data: returned } = await _sb.from('equipment')
            .select('equip_no,site_name,out_date')
            .eq('equip_no', equipNo)
            .eq('status', 'returned')
            .maybeSingle();
          if (returned) {
            Toast.error(`반출된 장비입니다. (${returned.equip_no}${returned.out_date ? ' · ' + returned.out_date : ''})`);
            return;
          }
        }
        Toast.error('등록되지 않은 QR코드입니다.');
        return;
      }
      // 반출 예정 여부 확인
      let pendingOut = false;
      try {
        const { data: outTransit } = await _sb.from('transit')
          .select('id')
          .eq('type', 'out')
          .in('status', ['requested', 'scheduled', 'confirmed'])
          .ilike('aj_equip', `%${equip.equip_no}%`)
          .limit(1);
        pendingOut = !!(outTransit && outTransit.length);
      } catch {}
      _showActionSheet(equip, pendingOut);
    } catch {
      Toast.error('장비 정보를 불러올 수 없습니다.');
    }
  }

  // ── 스캔 모달 ────────────────────────────────────────────
  function _openScanModal() {
    Modal.open({
      title: 'QR 코드 스캔',
      body: `
        <div id="qr-scan-wrap" style="position:relative;background:#000;border-radius:10px;overflow:hidden;aspect-ratio:1;max-height:340px">
          <video id="qr-video" autoplay playsinline muted
            style="width:100%;height:100%;object-fit:cover;display:block"></video>
          <canvas id="qr-canvas" style="display:none"></canvas>
          <!-- 스캔 가이드 오버레이 -->
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
            <div style="
              width:55%;aspect-ratio:1;
              border:2.5px solid rgba(255,255,255,0.85);
              border-radius:14px;
              box-shadow:0 0 0 9999px rgba(0,0,0,0.45)">
            </div>
          </div>
          <div id="qr-scan-status" style="
            position:absolute;bottom:0;left:0;right:0;
            background:rgba(0,0,0,0.55);
            color:#fff;font-size:13px;text-align:center;
            padding:8px;">
            카메라 초기화 중...
          </div>
        </div>
        <p class="text-sm text-muted" style="text-align:center;margin-top:10px">
          장비에 부착된 QR코드를 화면 중앙 박스에 맞춰주세요.
        </p>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="QrScanner.stop();Modal.close()">취소</button>
      `,
    });
    setTimeout(_startCamera, 150);
  }

  async function _startCamera() {
    _video  = document.getElementById('qr-video');
    _canvas = document.getElementById('qr-canvas');
    _ctx    = _canvas?.getContext('2d', { willReadFrequently: true });
    const statusEl = document.getElementById('qr-scan-status');

    if (!_video || !_ctx) return;

    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      _video.srcObject = _stream;
      await _video.play();
      _scanning = true;
      if (statusEl) statusEl.textContent = 'QR 코드를 인식하는 중...';
      _animId = requestAnimationFrame(_tick);
    } catch (e) {
      if (statusEl) statusEl.textContent = '카메라 접근 권한이 필요합니다.';
      Toast.error('카메라 접근 권한이 필요합니다. 브라우저 설정을 확인해주세요.');
    }
  }

  function _tick() {
    if (!_scanning || !_video) return;

    if (_video.readyState < _video.HAVE_ENOUGH_DATA) {
      _animId = requestAnimationFrame(_tick);
      return;
    }

    _canvas.width  = _video.videoWidth;
    _canvas.height = _video.videoHeight;
    _ctx.drawImage(_video, 0, 0, _canvas.width, _canvas.height);

    try {
      const imgData = _ctx.getImageData(0, 0, _canvas.width, _canvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code?.data) {
        stop();
        Modal.close();
        setTimeout(() => _callback?.(code.data), 100);
        return;
      }
    } catch (_) {}

    _animId = requestAnimationFrame(_tick);
  }

  function stop() {
    _scanning = false;
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
    if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
    _video = null; _canvas = null; _ctx = null;
  }

  const _STATUS_LABEL = {
    in_use:   { text: '사용중',   style: 'background:#dbeafe;color:#1e40af' },
    transit:  { text: '반입예정', style: 'background:#fef3c7;color:#92400e' },
    returned: { text: '반출완료', style: 'background:#f3f4f6;color:#374151' },
    stock:    { text: '재고',     style: 'background:#dcfce7;color:#166534' },
  };

  // ── 스캔 결과 액션 시트 ──────────────────────────────────
  async function _showActionSheet(equip, pendingOut = false) {
    const user    = Auth.getUser();
    const canUse  = ['tech', 'partner', 'aj'].includes(user.role);
    const canAs   = ['tech', 'partner', 'aj', 'as_tech'].includes(user.role);

    // 모델이 있으면 제원표 조회
    let specData = null;
    if (equip.model) {
      const { data } = await _sb.from('equipment_specs')
        .select('*').eq('model', equip.model).maybeSingle();
      specData = data;
    }

    const modelLine = equip.model
      ? `<div style="font-size:12px;color:var(--gray-500);margin-top:3px;font-family:monospace">${equip.model}${equip.serial_no ? ' · ' + equip.serial_no : ''}</div>`
      : '';

    const statusInfo = _STATUS_LABEL[equip.status] || { text: equip.status, style: 'background:#f3f4f6;color:#374151' };

    Modal.open({
      title: '장비 확인',
      body: `
        <div style="background:var(--gray-100);padding:14px 16px;border-radius:10px;margin-bottom:18px">
          <div style="font-size:20px;font-weight:700;color:var(--navy);letter-spacing:0.5px">${equip.equip_no}</div>
          <div style="font-size:13px;color:var(--gray-500);margin-top:4px">
            ${equip.spec ? equip.spec + ' · ' : ''}${equip.site_name || equip.site_id || ''}${equip.company ? ' · ' + equip.company : ''}
          </div>
          ${modelLine}
          ${equip.project ? `<div style="font-size:12px;color:var(--gray-400);margin-top:2px">${equip.project}</div>` : ''}
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <span class="badge" style="${statusInfo.style}">${statusInfo.text}</span>
            ${pendingOut ? `<span class="badge" style="background:#fce7f3;color:#9d174d">반출예정</span>` : ''}
          </div>
          ${pendingOut ? `<div style="margin-top:8px;font-size:12px;color:#9d174d;font-weight:600">반출예정인 장비입니다.</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${canUse ? `
            <button class="btn btn-primary"
              style="font-size:15px;padding:13px;justify-content:center"
              id="qr-action-start">
              사용 시작
            </button>
            <button class="btn btn-outline"
              style="font-size:15px;padding:13px;justify-content:center"
              id="qr-action-end">
              사용 종료
            </button>
          ` : ''}
          ${canAs ? `
            <button class="btn btn-outline"
              style="font-size:15px;padding:13px;justify-content:center;border-color:var(--red);color:var(--red)"
              id="qr-action-as">
              AS 요청
            </button>
          ` : ''}
          ${specData ? `
            <button class="btn btn-outline"
              style="font-size:15px;padding:13px;justify-content:center;border-color:var(--navy);color:var(--navy)"
              id="qr-action-spec">
              제원표 확인
            </button>
          ` : ''}
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>`,
    });

    document.getElementById('qr-action-start')?.addEventListener('click', () => _handleStart(equip));
    document.getElementById('qr-action-end')  ?.addEventListener('click', () => _handleEnd(equip));
    document.getElementById('qr-action-as')   ?.addEventListener('click', () => _handleAs(equip));
    document.getElementById('qr-action-spec') ?.addEventListener('click', () => _showSpecSheet(specData, equip));
  }

  // ── 제원표 표시 ──────────────────────────────────────────
  function _showSpecSheet(spec, equip) {
    Modal.open({
      title: `제원표 — ${spec.model}`,
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--gray-200);border-radius:10px;overflow:hidden;font-size:14px">
          ${[
            ['모델명',   spec.model],
            ['제조사',   spec.manufacturer || '-'],
            ['작업높이', spec.work_height  || '-'],
            ['장비번호', equip.equip_no],
            ['시리얼',   equip.serial_no   || '-'],
            ['현장',     equip.site_name   || '-'],
          ].map(([label, val], i) => `
            <div style="padding:11px 14px;background:${i%2===0?'var(--gray-50,#f9fafb)':'#fff'};border-bottom:1px solid var(--gray-100)">
              <div style="font-size:11px;color:var(--gray-400);margin-bottom:2px">${label}</div>
              <div style="font-weight:600;color:var(--navy)">${val}</div>
            </div>
          `).join('')}
        </div>
      `,
      footer: `<button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>`,
    });
  }

  // ── 사용 시작 ────────────────────────────────────────────
  async function _handleStart(equip) {
    const { data: active } = await _sb
      .from('usage_logs')
      .select('id,team_name,recorder')
      .eq('equip_no', equip.equip_no)
      .eq('status', 'using')
      .maybeSingle();

    if (active) {
      Toast.error(`이 장비는 현재 ${active.team_name || active.recorder || '다른 사용자'}가 사용 중입니다.`);
      Modal.close();
      return;
    }
    Modal.close();
    App.showPage('usage-log');
    setTimeout(() => UsageLogPage.openStartForm(equip), 150);
  }

  // ── 사용 종료 ────────────────────────────────────────────
  async function _handleEnd(equip) {
    const { data: active } = await _sb
      .from('usage_logs')
      .select('id,equip_no,team_name,recorder,start_time,date')
      .eq('equip_no', equip.equip_no)
      .eq('status', 'using')
      .maybeSingle();

    if (!active) {
      Toast.error('현재 가동 중인 기록이 없습니다.');
      Modal.close();
      return;
    }
    Modal.close();
    App.showPage('usage-log');
    setTimeout(() => UsageLogPage.openEndForm(active.id, active.equip_no), 150);
  }

  // ── AS 요청 ──────────────────────────────────────────────
  async function _handleAs(equip) {
    Modal.close();
    await AsRequestPage.openNewFormWithEquip(equip);
  }

  // QR 이미지에 담을 URL 생성 (스캔 시 앱으로 바로 진입)
  function _qrUrl(qrCode) {
    return `${window.location.origin}${window.location.pathname}?qr=${encodeURIComponent(qrCode)}`;
  }

  // ── QR 코드 이미지 표시 (equipment 페이지에서 사용) ──────
  function showQrCode(equip) {
    _currentEquip = equip;
    const qrUrl = _qrUrl(equip.qr_code);

    const siteLine   = [equip.site_name, equip.company].filter(Boolean).join(' · ');
    const serialLine = equip.serial_no || '';
    const inDate     = equip.in_date ? `반입일: ${equip.in_date}` : '';

    Modal.open({
      title: `QR 코드 — ${equip.equip_no}`,
      body: `
        <div style="text-align:center;padding:8px 0">
          <div id="qr-display" style="display:inline-block;padding:16px;background:#fff;border-radius:8px;border:1px solid var(--gray-200)"></div>
          <div style="margin-top:14px;font-size:18px;font-weight:700;color:var(--navy);letter-spacing:0.3px">${equip.equip_no}</div>
          ${siteLine   ? `<div style="font-size:14px;font-weight:700;color:var(--navy);margin-top:4px">${siteLine}</div>`   : ''}
          ${serialLine ? `<div style="font-size:14px;font-weight:700;color:var(--navy);margin-top:2px;font-family:monospace">${serialLine}</div>` : ''}
          ${inDate     ? `<div style="font-size:14px;font-weight:700;color:var(--navy);margin-top:2px">${inDate}</div>`     : ''}
          <div style="font-size:11px;color:#94a3b8;margin-top:10px;word-break:break-all;padding:0 8px">
            스캔 시 앱으로 바로 연결됩니다
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">닫기</button>
        <button class="btn btn-primary btn-sm" onclick="QrScanner.printQrCode()">인쇄</button>
      `,
    });

    setTimeout(() => {
      const container = document.getElementById('qr-display');
      if (!container) return;
      if (typeof QRCode !== 'undefined') {
        new QRCode(container, {
          text:         qrUrl,
          width:        200,
          height:       200,
          colorDark:    '#1B365D',
          colorLight:   '#ffffff',
          correctLevel: QRCode.CorrectLevel.H,
        });
      } else {
        container.textContent = qrUrl;
      }
    }, 100);
  }

  function printQrCode() {
    const equip = _currentEquip;
    if (!equip) return;
    const qrUrl    = _qrUrl(equip.qr_code);
    const equipNo  = equip.equip_no  || '';
    const siteLine = [equip.site_name, equip.company].filter(Boolean).join(' · ');
    const serial   = equip.serial_no || '';
    const inDate   = equip.in_date   ? `반입일: ${equip.in_date}` : '';

    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) { Toast.error('팝업 차단을 해제해주세요.'); return; }
    win.document.write(`
      <!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <title>QR 코드 — ${equipNo}</title>
        <style>
          body { margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Malgun Gothic',sans-serif }
          .card { text-align:center;padding:60px 54px;border:2px solid #1B365D;border-radius:20px;max-width:560px }
          h2 { color:#1B365D;margin:0 0 28px;font-size:30px }
          #qr { display:inline-block;margin:0 auto 28px }
          .equip-no { font-size:30px;font-weight:700;color:#1B365D;margin-bottom:8px }
          .info-line { font-size:20px;font-weight:700;color:#1B365D;margin:4px 0 }
          .info-mono { font-size:20px;font-weight:700;color:#1B365D;margin:4px 0;font-family:monospace }
        </style>
      </head><body>
        <div class="card">
          <h2>삼성E&amp;A</h2>
          <div id="qr"></div>
          <div class="equip-no">${equipNo}</div>
          ${siteLine ? `<div class="info-line">${siteLine}</div>` : ''}
          ${serial   ? `<div class="info-mono">${serial}</div>`   : ''}
          ${inDate   ? `<div class="info-line">${inDate}</div>`   : ''}
        </div>
        <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
        <script>
          window.onload = () => {
            new QRCode(document.getElementById('qr'), {
              text: '${qrUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',
              width:330, height:330,
              colorDark:'#1B365D', colorLight:'#ffffff',
              correctLevel: QRCode.CorrectLevel.H
            });
            setTimeout(() => window.print(), 400);
          };
        <\/script>
      </body></html>
    `);
    win.document.close();
  }

  return { scan, scanAndAct, stop, handleQrCode, showQrCode, printQrCode };
})();
