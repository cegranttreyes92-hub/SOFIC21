const CACHE_NAME = 'studio-citas-v6';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/styles.css',
    './js/firebase-config.js',
    './js/store.js',
    './js/logic.js',
    './js/app.js',
    './assets/icons/apple-touch-icon.png',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/favicon-32.png'
];

// Instalación: Precarga de assets críticos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('[SW] Error en precarga parcial:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activación: Limpieza de caches antiguos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia de peticiones
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Ignorar peticiones no HTTP/HTTPS o peticiones de Firebase Firestore/Auth
    if (!url.protocol.startsWith('http')) return;
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.hostname.includes('securetoken.googleapis.com')) {
        return;
    }

    // 1. Archivos estáticos pesados / imágenes / iconos: Cache-First
    if (url.pathname.includes('/assets/') || request.destination === 'image' || request.destination === 'font') {
        event.respondWith(
            caches.match(request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // 2. HTML, JS, CSS y llamadas locales: Network-First (para que actualizaciones se reflejen rápido)
    event.respondWith(
        fetch(request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
                }
                return networkResponse;
            })
            .catch(() => {
                // Fallback a caché si no hay conexión móvil
                return caches.match(request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
