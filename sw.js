const CACHE = 'wa-blast-v2';
const ASSETS = [
  '/wablast/',
  '/wablast/index.html',
  '/wablast/dashboard.html',
  '/wablast/auth.html',
  '/wablast/billing.html',
  '/wablast/landing.html',
  '/wablast/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
