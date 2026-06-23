// ── Service Worker mit Auto-Update ──
// Cache-Name enthält Versionsnummer – bei Änderung wird alter Cache automatisch geleert
const CACHE_VERSION = 'laufkarten-v1.5.0';
const STATIC = [
  './',
  './index.html',
  './manifest.json',
  './version.json',
];

// Install: cache static files
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(STATIC))
      .catch(() => {})
  );
  // Activate immediately without waiting for old SW to finish
  self.skipWaiting();
});

// Activate: delete all old caches (but keep IndexedDB – config + PDFs stay!)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', e => {
  // Never intercept GitHub API calls
  if (e.request.url.includes('api.github.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // For version.json: always try network first so updates are detected
      if (e.request.url.includes('version.json')) {
        return fetch(e.request)
          .then(resp => {
            if (resp && resp.status === 200) {
              caches.open(CACHE_VERSION).then(c => c.put(e.request, resp.clone()));
            }
            return resp;
          })
          .catch(() => cached);
      }
      // For everything else: cache first
      return cached || fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          caches.open(CACHE_VERSION).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});

// Handle SKIP_WAITING message from app
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
