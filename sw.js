/* Service Worker v9.0.13 — کش پیشرفته
   Network-First (حیاتی) | Cache-First (استاتیک) | SWR (بقیه)
   + Navigation Preload
   + TTL فقط روی runtime (static/precache بدون انقضا → آفلاین امن)
   + LRU واقعی هنگام پر شدن runtime
*/
const CACHE_VERSION = 'vam-manager-v9.0.13';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const RUNTIME_MAX_ENTRIES = 80;
/** انقضای runtime: ۷ روز — precache/static منقضی نمی‌شود */
const RUNTIME_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TS_HEADER = 'x-sw-cache-ts';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './js/app.js',
  './js/assistant.js',
  './css/app.css',
  './css/assistant.css',
  './css/all.min.css',
  './css/vazirmatn.css',
  './js/tailwindcss.js',
  './js/chart.umd.min.js',
  './js/chartjs-plugin-datalabels.min.js',
  './js/xlsx-js-style.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './webfonts/fa-solid-900.woff2',
  './webfonts/fa-regular-400.woff2',
  './fonts/vazirmatn-arabic-400.woff2',
  './fonts/vazirmatn-arabic-700.woff2',
  './fonts/vazirmatn-latin-400.woff2',
];

const NETWORK_FIRST_PATHS = [
  '/index.html',
  '/js/app.js',
  '/css/app.css',
  '/manifest.json',
  '/sw.js',
];

const STATIC_EXT = /\.(woff2?|ttf|png|jpg|jpeg|svg|webp|ico)$/i;
const STATIC_LIB_EXT = /\.(js|css)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] precache failed:', url, err);
            })
          )
        )
      )
      .then(() => {
        if (!self.registration.active) return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      // Navigation Preload: شروع زودتر درخواست صفحه هنگام boot شدن SW
      try {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
      } catch (e) {
        console.warn('[SW] navigationPreload', e);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'CLEAR_AND_RECACHE') {
    event.waitUntil(clearAndRecache());
  }
});

async function clearAndRecache() {
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    PRECACHE_ASSETS.map((url) =>
      cache.add(url).catch((err) => console.warn('[SW] recache failed:', url, err))
    )
  );
  try {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
  } catch (_) {}
  const clientsList = await self.clients.matchAll({ type: 'window' });
  clientsList.forEach((c) =>
    c.postMessage({ type: 'RECACHE_DONE', version: CACHE_VERSION })
  );
}

function pathOf(url) {
  try {
    return new URL(url, self.location.origin).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

function isNavigate(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      request.headers.get('accept')?.includes('text/html'))
  );
}

function isNetworkFirstPath(url) {
  const p = pathOf(url.href);
  return NETWORK_FIRST_PATHS.some((np) => {
    const clean = np.replace(/\/+$/, '') || '/';
    return p === clean || p.endsWith(clean);
  });
}

function isCacheFirstAsset(url) {
  const p = pathOf(url.href);
  if (isNetworkFirstPath(url)) return false;
  if (STATIC_EXT.test(p)) return true;
  if (STATIC_LIB_EXT.test(p)) {
    if (p.includes('/js/app.js') || p.includes('/css/app.css')) return false;
    if (
      p.includes('tailwind') ||
      p.includes('chart') ||
      p.includes('xlsx') ||
      p.includes('all.min') ||
      p.includes('vazirmatn.css')
    ) {
      return true;
    }
  }
  if (
    p.includes('/icons/') ||
    p.includes('/screenshots/') ||
    p.includes('/webfonts/') ||
    p.includes('/fonts/')
  ) {
    return true;
  }
  return false;
}

function isHtmlResponse(res) {
  if (!res || !res.ok) return false;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('text/html');
}

/** پاسخ را با timestamp برای TTL/LRU ذخیره کن */
async function putWithTimestamp(cacheName, request, response) {
  if (!response || !response.ok) return;
  try {
    const headers = new Headers(response.headers);
    headers.set(TS_HEADER, String(Date.now()));
    const body = await response.clone().blob();
    const stamped = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    const cache = await caches.open(cacheName);
    await cache.put(request, stamped);
  } catch (e) {
    console.warn('[SW] putWithTimestamp', e);
  }
}

/** خواندن از runtime با بررسی TTL؛ در صورت اعتبار، timestamp دسترسی را تازه کن (LRU) */
async function matchRuntimeFresh(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (!cached) return null;
  const ts = parseInt(cached.headers.get(TS_HEADER) || '0', 10);
  if (ts && Date.now() - ts > RUNTIME_TTL_MS) {
    try {
      await cache.delete(request);
    } catch (_) {}
    return null;
  }
  // به‌روزرسانی زمان دسترسی برای LRU (بدون انتظار اجباری)
  putWithTimestamp(RUNTIME_CACHE, request, cached.clone()).catch(() => {});
  return cached;
}

/** LRU: حذف قدیمی‌ترین‌ها بر اساس x-sw-cache-ts */
async function trimRuntimeCacheLRU() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const keys = await cache.keys();
    if (keys.length <= RUNTIME_MAX_ENTRIES) return;

    const scored = [];
    for (const req of keys) {
      const res = await cache.match(req);
      const ts = parseInt(res?.headers.get(TS_HEADER) || '0', 10) || 0;
      scored.push({ req, ts });
    }
    scored.sort((a, b) => a.ts - b.ts); // قدیمی‌ترین اول
    const toDelete = scored.length - RUNTIME_MAX_ENTRIES;
    for (let i = 0; i < toDelete; i++) {
      await cache.delete(scored[i].req);
    }
  } catch (e) {
    console.warn('[SW] trimRuntimeCacheLRU', e);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    if (request.destination === 'image') {
      return (
        (await caches.match('./icons/icon-192.png')) ||
        new Response('', { status: 503 })
      );
    }
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request, preloadResponsePromise) {
  try {
    // Navigation Preload: اگر مرورگر از قبل fetch کرده، همان را مصرف کن
    let res = null;
    if (preloadResponsePromise) {
      try {
        res = await preloadResponsePromise;
      } catch (_) {}
    }
    if (!res) res = await fetch(request);

    if (res && res.ok) {
      await putWithTimestamp(RUNTIME_CACHE, request, res.clone());
      await trimRuntimeCacheLRU();

      if (isNavigate(request) && isHtmlResponse(res)) {
        const sc = await caches.open(STATIC_CACHE);
        sc.put('./index.html', res.clone());
      }
      const p = pathOf(request.url);
      if (p.endsWith('/js/app.js') || p.endsWith('/css/app.css')) {
        const sc = await caches.open(STATIC_CACHE);
        sc.put(request, res.clone());
      }
    }
    return res;
  } catch {
    const cached =
      (await matchRuntimeFresh(request)) ||
      (await caches.match(request)) ||
      (await caches.match('./index.html')) ||
      (await caches.match('./offline.html'));
    if (cached) return cached;
    const offline = await caches.match('./offline.html');
    if (offline) return offline;
    return new Response('Offline', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 503,
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await matchRuntimeFresh(request);
  const fetchPromise = fetch(request)
    .then(async (res) => {
      if (res.ok) {
        await putWithTimestamp(RUNTIME_CACHE, request, res.clone());
        await trimRuntimeCacheLRU();
      }
      return res;
    })
    .catch(() => cached || new Response('', { status: 503 }));
  return cached || fetchPromise;
}

async function crossOriginStrategy(request) {
  const cached = await matchRuntimeFresh(request);
  const network = fetch(request)
    .then(async (res) => {
      if (res.ok) {
        try {
          await putWithTimestamp(RUNTIME_CACHE, request, res.clone());
          await trimRuntimeCacheLRU();
        } catch (_) {}
      }
      return res;
    })
    .catch(() => cached || new Response('', { status: 503 }));
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(crossOriginStrategy(request));
    return;
  }

  if (isNavigate(request) || isNetworkFirstPath(url)) {
    event.respondWith(
      networkFirst(request, event.preloadResponse)
    );
    return;
  }

  if (isCacheFirstAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-loans') {
    event.waitUntil(
      (async () => {
        const clientsList = await self.clients.matchAll({ type: 'window' });
        clientsList.forEach((c) =>
          c.postMessage({ type: 'BACKGROUND_SYNC', tag: event.tag })
        );
      })()
    );
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'مدیریت وام', body: 'اعلان جدید' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-96.png',
      dir: 'rtl',
      lang: 'fa',
      data: data.data || {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = './index.html';
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          try {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: event.notification.data || {},
            });
          } catch (e) {}
          return;
        }
      }
      if (clients.openWindow) await clients.openWindow(targetUrl);
    })()
  );
});
