/**
 * PWA Push 알림 모듈
 * VAPID 키로 구독하고, 수신 설정을 저장합니다.
 */

// 백엔드에서 생성한 VAPID 공개키로 교체하세요
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY';

const Notifications = (() => {
  async function requestPermission() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      // 구독 정보를 백엔드에 저장
      await Api.post('/users/me/push-subscribe', sub.toJSON());
    } catch (e) {
      console.warn('Push 구독 실패:', e);
    }
  }

  // ── 알림 목록 로드 ───────────────────────────────────────
  async function loadNotifications() {
    try {
      const list = await Api.get('/notifications', { silent: true });
      _renderNotifDropdown(list);
      const unread = list.filter(n => !n.is_read).length;
      const dot = document.getElementById('notif-dot');
      if (dot) dot.classList.toggle('hidden', unread === 0);
    } catch (e) { /* 조용히 처리 */ }
  }

  function _renderNotifDropdown(list) {
    const container = document.getElementById('notif-list');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<div class="empty-state" style="padding:24px"><div>알림이 없습니다</div></div>';
      return;
    }

    container.innerHTML = list.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" onclick="Notifications.markRead(${n.id})">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-body">${n.body}</div>
        <div class="notif-item-time">${_timeAgo(n.created_at)}</div>
      </div>
    `).join('');
  }

  async function markRead(id) {
    await Api.patch(`/notifications/${id}/read`, {});
    loadNotifications();
  }

  // ── 유틸 ─────────────────────────────────────────────────
  function _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  function _timeAgo(iso) {
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60)   return '방금 전';
    if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
    return new Date(iso).toLocaleDateString('ko-KR');
  }

  return { requestPermission, loadNotifications, markRead };
})();
