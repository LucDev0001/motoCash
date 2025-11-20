// js/ganhos.js
// Lida com toda a lógica de adicionar, editar, excluir e exibir ganhos.

import { perfil } from "./perfil.js";
// Importa as ferramentas do Firebase
import { auth as firebaseAuth, db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Importa utilitários locais
import { $ } from "./utils.js";
import { storage } from "./storage.js";
import { getDateRange } from "./date.utils.js";
import { formatarMoeda } from "./utils.js";

let relatoriosModule;

export const ganhos = {
  ganhoEditandoId: null,
  localGanhosCache: null, // Cache para evitar múltiplas buscas no Firestore

  init: function (dependencies) {
    relatoriosModule = dependencies.relatorios;
    this.setupEventListeners();
    this.setupFiltros();
    this.atualizarUI(); // Carrega o histórico ao iniciar
    document.body.addEventListener("click", () =>
      document
        .querySelectorAll(".menu-ganho-opcoes")
        .forEach((m) => (m.style.display = "none"))
    );
  },

  setupEventListeners: function () {
    // Lógica para alternar entre os formulários de ganho
    document.querySelectorAll(".categoria-btn-ganho").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".categoria-btn-ganho")
          .forEach((b) => b.classList.remove("ativo"));
        btn.classList.add("ativo");

        document
          .querySelectorAll(".form-ganho-container")
          .forEach((form) => form.classList.remove("ativo"));
        const formId = btn.dataset.form;
        $(formId).classList.add("ativo");
      });
    });

    // Adiciona o evento de submit para cada formulário
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

  setupFiltros: function () {
    const update = () => this.atualizarUI();
    const filtroPeriodo = $("filtro-periodo");
    if (filtroPeriodo) {
      filtroPeriodo.addEventListener("change", () => {
        $("filtro-datas-personalizadas").style.display =
          filtroPeriodo.value === "personalizado" ? "flex" : "none";
        update();
      });
    }
    if ($("filtro-data-inicio"))
      $("filtro-data-inicio").addEventListener("change", update);
    if ($("filtro-data-fim"))
      $("filtro-data-fim").addEventListener("change", update);
    if ($("filtro-ordenar"))
      $("filtro-ordenar").addEventListener("change", update);
  },

  adicionarGanho: async function (categoria, event) {
    this.localGanhosCache = null; // Invalida o cache ao adicionar um novo ganho
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) {
      alert("Você precisa estar logado para adicionar um ganho.");
      return;
    }

    let novoGanho = { id: String(Date.now()), categoria };

    if (categoria === "loja_fixa") {
      novoGanho.data = $("data-loja").value;
      const valorDiaria = parseFloat($("valorDiaria-loja").value) || 0;
      const taxaEntrega = parseFloat($("taxaEntrega-loja").value) || 0;
      const qtdEntregas = parseInt($("qtdEntregas-loja").value) || 0;
      novoGanho.valor = valorDiaria + taxaEntrega * qtdEntregas;
      novoGanho.qtd = qtdEntregas;
    } else if (categoria === "passageiros") {
      novoGanho.data = $("data-passageiros").value;
      novoGanho.valor = parseFloat($("valor-passageiros").value) || 0;
      novoGanho.qtd = parseInt($("qtd-passageiros").value) || 0;
    } else if (categoria === "entregas") {
      novoGanho.data = $("data-entregas").value;
      novoGanho.valor = parseFloat($("valor-entregas").value) || 0;
      novoGanho.qtd = parseInt($("qtd-entregas").value) || 0;
    }

    if (!novoGanho.data || !novoGanho.valor) {
      return alert("Por favor, preencha a data e o valor.");
    }

    try {
      // Cria uma referência para o novo documento de ganho dentro da sub-coleção do usuário
      const docRef = doc(
        db,
        "usuarios",
        usuarioLogado.uid,
        "ganhos",
        novoGanho.id
      );
      // Salva o objeto 'novoGanho' no Firestore
      await setDoc(docRef, novoGanho);
      alert("Ganho salvo com sucesso!");
      event.target.reset(); // Reseta o formulário que foi enviado
      this.atualizarUI();
      this.atualizarTelaInicio();
    } catch (error) {
      console.error("Erro ao adicionar ganho no Firestore: ", error);
      alert("Ocorreu um erro ao salvar seu ganho. Tente novamente.");
    }
  },

  atualizarGanho: async function () {
    this.localGanhosCache = null; // Invalida o cache
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) return alert("Usuário não encontrado.");
    if (!this.ganhoEditandoId)
      return alert("Erro: ID do ganho não encontrado.");

    const valorDiaria = parseFloat($("valorDiaria").value) || 0;
    const taxaEntrega = parseFloat($("taxaEntrega").value) || 0;
    const qtdEntregas = parseInt($("qtdEntregas").value) || 0;

    const ganhoAtualizado = {
      id: this.ganhoEditandoId,
      data: $("data").value,
      valorDiaria,
      taxaEntrega,
      qtdEntregas,
      valor: valorDiaria + taxaEntrega * qtdEntregas,
    };

    try {
      // A referência aponta para o documento que já existe
      const docRef = doc(
        db,
        "usuarios",
        usuarioLogado.uid,
        "ganhos",
        this.ganhoEditandoId
      );
      // setDoc vai sobrescrever o documento com os novos dados
      await setDoc(docRef, ganhoAtualizado);
      this.finalizarAcaoDeGanho();
    } catch (error) {
      console.error("Erro ao atualizar ganho: ", error);
      alert("Não foi possível atualizar o ganho. Tente novamente.");
    }
  },

  excluirGanho: async function (ganhoId) {
    this.localGanhosCache = null; // Invalida o cache
    if (confirm("Tem certeza que deseja excluir este ganho?")) {
      const usuarioLogado = firebaseAuth.currentUser;
      if (!usuarioLogado) return alert("Usuário não encontrado.");

      try {
        // Cria a referência para o documento a ser excluído
        const docRef = doc(
          db,
          "usuarios",
          usuarioLogado.uid,
          "ganhos",
          ganhoId
        );
        // Deleta o documento no Firestore
        await deleteDoc(docRef);

        // Atualiza a interface após a exclusão
        this.atualizarUI();
        this.atualizarTelaInicio();
        // A atualização dos gráficos já é chamada dentro de atualizarTelaInicio indiretamente
      } catch (error) {
        console.error("Erro ao excluir ganho: ", error);
        alert("Não foi possível excluir o ganho. Tente novamente.");
      }
    }
  },

  editarGanho: async function (ganhoId) {
    // A lógica de edição se tornou mais complexa.
    // Por enquanto, vamos focar no cadastro e visualização.
    alert("A função de editar será implementada em breve!");
  },

  fetchGanhos: async function () {
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) return [];

    // Se o cache existir, retorna os dados cacheados para evitar uma nova busca
    if (this.localGanhosCache) {
      return this.localGanhosCache;
    }

    const ganhosRef = collection(db, "usuarios", usuarioLogado.uid, "ganhos");
    const querySnapshot = await getDocs(ganhosRef);
    const ganhos = [];
    querySnapshot.forEach((doc) => {
      ganhos.push(doc.data());
    });

    this.localGanhosCache = ganhos; // Armazena os dados no cache
    return ganhos;
  },

  getGanhosFiltrados: async function () {
    // Simplificado por enquanto. A lógica de filtros pode ser reintroduzida depois.
    const ganhosUsuario = await this.fetchGanhos();
    return ganhosUsuario.sort((a, b) => new Date(b.data) - new Date(a.data));
  },

  atualizarUI: async function () {
    if (!firebaseAuth.currentUser || !$("listaGanhos")) return;

    const ganhosFiltrados = await this.getGanhosFiltrados();
      const categoriaNomes = {
        loja_fixa: "Loja Fixa",
        passageiros: "Passageiros",
        entregas: "Entregas App",
      };
      const dataGanho = new Date(item.data + "T03:00:00");
      let diaSemana = dataGanho.toLocaleDateString("pt-BR", {

    const lista = $("listaGanhos");
    lista.innerHTML = "";
    if (ganhosFiltrados.length === 0) {
      lista.innerHTML =
        "<li class='ganho-item-vazio'>Nenhum ganho encontrado. Adicione um novo ganho acima!</li>";
      return;
    }

    ganhosFiltrados.forEach((item) => {
      let diaSemana = new Date(item.data + "T03:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
      });
      diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

      const li = document.createElement("li");
      li.className = "ganho-item";
      li.innerHTML = `
          <div class="ganho-info">
              <p class="ganho-categoria">${
                categoriaNomes[item.categoria] || "Geral"
              }</p>
              <p class="ganho-data">${diaSemana}, ${dataGanho.toLocaleDateString("pt-BR")}</p>
              <p class="ganho-valor">${formatarMoeda(item.valor)}</p>
              ${item.qtd ? `<p class="info-secundaria">${item.categoria === 'passageiros' ? 'Corridas' : 'Entregas'}: ${item.qtd}</p>` : ''}
          </div>
          <div class="ganho-acoes">
              <button class="btn-menu-ganho">...</button>
              <div class="menu-ganho-opcoes" style="display: none;">
                  <a href="#" class="btn-editar">Editar</a>
                  <a href="#" class="btn-excluir">Excluir</a>
              </div>
          </div>`;

      li.querySelector(".btn-menu-ganho").addEventListener("click", (e) => {
        e.stopPropagation();
        document
          .querySelectorAll(".menu-ganho-opcoes")
          .forEach((m) => (m.style.display = "none"));
        e.currentTarget.nextElementSibling.style.display = "block";
      });
      li.querySelector(".btn-editar").addEventListener("click", (e) => {
        e.preventDefault();
        this.editarGanho(item.id);
      });
      li.querySelector(".btn-excluir").addEventListener("click", (e) => {
        e.preventDefault();
        this.excluirGanho(item.id);
      });

      lista.appendChild(li);
    });
  },

  atualizarTelaInicio: async function () {
    const usuario = firebaseAuth.currentUser;
    if (!usuario) return;
    const ganhosUsuario = await this.fetchGanhos();

    const hoje = new Date().toISOString().slice(0, 10);
    const ganhosHoje = ganhosUsuario
      .filter((g) => g.data === hoje)
      .reduce((s, g) => s + g.valor, 0);

    const semanaRange = getDateRange("esta-semana");
    const ganhosSemana = ganhosUsuario
      .filter(
        (g) =>
          new Date(g.data + "T00:00:00") >= semanaRange.start &&
          new Date(g.data + "T00:00:00") <= semanaRange.end
      )
      .reduce((s, g) => s + g.valor, 0);

    const mesRange = getDateRange("este-mes");
    const ganhosMes = ganhosUsuario
      .filter(
        (g) =>
          new Date(g.data + "T00:00:00") >= mesRange.start &&
          new Date(g.data + "T00:00:00") <= mesRange.end
      )
      .reduce((s, g) => s + g.valor, 0);

    let ultimaEntrega = "-";
    if (ganhosUsuario.length > 0) {
      const ult = ganhosUsuario.sort(
        (a, b) => new Date(b.data) - new Date(a.data)
      )[0];
      ultimaEntrega = `${new Date(ult.data + "T03:00:00").toLocaleDateString(
        "pt-BR"
      )} (${formatarMoeda(ult.valor)})`;
    }

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

    let melhorDia = "-";
    if (ganhosUsuario.length > 0) {
      const ganhosPorDia = ganhosUsuario.reduce((acc, g) => {
        acc[g.data] = (acc[g.data] || 0) + g.valor;
        return acc;
      }, {});
      const melhor = Object.entries(ganhosPorDia).sort(
        (a, b) => b[1] - a[1]
      )[0];
      if (melhor)
        melhorDia = `${new Date(melhor[0] + "T03:00:00").toLocaleDateString(
          "pt-BR"
        )} (${formatarMoeda(melhor[1])})`;
    }

    // Busca o perfil do usuário do Firestore para obter a meta
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
    this.setElementText("resumoHoje", formatarMoeda(ganhosHoje));
    this.setElementText("resumoSemana", formatarMoeda(ganhosSemana));
    this.setElementText("resumoMes", formatarMoeda(ganhosMes));
    this.setElementText("mediaEntregas", mediaEntregas.toFixed(1));
    this.setElementText("melhorDia", melhorDia);
    this.setElementText("ultimaEntrega", ultimaEntrega);
  },

  // LÓGICA ORIGINAL RESTAURADA
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
      progressoContainer
        .querySelector(".progresso-barra")
        .classList.add("meta-completa");
    }
    if ($("metaMensagem")) {
      $("metaMensagem").insertAdjacentElement("afterend", progressoContainer);
    }
  },

  setElementText: (id, text) => {
    if ($(id)) $(id).textContent = text;
  },
};
