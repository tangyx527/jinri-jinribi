/**
 * 今日事今日毕 — Service Worker
 * 版本: v3
 * 策略: Cache First，安全版本更新（等待用户确认后激活）
 *
 * 更新机制:
 *   1. 新版 SW 安装后进入 waiting 状态，不立即替换
 *   2. 主线程检测到 waiting 后弹出升级提示
 *   3. 用户确认 → 主线程发送 SKIP_WAITING 消息 → SW 激活 → 页面刷新
 */

const APP_CACHE_VERSION = 'task-app-v3';

const PRE_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ========== Install: 预缓存核心静态资源，不自动激活 ==========
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE_VERSION).then(cache => {
      console.log('[SW] 预缓存核心资源...');
      return cache.addAll(PRE_CACHE);
    })
  );
  // 不调用 skipWaiting()，安装后进入 waiting 状态等待用户确认
});

// ========== Activate: 清理旧版本缓存，接管所有页面 ==========
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== APP_CACHE_VERSION)
          .map(key => {
            console.log('[SW] 清理旧缓存:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      // 接管所有页面
      return self.clients.claim();
    }).then(() => {
      // 激活后通知所有 clients 刷新页面加载最新代码
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_ACTIVATED' });
        });
      });
    })
  );
});

// ========== Message: 接收主线程指令 ==========
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // 用户确认升级 → 立即激活
    console.log('[SW] 收到 SKIP_WAITING，即将激活新版本');
    self.skipWaiting();
  }
});

// ========== Fetch: Cache First 策略 ==========
self.addEventListener('fetch', event => {
  // 仅处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 跳过 chrome-extension:// 等非标准协议
  if (!event.request.url.startsWith('http')) return;

  // 跳过跨域字体等非同源请求（不缓存，直接网络）
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return; // 让浏览器自行处理
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // 缓存命中，直接返回
        return cached;
      }

      // 未命中 → 网络请求并动态缓存
      return fetch(event.request).then(response => {
        // 仅缓存同源成功响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const clone = response.clone();
        caches.open(APP_CACHE_VERSION).then(cache => {
          cache.put(event.request, clone);
        });

        return response;
      }).catch(() => {
        // 网络断开且无缓存 → 导航请求返回缓存首页兜底
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // 非导航请求静默忽略
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
