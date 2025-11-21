const CACHE_NAME = "motocash-v15";
const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./main.js",
  "./api.js",
  "./ui.js",
  "./auth.js",
  "./config.js",
  "./Icon-192.png",
  "./Icon-512.png",
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/lucide@latest",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js",
];

// Instalação do Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log("Service Worker: Caching app shell");
      await cache.addAll(urlsToCache);
    })()
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Service Worker: Deleting old cache", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })()
  );
  return self.clients.claim();
});

// Interceptar requisições (Estratégia Stale-While-Revalidate para assets locais)
self.addEventListener("fetch", (event) => {
  // Ignorar requisições do Firebase para não interferir com o cache offline dele
  if (event.request.url.includes("firestore.googleapis.com")) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      });

      // Retorna do cache imediatamente se disponível, enquanto busca atualização em segundo plano.
      return cachedResponse || fetchPromise;
    })()
  );
});
