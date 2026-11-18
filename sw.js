// Service worker : met l'appli en cache pour qu'elle fonctionne hors ligne.
// Changer CACHE (v1 -> v2...) à chaque modification des fichiers pour forcer la mise à jour.
const CACHE = 'subnet-v2';
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'vlsm.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie "cache d'abord, réseau ensuite"
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
