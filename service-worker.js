const CACHE_NAME = 'ferresoluciones-v12';
const urlsToCache = [
  'https://transferencias.manasakilla.com/',
  'https://transferencias.manasakilla.com/index.html',
  'https://transferencias.manasakilla.com/login.html',
  'https://transferencias.manasakilla.com/styles.css',
  'https://transferencias.manasakilla.com/app.js',
  'https://transferencias.manasakilla.com/auth.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.log('Error al cachear archivos:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  
  if (!request.url.startsWith('http')) {
    return;
  }
  
  const url = new URL(request.url);

  if (url.hostname.includes('supabase') || url.hostname.includes('manasakilla')) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request).then(response => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, responseToCache))
              .catch(err => console.log('Error al cachear:', err));
            return response;
          });
        })
        .catch(() => {
          if (request.destination === 'document') {
            return caches.match('https://transferencias.manasakilla.com/index.html');
          }
        })
    );
  }
});
