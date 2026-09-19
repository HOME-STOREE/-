const CACHE_NAME = "gateway-cache-v2"; // 🔴 غيّر الرقم (v2, v3, ...) كل ما تعمل تحديث مهم مستقبلاً
const STATIC_ASSETS = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isHTML =
    event.request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/");

  if (isHTML) {
    // Network First: يجيب أحدث نسخة من الصفحة دائمًا، ويستخدم الكاش فقط لو النت مقطوع
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache First (مع تحديث في الخلفية): للأيقونات وmanifest.json فقط، ما تتغيّر كثير
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
