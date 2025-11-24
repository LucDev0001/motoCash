import { initAuth } from "./auth.js";
import * as UIActions from "./ui.js";
import * as APIActions from "./api.js";

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

// --- THEME LOGIC ---
function initTheme() {
  const themeToggle = document.getElementById("theme-toggle");
  const themeToggleDot = document.getElementById("theme-toggle-dot");
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add("dark");
    if (themeToggle) {
      themeToggle.classList.add("bg-green-600");
      themeToggleDot.classList.add("translate-x-6");
    }
  } else {
    document.documentElement.classList.remove("dark");
  }
}

window.toggleTheme = () => {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");

  const themeToggle = document.getElementById("theme-toggle");
  const themeToggleDot = document.getElementById("theme-toggle-dot");

  if (themeToggle && themeToggleDot) {
    themeToggle.classList.toggle("bg-green-600", isDark);
    themeToggleDot.classList.toggle("translate-x-6", isDark);
  }
};

// --- ONLINE/OFFLINE STATUS ---
function initOnlineStatusIndicator() {
  const indicator = document.getElementById("offline-indicator");
  if (!indicator) return;

  const updateOnlineStatus = () => {
    indicator.classList.toggle("hidden", navigator.onLine);
  };

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  updateOnlineStatus(); // Check status on load
}

// --- GLOBAL STATE & INITIALIZATION ---

// Expose functions to the global window object so inline `onclick` attributes can access them
window.router = UIActions.router;
window.handleEmailLogin = APIActions.handleEmailLogin;
window.handleAnonLogin = APIActions.handleAnonLogin;
window.resendVerificationEmail = APIActions.resendVerificationEmail;
window.handlePasswordReset = APIActions.handlePasswordReset;
window.logout = APIActions.logout;
window.saveProfile = APIActions.saveProfile;
window.saveMonthlyGoal = APIActions.saveMonthlyGoal;
window.filterDashboard = UIActions.filterDashboard;
window.filterByShift = UIActions.filterByShift;
window.toggleCustomPicker = UIActions.toggleCustomPicker;
window.applyCustomFilter = UIActions.applyCustomFilter;
window.openShareModal = UIActions.openShareModal;
window.closeShareModal = UIActions.closeShareModal;
window.shareCategory = UIActions.shareCategory;
window.showNotification = UIActions.showNotification;
window.closeNotification = UIActions.closeNotification;
window.openEditModal = UIActions.openEditModal;
window.closeEditModal = UIActions.closeEditModal;
window.saveEdit = APIActions.saveEdit;
window.deleteItem = APIActions.deleteItem;
window.setTransactionType = UIActions.setTransactionType;
window.setFinanceTab = UIActions.setFinanceTab;
window.copyPixKey = UIActions.copyPixKey;
window.submitFinance = APIActions.submitFinance;
window.submitExpense = APIActions.submitExpense;
window.searchMarket = UIActions.searchMarket;
window.searchSupportArticles = UIActions.searchSupportArticles;
window.setHubView = UIActions.setHubView;
window.openMotoboyDetails = UIActions.openMotoboyDetails;
window.closeMotoboyDetails = UIActions.closeMotoboyDetails;
window.savePublicProfile = APIActions.savePublicProfile;
window.openPublicProfileEditor = UIActions.openPublicProfileEditor;
window.closeCompleteProfileModal = UIActions.closeCompleteProfileModal;
window.toggleUserOnlineStatus = async () => {
  const toggle = document.getElementById("user-status-toggle");
  const dot = document.getElementById("user-status-toggle-dot");
  const text = document.getElementById("user-status-text");
  const isGoingOnline = !toggle.classList.contains("bg-green-600");

  try {
    await APIActions.setUserOnlineStatus(isGoingOnline);

    // A UI só será atualizada se a chamada for bem-sucedida (ou se o perfil já estiver completo)
    toggle.classList.toggle("bg-green-600", isGoingOnline);
    toggle.classList.toggle("bg-gray-700", !isGoingOnline);
    dot.classList.toggle("translate-x-6", isGoingOnline);
    text.textContent = isGoingOnline ? "ONLINE" : "OFFLINE";
    text.classList.toggle("text-green-500", isGoingOnline);
  } catch (error) {
    // Se o perfil estiver incompleto, a promessa será rejeitada e o erro será capturado aqui.
    // Não é necessário fazer nada, pois o modal de perfil já foi aberto pela função setUserOnlineStatus.
    console.log("Ação de ficar online interrompida:", error);
  }
};
window.deleteMarketItem = APIActions.deleteMarketItem;
window.submitAd = APIActions.submitAd;
window.backupData = APIActions.backupData;
window.handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    APIActions.restoreData(file);
    event.target.value = null; // Limpa o input para permitir selecionar o mesmo arquivo novamente
  }
};

// Initialize the app
initTheme();
initOnlineStatusIndicator();
initAuth();
setTimeout(() => {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}, 500);
