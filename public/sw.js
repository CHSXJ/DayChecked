const CACHE_NAME = "daychecked-v2";
const PRECACHE = ["/check-in", "/login", "/manifest.json", "/icon.svg"];

// Install — precache critical pages (do NOT skipWaiting here — let user trigger update)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
});

// Message from client — skip waiting and activate immediately
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Activate — delete old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls → network only (no cache)
// - _next/static (JS/CSS bundles) → cache first, update in background (stale-while-revalidate)
// - Pages & assets → network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Never cache API calls
  if (url.pathname.startsWith("/api/")) return;

  // Static JS/CSS bundles — cache first, revalidate in background
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then((res) => {
          cache.put(request, res.clone());
          return res;
        });
        return cached ?? networkFetch;
      })
    );
    return;
  }

  // Pages & other assets — network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
