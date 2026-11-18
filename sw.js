// Service worker : met l'appli en cache pour qu'elle fonctionne hors ligne.
// Changer CACHE (v3 -> v4...) quand la liste FILES change ; les mises à jour du contenu arrivent seules.
const CACHE = 'subnet-v3';
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
  // cache: 'reload' : on contourne le cache HTTP du navigateur (GitHub Pages le garde
  // 10 min), sinon on risquerait de stocker l'ancienne version sous le nouveau nom.
  e.waitUntil(caches.open(CACHE).then((c) =>
    c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
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

// Stratégie "réseau d'abord, cache en secours" : en ligne on a toujours la dernière
// version (et le cache est rafraîchi au passage) ; hors ligne on sert le cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
