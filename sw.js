// CERA — service worker mínimo. Cachea los recursos estáticos para que la
// calculadora funcione sin cobertura una vez visitada. Estrategia:
// network-first con caché de respaldo (siempre intenta servir la última
// versión publicada; si no hay red, sirve la copia local).

const CACHE = 'cera-v9';
const RECURSOS = [
  '.',
  'index.html',
  'movil.html',
  'css/styles.css?v=7',
  'js/app.js',
  'js/calculo.js',
  'assets/fonts/bricolage-grotesque-latin.woff2',
  'assets/picos-banner.webp',
  'assets/pueblo-energetico.webp',
  'manifest.webmanifest',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(RECURSOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(
    fetch(evento.request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE).then((cache) => cache.put(evento.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(evento.request, { ignoreSearch: true }))
  );
});
