/* ========================================
   Service Worker — 今日事今日毕
   Cache First 策略 + 基础离线能力
======================================== */

const CACHE_NAME = 'jinrishi-v2';
const PRE_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './app.js',
  './state.js',
  './storage.js',
  './ui.js',
  './actions.js',
  './gesture.js',
  './spring.js',
  './drag-engine.js'
];

/* ── INSTALL: 预缓存核心资源 ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRE_CACHE).catch(err => {
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

/* ── ACTIVATE: 清理旧缓存 ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

/* ── FETCH: Cache First ── */
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and non-http(s) requests
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Cache hit → return immediately
      if (cached) return cached;

      // Cache miss → fetch from network, cache a clone
      return fetch(event.request).then(response => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(() => {
        // Network fail + no cache → simple offline fallback
        // For HTML requests, return cached index.html if available
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
        // Otherwise just fail silently
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
