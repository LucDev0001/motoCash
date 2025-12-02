const CACHE_NAME = "motomanager-v31.0.0"; // Versão incrementada

// Lista de arquivos essenciais para o App Shell.
const assetsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/css/styles.css",
  "./ajuda.html",
  "./termos_de_uso.html",
  "./politicas_e_privacidade.html",
  "./Icon-192.png",
  "./Icon-512.png",
  "./assets/notification.mp3",
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
  const requestUrl = new URL(event.request.url);

  // Ignora requisições que não são GET, ou que são para domínios externos (APIs, etc.)
  // ou para o Firebase (para garantir dados em tempo real).
  if (
    event.request.method !== "GET" ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.hostname.includes("firebase")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Se encontrar no cache, retorna a resposta do cache. Senão, busca na rede.
      return response || fetch(event.request);
    })
  );
});

let monitoringInterval = null;
let currentUserId = null;

// Ouve por mensagens da página principal
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "START_MONITORING") {
    console.log(
      "[SW] Iniciando monitoramento para o usuário:",
      event.data.userId
    );
    currentUserId = event.data.userId;

    // Limpa qualquer monitoramento anterior
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }

    // Inicia a verificação imediatamente e depois a cada 4 horas
    checkUserDataAndNotify();
    monitoringInterval = setInterval(
      checkUserDataAndNotify,
      4 * 60 * 60 * 1000
    ); // 4 horas
  }
});

async function checkUserDataAndNotify() {
  if (!currentUserId) {
    console.log("[SW] Nenhum usuário para monitorar.");
    return;
  }

  // **IMPORTANTE:** O Service Worker não tem acesso direto ao `firebase` da página.
  // Para acessar o Firestore aqui, precisaríamos importar e inicializar o Firebase novamente.
  // Esta é uma implementação SIMPLIFICADA que mostra a lógica da notificação.
  // Uma implementação real exigiria a importação dos scripts do Firebase.

  console.log("[SW] Verificando dados para notificações...");

  // Lógica de verificação (SIMULADA - pois não temos acesso ao DB aqui)
  // Em uma implementação real, você faria um fetch para uma Cloud Function
  // ou inicializaria o Firebase aqui para ler os dados do usuário.

  // Exemplo de como a notificação seria disparada:
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  // Simulando que a CNH vence em menos de 30 dias
  const cnhExpiryDate = new Date(); // Data de hoje para teste
  cnhExpiryDate.setDate(today.getDate() + 29);

  if (cnhExpiryDate <= thirtyDaysFromNow) {
    const title = "Alerta de Vencimento!";
    const options = {
      body: `Sua CNH está próxima de vencer. Verifique a data no app.`,
      icon: "./Icon-192.png",
      badge: "./Icon-192.png", // Ícone para a barra de notificações do Android
      vibrate: [200, 100, 200], // Vibração
    };
    // `self.registration.showNotification` é como o SW envia a notificação
    self.registration.showNotification(title, options);
  }
}
