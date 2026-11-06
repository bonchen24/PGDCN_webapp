// Author: AGY
// OS support: Web/Node
// Description: Service Worker v6 for PGDCN PWA with explicit public asset allowlist and generic offline document fallback

const CACHE_NAME = 'pgdcn-pwa-v6';
const PUBLIC_ASSETS_ALLOWLIST = [
  '/offline.html',
  '/tvci_logo.jpg',
  '/manifest.json',
  '/icons/iemm-logo-32.png',
  '/icons/iemm-logo-192.png',
  '/icons/iemm-logo-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_ASSETS_ALLOWLIST).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('pgdcn-pwa-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-only for navigation, HTML, and Next.js RSC requests.
  // Never store private application responses in the public service worker cache.
  if (
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html') ||
    url.searchParams.has('_rsc')
  ) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cachedOffline = await caches.match('/offline.html');
        if (cachedOffline) {
          return cachedOffline;
        }
        return new Response('Không có kết nối mạng', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
    );
    return;
  }

  // Do not intercept Next.js static bundles or API endpoints
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Only allowlisted public static assets are eligible for cache lookup
  if (PUBLIC_ASSETS_ALLOWLIST.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request)
          .then((response) => {
            if (response.status === 200 && !response.headers.has('set-cookie')) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
            }
            return response;
          })
          .catch(() =>
            new Response('Tài nguyên không khả dụng ngoại tuyến', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
      })
    );
    return;
  }

  // All other unlisted requests pass through to the network without caching
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response('Không thể kết nối máy chủ', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

// --- End of sw.js ---
