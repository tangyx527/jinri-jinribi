/* ============================================================
   service-worker.js — 今日事今日毕 PWA
   缓存优先策略 + 版本管理 + skipWaiting 立即激活 + 自动更新
   不干扰 localStorage / IndexedDB 数据读写
   兼容 Chrome / Edge / Android / iOS Safari

   ⚠️ 发版操作：每次发布新版本，只需修改下面的 SW_VERSION 即可
     浏览器检测到 SW 文件内容变化后会触发更新流程
     同步修改 index.html 中的 APP_VERSION 常量，保持一致触发公告弹窗
============================================================ */

/* ---- 独立版本号（发版时递增此处） ---- */
var SW_VERSION = 'v3';
var CACHE_VERSION = 'serene-today-' + SW_VERSION;
var CACHE_NAME = 'serene-today-' + SW_VERSION;

/* ---- SW 自身构建时间戳（用于日志排查） ---- */
var SW_BUILD_TIME = '2026-06-24T13:51:00';

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
  console.log('[SW] 🔧 install 事件触发 | 版本=' + SW_VERSION + ' | 构建时间=' + SW_BUILD_TIME);

  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log('[SW] 📦 缓存存储已打开: ' + CACHE_NAME + ' | 预缓存资源数=' + PRECACHE_URLS.length);
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).then(function () {
            console.log('[SW] ✅ 预缓存成功: ' + url);
          }).catch(function (err) {
            console.warn('[SW] ⚠️ 预缓存失败: ' + url + ' | ' + err.message);
          });
        })
      );
    })
    .then(function () {
      // ★ 立即跳过等待，不等待旧 SW 释放页面
      console.log('[SW] ⏩ 调用 skipWaiting() — 新 SW 立即激活，无需等待旧版退出');
      return self.skipWaiting();
    })
  );
});

/* ============================================================
   ACTIVATE — 清理所有旧版本缓存 + 接管所有客户端
============================================================ */
self.addEventListener('activate', function (event) {
  console.log('[SW] 🚀 activate 事件触发 | 版本=' + SW_VERSION);

  event.waitUntil(
    caches.keys().then(function (keys) {
      // 找出需要删除的旧缓存
      var oldCaches = keys.filter(function (name) {
        return name.startsWith('serene-today-') && name !== CACHE_NAME;
      });

      console.log('[SW] 🧹 当前缓存总数=' + keys.length + ' | 当前版本=' + CACHE_NAME + ' | 待清理旧缓存=' + oldCaches.length + '个');

      if (oldCaches.length > 0) {
        console.log('[SW] 🗑️ 待删除旧缓存: ' + oldCaches.join(', '));
      }

      return Promise.all(
        oldCaches.map(function (name) {
          console.log('[SW] ❌ 删除旧缓存: ' + name);
          return caches.delete(name);
        })
      );
    })
    .then(function () {
      // ★ 激活后立即接管所有打开的页面（无需用户关闭重开）
      console.log('[SW] 🎯 调用 clients.claim() — 立即接管所有已打开页面');
      return self.clients.claim();
    })
    .then(function () {
      // ★ 通知所有打开的页面：新版本已激活
      return self.clients.matchAll({ type: 'window' }).then(function (clients) {
        console.log('[SW] 📨 向 ' + clients.length + ' 个已打开页面发送 SW_UPDATED 消息');
        clients.forEach(function (client) {
          client.postMessage({ type: 'SW_UPDATED', version: SW_VERSION });
        });
      });
    })
    .then(function () {
      console.log('[SW] ✅ activate 完成 | 版本=' + SW_VERSION + ' 已就绪');
    })
  );
});

/* ============================================================
   FETCH — 缓存优先策略（Cache-First）
   1. 命中缓存 → 直接返回（离线可用）
   2. 未命中 → 网络请求，成功后写入缓存供下次离线使用
   3. 网络失败 → 降级返回（HTML 导航返回缓存首页，其他返回 408）
   
   ★ 这是 Chromium PWA 可安装性判定的核心：必须监听 fetch 并提供离线响应
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
      if (cached) {
        // 缓存命中 → 直接返回，无需网络（离线可用）
        return cached;
      }

      // 缓存未命中 → 发起网络请求
      return fetch(event.request).then(function (response) {
        // 只缓存同源成功的 GET 响应（避免缓存跨域资源和非成功响应）
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // 异步写入缓存（不阻塞响应返回）
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function (err) {
        // 网络完全不可用时的降级方案
        console.warn('[SW] 🌐 网络不可达，尝试降级: ' + event.request.url + ' | ' + err.message);

        // HTML 导航请求 → 返回缓存的 index.html（App Shell 模式）
        if (event.request.mode === 'navigate' ||
            (event.request.headers.get('accept') || '').includes('text/html')) {
          // 多层降级匹配：先从所有缓存中查找 index.html 或根路径
          return caches.match('./') ||
                 caches.match('index.html') ||
                 caches.keys().then(function (keys) {
                   // 终极降级：遍历所有缓存存储，查找 index.html
                   var checkCaches = keys.filter(function (k) { return k.startsWith('serene-today-'); });
                   function tryNext(i) {
                     if (i >= checkCaches.length) {
                       return new Response('Offline - 请连接网络后重试', {
                         status: 503,
                         statusText: 'Service Unavailable',
                         headers: { 'Content-Type': 'text/html; charset=utf-8' }
                       });
                     }
                     return caches.open(checkCaches[i]).then(function (cache) {
                       return cache.match('./') || cache.match('index.html');
                     }).then(function (r) {
                       return r || tryNext(i + 1);
                     });
                   }
                   return tryNext(0);
                 });
        }

        // 其他资源（JS/CSS/图片等）→ 返回 408 超时
        return new Response('Offline', { status: 408, statusText: 'Offline' });
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
    console.log('[SW] 📩 收到 SKIP_WAITING 消息 — 页面主动触发激活');
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    console.log('[SW] 📩 收到 GET_VERSION 查询 — 当前版本=' + SW_VERSION);
    if (event.source) {
      event.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
    }
  }
});

/* ---- 启动日志：SW 脚本首次执行 ---- */
console.log('[SW] 📋 Service Worker 脚本已加载 | 版本=' + SW_VERSION + ' | 构建时间=' + SW_BUILD_TIME);
console.log('[SW] 📋 当前作用域: ' + (self.registration ? self.registration.scope : 'unknown'));
console.log('[SW] 📋 缓存策略: Cache-First | 预缓存资源: ' + PRECACHE_URLS.join(', '));
