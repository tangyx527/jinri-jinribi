/**
 * 今日事今日毕 — Service Worker
 * Cache First 策略，版本化缓存管理
 */

const CACHE_NAME = 'task-app-v1';

const PRE_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ========== Install: 预缓存核心静态资源 ==========
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] 预缓存核心资源...');
      return cache.addAll(PRE_CACHE);
    })
  );
  // 立即激活，不等待旧 SW 释放
  self.skipWaiting();
});

// ========== Activate: 清理旧版本缓存 ==========
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW] 清理旧缓存:', key);
          return caches.delete(key);
        })
      );
    })
  );
  // 接管所有页面，确保 fetch 事件由新 SW 处理
  self.clients.claim();
});

// ========== Fetch: Cache First 策略 ==========
self.addEventListener('fetch', event => {
  // 仅处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 跳过 chrome-extension:// 等非标准协议
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // 缓存命中，直接返回
        return cached;
      }

      // 网络请求并动态缓存
      return fetch(event.request).then(response => {
        // 仅缓存同源且成功的响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });

        return response;
      }).catch(() => {
        // 网络断开且无缓存 → 返回缓存的首页作为兜底
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // 非页面请求（如字体、图标）失败时静默忽略
        throw new Error('Network unavailable');
      });
    })
  );
});
