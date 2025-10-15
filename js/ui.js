// js/ui.js
// Controla elementos gerais da interface como navegação e modais.

import { $ } from "./utils.js";
import { storage } from "./storage.js";

// Módulo de Navegação
export const navegacao = {
  mostrarTela: (telaId) => {
    document
      .querySelectorAll(".pagina")
      .forEach((sec) => (sec.style.display = "none"));
    const tela = $(telaId);
    if (tela) {
      tela.style.display = "block";
      navegacao.ajustarBarraInferior(telaId);
    }
  },
  mostrarTelaProtegida: (telaId) => {
    if (!storage.getUsuarioLogado()) {
      navegacao.mostrarTela("tela-login");
    } else {
      navegacao.mostrarTela(telaId);
    }
  },
  ajustarBarraInferior: (telaId) => {
    const barra = $("bottomBar");
    if (barra) {
      barra.style.display = telaId === "tela-login" ? "none" : "flex";
    }
  },
};

// Módulo da Barra de Navegação Inferior
export const bottomNav = {
  init: function (callbacks) {
    this.setupEventos(callbacks);
  },
  setupEventos: function (callbacks) {
    if ($("btnNavInicio"))
      $("btnNavInicio").onclick = () => {
        navegacao.mostrarTelaProtegida("tela-inicio");
        if(callbacks.onNavigateToHome) callbacks.onNavigateToHome();
      };
    if ($("btnNavGanhos"))
      $("btnNavGanhos").onclick = () => {
        navegacao.mostrarTelaProtegida("tela-ganhos");
        if(callbacks.onNavigateToGanhos) callbacks.onNavigateToGanhos();
      };
    if ($("btnNavPerfil"))
      $("btnNavPerfil").onclick = () => {
        navegacao.mostrarTelaProtegida("tela-perfil");
        if(callbacks.onNavigateToPerfil) callbacks.onNavigateToPerfil();
      };
    if ($("btnSair"))
      $("btnSair").addEventListener("click", () => {
        storage.limparSessao();
        navegacao.mostrarTela("tela-login");
      });
  },
};

// Função do Modal Telegram
export function checarEExibirModalTelegram() {
    const modal = $("modal-telegram");
    const avisoVisto = localStorage.getItem("avisoTelegramVisto");
  
    if (!avisoVisto) {
      modal.style.display = "flex";
      setTimeout(() => modal.classList.add("ativo"), 10);
  
      const fecharModal = () => {
        modal.classList.remove("ativo");
        setTimeout(() => (modal.style.display = "none"), 300);
        localStorage.setItem("avisoTelegramVisto", "true");
      };
  
      $("modal-fechar").onclick = fecharModal;
      $("btn-agora-nao").onclick = fecharModal;
      $("btn-entrar-telegram").onclick = fecharModal;
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          fecharModal();
        }
      });
    }
  }
