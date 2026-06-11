/**
 * 고객지원 게시판
 * - 자료실: 매뉴얼/서식 다운로드 + 검색
 * - FAQ 챗봇
 */
const SupportPage = (() => {

  // ── 자료 목록 (정적 데이터) ────────────────────────────────
  const DOCS = [
    { id:1, category:'매뉴얼',   title:'AJ 고소작업대 운영시스템 사용자 매뉴얼',  file:'manual_user_v1.pdf',    size:'2.4MB', date:'2026-06-01' },
    { id:2, category:'매뉴얼',   title:'AJ관리자 운영 가이드',                     file:'manual_admin_v1.pdf',   size:'1.8MB', date:'2026-06-01' },
    { id:3, category:'매뉴얼',   title:'QR코드 스캔 및 장비 사용 가이드',          file:'manual_qr_v1.pdf',      size:'0.9MB', date:'2026-06-01' },
    { id:4, category:'서식',     title:'반입 신청서 양식',                          file:'form_transit_in.xlsx',  size:'0.1MB', date:'2026-06-01' },
    { id:5, category:'서식',     title:'반출 신청서 양식',                          file:'form_transit_out.xlsx', size:'0.1MB', date:'2026-06-01' },
    { id:6, category:'안전서류', title:'안전검사증 제출 양식',                      file:'form_safety_cert.pdf',  size:'0.3MB', date:'2026-06-01' },
    { id:7, category:'안전서류', title:'장비 보험증서 제출 양식',                   file:'form_insurance.pdf',    size:'0.3MB', date:'2026-06-01' },
    { id:8, category:'안전서류', title:'고소작업대 안전수칙',                       file:'safety_rules.pdf',      size:'1.2MB', date:'2026-06-01' },
    { id:9, category:'공지',     title:'2026년 운영 일정 공지',                     file:'notice_2026.pdf',       size:'0.5MB', date:'2026-06-10' },
  ];

  // ── FAQ 데이터 ─────────────────────────────────────────────
  const FAQ = [
    { keywords: ['반입','신청','방법'],
      q: '반입 신청은 어떻게 하나요?',
      a: '좌측 메뉴 [반입/반출 관리] → [+ 신규 신청] 버튼을 클릭하세요. 업체명·담당자·희망 반입일·장비 제원을 입력 후 제출하면 AJ관리자에게 알림이 발송됩니다.' },
    { keywords: ['QR','스캔','사용','시작'],
      q: 'QR코드로 장비를 사용하려면?',
      a: '장비에 부착된 QR코드를 카메라로 스캔하면 팝업이 뜹니다. [장비 사용 신청]을 탭하고 팀명·층수·위치를 입력하면 사용 시작 시각이 자동 기록됩니다.' },
    { keywords: ['AS','요청','고장','신청'],
      q: 'AS 요청은 어떻게 하나요?',
      a: '[AS 요청] 메뉴에서 [+ AS 신청] 버튼을 클릭하거나, 장비 QR 스캔 후 [AS 요청]을 선택하세요. 고장 유형과 증상을 입력하면 담당 AS기사에게 즉시 알림이 발송됩니다.' },
    { keywords: ['승인','가입','대기','협력사'],
      q: '가입 승인은 얼마나 걸리나요?',
      a: '협력사·AS기사 역할은 AJ관리자 승인이 필요합니다. 승인 완료 시 앱 알림과 푸시 알림이 발송됩니다. 긴급한 경우 AJ담당자에게 직접 연락하세요.' },
    { keywords: ['비밀번호','로그인','아이디'],
      q: '관리자 로그인 계정은 어떻게 되나요?',
      a: '초기 계정은 ID: admin / PW: aj1234 입니다. 로그인 후 [사용자 관리] → [계정 정보 변경]에서 즉시 변경하세요.' },
    { keywords: ['오프라인','인터넷','끊김','저장'],
      q: '인터넷이 끊겼을 때 입력한 데이터는?',
      a: '오프라인 상태에서 입력한 데이터는 기기에 임시 저장됩니다. 인터넷 연결이 복구되면 자동으로 서버에 전송됩니다.' },
    { keywords: ['알림','푸시','수신','설정'],
      q: '알림을 받으려면 어떻게 하나요?',
      a: '앱 최초 접속 시 브라우저 알림 허용 팝업이 뜹니다. 허용하면 반입 확정·AS 요청 등 주요 이벤트 시 실시간 푸시 알림을 받을 수 있습니다.' },
    { keywords: ['QR','PDF','인쇄','출력'],
      q: 'QR코드를 인쇄하려면?',
      a: '[장비 관리]에서 장비를 선택 후 [QR PDF 출력] 버튼을 클릭하세요. A4 용지에 QR코드가 크게 인쇄되며, 여러 장비를 한 번에 출력할 수 있습니다.' },
    { keywords: ['분석','리포트','통계','데이터'],
      q: '분석 리포트는 어떻게 사용하나요?',
      a: '[분석 리포트] 메뉴에서 장비 사용내역·AS 요청·사용 기록 세 가지 분석 대시보드를 확인할 수 있습니다. 기간(7/30/90일)과 현장별로 필터링 가능합니다. AJ관리자만 접근 가능합니다.' },
  ];

  let _chatHistory = [];
  let _docFilter = { q: '', category: '' };

  // ── 렌더 ─────────────────────────────────────────────────
  function render() {
    document.getElementById('page-support').innerHTML = `
      <h2 class="section-title" style="margin-bottom:20px">고객지원 게시판</h2>

      <!-- 탭 -->
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--gray-200)">
        <button id="tab-docs" class="tab-btn active" onclick="SupportPage.switchTab('docs')"
          style="padding:10px 20px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;
          color:var(--navy);border-bottom:2px solid var(--navy);margin-bottom:-2px">
          자료실
        </button>
        <button id="tab-chat" class="tab-btn" onclick="SupportPage.switchTab('chat')"
          style="padding:10px 20px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;
          color:var(--gray-400);border-bottom:2px solid transparent;margin-bottom:-2px">
          FAQ 챗봇
        </button>
      </div>

      <!-- 자료실 -->
      <div id="panel-docs">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          <input id="doc-search" type="text" class="search-input" style="flex:1;min-width:200px"
            placeholder="파일명, 카테고리 검색"
            oninput="SupportPage.filterDocs()">
          <select id="doc-category" class="form-input form-select" style="width:120px" onchange="SupportPage.filterDocs()">
            <option value="">전체</option>
            <option value="매뉴얼">매뉴얼</option>
            <option value="서식">서식</option>
            <option value="안전서류">안전서류</option>
            <option value="공지">공지</option>
          </select>
        </div>
        <div id="doc-list"></div>
      </div>

      <!-- 챗봇 -->
      <div id="panel-chat" class="hidden">
        <div class="card" style="max-width:680px;margin:0 auto">
          <div style="font-size:13px;color:var(--gray-500);margin-bottom:12px;text-align:center">
            자주 묻는 질문을 입력하거나 아래 예시를 클릭하세요.
          </div>
          <!-- FAQ 빠른 선택 -->
          <div id="faq-chips" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
            ${FAQ.map((f,i) => `
              <button onclick="SupportPage.askFaq(${i})"
                style="padding:6px 12px;border:1px solid var(--gray-300);border-radius:20px;
                background:var(--white);font-size:12px;cursor:pointer;color:var(--gray-600);
                transition:all .15s"
                onmouseover="this.style.borderColor='var(--navy)';this.style.color='var(--navy)'"
                onmouseout="this.style.borderColor='var(--gray-300)';this.style.color='var(--gray-600)'">
                ${f.q}
              </button>`).join('')}
          </div>
          <!-- 채팅창 -->
          <div id="chat-messages" style="height:320px;overflow-y:auto;border:1px solid var(--gray-200);
            border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:12px;margin-bottom:12px;
            background:var(--gray-100)">
            <div class="chat-bubble bot">
              <div style="font-size:13px;color:var(--navy);font-weight:600;margin-bottom:4px">AJ 운영 도우미</div>
              <div style="font-size:13px;line-height:1.6">안녕하세요! AJ 고소작업대 운영시스템 FAQ 챗봇입니다.<br>궁금한 내용을 입력하거나 위 버튼을 클릭하세요.</div>
            </div>
          </div>
          <!-- 입력 -->
          <div style="display:flex;gap:8px">
            <input id="chat-input" type="text" class="form-input" style="flex:1"
              placeholder="질문을 입력하세요..."
              onkeydown="if(event.key==='Enter')SupportPage.sendMessage()">
            <button class="btn btn-primary btn-sm" onclick="SupportPage.sendMessage()">전송</button>
          </div>
        </div>
      </div>
    `;

    _renderDocs(DOCS);
    _injectChatStyle();
  }

  // ── 탭 전환 ───────────────────────────────────────────────
  function switchTab(tab) {
    const isDocs = tab === 'docs';
    document.getElementById('panel-docs').classList.toggle('hidden', !isDocs);
    document.getElementById('panel-chat').classList.toggle('hidden', isDocs);

    const btnDocs = document.getElementById('tab-docs');
    const btnChat = document.getElementById('tab-chat');
    const ON  = 'color:var(--navy);border-bottom:2px solid var(--navy);margin-bottom:-2px';
    const OFF = 'color:var(--gray-400);border-bottom:2px solid transparent;margin-bottom:-2px';
    btnDocs.style.cssText = `padding:10px 20px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;${isDocs?ON:OFF}`;
    btnChat.style.cssText = `padding:10px 20px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;${!isDocs?ON:OFF}`;
  }

  // ── 자료실 ────────────────────────────────────────────────
  function filterDocs() {
    _docFilter.q        = document.getElementById('doc-search').value.toLowerCase();
    _docFilter.category = document.getElementById('doc-category').value;
    const filtered = DOCS.filter(d => {
      const matchQ  = !_docFilter.q || d.title.toLowerCase().includes(_docFilter.q) || d.category.toLowerCase().includes(_docFilter.q);
      const matchCt = !_docFilter.category || d.category === _docFilter.category;
      return matchQ && matchCt;
    });
    _renderDocs(filtered);
  }

  function _renderDocs(list) {
    const CAT_COLOR = { 매뉴얼:'background:#dbeafe;color:#1e40af', 서식:'background:#d1fae5;color:#065f46', 안전서류:'background:#fef3c7;color:#92400e', 공지:'background:#fce7f3;color:#9d174d' };
    const EXT_ICON  = { pdf: 'PDF', xlsx: 'XLS', docx: 'DOC' };
    const container = document.getElementById('doc-list');
    if (!list.length) {
      container.innerHTML = '<div class="empty-state"><div>검색 결과가 없습니다.</div></div>';
      return;
    }
    container.innerHTML = `
      <div class="card" style="overflow:auto">
        <table class="data-table">
          <thead><tr><th>분류</th><th>파일명</th><th>크기</th><th>등록일</th><th>다운로드</th></tr></thead>
          <tbody>
            ${list.map(d => {
              const ext = d.file.split('.').pop();
              return `<tr>
                <td><span class="badge" style="${CAT_COLOR[d.category]||''}">${d.category}</span></td>
                <td style="font-weight:500">
                  <span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:700;background:var(--gray-200);color:var(--gray-600);margin-right:5px">${EXT_ICON[ext]||'FILE'}</span>${d.title}</td>
                <td style="color:var(--gray-500)">${d.size}</td>
                <td style="color:var(--gray-500)">${d.date}</td>
                <td>
                  <button class="btn btn-outline btn-sm" onclick="SupportPage.download('${d.file}','${d.title}')"
                    style="font-size:11px;padding:4px 10px">다운로드</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function download(file, title) {
    Toast.info(`${title} 다운로드는 실제 배포 후 이용 가능합니다.`);
  }

  // ── 챗봇 ─────────────────────────────────────────────────
  function askFaq(idx) {
    const faq = FAQ[idx];
    _appendMsg('user', faq.q);
    setTimeout(() => _appendMsg('bot', faq.a), 400);
  }

  function sendMessage() {
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text) return;
    input.value = '';
    _appendMsg('user', text);

    setTimeout(() => {
      const answer = _findAnswer(text);
      _appendMsg('bot', answer);
    }, 500);
  }

  function _findAnswer(text) {
    const lower = text.toLowerCase();
    for (const faq of FAQ) {
      if (faq.keywords.some(kw => lower.includes(kw))) return faq.a;
    }
    return '죄송합니다, 해당 질문에 대한 답변을 찾지 못했습니다.\n\n위 FAQ 버튼을 클릭하거나, 더 자세한 내용은 AJ담당자에게 문의해주세요.\n연락처: 1588-0000';
  }

  function _appendMsg(role, text) {
    const wrap = document.getElementById('chat-messages');
    if (!wrap) return;
    const isBot = role === 'bot';
    const div = document.createElement('div');
    div.className = `chat-bubble ${role}`;
    div.innerHTML = `
      ${isBot ? `<div style="font-size:12px;color:var(--navy);font-weight:600;margin-bottom:3px">AJ 운영 도우미</div>` : ''}
      <div style="font-size:13px;line-height:1.65;white-space:pre-wrap">${text}</div>`;
    wrap.appendChild(div);
    wrap.scrollTop = wrap.scrollHeight;
  }

  function _injectChatStyle() {
    if (document.getElementById('chat-style')) return;
    const s = document.createElement('style');
    s.id = 'chat-style';
    s.textContent = `
      .chat-bubble { max-width:85%; padding:10px 14px; border-radius:12px; }
      .chat-bubble.bot { background:var(--white); border:1px solid var(--gray-200); align-self:flex-start; border-radius:4px 12px 12px 12px; }
      .chat-bubble.user { background:var(--navy); color:var(--white); align-self:flex-end; border-radius:12px 4px 12px 12px; }
      .chat-bubble.user div { color:var(--white) !important; }
    `;
    document.head.appendChild(s);
  }

  return { render, switchTab, filterDocs, download, askFaq, sendMessage };
})();
