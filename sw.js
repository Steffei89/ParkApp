const CACHE_NAME = 'parkapp-v3'; // Version
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

self.addEventListener('fetch', (event) => {
  // WICHTIG: Wir cachen nur GET-Requests (Laden von Seiten/Bildern).
  // Datenbank-Schreibvorgänge (POST/PUT/DELETE) ignoriert der Service Worker.
  if (event.request.method !== 'GET') {
      return; 
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Wir müssen die Antwort klonen, da sie nur einmal gelesen werden kann
        const responseToCache = networkResponse.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
        });
        
        return networkResponse;
      })
      .catch(() => {
        // Wenn Offline: Versuche es aus dem Cache
        return caches.match(event.request);
      })
  );
});