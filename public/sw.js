// PocketWatch Service Worker — caching + push notifications
const CACHE_NAME = "pocketwatch-shell-v2";
const SHELL_URLS = ["/offline.html"];

// ─── Install: pre-cache the offline shell ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ───
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// ─── Fetch: network-first for navigations, cache fallback to offline page ───
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match("/offline.html"))
  );
});

// ─── Push: display notification from server payload ───
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const options = {
      body: payload.body,
      icon: payload.icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag: payload.tag || "pocketwatch-alert",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: payload.url || "/portfolio" },
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
  const url = event.notification.data?.url || "/portfolio";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const targetPath = url.split("?")[0];
        const existing = clients.find((c) => {
          try { return new URL(c.url).pathname === targetPath; } catch { return false; }
        });
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});
