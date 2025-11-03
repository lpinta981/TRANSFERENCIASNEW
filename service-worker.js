const CACHE_NAME = 'ferresoluciones-v1';
const urlsToCache = [
  'https://transferenciasnew.manasakilla.com/',
  'https://transferenciasnew.manasakilla.com/index.html',
  'https://transferenciasnew.manasakilla.com/login.html',
  'https://transferenciasnew.manasakilla.com/styles.css',
  'https://transferenciasnew.manasakilla.com/app.js',
  'https://transferenciasnew.manasakilla.com/auth.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Archivos en caché');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('Error al cachear archivos:', err);
      })
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Limpiando caché antigua');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia de caché: Network First para datos dinámicos, Cache First para estáticos
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // No cachear las llamadas a Supabase ni al webhook
  if (url.hostname.includes('supabase') || url.hostname.includes('manasakilla')) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache First para recursos estáticos
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request).then(response => {
            // Cachear recursos nuevos
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, responseToCache);
              });
            return response;
          });
        })
        .catch(() => {
          // Si falla, mostrar página offline (opcional)
          if (request.destination === 'document') {
            return caches.match('https://transferenciasnew.manasakilla.com/index.html');
          }
        })
    );
  }
});
