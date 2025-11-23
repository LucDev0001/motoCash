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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
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
  themeToggle.classList.toggle("bg-green-600", isDark);
  themeToggleDot.classList.toggle("translate-x-6", isDark);
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
  APIActions.restoreData(file);
  event.target.value = null; // Limpa o input para permitir selecionar o mesmo arquivo novamente
};

// Initialize the app
initTheme();
initOnlineStatusIndicator();
initAuth();
setTimeout(() => lucide.createIcons(), 500);
