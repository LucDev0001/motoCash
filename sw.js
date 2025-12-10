const CACHE_NAME = "motocash-v2.2.0"; // Versão incrementada para forçar a atualização do cache
const DATA_CACHE_NAME = "motocash-data-v2.2.0";

// Lista de arquivos essenciais para o App Shell.
const assetsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/css/styles.css",
  "./Icon-192.png",
  "./Icon-512.png",
  "./assets/notification.mp3",
  "./assets/img/bike.svg", // Novo ícone local
  // Ícones para atalhos
  "./icons/add.png",
  "./icons/garage.png",
  // Templates de Views (essencial para navegação offline)
  "./src/templates/views/about.html",
  "./src/templates/views/accepted-jobs.html",
  "./src/templates/views/achievements.html",
  "./src/templates/views/add-job.html",
  "./src/templates/views/dashboard.html",
  "./src/templates/views/finance.html",
  "./src/templates/views/garage.html",
  "./src/templates/views/graxa.html",
  "./src/templates/views/history-jobs.html",
  "./src/templates/views/hub.html",
  "./src/templates/views/job-chat.html",
  "./src/templates/views/market-add.html",
  "./src/templates/views/market.html",
  "./src/templates/views/notifications.html",
  "./src/templates/views/privacy.html",
  "./src/templates/views/profile.html",
  "./src/templates/views/publicProfile.html",
  "./src/templates/views/support.html",
  // Templates de Modais (essencial para interações offline)
  "./src/templates/modals/adModal.html", // Novo modal de anúncio
  "./src/templates/modals/rateCompanyModal.html", // Novo modal de avaliação
  "./src/templates/modals/completeProfileModal.html",
  "./src/templates/modals/debitsModal.html",
  "./src/templates/modals/documentsModal.html",
  "./src/templates/modals/editModal.html",
  "./src/templates/modals/maintenanceModal.html",
  "./src/templates/modals/marketDetailModal.html",
  "./src/templates/modals/notificationModal.html",
  "./src/templates/modals/odometerModal.html",
  "./src/templates/modals/proPlanModal.html",
  "./src/templates/modals/serviceHistoryModal.html",
  "./src/templates/modals/serviceRecordModal.html",
  "./src/templates/modals/shareModal.html",
  // Arquivos de dados para a assistente Graxa
  "./src/data/ajuda.json",
  "./src/data/leis_transito.json",
];

// Evento de Instalação: Salva os assets em cache.
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Instalando...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log(
          "[SW] Adicionando App Shell ao cache:",
          assetsToCache.length,
          "arquivos"
        );
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
        cacheNames
          .filter(
            (cacheName) =>
              cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME
          )
          .map((cacheName) => {
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

  // Estratégia para a API da FIPE e manuais JSON: Stale-While-Revalidate
  // Responde rápido com o cache, mas busca uma nova versão em segundo plano.
  if (
    requestUrl.hostname.includes("parallelum.com.br") ||
    requestUrl.pathname.startsWith("/src/data/manuals/")
  ) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          // Retorna o cache imediatamente se existir, senão espera a rede.
          return cachedResponse || fetchPromise;
        });
      })
    );
    return; // Encerra aqui para esta estratégia
  }

  // Estratégia para o App Shell (arquivos locais): Cache First
  // Se o arquivo está no cache, serve a partir dele. Senão, busca na rede.
  // Ignora requisições que não são GET e as do Firebase para garantir dados em tempo real.
  if (
    requestUrl.origin === self.location.origin &&
    event.request.method === "GET"
  ) {
    // Não faz cache de requisições do Firebase
    if (requestUrl.pathname.includes("firestore.googleapis.com")) {
      return;
    }

    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response; // Encontrado no cache
        }
        // Não encontrado no cache, busca na rede
        return fetch(event.request);
      })
    );
  }
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
