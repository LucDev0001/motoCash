const CACHE_NAME = "motomanager-v29.1.29"; // Versão incrementada para forçar a atualização

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
  // Os arquivos de CDN (Tailwind, Leaflet, Firebase, etc.)
  // e imagens de screenshots/atalhos foram removidos.
  // O cache do navegador é mais eficiente para eles e isso evita a falha do Service Worker.
];

// Evento de Instalação: Salva os assets em cache.
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Instalando...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Adicionando assets ao cache");
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
  // Ignora requisições que não são GET (ex: POST para o Firebase)
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Se encontrar no cache, retorna a resposta do cache.
      // Senão, busca na rede.
      return response || fetch(event.request);
    })
  );
});
