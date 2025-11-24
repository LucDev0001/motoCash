const CACHE_NAME = "motomanager-v29.1.19";

// Lista de arquivos essenciais para o App Shell.
const assetsToCache = [
  "./",
  "./index.html",
  "./freelancermoto.html",
  "./config.js",
  "./styles.css",
  "./freelancermoto.js",
  "./manifest.json",
  "./main.js",
  "./ui.js",
  "./api.js",
  "./Icon-192.png",
  "./Icon-512.png",
  // Adicione aqui os ícones dos atalhos se eles existirem
  "./icons/add.png",
  "./icons/profile.png",
  // Adicione as screenshots para a experiência offline
  "./painel.png",
  "./ganhos.png",
  "./ganhos2.png",
  // Fontes e bibliotecas externas (importante para offline)
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/lucide@latest",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js",
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
