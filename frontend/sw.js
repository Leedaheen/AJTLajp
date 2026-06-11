/**
 * Service Worker — 오프라인 캐시 + PWA Push 수신 + Background Sync
 */
const CACHE_NAME = 'ajtl-v2';
const CACHE_URLS = [
  '/', '/index.html',
  '/css/base.css', '/css/layout.css', '/css/components.css',
  '/js/components/toast.js', '/js/components/modal.js',
  '/js/api.js', '/js/auth.js', '/js/app.js', '/js/storage.js',
  '/js/notifications.js',
  '/js/pages/home.js', '/js/pages/transit.js', '/js/pages/equipment.js',
  '/js/pages/as_request.js', '/js/pages/usage_log.js',
  '/js/pages/analytics.js', '/js/pages/admin.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];
const SYNC_TAG = 'ajtl-offline-sync';

// 설치: 정적 파일 캐시
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // 외부 CDN 실패해도 설치 중단하지 않음
      Promise.allSettled(CACHE_URLS.map(url => cache.add(url)))
    )
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

// fetch: 캐시 우선 전략 (API 제외)
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        // GET 요청만 캐시에 저장
        if (e.request.method === 'GET' && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() => {
        // 오프라인 + 캐시 없음 → index.html 반환 (SPA 폴백)
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Background Sync — 오프라인 큐 재전송
self.addEventListener('sync', e => {
  if (e.tag === SYNC_TAG) {
    e.waitUntil(_notifyClientsToFlush());
  }
});

async function _notifyClientsToFlush() {
  const all = await self.clients.matchAll({ type: 'window' });
  all.forEach(client => client.postMessage({ type: 'FLUSH_QUEUE' }));
}

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
