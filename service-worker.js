const CACHE_NAME = "motocash-v4-final-
  "./",
  "./index.html",
  // CSS
  "./css/base.css",
  "./css/components.css",
  "./css/login.css",
  "./css/inicio.css",
  "./css/ganhos.css",
  "./css/perfil.css",
  "./css/marketplace.css",
  "./css/responsive.css",
  "./css/add-product.css",
  "./css/gerenciar-anuncios.css",
  "./css/legal.css",
  // JavaScript
  "./js/main.js",
  "./js/utils.js",
  "./js/date.utils.js",
  "./js/auth.js",
  "./js/perfil.js",
  "./js/ganhos.js",
  "./js/reports.js",
  "./js/weather.js",
  "./js/marketplace.js",
  "./js/admin.js",
  "./js/firebase-config.js", // <--- Adicionei este, geralmente é necessário
  // Templates HTML
  "./templates/inicio.html",
  "./templates/login.html",
  "./templates/ganhos.html",
  "./templates/perfil.html",
  "./templates/marketplace.html",
  "./templates/add-product.html",
  "./templates/gerenciar-anuncios.html",
  "./templates/modal.html",
  "./templates/termos-de-uso.html",
  "./templates/politica-de-privacidade.html",
  "./templates/admin.html",
  // Outros
  "./manifest.json",
  // Ícones e Avatares (Os vilões comuns de erro 404)
  // Se algum desses não existir, o novo código vai avisar no console em vez de quebrar o site
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./avatares/ava1.jpg",
  "./avatares/ava2.jpg",
  "./avatares/ava3.jpg",
  "./icons/zap.png",
];

// --- INSTALAÇÃO INTELIGENTE ---
// Tenta cachear arquivo por arquivo. Se um falhar, avisa no console mas não quebra o resto.
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Força a ativação imediata
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Service Worker: Abrindo cache...");
      return Promise.all(
        URLS_TO_CACHE.map((url) => {
          return cache.add(url).catch((error) => {
            console.error(
              `ALERTA: Falha ao cachear o arquivo '${url}'. Verifique se ele existe na pasta.`,
              error
            );
          });
        })
      );
    })
  );
});

// --- ATIVAÇÃO E LIMPEZA ---
self.addEventListener("activate", (event) => {
  console.log("Service Worker ativado!");
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log("Deletando cache antigo:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Assume o controle da página imediatamente
});

// --- INTERCEPTAÇÃO (FETCH) ---
self.addEventListener("fetch", (event) => {
  // Ignora requisições que não sejam http/https (como chrome-extension)
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retorna do cache se tiver, senão vai na rede
      return (
        response ||
        fetch(event.request)
          .then((networkResponse) => {
            return networkResponse;
          })
          .catch(() => {
            // Opcional: Se estiver offline e não tiver cache, poderia retornar uma página de fallback aqui
          })
      );
    })
  );
});
