const CACHE = 'pinflix-v8-hardened';
const CORE = [
  './', './index.html', './assets/css/styles.css', './assets/js/app.js',
  './assets/js/lib/validation.js', './assets/js/services/storage.js',
  './assets/js/services/tmdb.js', './assets/js/services/providers.js',
  './assets/js/services/player-security.js', './assets/js/dev-config.js',
  './assets/icons/pinflix.svg', './assets/icons/poster-placeholder.svg',
  './manifest.webmanifest'
];
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('pinflix-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, clone)));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        return (await caches.match('./index.html')) || Response.error();
      }
      return Response.error(); // Never serve HTML fallback for JSON/JS.
    })
  );
});
