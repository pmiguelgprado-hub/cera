// CERA — service worker mínimo. Cachea los recursos estáticos para que la
// herramienta funcione sin cobertura una vez visitada. Estrategia:
// network-first con caché de respaldo (siempre intenta servir la última
// versión publicada; si no hay red, sirve la copia local).

const CACHE = 'cera-pasaporte-v1';
const RECURSOS = [
  '.',
  'index.html',
  'movil.html',
  'css/styles.css',
  'assets/mapa-asturias.svg',
  'assets/cera-mesa-territorial.png',
  'assets/fonts/geist-sans-latin.woff2',
  'assets/fonts/geist-mono-latin.woff2',
  'js/app.js',
  'js/calculo.js',
  'js/calculo-v2.js',
  'js/ui-state.js',
  'js/ui-state-v2.js',
  'js/atlas.js',
  'js/balance-energetico.js',
  'js/economia.js',
  'js/perfiles-consumo.js',
  'js/pasaporte.js',
  'js/producto.js',
  'js/solar-data.js',
  'js/trazabilidad.js',
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
