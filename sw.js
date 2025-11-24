const CACHE_NAME = 'parkapp-v2'; // Version hochgezählt
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/js/main.js',
  '/js/dom.js',
  '/js/firebase.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/utils.js',
  '/js/config.js',
  '/js/services/auth.js',
  '/js/services/booking.js',
  '/js/services/invite.js',
  '/js/views/dashboard.js',
  '/js/views/guest.js',
  '/js/views/admin.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

// KORRIGIERT: Network-First Strategie für zuverlässiges "Neuladen"
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Wenn Netzwerk erfolgreich: Cache aktualisieren
        return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
        });
      })
      .catch(() => {
        // Wenn Netzwerk fehlschlägt (Offline): Cache nutzen
        return caches.match(event.request);
      })
  );
});