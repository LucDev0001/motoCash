const CACHE_NAME = "motomanager-v30.0.0"; // Versão incrementada para a nova estratégia

// Lista de arquivos essenciais para o App Shell.
const assetsToCache = [
  "./",
  "./index.html",
  "./freelancermoto.html",
  "./manifest.json",
  "./config.js",
  "./main.js",
  "./auth.js",
  "./ui.js",
  "./api.js",
  "./freelancermoto.js",
  "./Icon-192.png",
  "./Icon-512.png",
  // Adicionando CDNs para cache e melhor performance offline
  "https://cdn.tailwindcss.com/3.4.3",
  "https://unpkg.com/lucide@0.378.0",
  "https://cdn.jsdelivr.net/npm/chart.js",
];

const FIREBASE_HOST = "firestore.googleapis.com";

// Evento de Instalação: Salva os assets em cache.
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Instalando...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Adicionando assets ao cache");
        // Usamos `add` em vez de `addAll` para alguns recursos de CDN
        // para evitar que a falha de um único recurso quebre a instalação.
        // No entanto, para o App Shell, `addAll` é bom porque é atômico.
        return cache.addAll(assetsToCache);
      })
      .catch((err) => {
        console.error("[Service Worker] Falha ao abrir o cache", err);
      })
  );
});

// Evento de Ativação: Limpa caches antigos.
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Ativando...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[Service Worker] Limpando cache antigo:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Evento de Fetch: Intercepta requisições e serve do cache se disponível.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições que não são GET e requisições para a API do Firebase.
  if (request.method !== "GET" || url.hostname === FIREBASE_HOST) {
    return;
  }

  // Estratégia: Stale-While-Revalidate para recursos locais (App Shell)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            // Se a busca na rede for bem-sucedida, atualiza o cache
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });

          // Retorna a resposta do cache imediatamente (se houver),
          // ou espera a resposta da rede.
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Estratégia: Cache First, then Network (para CDNs e outros recursos de terceiros)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          // Se a busca for bem-sucedida, clona e armazena no cache para uso futuro
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    })
  );
});
