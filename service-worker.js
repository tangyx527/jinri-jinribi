/* ============================================================
   service-worker.js — 今日事今日毕 PWA
   缓存优先策略 + 版本管理 + 自动更新
   不干扰 localStorage / IndexedDB 数据读写
   兼容 Chrome / Edge / Android / iOS Safari

   ⚠️ 版本联动：
   每次发布新版本，请同时更新：
   1. 此处的 CACHE_VERSION
   2. index.html 中的 APP_VERSION 常量
   两者保持一致即可触发更新公告弹窗
============================================================ */

/* ---- 缓存版本（发布新版本时递增） ---- */
var CACHE_VERSION = 'serene-today-v1';
var CACHE_NAME = 'serene-today-' + CACHE_VERSION;

/* ---- 预缓存资源列表 ---- */
var PRECACHE_URLS = [
  '/',
  'index.html',
  'manifest.json'
  // 外部 CDN（Google Fonts）默认不缓存，离线时降级为系统字体
];

/* ============================================================
   INSTALL — 预缓存核心资源，立即激活
============================================================ */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function (err) {
            // 单个资源失败不阻塞整体安装
            console.warn('[SW] 预缓存失败:', url, err.message);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting(); // 立即激活，不等待旧 SW 释放
    })
  );
});

/* ============================================================
   ACTIVATE — 清理旧缓存，接管所有客户端
============================================================ */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (name) {
            return name.startsWith('serene-today-') && name !== CACHE_NAME;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    }).then(function () {
      // 接管所有页面，确保新版 SW 立即控制
      return self.clients.claim();
    })
  );
});

/* ============================================================
   FETCH — 缓存优先策略
   1. 命中缓存 → 直接返回
   2. 未命中 → 网络请求，成功后写入缓存
   3. 网络失败 → 降级返回（HTML 导航返回缓存首页）
============================================================ */
self.addEventListener('fetch', function (event) {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 跳过非 HTTP/HTTPS 协议（chrome-extension 等）
  if (!/^https?:/.test(event.request.url)) return;

  // 跳过 Google Fonts（离线时降级为系统字体）
  if (/fonts\.(googleapis|gstatic)\.com/.test(event.request.url)) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        // 只缓存同源成功的 GET 响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function () {
        // 网络完全不可用时的降级
        if (event.request.mode === 'navigate' ||
            (event.request.headers.get('accept') || '').includes('text/html')) {
          return caches.match('index.html');
        }
        return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});

/* ============================================================
   MESSAGE — 允许页面主动触发 SW 更新
============================================================ */
self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
