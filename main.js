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
  navigator.serviceWorker.register("./sw.js").then((reg) => {
    console.log('Service Worker registado.');

    // Se já houver uma atualização à espera
    if (reg.waiting) {
      showUpdateToast();
      return;
    }

    // Monitoriza novas atualizações
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Nova versão pronta!
          showUpdateToast();
        }
      });
    });
  }).catch(console.error);

  // Recarrega a página quando o novo SW assumir o controlo
  let refreshing;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    window.location.reload();
    refreshing = true;
  });
}

// Função local para mostrar o Toast de Atualização Específico
function showUpdateToast() {
    const container = document.getElementById('toast-container');
    
    if (!container) {
        // Fallback se não houver container
        if(confirm("Nova versão disponível. Atualizar agora?")) {
            window.location.reload();
        }
        return;
    }

    const toast = document.createElement('div');
    toast.className = `flex flex-col gap-2 px-4 py-3 rounded-lg text-white shadow-xl border border-yellow-600 bg-gray-800 pointer-events-auto toast-enter z-[200]`;
    toast.innerHTML = `
        <div class="flex items-center gap-2">
            <i data-lucide="refresh-cw" class="w-5 h-5 text-yellow-500"></i>
            <span class="text-sm font-bold">Nova atualização disponível!</span>
        </div>
        <p class="text-xs text-gray-400">Melhorias foram aplicadas.</p>
        <button id="btn-update-now" class="bg-yellow-500 text-black text-xs font-bold py-2 px-4 rounded hover:bg-yellow-400 transition w-full mt-1">
            ATUALIZAR AGORA
        </button>
    `;

    container.appendChild(toast);
    
    // Tenta renderizar ícones se a biblioteca estiver disponível
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    document.getElementById('btn-update-now').addEventListener('click', () => {
        if (navigator.serviceWorker.waiting) {
            // Envia mensagem para o SW pular a espera (skipWaiting)
            navigator.serviceWorker.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
            window.location.reload();
        }
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
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}, 500);

