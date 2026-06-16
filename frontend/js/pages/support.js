/**
 * 고객지원 게시판
 * - 자료실: 정적 + DB 게시글 합산, AJ관리자 글쓰기
 * - FAQ 챗봇
 */
const SupportPage = (() => {

  // ── 정적 게시글 (제원표 등 기본 자료) ──────────────────────
  const STATIC_POSTS = [
    {
      id: 's1',
      category: '제원표',
      title: '장비 제원표 모음 (모델별 PDF)',
      body: '각 장비 모델별 제원표(카탈로그) PDF 파일입니다. 필요한 모델을 선택하여 다운로드하세요.',
      date: '2026-06-16',
      isStatic: true,
      attachments: [
        { name:'GS1330m',     path:'specs/GS1330m.pdf',      maker:'Genie',    height:'6M'      },
        { name:'GS1930',      path:'specs/GS1930.pdf',       maker:'Genie',    height:'8M'      },
        { name:'GS1930-e',    path:'specs/GS1930-e.pdf',     maker:'Genie',    height:'8M'      },
        { name:'GS2032',      path:'specs/GS2032.pdf',       maker:'Genie',    height:'8M'      },
        { name:'GS2632',      path:'specs/GS2632.pdf',       maker:'Genie',    height:'10M'     },
        { name:'GS2646',      path:'specs/GS2646.pdf',       maker:'Genie',    height:'10M'     },
        { name:'GS3246',      path:'specs/GS3246.pdf',       maker:'Genie',    height:'12M'     },
        { name:'GS4046',      path:'specs/GS4046.pdf',       maker:'Genie',    height:'14M'     },
        { name:'GS4047',      path:'specs/GS4047.pdf',       maker:'Genie',    height:'14M'     },
        { name:'GS4655',      path:'specs/GS4655.pdf',       maker:'Genie',    height:'16M'     },
        { name:'GS5390RT',    path:'specs/GS5390RT.pdf',     maker:'Genie',    height:'16M'     },
        { name:'ES1932',      path:'specs/ES1932.pdf',       maker:'Genie',    height:'8M'      },
        { name:'ERT4069',     path:'specs/ERT4069.pdf',      maker:'Genie',    height:'14M'     },
        { name:'MS10.4',      path:'specs/MS10.4.pdf',       maker:'Genie',    height:'10M'     },
        { name:'MS11.8',      path:'specs/MS11.8.pdf',       maker:'Genie',    height:'14M'     },
        { name:'E450AJ',      path:'specs/E450AJ.pdf',       maker:'JLG',      height:'16M굴절' },
        { name:'Z45_25J DC',  path:'specs/Z45_25J DC.pdf',   maker:'JLG',      height:'16M굴절' },
        { name:'OPTIMUM8',    path:'specs/OPTIMUM8.pdf',     maker:'Haulotte', height:'8M'      },
        { name:'compact8',    path:'specs/compact8.pdf',     maker:'Haulotte', height:'8M'      },
        { name:'SIGMA16',     path:'specs/SIGMA16.pdf',      maker:'Haulotte', height:'16M굴절' },
        { name:'JCPT1614ACZ', path:'specs/JCPT1614ACZ.pdf',  maker:'JCPT',     height:'16M'     },
      ],
    },
  ];

  // ── FAQ ───────────────────────────────────────────────────
  const FAQ = [
    { keywords:['반입','신청','방법'],   q:'반입 신청은 어떻게 하나요?',        a:'좌측 메뉴 [반입/반출 관리] → [+ 신규 신청] 버튼을 클릭하세요. 업체명·담당자·희망 반입일·장비 제원을 입력 후 제출하면 AJ관리자에게 알림이 발송됩니다.' },
    { keywords:['QR','스캔','사용','시작'], q:'QR코드로 장비를 사용하려면?',     a:'장비에 부착된 QR코드를 카메라로 스캔하면 팝업이 뜹니다. [장비 사용 신청]을 탭하고 팀명·층수·위치를 입력하면 사용 시작 시각이 자동 기록됩니다.' },
    { keywords:['AS','요청','고장'],      q:'AS 요청은 어떻게 하나요?',          a:'[AS 요청] 메뉴에서 [+ AS 신청] 버튼을 클릭하거나, 장비 QR 스캔 후 [AS 요청]을 선택하세요. 고장 유형과 증상을 입력하면 담당 AS기사에게 즉시 알림이 발송됩니다.' },
    { keywords:['승인','가입','대기'],    q:'가입 승인은 얼마나 걸리나요?',      a:'협력사·AS기사 역할은 AJ관리자 승인이 필요합니다. 승인 완료 시 앱 알림과 푸시 알림이 발송됩니다. 긴급한 경우 AJ담당자에게 직접 연락하세요.' },
    { keywords:['오프라인','인터넷','끊김'], q:'인터넷이 끊겼을 때 입력한 데이터는?', a:'오프라인 상태에서 입력한 데이터는 기기에 임시 저장됩니다. 인터넷 연결이 복구되면 자동으로 서버에 전송됩니다.' },
    { keywords:['알림','푸시','수신'],    q:'알림을 받으려면 어떻게 하나요?',    a:'앱 최초 접속 시 브라우저 알림 허용 팝업이 뜹니다. 허용하면 반입 확정·AS 요청 등 주요 이벤트 시 실시간 푸시 알림을 받을 수 있습니다.' },
    { keywords:['QR','PDF','인쇄'],       q:'QR코드를 인쇄하려면?',              a:'[장비 관리]에서 장비를 선택 후 [QR PDF 출력] 버튼을 클릭하세요. A4 용지에 QR코드가 크게 인쇄되며, 여러 장비를 한 번에 출력할 수 있습니다.' },
    { keywords:['분석','리포트','통계'], q:'분석 리포트는 어떻게 사용하나요?',  a:'[분석 리포트] 메뉴에서 장비 사용내역·AS 요청·사용 기록 세 가지 분석 대시보드를 확인할 수 있습니다. 기간(7/30/90일)과 현장별로 필터링 가능합니다. AJ관리자만 접근 가능합니다.' },
    { keywords:['제원표','스펙','카탈로그'], q:'장비 제원표는 어디서 확인하나요?', a:'[고객지원] → [자료실]에서 "제원표" 카테고리를 선택하세요. 모델별 PDF를 다운로드할 수 있습니다. QR 스캔 후 [제원표 확인] 버튼으로도 확인 가능합니다.' },
  ];

  const CAT_COLOR = {
    제원표:'background:#ede9fe;color:#5b21b6', 매뉴얼:'background:#dbeafe;color:#1e40af',
    서식:'background:#d1fae5;color:#065f46',   안전서류:'background:#fef3c7;color:#92400e',
    공지:'background:#fce7f3;color:#9d174d',   기타:'background:#f1f5f9;color:#475569',
  };
  const HEIGHT_COLOR = {
    '6M':'#6366f1','8M':'#3b82f6','10M':'#06b6d4','12M':'#10b981',
    '14M':'#f59e0b','16M':'#ef4444','16M굴절':'#e8192c','18M':'#8b5cf6','20M굴절':'#ec4899',
  };

  const _sb = window._supabase;
  let _posts    = [];
  let _expanded = new Set();
  let _filter   = { q: '', category: '' };
  let _storageBase = null;

  // ── Storage URL 베이스 ────────────────────────────────────
  function _base() {
    if (_storageBase) return _storageBase;
    try {
      const url = _sb.storage.from('support-files').getPublicUrl('_').data?.publicUrl || '';
      _storageBase = url.slice(0, url.lastIndexOf('/_') + 1);
    } catch {}
    return _storageBase || '';
  }

  // ── 렌더 ─────────────────────────────────────────────────
  async function render() {
    const user  = Auth.getUser();
    const isAj  = user && (user.role === 'aj' || user.role === 'admin');

    document.getElementById('page-support').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        <h2 class="section-title" style="margin:0">고객지원 게시판</h2>
        ${isAj ? `<button class="btn btn-primary btn-sm" id="btn-write" onclick="SupportPage.openWriteForm()">+ 글쓰기</button>` : ''}
      </div>

      <!-- 탭 -->
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--gray-200)">
        <button id="tab-docs" onclick="SupportPage.switchTab('docs')"
          style="padding:10px 20px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;
          color:var(--navy);border-bottom:2px solid var(--navy);margin-bottom:-2px">
          자료실
        </button>
        <button id="tab-chat" onclick="SupportPage.switchTab('chat')"
          style="padding:10px 20px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;
          color:var(--gray-400);border-bottom:2px solid transparent;margin-bottom:-2px">
          FAQ 챗봇
        </button>
      </div>

      <!-- 자료실 -->
      <div id="panel-docs">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          <input id="doc-search" type="text" class="search-input" style="flex:1;min-width:180px"
            placeholder="제목 검색" oninput="SupportPage.filterDocs()">
          <select id="doc-category" class="form-input form-select" style="width:120px" onchange="SupportPage.filterDocs()">
            <option value="">전체</option>
            <option value="제원표">제원표</option>
            <option value="매뉴얼">매뉴얼</option>
            <option value="서식">서식</option>
            <option value="안전서류">안전서류</option>
            <option value="공지">공지</option>
            <option value="기타">기타</option>
          </select>
        </div>
        <div id="doc-list"><div class="empty-state"><div><span class="spinner"></span></div></div></div>
      </div>

      <!-- 챗봇 -->
      <div id="panel-chat" class="hidden">
        <div class="card" style="max-width:680px;margin:0 auto">
          <div style="font-size:13px;color:var(--gray-500);margin-bottom:12px;text-align:center">
            자주 묻는 질문을 입력하거나 아래 예시를 클릭하세요.
          </div>
          <div id="faq-chips" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
            ${FAQ.map((f,i) => `
              <button onclick="SupportPage.askFaq(${i})"
                style="padding:6px 12px;border:1px solid var(--gray-300);border-radius:20px;
                background:var(--white);font-size:12px;cursor:pointer;color:var(--gray-600)"
                onmouseover="this.style.borderColor='var(--navy)';this.style.color='var(--navy)'"
                onmouseout="this.style.borderColor='var(--gray-300)';this.style.color='var(--gray-600)'">
                ${f.q}
              </button>`).join('')}
          </div>
          <div id="chat-messages" style="height:320px;overflow-y:auto;border:1px solid var(--gray-200);
            border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:12px;margin-bottom:12px;
            background:var(--gray-100)">
            <div class="chat-bubble bot">
              <div style="font-size:13px;color:var(--navy);font-weight:600;margin-bottom:4px">AJ 운영 도우미</div>
              <div style="font-size:13px;line-height:1.6">안녕하세요! AJ 고소작업대 운영시스템 FAQ 챗봇입니다.<br>궁금한 내용을 입력하거나 위 버튼을 클릭하세요.</div>
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <input id="chat-input" type="text" class="form-input" style="flex:1"
              placeholder="질문을 입력하세요..."
              onkeydown="if(event.key==='Enter')SupportPage.sendMessage()">
            <button class="btn btn-primary btn-sm" onclick="SupportPage.sendMessage()">전송</button>
          </div>
        </div>
      </div>
    `;

    _injectStyle();
    await _loadPosts();
  }

  // ── DB 게시글 로드 ────────────────────────────────────────
  async function _loadPosts() {
    let dbPosts = [];
    try {
      const { data } = await _sb.from('support_posts')
        .select('*')
        .order('created_at', { ascending: false });
      dbPosts = (data || []).map(p => ({
        id:          p.id,
        category:    p.category,
        title:       p.title,
        body:        p.body,
        date:        (p.created_at || '').slice(0, 10),
        author:      p.author_name || '',
        attachments: p.attachments || [],
        isStatic:    false,
      }));
    } catch {}

    // 정적 게시글을 뒤에 붙임 (DB 게시글이 앞에)
    _posts = [...dbPosts, ...STATIC_POSTS];
    _renderDocs(_filteredPosts());
  }

  function _filteredPosts() {
    return _posts.filter(p => {
      const matchQ  = !_filter.q || p.title.toLowerCase().includes(_filter.q);
      const matchCt = !_filter.category || p.category === _filter.category;
      return matchQ && matchCt;
    });
  }

  // ── 탭 전환 ───────────────────────────────────────────────
  function switchTab(tab) {
    const isDocs = tab === 'docs';
    document.getElementById('panel-docs').classList.toggle('hidden', !isDocs);
    document.getElementById('panel-chat').classList.toggle('hidden', isDocs);
    const ON  = 'color:var(--navy);border-bottom:2px solid var(--navy);margin-bottom:-2px';
    const OFF = 'color:var(--gray-400);border-bottom:2px solid transparent;margin-bottom:-2px';
    ['docs','chat'].forEach(t => {
      const btn = document.getElementById(`tab-${t}`);
      if (btn) btn.style.cssText = `padding:10px 20px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;${(t==='docs')==isDocs?ON:OFF}`;
    });
  }

  // ── 필터 ─────────────────────────────────────────────────
  function filterDocs() {
    _filter.q        = (document.getElementById('doc-search')?.value || '').toLowerCase();
    _filter.category = document.getElementById('doc-category')?.value || '';
    _renderDocs(_filteredPosts());
  }

  // ── 게시글 목록 렌더 ─────────────────────────────────────
  function _renderDocs(list) {
    const container = document.getElementById('doc-list');
    if (!container) return;
    if (!list.length) {
      container.innerHTML = '<div class="empty-state"><div>게시글이 없습니다.</div></div>';
      return;
    }
    container.innerHTML = list.map(p => _renderCard(p)).join('');
  }

  function _renderCard(p) {
    const isOpen   = _expanded.has(String(p.id));
    const catStyle = CAT_COLOR[p.category] || CAT_COLOR['기타'];
    const user     = Auth.getUser();
    const canDelete = !p.isStatic && user && (user.role === 'aj' || user.role === 'admin');

    const bodyHtml = isOpen ? `
      <div class="post-body">
        ${p.body ? `<p style="font-size:13px;color:var(--gray-600);line-height:1.7;margin-bottom:${p.attachments?.length?'14px':'0'}">${p.body}</p>` : ''}
        ${p.isStatic ? _renderSpecGrid(p.attachments) : _renderAttachList(p.attachments)}
        ${canDelete ? `
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--gray-200);text-align:right">
            <button class="btn btn-sm" style="color:var(--red);border:1px solid var(--red);background:none;font-size:11px;padding:3px 10px"
              onclick="SupportPage.deletePost(${p.id})">삭제</button>
          </div>` : ''}
      </div>` : '';

    return `
      <div class="post-card" id="pc-${p.id}">
        <div class="post-header" onclick="SupportPage.togglePost('${p.id}')">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
            <span class="badge" style="${catStyle};flex-shrink:0">${p.category}</span>
            <span class="post-title">${p.title}</span>
            ${p.attachments?.length ? `<span style="flex-shrink:0;font-size:12px;color:var(--gray-400)">첨부 ${p.attachments.length}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
            ${p.author ? `<span style="font-size:12px;color:var(--gray-500)">${p.author}</span>` : ''}
            <span style="font-size:12px;color:var(--gray-400)">${p.date}</span>
            <span class="post-toggle ${isOpen?'open':''}">▼</span>
          </div>
        </div>
        ${bodyHtml}
      </div>`;
  }

  function _renderAttachList(attachments) {
    if (!attachments?.length) return '<div style="font-size:13px;color:var(--gray-400)">첨부파일이 없습니다.</div>';
    return `<div style="display:flex;flex-direction:column;gap:6px">
      ${attachments.map(a => `
        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:8px 12px;background:var(--white);border:1px solid var(--gray-200);border-radius:6px">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <span style="font-size:10px;font-weight:700;padding:2px 5px;border-radius:3px;
              background:var(--gray-200);color:var(--gray-600);flex-shrink:0">
              ${_extLabel(a.path || a.file || '')}
            </span>
            <span style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</span>
            ${a.size ? `<span style="font-size:11px;color:var(--gray-400);flex-shrink:0">${a.size}</span>` : ''}
          </div>
          <button class="btn btn-outline btn-sm"
            onclick="SupportPage.download('${a.path || a.file || ''}','${a.name}')"
            style="font-size:11px;padding:4px 12px;flex-shrink:0;margin-left:8px">
            다운로드
          </button>
        </div>`).join('')}
    </div>`;
  }

  function _renderSpecGrid(attachments) {
    if (!attachments?.length) return '';
    const groups = {};
    attachments.forEach(a => { (groups[a.maker] = groups[a.maker] || []).push(a); });
    return Object.entries(groups).map(([maker, items]) => `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:var(--gray-500);letter-spacing:.05em;
          margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--gray-200)">${maker}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px">
          ${items.map(a => {
            const hc = HEIGHT_COLOR[a.height] || '#64748b';
            return `<div style="display:flex;align-items:center;justify-content:space-between;
              padding:7px 10px;border:1px solid var(--gray-200);border-radius:7px;background:var(--white);gap:8px">
              <div style="display:flex;align-items:center;gap:7px;min-width:0">
                <span style="width:8px;height:8px;border-radius:50%;background:${hc};flex-shrink:0;display:inline-block"></span>
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--navy)">${a.name}</div>
                  <div style="font-size:11px;color:${hc};font-weight:500">${a.height}</div>
                </div>
              </div>
              <button class="btn btn-outline btn-sm"
                onclick="SupportPage.download('${a.path}','${a.name} 제원표')"
                style="font-size:11px;padding:3px 8px;flex-shrink:0">PDF</button>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');
  }

  function _extLabel(path) {
    const ext = (path || '').split('.').pop().toUpperCase();
    return { PDF:'PDF', XLSX:'XLS', DOCX:'DOC', PPTX:'PPT' }[ext] || 'FILE';
  }

  // ── 토글 ─────────────────────────────────────────────────
  function togglePost(id) {
    const sid = String(id);
    _expanded.has(sid) ? _expanded.delete(sid) : _expanded.add(sid);
    const post = _posts.find(p => String(p.id) === sid);
    if (!post) return;
    const card = document.getElementById(`pc-${id}`);
    if (card) card.outerHTML = _renderCard(post);
  }

  // ── 다운로드 ─────────────────────────────────────────────
  function download(filePath, name) {
    const base = _base();
    if (!base) { Toast.info('파일 서버에 연결할 수 없습니다.'); return; }
    const url = base + filePath.split('/').map(encodeURIComponent).join('/');
    const a   = document.createElement('a');
    a.href = url; a.download = name; a.target = '_blank'; a.rel = 'noopener';
    a.click();
  }

  // ── 글쓰기 폼 ─────────────────────────────────────────────
  function openWriteForm() {
    Modal.open({
      title: '새 게시글 작성',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label class="form-label">카테고리 <span style="color:var(--red)">*</span></label>
            <select id="wp-category" class="form-input form-select">
              <option value="">-- 선택 --</option>
              <option value="매뉴얼">매뉴얼</option>
              <option value="서식">서식</option>
              <option value="안전서류">안전서류</option>
              <option value="공지">공지</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div>
            <label class="form-label">제목 <span style="color:var(--red)">*</span></label>
            <input id="wp-title" type="text" class="form-input" placeholder="게시글 제목을 입력하세요">
          </div>
          <div>
            <label class="form-label">내용</label>
            <textarea id="wp-body" class="form-input" rows="5"
              style="resize:vertical;min-height:100px"
              placeholder="내용을 입력하세요 (선택사항)"></textarea>
          </div>
          <div>
            <label class="form-label">첨부파일</label>
            <input id="wp-files" type="file" multiple
              style="display:block;width:100%;padding:8px;border:1px dashed var(--gray-300);
              border-radius:8px;font-size:13px;cursor:pointer;background:var(--gray-50)">
            <div style="margin-top:4px;font-size:11px;color:var(--gray-400)">
              PDF, Excel, Word 등 여러 파일 선택 가능
            </div>
            <div id="wp-file-preview" style="margin-top:8px;display:flex;flex-direction:column;gap:4px"></div>
          </div>
          <div id="wp-progress" class="hidden">
            <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px">업로드 중...</div>
            <div style="height:4px;background:var(--gray-200);border-radius:2px">
              <div id="wp-progress-bar" style="height:100%;background:var(--navy);border-radius:2px;width:0%;transition:width .3s"></div>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-outline btn-sm" onclick="Modal.close()">취소</button>
        <button class="btn btn-primary btn-sm" id="btn-wp-save">등록</button>
      `,
    });

    // 파일 선택 미리보기
    document.getElementById('wp-files').addEventListener('change', e => {
      const preview = document.getElementById('wp-file-preview');
      preview.innerHTML = [...e.target.files].map(f => `
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray-600);
          padding:4px 8px;background:var(--gray-100);border-radius:4px">
          <span style="font-size:10px;font-weight:700;padding:1px 4px;border-radius:2px;
            background:var(--gray-300);color:var(--gray-700)">${_extLabel(f.name)}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</span>
          <span style="color:var(--gray-400)">${_fmtSize(f.size)}</span>
        </div>`).join('');
    });

    document.getElementById('btn-wp-save').onclick = _savePost;
  }

  async function _savePost() {
    const category = document.getElementById('wp-category').value.trim();
    const title    = document.getElementById('wp-title').value.trim();
    const body     = document.getElementById('wp-body').value.trim();
    const files    = document.getElementById('wp-files').files;

    if (!category) { Toast.error('카테고리를 선택해주세요.'); return; }
    if (!title)    { Toast.error('제목을 입력해주세요.'); return; }

    const btn = document.getElementById('btn-wp-save');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      const user    = Auth.getUser();
      const postTs  = Date.now();
      const attachments = [];

      // 파일 업로드
      if (files.length > 0) {
        document.getElementById('wp-progress').classList.remove('hidden');
        for (let i = 0; i < files.length; i++) {
          const f    = files[i];
          const path = `posts/${postTs}/${f.name}`;
          const { error } = await _sb.storage.from('support-files').upload(path, f, { upsert: true });
          if (error) throw new Error(`파일 업로드 실패: ${f.name}`);
          attachments.push({ name: f.name, path, size: _fmtSize(f.size) });
          document.getElementById('wp-progress-bar').style.width = `${Math.round((i+1)/files.length*100)}%`;
        }
      }

      // DB 저장
      const { error: dbErr } = await _sb.from('support_posts').insert({
        category,
        title,
        body: body || null,
        attachments,
        author_name: user?.name || '',
      });
      if (dbErr) throw dbErr;

      Modal.close();
      Toast.success('게시글이 등록되었습니다.');
      await _loadPosts();
    } catch (e) {
      btn.disabled = false; btn.textContent = '등록';
      Toast.error(e.message || '저장에 실패했습니다.');
    }
  }

  // ── 삭제 ─────────────────────────────────────────────────
  async function deletePost(id) {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
    try {
      // 첨부파일 Storage 삭제
      const post = _posts.find(p => p.id === id);
      if (post?.attachments?.length) {
        const paths = post.attachments.map(a => a.path).filter(Boolean);
        if (paths.length) await _sb.storage.from('support-files').remove(paths);
      }
      const { error } = await _sb.from('support_posts').delete().eq('id', id);
      if (error) throw error;
      Toast.success('삭제되었습니다.');
      _expanded.delete(String(id));
      await _loadPosts();
    } catch (e) {
      Toast.error(e.message || '삭제에 실패했습니다.');
    }
  }

  function _fmtSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(0) + 'KB';
    return (bytes/1024/1024).toFixed(1) + 'MB';
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
    setTimeout(() => _appendMsg('bot', _findAnswer(text)), 500);
  }
  function _findAnswer(text) {
    const lower = text.toLowerCase();
    for (const faq of FAQ) {
      if (faq.keywords.some(kw => lower.includes(kw))) return faq.a;
    }
    return '죄송합니다, 해당 질문에 대한 답변을 찾지 못했습니다.\n\n위 FAQ 버튼을 클릭하거나, AJ담당자에게 직접 문의해주세요.';
  }
  function _appendMsg(role, text) {
    const wrap = document.getElementById('chat-messages');
    if (!wrap) return;
    const div = document.createElement('div');
    div.className = `chat-bubble ${role}`;
    div.innerHTML = `
      ${role==='bot'?`<div style="font-size:12px;color:var(--navy);font-weight:600;margin-bottom:3px">AJ 운영 도우미</div>`:''}
      <div style="font-size:13px;line-height:1.65;white-space:pre-wrap">${text}</div>`;
    wrap.appendChild(div);
    wrap.scrollTop = wrap.scrollHeight;
  }

  // ── 스타일 ───────────────────────────────────────────────
  function _injectStyle() {
    if (document.getElementById('support-style')) return;
    const s = document.createElement('style');
    s.id = 'support-style';
    s.textContent = `
      .post-card { border:1px solid var(--gray-200); border-radius:10px; margin-bottom:8px; overflow:hidden; }
      .post-card:hover { box-shadow:0 2px 8px rgba(0,0,0,.07); }
      .post-header { display:flex; align-items:center; justify-content:space-between; gap:12px;
        padding:14px 16px; background:var(--white); cursor:pointer; user-select:none; }
      .post-header:hover { background:var(--gray-50); }
      .post-title { font-size:14px; font-weight:600; color:var(--gray-800);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .post-toggle { font-size:11px; color:var(--gray-400); transition:transform .2s; }
      .post-toggle.open { transform:rotate(180deg); }
      .post-body { padding:14px 16px 16px; background:var(--gray-50); border-top:1px solid var(--gray-200); }
      .chat-bubble { max-width:85%; padding:10px 14px; border-radius:12px; }
      .chat-bubble.bot { background:var(--white); border:1px solid var(--gray-200); align-self:flex-start; border-radius:4px 12px 12px 12px; }
      .chat-bubble.user { background:var(--navy); color:var(--white); align-self:flex-end; border-radius:12px 4px 12px 12px; }
      .chat-bubble.user div { color:var(--white) !important; }
    `;
    document.head.appendChild(s);
  }

  return { render, switchTab, filterDocs, togglePost, download, openWriteForm, deletePost, askFaq, sendMessage };
})();
