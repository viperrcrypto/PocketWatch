// PocketWatch Service Worker v3 — full offline caching + push notifications
// Bump VERSION when deploying new builds to bust caches.
const VERSION = "v3";
const SHELL_CACHE = `pw-shell-${VERSION}`;
const STATIC_CACHE = `pw-static-${VERSION}`;
const IMAGE_CACHE = `pw-images-${VERSION}`;
const API_CACHE = `pw-api-${VERSION}`;

const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE, API_CACHE];

// App shell routes to pre-cache at install
const SHELL_URLS = [
  "/offline.html",
  "/net-worth",
  "/portfolio",
  "/finance",
  "/travel",
  "/chat",
];

const IMAGE_CACHE_LIMIT = 100;
const API_STALE_MS = 5 * 60 * 1000; // 5 minutes

// ─── Install: pre-cache app shell ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS).catch((err) => {
        // Don't fail install if some routes aren't built yet
        console.warn("[SW] Pre-cache partial failure:", err);
        return cache.addAll(["/offline.html"]);
      })
    )
  );
  self.skipWaiting();
});

// ─── Activate: purge old versioned caches ───
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("pw-") && !CURRENT_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: route to strategy by URL pattern ───
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests — never intercept cross-origin redirects
  if (url.origin !== self.location.origin) return;
  if (request.method !== "GET" && request.mode !== "navigate") return;

  // Navigation requests → shell strategy (network-first, 3s timeout)
  if (request.mode === "navigate") {
    event.respondWith(shellStrategy(request));
    return;
  }

  // Static assets → cache-first (immutable hashed chunks)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css")
  ) {
    event.respondWith(staticStrategy(request));
    return;
  }

  // Local fonts → cache-first (served from same origin)
  if (
    url.pathname.startsWith("/fonts/") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ttf")
  ) {
    event.respondWith(staticStrategy(request));
    return;
  }

  // Images → stale-while-revalidate
  if (
    url.pathname.startsWith("/img/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".gif") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webp")
  ) {
    event.respondWith(imageStrategy(request));
    return;
  }

  // API GET requests → network-first with stale fallback
  if (url.pathname.startsWith("/api/") && request.method === "GET") {
    event.respondWith(apiStrategy(request));
    return;
  }
});

// ─── Shell strategy: network-first with 3s timeout, fallback to cache ───
async function shellStrategy(request) {
  try {
    const response = await fetchWithTimeout(request, 3000);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("/offline.html");
  }
}

// ─── Static strategy: cache-first (immutable content-addressed assets) ───
async function staticStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

// ─── Image strategy: stale-while-revalidate with cache size limit ───
async function imageStrategy(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        await trimCache(cache, IMAGE_CACHE_LIMIT);
      }
      return response;
    })
    .catch(() => null);

  // Return cached immediately, update in background
  if (cached) {
    networkFetch; // fire-and-forget revalidation
    return cached;
  }

  // No cache — wait for network
  const response = await networkFetch;
  if (response) return response;
  return new Response("", { status: 503 });
}

// ─── API strategy: network-first with 5s timeout, stale cache fallback ───
async function apiStrategy(request) {
  try {
    const response = await fetchWithTimeout(request, 5000);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      // Store with timestamp header for staleness check
      const headers = new Headers(response.headers);
      headers.set("sw-cached-at", String(Date.now()));
      const timestamped = new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, timestamped);
    }
    return response;
  } catch {
    // Try stale cache
    const cached = await caches.match(request);
    if (cached) {
      const cachedAt = Number(cached.headers.get("sw-cached-at") || 0);
      if (Date.now() - cachedAt < API_STALE_MS) {
        return cached;
      }
    }
    return new Response(
      JSON.stringify({ error: "offline", stale: true }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ─── Helpers ───
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    fetch(request, { signal: controller.signal })
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

async function trimCache(cache, maxItems) {
  const keys = await cache.keys();
  if (keys.length <= maxItems) return;
  // Remove oldest entries (FIFO)
  const toDelete = keys.slice(0, keys.length - maxItems);
  await Promise.all(toDelete.map((key) => cache.delete(key)));
}

// ─── Push: display notification from server payload ───
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const options = {
      body: payload.body,
      icon: payload.icon || "/img/pwa-icon-192.png",
      badge: "/img/pwa-icon-192.png",
      tag: payload.tag || "pocketwatch-alert",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: payload.url || "/net-worth" },
      actions: payload.actions || [],
    };
    event.waitUntil(
      self.registration.showNotification(payload.title || "PocketWatch", options)
    );
  } catch {
    // Ignore malformed push payloads
  }
});

// ─── Notification Click: open/focus the app ───
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/net-worth";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const targetPath = url.split("?")[0];
        const existing = clients.find((c) => {
          try {
            return new URL(c.url).pathname === targetPath;
          } catch {
            return false;
          }
        });
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});

// ─── Message: handle skipWaiting from update prompt ───
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
