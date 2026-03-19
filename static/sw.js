// FillTheHole.ca Service Worker
// Handles push notifications and provides a basic offline fallback for the app shell.

const CACHE_NAME = 'fillthehole-v1';
const OFFLINE_URL = '/';

// ── Install: cache the app shell ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first with offline fallback ─────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin navigation
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // For navigation requests, fall back to cached home page if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// ── Push: display notification ─────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'FillTheHole.ca', body: 'Something happened.', url: '/' };
  try {
    data = event.data.json();
  } catch {
    // Malformed payload — use defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕳️</text></svg>",
      badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕳️</text></svg>",
      data: { url: data.url },
      tag: 'fillthehole-update',
      renotify: true
    })
  );
});

// ── Notification click: open or focus the app ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url === targetUrl);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
