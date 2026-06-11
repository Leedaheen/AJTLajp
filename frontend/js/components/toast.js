/* 토스트 알림 컴포넌트 */
const Toast = (() => {
  let container;
  const _active = new Set(); // 현재 표시 중인 메시지 중복 방지

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = 'default', duration = 3500) {
    // 동일 메시지가 이미 표시 중이면 스킵
    if (_active.has(message)) return;
    // 최대 3개까지만
    if (getContainer().children.length >= 3) return;

    _active.add(message);
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    getContainer().appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .3s';
      setTimeout(() => { toast.remove(); _active.delete(message); }, 300);
    }, duration);
  }

  return {
    success: (msg) => show(msg, 'success'),
    error:   (msg) => show(msg, 'error'),
    info:    (msg) => show(msg, 'default'),
  };
})();
