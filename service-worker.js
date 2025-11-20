const CACHE_NAME = "motocash-v3.2.28"; // Versão do cache atualizada
const URLS_TO_CACHE = [
  "/",
  "/index.html",
  // CSS
  "/css/base.css",
  "/css/components.css",
  "/css/login.css",
  "/css/inicio.css",
  "/css/ganhos.css",
  "/css/perfil.css",
  "/css/marketplace.css",
  "/css/responsive.css",
  "/css/add-product.css",
  "/css/legal.css",
  // JavaScript
  "/js/main.js",
  "/js/utils.js",
  "/js/date.utils.js",
  "/js/auth.js",
  "/js/perfil.js",
  "/js/ganhos.js",
  "/js/reports.js",
  "/js/weather.js",
  "/js/marketplace.js",
  "/js/admin.js",
  // Templates HTML
  "/templates/inicio.html",
  "/templates/login.html",
  "/templates/ganhos.html",
  "/templates/perfil.html",
  "/templates/marketplace.html",
  "/templates/add-product.html",
  "/templates/modal.html",
  "/templates/termos-de-uso.html",
  "/templates/politica-de-privacidade.html",
  "/templates/admin.html",
  // Outros
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  // Avatares
  "/avatares/ava1.jpg",
  "/avatares/ava2.jpg",
  "/avatares/ava3.jpg",
];

// Instala o Service Worker e adiciona arquivos ao cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Cache aberto");
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
      // Retorna do cache se encontrar, senão busca na rede
      return response || fetch(event.request);
    })
  );
});
