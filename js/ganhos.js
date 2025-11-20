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
import { formatarMoeda } from "./utils.js";

let isPrimeiraCargaGanhos = true;

export const ganhos = {
  ganhoEditandoId: null,
  localGanhosCache: null,

  init: function () {
    this.setupEventListeners();
    this.setupFiltros();
    this.atualizarUI();

    // Lógica do botão "Ver por Categoria"
    const btnDetalhes = $("btn-ver-detalhes-categoria");
    const detalhesContainer = $("detalhes-por-categoria");

    if (btnDetalhes && detalhesContainer) {
      btnDetalhes.addEventListener("click", () => {
        const isAtivo = btnDetalhes.classList.toggle("ativo");
        detalhesContainer.style.display = isAtivo ? "grid" : "none";
        btnDetalhes.querySelector("span").textContent = isAtivo
          ? "expand_less"
          : "expand_more";
      });
    }

    // Fechar menus flutuantes ao clicar fora
    document.body.addEventListener("click", () =>
      document
        .querySelectorAll(".menu-ganho-opcoes")
        .forEach((m) => (m.style.display = "none"))
    );
  },

  setupEventListeners: function () {
    const cardForm = $("card-formulario-ganho");
    const btnFechar = $("btn-fechar-form-ganho");

    // 1. Abrir Modais pelos botões coloridos
    document.querySelectorAll(".btn-acao-ganho").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.abrirModal(btn.dataset.target);
      });
    });

    // 2. Fechar Modal
    if (btnFechar) {
      btnFechar.addEventListener(
        "click",
        () => (cardForm.style.display = "none")
      );
    }

    // 3. Submits dos 3 Formulários
    if ($("formGanhoLojaFixa"))
      $("formGanhoLojaFixa").addEventListener("submit", (e) => {
        e.preventDefault();
        this.adicionarGanho("loja_fixa", e);
      });
    if ($("formGanhoPassageiros"))
      $("formGanhoPassageiros").addEventListener("submit", (e) => {
        e.preventDefault();
        this.adicionarGanho("passageiros", e);
      });
    if ($("formGanhoEntregas"))
      $("formGanhoEntregas").addEventListener("submit", (e) => {
        e.preventDefault();
        this.adicionarGanho("entregas", e);
      });

    // 4. Compartilhamento
    if ($("btnCompartilhar")) {
      $("btnCompartilhar").addEventListener("click", () =>
        this.compartilharResumo()
      );
    }
  },

  abrirModal: function (tipo) {
    const cardForm = $("card-formulario-ganho");
    const titulo = $("titulo-form-ganho");

    // Esconde todos e reseta
    document
      .querySelectorAll(".form-ganho-conteudo")
      .forEach((f) => (f.style.display = "none"));
    document.querySelectorAll("form").forEach((f) => f.reset());

    // Mostra o específico
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
    const filtroPeriodo = $("filtro-periodo");

    if (filtroPeriodo) {
      filtroPeriodo.addEventListener("change", () => {
        const divPers = $("filtro-datas-personalizadas");
        if (divPers)
          divPers.style.display =
            filtroPeriodo.value === "personalizado" ? "flex" : "none";
        update();
      });
    }
    if ($("filtro-data-inicio"))
      $("filtro-data-inicio").addEventListener("change", update);
    if ($("filtro-data-fim"))
      $("filtro-data-fim").addEventListener("change", update);
    if ($("btn-limpar-filtros")) {
      $("btn-limpar-filtros").addEventListener("click", () => {
        $("filtro-periodo").value = "todos";
        update();
      });
    }
  },

  adicionarGanho: async function (categoria, event) {
    this.localGanhosCache = null;
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) return alert("Você precisa estar logado.");

    let novoGanho = { id: String(Date.now()), categoria: categoria };

    // Captura dados conforme formulário
    if (categoria === "loja_fixa") {
      novoGanho.data = $("data-loja").value;
      const vd = parseFloat($("valorDiaria-loja").value) || 0;
      const te = parseFloat($("taxaEntrega-loja").value) || 0;
      const qe = parseInt($("qtdEntregas-loja").value) || 0;
      novoGanho.valor = vd + te * qe;
      novoGanho.qtd = qe;
      novoGanho.valorDiaria = vd;
      novoGanho.taxaEntrega = te;
    } else if (categoria === "passageiros") {
      novoGanho.data = $("data-passageiros").value;
      novoGanho.qtd = parseInt($("qtd-passageiros").value) || 0;
      novoGanho.valor = parseFloat($("valor-passageiros").value) || 0;
    } else if (categoria === "entregas") {
      novoGanho.data = $("data-entregas").value;
      novoGanho.qtd = parseInt($("qtd-entregas").value) || 0;
      novoGanho.valor = parseFloat($("valor-entregas").value) || 0;
    }

    if (!novoGanho.data || (!novoGanho.valor && novoGanho.valor !== 0))
      return alert("Dados inválidos. Verifique os valores.");

    try {
      const docRef = doc(
        db,
        "usuarios",
        usuarioLogado.uid,
        "ganhos",
        novoGanho.id
      );
      await setDoc(docRef, novoGanho);

      alert("Ganho salvo!");
      $("card-formulario-ganho").style.display = "none";

      this.atualizarUI();
      this.atualizarTelaInicio();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar.");
    }
  },

  fetchGanhos: async function () {
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) return [];
    if (this.localGanhosCache) return this.localGanhosCache;

    const snap = await getDocs(
      collection(db, "usuarios", usuarioLogado.uid, "ganhos")
    );
    const ganhos = [];
    snap.forEach((d) => ganhos.push(d.data()));

    this.localGanhosCache = ganhos;
    return ganhos;
  },

  getGanhosFiltrados: async function () {
    let lista = await this.fetchGanhos();
    // Ordena por data (decrescente)
    lista.sort((a, b) => new Date(b.data) - new Date(a.data));

    const periodo = $("filtro-periodo") ? $("filtro-periodo").value : "todos";
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return lista.filter((item) => {
      const dataItem = new Date(item.data + "T00:00:00");

      if (periodo === "hoje") {
        return dataItem.getTime() === hoje.getTime();
      }
      if (periodo === "esta-semana") {
        const primeiroDia = new Date(hoje);
        primeiroDia.setDate(hoje.getDate() - hoje.getDay());
        return dataItem >= primeiroDia && dataItem <= hoje;
      }
      if (periodo === "este-mes") {
        return (
          dataItem.getMonth() === hoje.getMonth() &&
          dataItem.getFullYear() === hoje.getFullYear()
        );
      }
      if (periodo === "personalizado") {
        const inicio = $("filtro-data-inicio").value
          ? new Date($("filtro-data-inicio").value + "T00:00:00")
          : null;
        const fim = $("filtro-data-fim").value
          ? new Date($("filtro-data-fim").value + "T00:00:00")
          : null;

        if (inicio && dataItem < inicio) return false;
        if (fim && dataItem > fim) return false;
        return true;
      }
      return true;
    });
  },

  atualizarUI: async function () {
    if (!firebaseAuth.currentUser || !$("listaGanhos")) return;

    const ganhosFiltrados = await this.getGanhosFiltrados();
    const lista = $("listaGanhos");
    lista.innerHTML = "";

    // 1. Calcular Totais Gerais
    const totalValor = ganhosFiltrados.reduce(
      (acc, item) => acc + item.valor,
      0
    );
    const totalQtd = ganhosFiltrados.reduce(
      (acc, item) => acc + (item.qtd || 0),
      0
    );
    const diasUnicos = new Set(ganhosFiltrados.map((g) => g.data)).size;
    const mediaDiaria = diasUnicos > 0 ? totalValor / diasUnicos : 0;

    // 2. Calcular Totais por Categoria
    // CORREÇÃO: Usando 'reduce' para garantir a soma correta.
    const totaisCat = ganhosFiltrados.reduce((acc, item) => {
      const cat = item.categoria || 'indefinida';
      if (!acc[cat]) {
        acc[cat] = { valor: 0, qtd: 0 };
      }
      acc[cat].valor += item.valor;
      acc[cat].qtd += (item.qtd || 0);
      return acc;
    }, {});

    // 3. Atualizar DOM Resumo Geral
    if ($("resumo-filtro-total"))
      $("resumo-filtro-total").textContent = formatarMoeda(totalValor);
    if ($("resumo-filtro-servicos"))
      $("resumo-filtro-servicos").textContent = totalQtd; // Corrigido ID
    if ($("resumo-filtro-dias"))
      $("resumo-filtro-dias").textContent = diasUnicos;
    if ($("resumo-filtro-media"))
      $("resumo-filtro-media").textContent = formatarMoeda(mediaDiaria);

    // 4. Atualizar DOM Detalhes Categoria
    // Loja
    ['loja_fixa', 'passageiros', 'entregas'].forEach(cat => {
      const total = totaisCat[cat] || { valor: 0, qtd: 0 };
      const labelQtd = cat === 'passageiros' ? 'corridas' : 'entregas';

      if($(`total-${cat}`)) {
        $(`total-${cat}`).textContent = formatarMoeda(total.valor);
      }
      if($(`qtd-${cat}`)) {
        $(`qtd-${cat}`).textContent = `${total.qtd} ${labelQtd}`;
      }
    });

    // Abre detalhes na primeira carga se houver dados
    if (isPrimeiraCargaGanhos && ganhosFiltrados.length > 0) {
      const details = $("detalhes-por-categoria");
      const btn = $("btn-ver-detalhes-categoria");
      if (details && btn) {
        // Simula um clique para usar a mesma lógica do event listener
        btn.click();
      }
      isPrimeiraCargaGanhos = false;
    }

    // 5. Renderizar Lista
    const configCat = {
      loja_fixa: { nome: "Loja Fixa", classe: "badge-loja", label: "Entregas" },
      passageiros: {
        nome: "Passageiro",
        classe: "badge-passageiro",
        label: "Corridas",
      },
      entregas: {
        nome: "Entrega App",
        classe: "badge-entrega",
        label: "Entregas",
      },
      undefined: { nome: "Geral", classe: "badge-loja", label: "Qtd" },
    };

    if (ganhosFiltrados.length === 0) {
      lista.innerHTML =
        "<li style='padding:20px; text-align:center; color:#777;'>Nenhum ganho encontrado neste período.</li>";
      return;
    }

    ganhosFiltrados.forEach((item) => {
      const d = new Date(item.data + "T12:00:00");
      const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "short" });
      const conf = configCat[item.categoria] || configCat.undefined;

      // Detalhes extras visuais para Loja Fixa
      let detalhesHTML = `<p class="info-secundaria">${conf.label}: ${
        item.qtd || 0
      }</p>`;
      if (item.categoria === "loja_fixa" && item.valorDiaria) {
        detalhesHTML = `
          <div class="info-detalhes-loja">
             <span>Diária: ${formatarMoeda(item.valorDiaria)} + Entregas: ${
          item.qtd
        }</span>
          </div>`;
      }

      const li = document.createElement("li");
      li.className = "ganho-item";
      li.innerHTML = `
          <div class="ganho-info">
              <span class="badge-categoria ${conf.classe}">${conf.nome}</span>
              <p class="ganho-data"><strong>${diaSemana}</strong>, ${d.toLocaleDateString(
        "pt-BR"
      )}</p>
              <p class="ganho-valor">${formatarMoeda(item.valor)}</p>
              ${detalhesHTML}
          </div>
          <div class="ganho-acoes">
               <button class="btn-excluir-direto" style="color:red; border:none; background:none; font-size:1.2rem; cursor:pointer;">&times;</button>
          </div>`;

      li.querySelector(".btn-excluir-direto").addEventListener("click", (e) => {
        e.stopPropagation();
        this.excluirGanho(item.id);
      });
      lista.appendChild(li);
    });
  },

  excluirGanho: async function (id) {
    if (confirm("Excluir este registro permanentemente?")) {
      await deleteDoc(
        doc(db, "usuarios", firebaseAuth.currentUser.uid, "ganhos", id)
      );
      this.localGanhosCache = null; // Limpa cache para forçar reload
      this.atualizarUI();
      this.atualizarTelaInicio();
    }
  },

  compartilharResumo: function () {
    const total = $("resumo-filtro-total").textContent;
    const qtd = $("resumo-filtro-servicos").textContent;
    const media = $("resumo-filtro-media").textContent;
    const periodo =
      $("filtro-periodo").options[$("filtro-periodo").selectedIndex].text;

    let texto = `*Resumo de Ganhos (${periodo})*:\n`;
    let check = false;

    if ($("compValorTotal")?.checked) {
      texto += `💰 Total: *${total}*\n`;
      check = true;
    }
    if ($("compQtdEntregas")?.checked) {
      texto += `📦 Serviços: *${qtd}*\n`;
      check = true;
    }
    if ($("compMedia")?.checked) {
      texto += `📊 Média Diária: *${media}*\n`;
      check = true;
    }

    if (!check) return alert("Selecione pelo menos uma opção.");

    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`,
      "_blank"
    );
  },

  atualizarTelaInicio: async function () {
    if (perfil && perfil.atualizarTelaInicio) {
      await perfil.atualizarTelaInicio();
    }
  },

  setElementText: (id, text) => {
    if ($(id)) $(id).textContent = text;
  },
};
