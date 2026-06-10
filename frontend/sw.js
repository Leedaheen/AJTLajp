/**
 * Service Worker — 오프라인 캐시 + PWA Push 수신
 */
const CACHE_NAME = 'ajtl-v1';
const CACHE_URLS = ['/', '/index.html', '/css/base.css', '/css/layout.css', '/css/components.css'];

// 설치: 정적 파일 캐시
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_URLS))
  );
  self.skipWaiting();
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// fetch: 캐시 우선, 없으면 네트워크
self.addEventListener('fetch', e => {
  // API 요청은 캐시하지 않음
  if (e.request.url.includes('/api/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// Push 알림 수신
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'AJ 운영시스템', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  );
});

// 알림 클릭 → 앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      const existing = windowClients.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
