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

// Se você não tiver o date.utils.js funcionando, usaremos a lógica local abaixo
// import { getDateRange } from "./date.utils.js";

export const ganhos = {
  ganhoEditandoId: null,
  localGanhosCache: null,

  init: function (dependencies) {
    this.setupEventListeners();
    this.setupFiltros();
    this.atualizarUI();

    document.body.addEventListener("click", () =>
      document
        .querySelectorAll(".menu-ganho-opcoes")
        .forEach((m) => (m.style.display = "none"))
    );
  },

  setupEventListeners: function () {
    const cardForm = $("card-formulario-ganho");
    const btnFechar = $("btn-fechar-form-ganho");

    // 1. Abertura dos 3 Modais
    document.querySelectorAll(".btn-acao-ganho").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.abrirModal(btn.dataset.target);
      });
    });

    // 2. Fechar Modal
    if (btnFechar)
      btnFechar.addEventListener(
        "click",
        () => (cardForm.style.display = "none")
      );

    // 3. Submits dos Forms
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

    // 4. Compartilhamento (Restaurado)
    if ($("btnCompartilhar")) {
      $("btnCompartilhar").addEventListener("click", () =>
        this.compartilharResumo()
      );
    }
  },

  abrirModal: function (tipo) {
    const cardForm = $("card-formulario-ganho");
    const titulo = $("titulo-form-ganho");

    document
      .querySelectorAll(".form-ganho-conteudo")
      .forEach((f) => (f.style.display = "none"));
    document.querySelectorAll("form").forEach((f) => f.reset());

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
    if ($("btn-limpar-filtros"))
      $("btn-limpar-filtros").addEventListener("click", () => {
        $("filtro-periodo").value = "todos";
        update();
      });
  },

  adicionarGanho: async function (categoria, event) {
    this.localGanhosCache = null;
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) return alert("Você precisa estar logado.");

    let novoGanho = { id: String(Date.now()), categoria: categoria };

    // Captura conforme categoria
    if (categoria === "loja_fixa") {
      novoGanho.data = $("data-loja").value;
      const vd = parseFloat($("valorDiaria-loja").value) || 0;
      const te = parseFloat($("taxaEntrega-loja").value) || 0;
      const qe = parseInt($("qtdEntregas-loja").value) || 0;
      novoGanho.valor = vd + te * qe;
      novoGanho.qtd = qe;
    } else if (categoria === "passageiros") {
      novoGanho.data = $("data-passageiros").value;
      novoGanho.qtd = parseInt($("qtd-passageiros").value) || 0;
      novoGanho.valor = parseFloat($("valor-passageiros").value) || 0;
    } else if (categoria === "entregas") {
      novoGanho.data = $("data-entregas").value;
      novoGanho.qtd = parseInt($("qtd-entregas").value) || 0;
      novoGanho.valor = parseFloat($("valor-entregas").value) || 0;
    }

    if (!novoGanho.data || novoGanho.valor <= 0)
      return alert("Dados inválidos.");

    try {
      await setDoc(
        doc(db, "usuarios", usuarioLogado.uid, "ganhos", novoGanho.id),
        novoGanho
      );
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

  // Filtra os dados com base no select e nas datas
  getGanhosFiltrados: async function () {
    let lista = await this.fetchGanhos();
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
        primeiroDia.setDate(hoje.getDate() - hoje.getDay()); // Domingo
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
      return true; // Todos
    });
  },

  atualizarUI: async function () {
    if (!firebaseAuth.currentUser || !$("listaGanhos")) return;

    const ganhosFiltrados = await this.getGanhosFiltrados();
    const lista = $("listaGanhos");
    lista.innerHTML = "";

    // CALCULAR TOTAIS DO PERÍODO
    const totalValor = ganhosFiltrados.reduce(
      (acc, item) => acc + item.valor,
      0
    );
    const totalQtd = ganhosFiltrados.reduce(
      (acc, item) => acc + (item.qtd || 0),
      0
    );

    // Dias trabalhados (Set para contar dias únicos)
    const diasUnicos = new Set(ganhosFiltrados.map((g) => g.data)).size;
    const mediaDiaria = diasUnicos > 0 ? totalValor / diasUnicos : 0;

    // Atualiza DOM do Resumo
    if ($("resumo-filtro-total"))
      $("resumo-filtro-total").textContent = formatarMoeda(totalValor);
    if ($("resumo-filtro-entregas"))
      $("resumo-filtro-entregas").textContent = totalQtd;
    if ($("resumo-filtro-dias"))
      $("resumo-filtro-dias").textContent = diasUnicos;
    if ($("resumo-filtro-media"))
      $("resumo-filtro-media").textContent = formatarMoeda(mediaDiaria);

    // Configurações visuais
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

      const li = document.createElement("li");
      li.className = "ganho-item";
      li.innerHTML = `
          <div class="ganho-info">
              <span class="badge-categoria ${conf.classe}">${conf.nome}</span>
              <p class="ganho-data"><strong>${diaSemana}</strong>, ${d.toLocaleDateString(
        "pt-BR"
      )}</p>
              <p class="ganho-valor">${formatarMoeda(item.valor)}</p>
              <p class="info-secundaria">${conf.label}: ${item.qtd || 0}</p>
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
    if (confirm("Excluir este registro?")) {
      await deleteDoc(
        doc(db, "usuarios", firebaseAuth.currentUser.uid, "ganhos", id)
      );
      this.localGanhosCache = null;
      this.atualizarUI();
      this.atualizarTelaInicio();
    }
  },

  compartilharResumo: function () {
    const total = $("resumo-filtro-total").textContent;
    const qtd = $("resumo-filtro-entregas").textContent;
    const media = $("resumo-filtro-media").textContent;
    const periodo =
      $("filtro-periodo").options[$("filtro-periodo").selectedIndex].text;
    let texto = `*Resumo de Ganhos (${periodo})*:\n`;
    let infoAdicionada = false;

    if ($("compValorTotal")?.checked) {
      texto += `\n- Valor total: *${total}*`;
      infoAdicionada = true;
    }
    if ($("compQtdEntregas")?.checked) {
      texto += `\n- Quantidade de serviços: *${qtd}*`;
      infoAdicionada = true;
    }
    if ($("compMedia")?.checked) {
      texto += `\n- Média diária: *${media}*`;
      infoAdicionada = true;
    }

    if (!infoAdicionada)
      return alert("Selecione pelo menos uma informação para compartilhar.");
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      texto
    )}`;
    window.open(url, "_blank");
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
