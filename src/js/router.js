import { unsubscribeListeners } from "./ui.js"; // Continua importando daqui
import { renderDashboard } from "./ui/dashboard.ui.js"; // Importa do novo módulo
import { renderGarage } from "./ui/garage.ui.js"; // Importa do novo módulo
import { renderHub, renderAddJob } from "./ui/hub.ui.js"; // Importa do novo módulo
import { renderAddFinance } from "./ui/finance.ui.js"; // Importa do novo módulo
import { renderMarketplace, renderAddMarketItem } from "./ui/market.ui.js"; // Importa do novo módulo
import { renderProfile } from "./ui/profile.ui.js"; // Importa do novo módulo
import { renderAbout } from "./ui/about.ui.js"; // Importa do novo módulo
import { renderPrivacyPolicy, renderSupport } from "./ui/static.ui.js"; // Importa do novo módulo
import {
  renderNotifications,
  renderAchievements,
  renderHistoryJobs,
  renderAcceptedJobs,
  renderJobChat,
} from "./ui/extra.ui.js"; // Importa do novo módulo
import { renderPublicProfile } from "./ui/publicProfile.ui.js"; // **NOVO**
import { renderGraxa } from "./ui/graxa.ui.js"; // **NOVO**

import { currentUser } from "./auth.js";

/**
 * Força a atualização do Service Worker se uma nova versão estiver disponível.
 * Isso garante que as alterações mais recentes sejam aplicadas.
 */
async function checkForUpdates() {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }
}

export async function router(view, params = {}) {
  unsubscribeListeners.forEach((u) => u());
  unsubscribeListeners.length = 0; // Limpa o array de forma mais eficiente
  const content = document.getElementById("content-area");
  const title = document.getElementById("page-title");
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.remove("text-yellow-600", "font-bold");
    b.classList.add("text-gray-400");
  });

  // **CORREÇÃO**: Verifica por atualizações sempre que uma nova rota é chamada.
  checkForUpdates();

  if (view === "dashboard") {
    const userName = currentUser.displayName?.split(" ")[0] || "Usuário";
    title.innerText = `Olá, ${userName}`;
    document
      .getElementById("nav-dashboard")
      .classList.add("text-yellow-600", "font-bold");
    renderDashboard(content);
  } else if (view === "garage") {
    title.innerText = "Minha Garagem";
    document
      .getElementById("nav-garage")
      .classList.add("text-yellow-600", "font-bold");
    renderGarage(content);
  } else if (view === "hub") {
    title.innerText = "Meu Corre";
    document
      .getElementById("nav-hub")
      .classList.add("text-yellow-600", "font-bold");
    renderHub(content);
  } else if (view === "finance") {
    title.innerText = "Adicionar Ganho  ou  Despesas";
    renderAddFinance(content);
  } else if (view === "market") {
    title.innerText = "Classificados";
    // O botão de navegação para o market está no perfil, não na nav principal.
    renderMarketplace(content);
  } else if (view === "market-add") {
    title.innerText = "Criar Anúncio";
    renderAddMarketItem(content);
  } else if (view === "profile") {
    title.innerText = "Perfil";
    document
      .getElementById("nav-profile")
      .classList.add("text-yellow-600", "font-bold");
    renderProfile(content);
  } else if (view === "about") {
    title.innerText = "Sobre o AppMotoCash";
    renderAbout(content);
  } else if (view === "privacy") {
    title.innerText = "Política de Privacidade";
    renderPrivacyPolicy(content);
  } else if (view === "support") {
    title.innerText = "Suporte e Tutoriais";
    renderSupport(content);
  } else if (view === "notifications") {
    title.innerText = "Notificações";
    renderNotifications(content);
  } else if (view === "achievements") {
    title.innerText = "Minhas Conquistas";
    renderAchievements(content);
  } else if (view === "add-job") {
    title.innerText = "Publicar Vaga";
    renderAddJob(content);
  } else if (view === "accepted-jobs") {
    title.innerText = "Vagas Aceitas";
    renderAcceptedJobs(content);
  } else if (view === "history-jobs") {
    title.innerText = "Meu Histórico";
    renderHistoryJobs(content);
  } else if (view === "job-chat") {
    title.innerText = "Negociação";
    renderJobChat(content); // A função já pega o ID da vaga internamente
  } else if (view === "publicProfile") {
    title.innerText = "Perfil Público";
    // Esconde a navegação e o cabeçalho para uma visualização limpa
    document.getElementById("main-app-header").classList.add("hidden");
    document.getElementById("main-app-nav").classList.add("hidden");
    await renderPublicProfile(content, params.userId);
  } else if (view === "graxa") {
    title.innerText = "Assistente Graxa";
    await renderGraxa(content);
  }
  setTimeout(() => lucide.createIcons(), 100);
}
