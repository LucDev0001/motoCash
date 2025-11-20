// js/ganhos.js
import { perfil } from "./perfil.js";
import { auth as firebaseAuth, db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { $ } from "./utils.js";
import { getDateRange } from "./date.utils.js";
import { formatarMoeda } from "./utils.js";

export const ganhos = {
  ganhoEditandoId: null,
  localGanhosCache: null,

  init: function (dependencies) {
    this.setupEventListeners();
    this.setupFiltros();
    this.atualizarUI();

    // Fecha menus flutuantes ao clicar fora
    document.body.addEventListener("click", () =>
      document
        .querySelectorAll(".menu-ganho-opcoes")
        .forEach((m) => (m.style.display = "none"))
    );
  },

  setupEventListeners: function () {
    const cardForm = $("card-formulario-ganho");
    const btnFechar = $("btn-fechar-form-ganho");

    // 1. Botões das Categorias (Loja, Passageiro, Entrega)
    document.querySelectorAll(".btn-acao-ganho").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target; // 'loja_fixa', 'passageiros', 'entregas'
        this.abrirModal(target);
      });
    });

    // 2. Botão Fechar
    if (btnFechar && cardForm) {
      btnFechar.addEventListener("click", () => {
        cardForm.style.display = "none";
      });
    }

    // 3. Submits dos 3 Formulários
    if ($("formGanhoLojaFixa")) {
      $("formGanhoLojaFixa").addEventListener("submit", (e) => {
        e.preventDefault();
        this.adicionarGanho("loja_fixa", e);
      });
    }
    if ($("formGanhoPassageiros")) {
      $("formGanhoPassageiros").addEventListener("submit", (e) => {
        e.preventDefault();
        this.adicionarGanho("passageiros", e);
      });
    }
    if ($("formGanhoEntregas")) {
      $("formGanhoEntregas").addEventListener("submit", (e) => {
        e.preventDefault();
        this.adicionarGanho("entregas", e);
      });
    }
  },

  abrirModal: function (tipo) {
    const cardForm = $("card-formulario-ganho");
    const titulo = $("titulo-form-ganho");

    // Esconde todos os forms primeiro
    document
      .querySelectorAll(".form-ganho-conteudo")
      .forEach((f) => (f.style.display = "none"));

    // Reseta formulários
    document.querySelectorAll("form").forEach((f) => f.reset());

    // Mostra o correto
    if (tipo === "loja_fixa") {
      titulo.textContent = "Novo Ganho: Loja Fixa";
      $("formGanhoLojaFixa").style.display = "block";
    } else if (tipo === "passageiros") {
      titulo.textContent = "Novo Ganho: App Passageiro";
      $("formGanhoPassageiros").style.display = "block";
    } else if (tipo === "entregas") {
      titulo.textContent = "Novo Ganho: App Entrega";
      $("formGanhoEntregas").style.display = "block";
    }

    cardForm.style.display = "block";
  },

  setupFiltros: function () {
    const update = () => this.atualizarUI();
    if ($("filtro-periodo"))
      $("filtro-periodo").addEventListener("change", update);
  },

  adicionarGanho: async function (categoria, event) {
    this.localGanhosCache = null;
    const usuarioLogado = firebaseAuth.currentUser;

    if (!usuarioLogado) return alert("Você precisa estar logado.");

    let novoGanho = {
      id: String(Date.now()),
      categoria: categoria,
    };

    // Captura de dados baseada na categoria
    if (categoria === "loja_fixa") {
      novoGanho.data = $("data-loja").value;
      const valorDiaria = parseFloat($("valorDiaria-loja").value) || 0;
      const taxaEntrega = parseFloat($("taxaEntrega-loja").value) || 0;
      const qtdEntregas = parseInt($("qtdEntregas-loja").value) || 0;

      novoGanho.valor = valorDiaria + taxaEntrega * qtdEntregas;
      novoGanho.qtd = qtdEntregas; // Qtd Entregas
      // Salva detalhes extras se quiser editar depois
      novoGanho.detalhes = { valorDiaria, taxaEntrega };
    } else if (categoria === "passageiros") {
      novoGanho.data = $("data-passageiros").value;
      novoGanho.qtd = parseInt($("qtd-passageiros").value) || 0; // Qtd Corridas
      novoGanho.valor = parseFloat($("valor-passageiros").value) || 0; // Valor Total direto
    } else if (categoria === "entregas") {
      novoGanho.data = $("data-entregas").value;
      novoGanho.qtd = parseInt($("qtd-entregas").value) || 0; // Qtd Entregas
      novoGanho.valor = parseFloat($("valor-entregas").value) || 0; // Valor Total direto
    }

    if (!novoGanho.data || novoGanho.valor <= 0) {
      return alert("Preencha a data e os valores corretamente.");
    }

    try {
      const docRef = doc(
        db,
        "usuarios",
        usuarioLogado.uid,
        "ganhos",
        novoGanho.id
      );
      await setDoc(docRef, novoGanho);
      alert("Ganho adicionado!");
      $("card-formulario-ganho").style.display = "none";
      this.atualizarUI();
      this.atualizarTelaInicio();
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao salvar.");
    }
  },

  // Funções de Cache e Fetch (Mantidas iguais)
  fetchGanhos: async function () {
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) return [];
    if (this.localGanhosCache) return this.localGanhosCache;

    const ganhosRef = collection(db, "usuarios", usuarioLogado.uid, "ganhos");
    const querySnapshot = await getDocs(ganhosRef);
    const ganhos = [];
    querySnapshot.forEach((doc) => ganhos.push(doc.data()));

    this.localGanhosCache = ganhos;
    return ganhos;
  },

  excluirGanho: async function (ganhoId) {
    if (confirm("Deseja excluir?")) {
      const usuarioLogado = firebaseAuth.currentUser;
      await deleteDoc(
        doc(db, "usuarios", usuarioLogado.uid, "ganhos", ganhoId)
      );
      this.localGanhosCache = null;
      this.atualizarUI();
      this.atualizarTelaInicio();
    }
  },

  atualizarUI: async function () {
    if (!firebaseAuth.currentUser || !$("listaGanhos")) return;

    const ganhos = await this.fetchGanhos();
    // Ordenar por data (mais recente primeiro)
    ganhos.sort((a, b) => new Date(b.data) - new Date(a.data));

    const lista = $("listaGanhos");
    lista.innerHTML = "";

    // Configurações visuais por categoria
    const configCategoria = {
      loja_fixa: {
        nome: "Loja Fixa",
        classe: "badge-loja",
        labelQtd: "Entregas",
      },
      passageiros: {
        nome: "App Passageiro",
        classe: "badge-passageiro",
        labelQtd: "Corridas",
      },
      entregas: {
        nome: "App Entrega",
        classe: "badge-entrega",
        labelQtd: "Entregas",
      },
      // Fallback
      undefined: { nome: "Geral", classe: "badge-loja", labelQtd: "Qtd" },
    };

    ganhos.forEach((item) => {
      // Ajusta data
      const dataObj = new Date(item.data + "T12:00:00");
      const diaSemana = dataObj.toLocaleDateString("pt-BR", {
        weekday: "short",
      });
      const dataFormatada = dataObj.toLocaleDateString("pt-BR");

      // Pega configs da categoria
      const config =
        configCategoria[item.categoria] || configCategoria.undefined;

      const li = document.createElement("li");
      li.className = "ganho-item";
      li.innerHTML = `
          <div class="ganho-info">
              <span class="badge-categoria ${config.classe}">${
        config.nome
      }</span>
              <p class="ganho-data"><strong>${diaSemana}</strong>, ${dataFormatada}</p>
              <p class="ganho-valor">${formatarMoeda(item.valor)}</p>
              <p class="info-secundaria">${config.labelQtd}: ${
        item.qtd || 0
      }</p>
          </div>
          <div class="ganho-acoes">
              <button class="btn-excluir-direto" style="color:red; border:none; background:none; font-size:1.2rem;">&times;</button>
          </div>`;

      li.querySelector(".btn-excluir-direto").addEventListener("click", () =>
        this.excluirGanho(item.id)
      );
      lista.appendChild(li);
    });

    // Atualiza Resumo Rápido do Filtro (se houver lógica de filtro ativa)
    this.atualizarResumoFiltro(ganhos);
  },

  atualizarResumoFiltro: function (ganhos) {
    const total = ganhos.reduce((acc, g) => acc + g.valor, 0);
    const qtd = ganhos.reduce((acc, g) => acc + (g.qtd || 0), 0);

    if ($("resumo-filtro-total"))
      $("resumo-filtro-total").textContent = formatarMoeda(total);
    if ($("resumo-filtro-entregas"))
      $("resumo-filtro-entregas").textContent = qtd;
  },

  atualizarTelaInicio: async function () {
    const usuario = firebaseAuth.currentUser;
    if (!usuario) return;
    const ganhosUsuario = await this.fetchGanhos();

    const hoje = new Date().toISOString().slice(0, 10);

    // Cálculo Hoje
    const ganhosHoje = ganhosUsuario
      .filter((g) => g.data === hoje)
      .reduce((s, g) => s + g.valor, 0);

    // Cálculo Semana
    const semanaRange = getDateRange("esta-semana");
    const ganhosSemana = ganhosUsuario
      .filter(
        (g) =>
          new Date(g.data + "T00:00:00") >= semanaRange.start &&
          new Date(g.data + "T00:00:00") <= semanaRange.end
      )
      .reduce((s, g) => s + g.valor, 0);

    // Cálculo Mês
    const mesRange = getDateRange("este-mes");
    const ganhosMes = ganhosUsuario
      .filter(
        (g) =>
          new Date(g.data + "T00:00:00") >= mesRange.start &&
          new Date(g.data + "T00:00:00") <= mesRange.end
      )
      .reduce((s, g) => s + g.valor, 0);

    // Última entrega
    let ultimaEntrega = "-";
    if (ganhosUsuario.length > 0) {
      const ult = ganhosUsuario.sort(
        (a, b) => new Date(b.data) - new Date(a.data)
      )[0];
      ultimaEntrega = `${new Date(ult.data + "T12:00:00").toLocaleDateString(
        "pt-BR"
      )} (${formatarMoeda(ult.valor)})`;
    }

    // Média de entregas
    const entregasPorDia = ganhosUsuario.reduce((acc, g) => {
      acc[g.data] = (acc[g.data] || 0) + (g.qtd || 0);
      return acc;
    }, {});
    const diasComEntregas = Object.keys(entregasPorDia).length;
    const totalEntregas = Object.values(entregasPorDia).reduce(
      (s, v) => s + v,
      0
    );
    const mediaEntregas = diasComEntregas ? totalEntregas / diasComEntregas : 0;

    // Melhor Dia
    let melhorDia = "-";
    if (ganhosUsuario.length > 0) {
      const ganhosPorDia = ganhosUsuario.reduce((acc, g) => {
        acc[g.data] = (acc[g.data] || 0) + g.valor;
        return acc;
      }, {});
      const melhor = Object.entries(ganhosPorDia).sort(
        (a, b) => b[1] - a[1]
      )[0];
      if (melhor) {
        melhorDia = `${new Date(melhor[0] + "T12:00:00").toLocaleDateString(
          "pt-BR"
        )} (${formatarMoeda(melhor[1])})`;
      }
    }

    // Atualiza textos na DOM
    this.setElementText("resumoHoje", formatarMoeda(ganhosHoje));
    this.setElementText("resumoSemana", formatarMoeda(ganhosSemana));
    this.setElementText("resumoMes", formatarMoeda(ganhosMes));
    this.setElementText("mediaEntregas", mediaEntregas.toFixed(1));
    this.setElementText("melhorDia", melhorDia);
    this.setElementText("ultimaEntrega", ultimaEntrega);

    // Meta Semanal
    try {
      const perfilUsuario = await perfil.fetchUserProfile();
      const metaSemanal = perfilUsuario ? perfilUsuario.metaSemanal : 1000;

      const faltaMeta = Math.max(0, metaSemanal - ganhosSemana);
      if ($("metaMensagem")) {
        $("metaMensagem").innerHTML =
          faltaMeta > 0
            ? `Faltam ${formatarMoeda(
                faltaMeta
              )} para bater sua meta de ${formatarMoeda(metaSemanal)}!`
            : `Parabéns! Você bateu sua meta de ${formatarMoeda(metaSemanal)}!`;
        this.atualizarBarraProgresso(metaSemanal, ganhosSemana);
      }
    } catch (e) {
      console.log("Erro ao carregar perfil para meta:", e);
    }
  },

  atualizarBarraProgresso: function (meta, ganhos) {
    const containerAntigo = $("progresso-meta-container");
    if (containerAntigo) {
      containerAntigo.remove();
    }

    const progressoContainer = document.createElement("div");
    progressoContainer.id = "progresso-meta-container";
    progressoContainer.style.marginTop = "10px";

    const progresso = meta > 0 ? Math.min(100, (ganhos / meta) * 100) : 0;

    progressoContainer.innerHTML = `<div class="progresso-meta"><div class="progresso-barra" style="width: ${progresso}%"></div></div><div class="progresso-texto">${progresso.toFixed(
      0
    )}% da meta alcançada</div>`;

    if (progresso >= 100) {
      const barra = progressoContainer.querySelector(".progresso-barra");
      if (barra) barra.classList.add("meta-completa");
    }

    if ($("metaMensagem")) {
      $("metaMensagem").insertAdjacentElement("afterend", progressoContainer);
    }
  },

  setElementText: (id, text) => {
    if ($(id)) $(id).textContent = text;
  },
};
