import { initAuth } from "./auth.js";
import { db } from "./config.js";
import { router } from "./router.js";
import {
  toggleTheme,
  initTheme,
  resendVerificationEmail,
  toggleUserOnlineStatus,
} from "./ui.js";

export let manifest = {}; // Exporta o manifesto para ser usado em outras partes

// --- PWA INSTALL LOGIC ---
let deferredPrompt;
const installBtn = document.getElementById("pwa-install-btn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) {
    installBtn.classList.remove("hidden");
  }
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      installBtn.classList.add("hidden");
    }
    deferredPrompt = null;
  });
}

// --- PWA UPDATE LOGIC (SERVICE WORKER) ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      console.log("Service Worker registado.");

      // Se já houver uma atualização à espera
      if (reg.waiting) {
        showUpdateToast();
        return;
      }

      // Monitoriza novas atualizações
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // Nova versão pronta!
            showUpdateToast();
          }
        });
      });
    })
    .catch(console.error);

  // Recarrega a página quando o novo SW assumir o controlo
  let refreshing;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    window.location.reload();
    refreshing = true;
  });
}

// Função local para mostrar o Toast de Atualização Específico
function showUpdateToast() {
  const container = document.getElementById("toast-container");
  if (!container) return;

  // Remove toasts antigos se houver
  const existingToast = document.getElementById("update-toast");
  if (existingToast) existingToast.remove();

  const toast = document.createElement("div");
  toast.id = "update-toast";
  toast.className = `w-full bg-gray-800 border border-yellow-600 shadow-2xl rounded-lg p-4 flex items-start gap-4 pointer-events-auto toast-enter`;
  toast.innerHTML = `
    <div>
        <i data-lucide="refresh-cw" class="w-6 h-6 text-yellow-500 animate-spin" style="animation-duration: 2s;"></i>
    </div>
    <div class="flex-1">
        <h4 class="font-bold text-white">Nova atualização disponível!</h4>
        <p class="text-sm text-gray-400 mt-1">Recarregue para aplicar as melhorias e novas funcionalidades.</p>
        <div class="mt-3 flex gap-2">
            <button id="btn-update-now" class="flex-1 bg-yellow-500 text-black text-sm font-bold py-2 px-4 rounded hover:bg-yellow-400 transition">
                Atualizar Agora
            </button>
        </div>
    </div>
    <div>
        <button id="btn-close-toast" class="text-gray-500 hover:text-white">
            <i data-lucide="x" class="w-5 h-5"></i>
        </button>
    </div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  document.getElementById("btn-update-now").addEventListener("click", () => {
    if (navigator.serviceWorker.waiting) {
      navigator.serviceWorker.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  });

  document.getElementById("btn-close-toast").addEventListener("click", () => {
    toast.classList.remove("toast-enter");
    toast.classList.add("toast-leave");
    setTimeout(() => toast.remove(), 500); // Remove o elemento após a animação
  });
}

// --- INICIALIZAÇÃO E EVENT LISTENERS GLOBAIS ---

async function initApp() {
  // **NOVO**: Verifica se a URL é de um perfil público
  const urlParams = new URLSearchParams(window.location.search);
  const profileId = urlParams.get("profile");

  if (profileId) {
    // Se for um perfil público, renderiza a página e para a execução
    router("publicProfile", { userId: profileId });
    return;
  }

  initTheme();

  // Indicador de Status Online/Offline
  const indicator = document.getElementById("offline-indicator");
  if (indicator) {
    const updateOnlineStatus = () =>
      indicator.classList.toggle("hidden", navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus();
  }

  // Carrega as configurações globais e verifica o modo manutenção
  const maintenanceActive = await loadGlobalSettings();
  if (maintenanceActive) {
    // Se a manutenção estiver ativa, não continua a inicialização do app.
    return;
  }

  // Listeners para os botões do Header e Banners
  const resendBtn = document.getElementById("resend-verification-btn");
  if (resendBtn) resendBtn.addEventListener("click", resendVerificationEmail);

  const closeBannerBtn = document.getElementById(
    "close-verification-banner-btn"
  );
  if (closeBannerBtn) {
    closeBannerBtn.addEventListener("click", () => {
      document
        .getElementById("email-verification-banner")
        .classList.add("hidden");
    });
  }

  const notificationsBtn = document.getElementById("notifications-btn");
  if (notificationsBtn)
    notificationsBtn.addEventListener("click", () => router("notifications"));

  const headerMarketBtn = document.getElementById("header-market-btn");
  if (headerMarketBtn)
    headerMarketBtn.addEventListener("click", () => router("market"));

  const headerGraxaBtn = document.getElementById("header-graxa-btn");
  if (headerGraxaBtn)
    headerGraxaBtn.addEventListener("click", () => router("graxa"));

  const statusToggle = document.getElementById("user-status-toggle");
  if (statusToggle)
    statusToggle.addEventListener("click", toggleUserOnlineStatus);

  // Navegação principal
  document
    .getElementById("nav-dashboard")
    .addEventListener("click", () => router("dashboard"));
  document
    .getElementById("nav-garage")
    .addEventListener("click", () => router("garage"));
  document
    .getElementById("nav-finance")
    .addEventListener("click", () => router("finance"));
  document
    .getElementById("nav-hub")
    .addEventListener("click", () => router("hub"));
  document
    .getElementById("nav-profile")
    .addEventListener("click", () => router("profile"));

  // Inicializa a autenticação (que por sua vez, carrega a primeira tela)
  initAuth();

  // Renderiza os ícones uma vez que a DOM está pronta
  setTimeout(() => lucide.createIcons(), 500);
}

// Inicia o aplicativo quando o conteúdo da DOM estiver carregado
document.addEventListener("DOMContentLoaded", initApp);

/**
 * Carrega as configurações globais do Firestore e as aplica.
 * @returns {Promise<boolean>} - Retorna true se o app estiver em manutenção, false caso contrário.
 */
async function loadGlobalSettings() {
  try {
    const settingsRef = db
      .collection("artifacts")
      .doc("moto-manager-v1") // Usa o appId global
      .collection("config")
      .doc("app_settings");

    const docSnap = await settingsRef.get();

    if (docSnap.exists) {
      const settings = docSnap.data();
      window.appSettings = settings; // Armazena as configurações globalmente

      // 1. Verifica o Modo Manutenção
      if (settings.maintenance?.enabled) {
        const message =
          settings.maintenance.message ||
          "Estamos em manutenção. Voltamos em breve!";
        document.body.innerHTML = `
          <div class="h-screen w-screen flex flex-col items-center justify-center text-center p-4 bg-gray-900 text-white">
            <i data-lucide="wrench" class="w-20 h-20 text-yellow-500 mb-6"></i>
            <h1 class="text-3xl font-bold">Sistema em Manutenção</h1>
            <p class="text-gray-400 mt-4 max-w-md">${message}</p>
          </div>
        `;
        lucide.createIcons();
        return true; // Interrompe o carregamento do app
      }

      // 2. Verifica a Mensagem do Dia (MOTD)
      if (settings.motd?.enabled && settings.motd?.message) {
        displayMotd(settings.motd.message);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar configurações globais:", error);
  }
  return false; // App não está em manutenção
}

/**
 * Exibe um banner com a Mensagem do Dia.
 * @param {string} message - A mensagem a ser exibida.
 */
function displayMotd(message) {
  const motdBanner = document.createElement("div");
  motdBanner.className =
    "bg-yellow-500 text-black text-center p-2 text-sm font-semibold";
  motdBanner.textContent = message;
  document.body.prepend(motdBanner); // Adiciona o banner no topo da página
}
