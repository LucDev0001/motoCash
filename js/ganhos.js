// js/ganhos.js
// Lida com toda a lógica de adicionar, editar, excluir e exibir ganhos.

// Importa as ferramentas do Firebase
import { auth as firebaseAuth, db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  collection,
  getDocs,
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
    this.setupGanhos();
    this.setupFiltros();
    document.body.addEventListener("click", () =>
      document
        .querySelectorAll(".menu-ganho-opcoes")
        .forEach((m) => (m.style.display = "none"))
    );
  },

  setupGanhos: function () {
    if ($("formGanho"))
      $("formGanho").addEventListener("submit", (e) => {
        e.preventDefault();
        this.ganhoEditandoId ? this.atualizarGanho() : this.adicionarGanho();
      });
    if ($("btn-abrir-form-ganho")) {
      $("btn-abrir-form-ganho").addEventListener("click", () => {
        $("card-formulario-ganho").style.display = "block";
        $("card-historico").style.display = "none";
        window.scrollTo(0, 0);
      });
    }
    if ($("btn-fechar-form-ganho")) {
      $("btn-fechar-form-ganho").addEventListener("click", () => {
        this.resetarFormulario();
      });
    }
  },

  resetarFormulario: function () {
    $("formGanho").reset();
    $("data").value = new Date().toISOString().substr(0, 10);
    this.ganhoEditandoId = null;
    $("btnSalvarGanho").textContent = "Adicionar Ganho";
    $("titulo-form-ganho").textContent = "Adicionar Novo Ganho";
    $("card-formulario-ganho").style.display = "none";
    $("card-historico").style.display = "block";
  },

  setupFiltros: function () {
    const update = () => this.atualizarUI();
    const update = () => this.atualizarUI(); // atualizarUI agora é async
    if ($("filtro-periodo")) {
      $("filtro-periodo").addEventListener("change", () => {
        $("filtro-datas-personalizadas").style.display =
          $("filtro-periodo").value === "personalizado" ? "flex" : "none";
        update();
      });
    }
    if ($("filtro-data-inicio"))
      $("filtro-data-inicio").addEventListener("change", update);
    if ($("filtro-data-fim"))
      $("filtro-data-fim").addEventListener("change", update);
    if ($("filtro-ordenar"))
      $("filtro-ordenar").addEventListener("change", update);
    if ($("btn-limpar-filtros"))
      $("btn-limpar-filtros").addEventListener("click", () => {
        $("filtro-periodo").value = "todos";
        $("filtro-ordenar").value = "recentes";
        $("filtro-data-inicio").value = "";
        $("filtro-data-fim").value = "";
        $("filtro-datas-personalizadas").style.display = "none";
        update();
      });
  },

  adicionarGanho: async function () {
    this.localGanhosCache = null; // Invalida o cache ao adicionar um novo ganho
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) {
      alert("Você precisa estar logado para adicionar um ganho.");
      return;
    }

    const data = $("data").value;
    if (!data) return alert("Preencha a data.");
    const valorDiaria = parseFloat($("valorDiaria").value) || 0;
    const taxaEntrega = parseFloat($("taxaEntrega").value) || 0;
    const qtdEntregas = parseInt($("qtdEntregas").value) || 0;

    const novoGanho = {
      id: String(Date.now()), // Usamos o timestamp como ID único do ganho
      data,
      valorDiaria,
      taxaEntrega,
      qtdEntregas,
      valor: valorDiaria + taxaEntrega * qtdEntregas,
    };

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
      this.finalizarAcaoDeGanho();
    } catch (error) {
      console.error("Erro ao adicionar ganho no Firestore: ", error);
      alert("Ocorreu um erro ao salvar seu ganho. Tente novamente.");
    }
  },

  atualizarGanho: function () {
    this.localGanhosCache = null; // Invalida o cache
    const ganhos = storage.getGanhos();
    const index = ganhos.findIndex((g) => g.id === this.ganhoEditandoId);
    if (index === -1) return alert("Erro: Ganho não encontrado.");

    const valorDiaria = parseFloat($("valorDiaria").value) || 0;
    const taxaEntrega = parseFloat($("taxaEntrega").value) || 0;
    const qtdEntregas = parseInt($("qtdEntregas").value) || 0;

    ganhos[index] = {
      ...ganhos[index],
      data: $("data").value,
      valorDiaria,
      taxaEntrega,
      qtdEntregas,
      valor: valorDiaria + taxaEntrega * qtdEntregas,
    };
    storage.setGanhos(ganhos);
    this.finalizarAcaoDeGanho();
  },

  finalizarAcaoDeGanho: function () {
    this.resetarFormulario();
    this.atualizarUI();
    this.atualizarTelaInicio();
    relatoriosModule.atualizarGraficos();
  },

  excluirGanho: function (ganhoId) {
    this.localGanhosCache = null; // Invalida o cache
    if (confirm("Tem certeza que deseja excluir este ganho?")) {
      storage.setGanhos(storage.getGanhos().filter((g) => g.id !== ganhoId));
      this.atualizarUI();
      this.atualizarTelaInicio();
      relatoriosModule.atualizarGraficos();
    }
  },

  editarGanho: function (ganhoId) {
    const ganho = storage.getGanhos().find((g) => g.id === ganhoId);
    if (!ganho) return;

    $("data").value = ganho.data;
    $("valorDiaria").value = ganho.valorDiaria;
    $("taxaEntrega").value = ganho.taxaEntrega;
    $("qtdEntregas").value = ganho.qtdEntregas;

    this.ganhoEditandoId = ganhoId;
    $("btnSalvarGanho").textContent = "Atualizar Ganho";
    $("titulo-form-ganho").textContent = "Editando Ganho";
    $("card-formulario-ganho").style.display = "block";
    $("card-historico").style.display = "none";
    window.scrollTo(0, 0);
  },

  getGanhosFiltrados: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return [];
  fetchGanhos: async function () {
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) return [];

    let ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuario.usuario);
    const periodo = $("filtro-periodo").value;
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
    let ganhosUsuario = await this.fetchGanhos();
    const periodo = $("filtro-periodo")?.value || "todos";
    const { start, end } = getDateRange(
      periodo,
      $("filtro-data-inicio").value,
      $("filtro-data-fim").value
    );

    if (start && end) {
      ganhosUsuario = ganhosUsuario.filter((g) => {
        const dataGanho = new Date(g.data + "T00:00:00");
        return dataGanho >= start && dataGanho <= end;
      });
    }

    const ordenacao = $("filtro-ordenar").value;
    const ordenacao = $("filtro-ordenar")?.value || "recentes";
    return ganhosUsuario.sort((a, b) => {
      switch (ordenacao) {
        case "recentes":
          return new Date(b.data) - new Date(a.data);
        case "antigos":
          return new Date(a.data) - new Date(b.data);
        case "maior-valor":
          return b.valor - a.valor;
        case "menor-valor":
          return a.valor - b.valor;
        default:
          return 0;
      }
    });
  },

  atualizarUI: function () {
    if (!storage.getUsuarioLogado() || !$("listaGanhos")) return;
  atualizarUI: async function () {
    if (!firebaseAuth.currentUser || !$("listaGanhos")) return;

    const ganhosFiltrados = this.getGanhosFiltrados();
    const ganhosFiltrados = await this.getGanhosFiltrados();
    const totalPeriodo = ganhosFiltrados.reduce((s, g) => s + g.valor, 0);
    const totalEntregas = ganhosFiltrados.reduce(
      (s, g) => s + g.qtdEntregas,
      0
    );
    const diasTrabalhados = new Set(ganhosFiltrados.map((g) => g.data)).size;

    $("resumo-filtro-total").textContent = formatarMoeda(totalPeriodo);
    $("resumo-filtro-entregas").textContent = totalEntregas;
    $("resumo-filtro-dias").textContent = diasTrabalhados;
    $("resumo-filtro-media").textContent = formatarMoeda(
      diasTrabalhados > 0 ? totalPeriodo / diasTrabalhados : 0
    );

    const lista = $("listaGanhos");
    lista.innerHTML = "";
    if (ganhosFiltrados.length === 0) {
      lista.innerHTML =
        "<li class='ganho-item-vazio'>Nenhum ganho encontrado.</li>";
      return;
    }

    ganhosFiltrados.forEach((item) => {
      const dataGanho = new Date(item.data + "T03:00:00");
      let diaSemana = dataGanho.toLocaleDateString("pt-BR", {
        weekday: "long",
      });
      diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

      const li = document.createElement("li");
      li.className = "ganho-item";
      li.innerHTML = `
          <div class="ganho-info">
              <p class="ganho-data">${diaSemana}, ${dataGanho.toLocaleDateString(
        "pt-BR"
      )}</p>
              <p class="ganho-valor">${formatarMoeda(item.valor)}</p>
              <p class="info-secundaria">Entregas: ${item.qtdEntregas}</p>
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

  atualizarTelaInicio: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    const ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuario.usuario);
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
      acc[g.data] = (acc[g.data] || 0) + g.qtdEntregas;
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

    const metaSemanal = usuario.metaSemanal || 1000;
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
