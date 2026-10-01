// Offline support: precache every file, serve cache-first.
// Bump VERSION whenever you change any file so phones pick up the update.
const VERSION = 'dm-v2';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/app.js',
  './js/core/rng.js',
  './js/core/format.js',
  './js/core/ev.js',
  './js/core/bayes.js',
  './js/core/cards.js',
  './js/core/poker.js',
  './js/core/bias.js',
  './js/core/difficulty.js',
  './js/core/session.js',
  './js/core/stats.js',
  './js/core/storage.js',
  './js/scenarios/index.js',
  './js/scenarios/ev.js',
  './js/scenarios/bayes.js',
  './js/scenarios/poker.js',
  './js/ui/dom.js',
  './js/ui/grid.js',
  './js/ui/charts.js',
  './js/ui/views.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(hit => hit || fetch(event.request).catch(() => caches.match('./index.html'))));
});
