/* ============================================================
   service-worker.js — 今日事今日毕 PWA
   缓存优先策略 + 版本管理 + skipWaiting 立即激活 + 自动更新
   不干扰 localStorage / IndexedDB 数据读写
   兼容 Chrome / Edge / Android / iOS Safari

   ⚠️ 发版操作：每次发布新版本，只需修改下面的 CACHE_VERSION 即可
     同步修改 index.html 中的 APP_VERSION 常量，保持一致触发公告弹窗
============================================================ */

/* ---- 缓存版本（发版时递增此处） ---- */
var CACHE_VERSION = 'serene-today-v1';
var CACHE_NAME = 'serene-today-' + CACHE_VERSION;

/* ---- 预缓存资源列表（相对路径，适配子目录部署） ---- */
var PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.json'
  // 外部 CDN（Google Fonts）默认不缓存，离线时降级为系统字体
];

/* ============================================================
   INSTALL — 预缓存核心资源，完成后立即 skipWaiting
============================================================ */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW] 预缓存失败:', url, err.message);
          });
        })
      );
    })
    .then(function () {
      // ★ 立即跳过等待，不等待旧 SW 释放页面
      return self.skipWaiting();
    })
  );
});

/* ============================================================
   ACTIVATE — 清理所有旧版本缓存 + 接管所有客户端
============================================================ */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (name) {
          // 删除所有 serene-today- 前缀但不是当前版本的缓存
          if (name.startsWith('serene-today-') && name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
    .then(function () {
      // ★ 激活后立即接管所有打开的页面（无需用户关闭重开）
      //    clients.claim() 会触发页面的 controllerchange 事件
      return self.clients.claim();
    })
    .then(function () {
      // ★ 通知所有打开的页面：新版本已激活，可刷新
      //    双重通知：postMessage + controllerchange 事件确保页面收到更新
      return self.clients.matchAll({ type: 'window' }).then(function (clients) {
        clients.forEach(function (client) {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
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
   MESSAGE — 页面 ↔ SW 通信
   支持：
   - SKIP_WAITING：页面主动触发 SW 激活
   - GET_VERSION：页面查询当前 SW 版本号
============================================================ */
self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    // 回复版本号给请求的客户端
    if (event.source) {
      event.source.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
    }
  }
});
