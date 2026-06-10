/* 공통 모달 컴포넌트 */
const Modal = (() => {
  let overlay;

  function open({ title, body, footer = '', onClose }) {
    close(); // 기존 모달 닫기

    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <button class="modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('modal-close-btn').onclick = () => {
      close();
      onClose?.();
    };
    // 배경 클릭으로 닫기
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { close(); onClose?.(); }
    });
  }

  function close() {
    overlay?.remove();
    overlay = null;
  }

  return { open, close };
})();
