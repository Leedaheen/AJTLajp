/**
 * Comments 공통 컴포넌트
 * - AS 요청 / 반입반출 양쪽에서 동일 디자인으로 사용
 * - ref_type: 'as' | 'transit'
 * - ref_id: 해당 레코드 id (숫자)
 *
 * 사용법:
 *   <div id="comments-as-123"></div>
 *   Comments.render('as', 123);
 */
const Comments = (() => {
  const MAX_INLINE = 3;

  // 업체명 → 아바타 색상 (해시 기반, 6가지 순환)
  const AVATAR_COLORS = [
    { bg: '#E6F1FB', color: '#185FA5' },
    { bg: '#EAF3DE', color: '#3B6D11' },
    { bg: '#FCEBEB', color: '#A32D2D' },
    { bg: '#FAEEDA', color: '#854F0B' },
    { bg: '#EEEDFE', color: '#534AB7' },
    { bg: '#E1F5EE', color: '#0F6E56' },
  ];

  function _avatarColor(company) {
    if (!company) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < company.length; i++) hash = (hash * 31 + company.charCodeAt(i)) & 0xffff;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  }

  function _avatarLabel(company) {
    if (!company) return '??';
    return company.slice(0, 2);
  }

  function _fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)   return '방금';
    if (diffMin < 60)  return `${diffMin}분 전`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)    return `${diffH}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }

  function _roleLabel(role) {
    const map = { aj: 'AJ관리자', as_tech: 'AS기사', partner: '협력사', tech: '기술인' };
    return map[role] || role || '';
  }

  function _commentHtml(c) {
    const col = _avatarColor(c.author_company);
    const lbl = _avatarLabel(c.author_company);
    return `
      <div class="cm-item" style="display:flex;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--gray-200)">
        <div style="width:28px;height:28px;border-radius:50%;background:${col.bg};color:${col.color};
          display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;
          flex-shrink:0;margin-top:1px;letter-spacing:-0.5px">${lbl}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-bottom:2px">
            <span style="font-size:12px;font-weight:500;color:var(--text-primary)">${c.author_name || ''}</span>
            <span style="font-size:11px;color:var(--gray-400)">${_roleLabel(c.author_role)}</span>
            ${c.author_company ? `<span style="font-size:11px;color:var(--gray-400)">· ${c.author_company}</span>` : ''}
            <span style="font-size:11px;color:var(--gray-400);margin-left:auto;white-space:nowrap">${_fmtTime(c.created_at)}</span>
          </div>
          <div style="font-size:13px;color:var(--text-primary);line-height:1.5;word-break:break-all">${_esc(c.body)}</div>
        </div>
      </div>`;
  }

  function _esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _inputHtml(refType, refId) {
    return `
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
        <input type="text" id="cm-input-${refType}-${refId}" maxlength="200"
          style="flex:1;height:34px;padding:0 10px;border:0.5px solid var(--gray-300);
            border-radius:8px;font-size:13px;background:var(--gray-100);color:var(--text-primary);outline:none"
          placeholder="코멘트를 입력하세요..."
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Comments.submit('${refType}',${refId})}">
        <button onclick="Comments.submit('${refType}',${refId})"
          style="height:34px;padding:0 12px;background:var(--navy);color:#fff;border:none;
            border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:5px">
          등록
        </button>
      </div>`;
  }

  // ── 목록 로드 ─────────────────────────────────────────────
  async function _loadComments(refType, refId) {
    const { data, error } = await _sb
      .from('comments')
      .select('*')
      .eq('ref_type', refType)
      .eq('ref_id', refId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data || [];
  }

  // ── 카드 내 인라인 렌더 (최대 3개) ───────────────────────
  async function render(refType, refId) {
    const el = document.getElementById(`comments-${refType}-${refId}`);
    if (!el) return;

    const comments = await _loadComments(refType, refId);
    const inline   = comments.slice(-MAX_INLINE);
    const extra    = comments.length - inline.length;

    el.innerHTML = `
      <hr style="border:none;border-top:0.5px solid var(--gray-200);margin:10px 0">
      <div id="cm-list-${refType}-${refId}">
        ${inline.map(_commentHtml).join('')}
        ${inline.length > 0 ? `<div style="height:0;overflow:hidden"></div>` : ''}
      </div>
      ${extra > 0 ? `
        <button onclick="Comments.openAll('${refType}',${refId})"
          style="font-size:12px;color:var(--navy);background:none;border:none;cursor:pointer;
            padding:4px 0 2px;display:flex;align-items:center;gap:4px;margin-top:2px">
          댓글 ${extra}개 더보기
        </button>` : ''}
      ${_inputHtml(refType, refId)}
    `;

    // 마지막 cm-item border 제거
    const items = el.querySelectorAll('.cm-item');
    if (items.length) items[items.length - 1].style.borderBottom = 'none';
  }

  // ── 더보기 팝업 ───────────────────────────────────────────
  async function openAll(refType, refId) {
    const comments = await _loadComments(refType, refId);
    const typeLabel = refType === 'as' ? 'AS 요청' : '반입/반출';

    Modal.open({
      title: `${typeLabel} · 전체 댓글 (${comments.length}개)`,
      body: `
        <div id="cm-all-list">
          ${comments.map(c => {
            const html = _commentHtml(c);
            return html.replace('border-bottom:0.5px solid var(--gray-200)', '');
          }).join('<hr style="border:none;border-top:0.5px solid var(--gray-200);margin:0">')}
        </div>
        <hr style="border:none;border-top:0.5px solid var(--gray-200);margin:12px 0 0">
        ${_inputHtml(refType, refId)}
      `,
      confirmLabel: null,
      cancelLabel: '닫기',
    });
  }

  // ── 등록 ──────────────────────────────────────────────────
  async function submit(refType, refId) {
    const input = document.getElementById(`cm-input-${refType}-${refId}`);
    const body  = input?.value.trim();
    if (!body) return;

    const user = Auth.getUser();
    if (!user) { Toast.error('로그인이 필요합니다.'); return; }

    input.disabled = true;
    try {
      const { error } = await _sb.from('comments').insert({
        ref_type:       refType,
        ref_id:         Number(refId),
        author_id:      user.id,
        author_name:    user.name,
        author_role:    user.role,
        author_company: user.company || '',
        body,
      });
      if (error) throw error;
      input.value = '';
      // 인라인 목록 새로고침
      await render(refType, refId);
      // 모달이 열려있으면 갱신
      const allList = document.getElementById('cm-all-list');
      if (allList) {
        const comments = await _loadComments(refType, refId);
        allList.innerHTML = comments.map(c => {
          return _commentHtml(c).replace('border-bottom:0.5px solid var(--gray-200)', '');
        }).join('<hr style="border:none;border-top:0.5px solid var(--gray-200);margin:0">');
      }
    } catch (e) {
      Toast.error('등록 실패: ' + (e.message || '오류'));
    } finally {
      if (input) input.disabled = false;
    }
  }

  return { render, openAll, submit };
})();
