const CACHE_NAME = "motocash-v2";
const URLS_TO_CACHE = [
  "/",
  "/index.html",
  "/app.css",
  "/app.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Instala o Service Worker e adiciona arquivos ao cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Ativa o Service Worker e remove caches antigos se necessário
self.addEventListener("activate", (event) => {
  console.log("Service Worker ativado!");

  const cacheWhitelist = [CACHE_NAME]; // O único cache que queremos manter

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Se o cache não estiver na nossa "lista branca", ele será deletado
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log("Deletando cache antigo:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Intercepta requisições para servir do cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
