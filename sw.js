/* ============================================================
   Service Worker — المنصة + المستودع
   - تخزين الصفحات الأساسية مسبقاً (index.html / warehouse.html) والأيقونات
   - الصفحات: الشبكة أولاً (أحدث نسخة دائماً) ثم الكاش عند انقطاع النت أو بطئه
   - مكتبات CDN (esm.sh / unpkg / jsdelivr / الخطوط): تُخزَّن عند أول استخدام فتعمل أوفلاين
   - بيانات Supabase وباركود QR: لا تُخزَّن أبداً
   - استقبال التنبيهات اللحظية (Push) كما كان
   ============================================================ */
const CACHE_NAME = "gateway-cache-v7";        // 🔴 غيّر الرقم (v7, v8, ...) كل ما تعمل تحديث مهم مستقبلاً
const RUNTIME_CACHE = "gateway-runtime-v7";   // مكتبات CDN وملفات تُخزَّن أثناء التشغيل
const RUNTIME_MAX_ENTRIES = 150;
const NETWORK_TIMEOUT_MS = 4000;

const PRECACHE_URLS = [
  "./index.html",
  "./warehouse.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "./icon-32.png",
  "./icon-16.png"
];

const CDN_HOSTS = [
  "esm.sh", "unpkg.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com",
  "fonts.googleapis.com", "fonts.gstatic.com"
];

/* ---------------- أدوات ---------------- */
function pageKey(url) {
  let p = url.pathname;
  if (p.endsWith("/")) p += "index.html";
  return url.origin + p;                       // نتجاهل ?login و #hash
}

// البحث في الكاش عن صفحة: المفتاح نفسه، ثم نسخة .html (مثل /warehouse → /warehouse.html)، ثم index.html للمجلد
async function matchPage(key, url) {
  const tries = [key];
  if (!url.pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(url.pathname)) {
    tries.push(key + ".html", key + "/index.html");
  }
  for (const k of tries) {
    const m = await caches.match(k);
    if (m) return m;
  }
  return null;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

function offlineResponse() {
  const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>غير متصل</title>' +
    '<style>body{font-family:system-ui,Tajawal,sans-serif;display:flex;min-height:100vh;align-items:center;' +
    'justify-content:center;margin:0;background:#fdfbf8;color:#2b3b47;text-align:center;padding:24px}' +
    'button{margin-top:16px;padding:10px 22px;border:0;border-radius:999px;background:#2b3b47;color:#fff;font:inherit;cursor:pointer}</style>' +
    '</head><body><div><h2>أنت غير متصل بالإنترنت</h2><p>هذه الصفحة لم تُحفظ بعد على جهازك.</p>' +
    '<button onclick="location.reload()">إعادة المحاولة</button></div></body></html>';
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/* ---------------- التثبيت والتفعيل ---------------- */
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // allSettled: غياب ملف واحد (مثلاً أيقونة) لا يفشل تثبيت الـ SW كله
    await Promise.allSettled(PRECACHE_URLS.map(async (u) => {
      const abs = new URL(u, self.registration.scope).href;
      const res = await fetch(new Request(abs, { cache: "reload" }));
      if (res && res.ok) await cache.put(abs, res);
    }));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = [CACHE_NAME, RUNTIME_CACHE];
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (keep.includes(k) ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

/* ---------------- الاستراتيجيات ---------------- */
// الصفحات: شبكة أولاً (بمهلة) ثم كاش
async function handlePage(request) {
  const url = new URL(request.url);
  const key = pageKey(url);
  const net = fetch(request, { cache: "no-cache" }).then((res) => {
    if (res && res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(key, copy)).catch(() => {});
    }
    return res;
  });
  net.catch(() => {});                          // منع تحذير rejection إن تأخرت الشبكة بعد المهلة
  try {
    return await withTimeout(net, NETWORK_TIMEOUT_MS);
  } catch (_) {
    const cached = await matchPage(key, url);
    if (cached) return cached;
    try { return await net; } catch (__) { return offlineResponse(); }
  }
}

// مكتبات ثابتة الإصدار (…@1.2.3) والخطوط: كاش أولاً
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && (res.ok || res.type === "opaque")) {
    const copy = res.clone();
    caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).then(() => trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES)).catch(() => {});
  }
  return res;
}

// الباقي: من الكاش فوراً مع تحديثه بالخلفية
async function staleWhileRevalidate(event) {
  const request = event.request;
  const cached = await caches.match(request);
  const update = fetch(request).then((res) => {
    if (res && (res.ok || res.type === "opaque")) {
      const copy = res.clone();
      caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => {});
    }
    return res;
  }).catch(() => null);
  if (cached) { event.waitUntil(update); return cached; }
  return (await update) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    const isPage =
      request.mode === "navigate" ||
      request.destination === "document" ||
      url.pathname.endsWith(".html") ||
      url.pathname.endsWith("/");
    event.respondWith(isPage ? handlePage(request) : staleWhileRevalidate(event));
    return;
  }

  // خارجي: فقط مكتبات CDN المعروفة. Supabase وQR وغيرها تمرّ مباشرة دون تدخّل
  if (CDN_HOSTS.includes(url.hostname)) {
    const pinned = /@\d+\.\d+\.\d+/.test(url.pathname) || url.hostname === "fonts.gstatic.com";
    event.respondWith(pinned ? cacheFirst(request) : staleWhileRevalidate(event));
  }
});

/* ---------------- رسائل من الصفحة ----------------
   CACHE_URLS: الصفحة ترسل روابط مكتبات CDN التي حمّلتها، فتُحفظ فوراً
   (حتى يعمل الأوفلاين من أول زيارة دون انتظار زيارة ثانية) */
async function warmUrls(urls) {
  const cache = await caches.open(RUNTIME_CACHE);
  for (const u of urls.slice(0, 80)) {
    try {
      const url = new URL(u);
      if (!CDN_HOSTS.includes(url.hostname)) continue;
      if (await cache.match(u)) continue;
      const res = await fetch(u, { mode: "cors", credentials: "omit" });
      if (res && res.ok) await cache.put(u, res);
    } catch (_) { /* تجاهل */ }
  }
  await trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES);
}

self.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d.type === "SKIP_WAITING") self.skipWaiting();
  if (d.type === "CACHE_URLS" && Array.isArray(d.urls)) event.waitUntil(warmUrls(d.urls));
});

/* ===== Web Push: استقبال وعرض التنبيهات حتى لو الموقع مقفل ===== */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "المستودع";
  const options = {
    body: data.body || "",
    tag: data.tag || "warehouse",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    dir: "rtl",
    lang: "ar",
    renotify: true,
    data: { url: data.url || "./warehouse.html" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "./warehouse.html";
  const target = new URL(raw, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.split(/[?#]/)[0] === target.split(/[?#]/)[0] && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
