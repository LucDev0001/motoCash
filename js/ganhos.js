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
import { getDateRange } from "./date.utils.js";
import { formatarMoeda } from "./utils.js";

let relatoriosModule;

export const ganhos = {
  ganhoEditandoId: null,
  localGanhosCache: null, // Cache para evitar múltiplas buscas no Firestore

  init: function (dependencies) {
    relatoriosModule = dependencies ? dependencies.relatorios : null;
    this.setupEventListeners();
    this.setupFiltros();
    this.atualizarUI(); // Carrega o histórico ao iniciar

    // Fecha menus flutuantes ao clicar fora
    document.body.addEventListener("click", () =>
      document
        .querySelectorAll(".menu-ganho-opcoes")
        .forEach((m) => (m.style.display = "none"))
    );
  },

  setupEventListeners: function () {
    // 1. Lógica para Abrir e Fechar o Modal (Adicionado para compatibilidade com HTML)
    const btnAbrir = $("btn-abrir-form-ganho");
    const btnFechar = $("btn-fechar-form-ganho");
    const cardForm = $("card-formulario-ganho");

    if (btnAbrir && cardForm) {
      btnAbrir.addEventListener("click", () => {
        cardForm.style.display = "block";
        // Reseta o formulário ao abrir para novo cadastro
        if ($("formGanho")) $("formGanho").reset();
        this.ganhoEditandoId = null;
        $("titulo-form-ganho").textContent = "Adicionar Novo Ganho";
        $("btnSalvarGanho").textContent = "Adicionar Ganho";
      });
    }

    if (btnFechar && cardForm) {
      btnFechar.addEventListener("click", () => {
        cardForm.style.display = "none";
      });
    }

    // 2. Lógica do Formulário Único (Adaptado ao seu HTML)
    if ($("formGanho")) {
      $("formGanho").addEventListener("submit", (e) => {
        e.preventDefault();
        if (this.ganhoEditandoId) {
          this.atualizarGanho();
        } else {
          // Como o formulário HTML é de diária/taxa, assumimos categoria 'loja_fixa'
          this.adicionarGanho("loja_fixa", e);
        }
      });
    }
  },

  setupFiltros: function () {
    const update = () => this.atualizarUI();
    const filtroPeriodo = $("filtro-periodo");

    if (filtroPeriodo) {
      filtroPeriodo.addEventListener("change", () => {
        const divPersonalizada = $("filtro-datas-personalizadas");
        if (divPersonalizada) {
          divPersonalizada.style.display =
            filtroPeriodo.value === "personalizado" ? "flex" : "none";
        }
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
    this.localGanhosCache = null; // Invalida o cache
    const usuarioLogado = firebaseAuth.currentUser;

    if (!usuarioLogado) {
      alert("Você precisa estar logado para adicionar um ganho.");
      return;
    }

    let novoGanho = {
      id: String(Date.now()),
      categoria: categoria,
    };

    // Mapeando os IDs conforme o seu HTML (ganhos.html)
    // O HTML usa IDs genéricos: data, valorDiaria, taxaEntrega, qtdEntregas
    novoGanho.data = $("data").value;

    // Lógica para cálculo baseado nos campos do HTML
    const valorDiaria = parseFloat($("valorDiaria").value) || 0;
    const taxaEntrega = parseFloat($("taxaEntrega").value) || 0;
    const qtdEntregas = parseInt($("qtdEntregas").value) || 0;

    novoGanho.valorDiaria = valorDiaria;
    novoGanho.taxaEntrega = taxaEntrega;
    novoGanho.qtd = qtdEntregas;
    novoGanho.valor = valorDiaria + taxaEntrega * qtdEntregas;

    if (!novoGanho.data || (!novoGanho.valor && novoGanho.valor !== 0)) {
      return alert("Por favor, preencha a data e os valores corretamente.");
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

      alert("Ganho salvo com sucesso!");
      if (event && event.target) event.target.reset();

      // Fecha o modal após salvar
      if ($("card-formulario-ganho"))
        $("card-formulario-ganho").style.display = "none";

      this.atualizarUI();
      this.atualizarTelaInicio();
    } catch (error) {
      console.error("Erro ao adicionar ganho no Firestore: ", error);
      alert("Ocorreu um erro ao salvar seu ganho. Tente novamente.");
    }
  },

  atualizarGanho: async function () {
    this.localGanhosCache = null;
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) return alert("Usuário não encontrado.");
    if (!this.ganhoEditandoId)
      return alert("Erro: ID do ganho não encontrado.");

    // IDs baseados no seu HTML
    const valorDiaria = parseFloat($("valorDiaria").value) || 0;
    const taxaEntrega = parseFloat($("taxaEntrega").value) || 0;
    const qtdEntregas = parseInt($("qtdEntregas").value) || 0;

    const ganhoAtualizado = {
      id: this.ganhoEditandoId,
      categoria: "loja_fixa", // Mantém compatibilidade
      data: $("data").value,
      valorDiaria,
      taxaEntrega,
      qtdEntregas,
      qtd: qtdEntregas,
      valor: valorDiaria + taxaEntrega * qtdEntregas,
    };

    try {
      const docRef = doc(
        db,
        "usuarios",
        usuarioLogado.uid,
        "ganhos",
        this.ganhoEditandoId
      );
      await setDoc(docRef, ganhoAtualizado); // Atualiza/Sobrescreve

      alert("Ganho atualizado com sucesso!");
      this.ganhoEditandoId = null;

      // Reseta UI
      $("formGanho").reset();
      if ($("card-formulario-ganho"))
        $("card-formulario-ganho").style.display = "none";

      this.atualizarUI();
      this.atualizarTelaInicio();
    } catch (error) {
      console.error("Erro ao atualizar ganho: ", error);
      alert("Não foi possível atualizar o ganho. Tente novamente.");
    }
  },

  excluirGanho: async function (ganhoId) {
    this.localGanhosCache = null;
    if (confirm("Tem certeza que deseja excluir este ganho?")) {
      const usuarioLogado = firebaseAuth.currentUser;
      if (!usuarioLogado) return alert("Usuário não encontrado.");

      try {
        const docRef = doc(
          db,
          "usuarios",
          usuarioLogado.uid,
          "ganhos",
          ganhoId
        );
        await deleteDoc(docRef);

        this.atualizarUI();
        this.atualizarTelaInicio();
      } catch (error) {
        console.error("Erro ao excluir ganho: ", error);
        alert("Não foi possível excluir o ganho. Tente novamente.");
      }
    }
  },

  editarGanho: async function (ganhoId) {
    // 1. Busca o ganho nos dados cacheados ou busca nova
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) return;

    let ganho = null;
    if (this.localGanhosCache) {
      ganho = this.localGanhosCache.find((g) => g.id === ganhoId);
    }

    // Se não achou no cache, não conseguimos editar sem buscar (simplificação)
    if (!ganho) {
      alert("Erro ao carregar dados para edição. Tente recarregar a página.");
      return;
    }

    // 2. Preenche o formulário HTML
    $("data").value = ganho.data;
    $("valorDiaria").value = ganho.valorDiaria || 0;
    $("taxaEntrega").value = ganho.taxaEntrega || 0;
    $("qtdEntregas").value = ganho.qtd || 0;

    // 3. Ajusta o estado para modo de edição
    this.ganhoEditandoId = ganhoId;
    $("titulo-form-ganho").textContent = "Editar Ganho";
    $("btnSalvarGanho").textContent = "Atualizar Ganho";

    // 4. Abre o modal
    $("card-formulario-ganho").style.display = "block";
  },

  fetchGanhos: async function () {
    const usuarioLogado = firebaseAuth.currentUser;
    if (!usuarioLogado) return [];

    if (this.localGanhosCache) {
      return this.localGanhosCache;
    }

    const ganhosRef = collection(db, "usuarios", usuarioLogado.uid, "ganhos");
    const querySnapshot = await getDocs(ganhosRef);
    const ganhos = [];
    querySnapshot.forEach((doc) => {
      ganhos.push(doc.data());
    });

    this.localGanhosCache = ganhos;
    return ganhos;
  },

  getGanhosFiltrados: async function () {
    const ganhosUsuario = await this.fetchGanhos();
    // Ordenação básica por data decrescente
    return ganhosUsuario.sort((a, b) => new Date(b.data) - new Date(a.data));
  },

  atualizarUI: async function () {
    if (!firebaseAuth.currentUser || !$("listaGanhos")) return;

    // CORREÇÃO AQUI: Removido o código quebrado e variáveis indefinidas que existiam antes
    const ganhosFiltrados = await this.getGanhosFiltrados();

    const categoriaNomes = {
      loja_fixa: "Loja Fixa",
      passageiros: "Passageiros",
      entregas: "Entregas App",
    };

    const lista = $("listaGanhos");
    lista.innerHTML = "";

    if (ganhosFiltrados.length === 0) {
      lista.innerHTML =
        "<li class='ganho-item-vazio'>Nenhum ganho encontrado. Adicione um novo ganho acima!</li>";
      return;
    }

    ganhosFiltrados.forEach((item) => {
      // Criação segura da data para exibição
      // Adiciona o fuso para garantir que não volte um dia
      let dataGanho = new Date(item.data + "T12:00:00");

      let diaSemana = dataGanho.toLocaleDateString("pt-BR", {
        weekday: "long",
      });
      diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

      const li = document.createElement("li");
      li.className = "ganho-item";

      // Definição do rótulo secundário (Qtd)
      let infoSecundaria = "";
      if (item.qtd !== undefined && item.qtd !== null) {
        const label =
          item.categoria === "passageiros" ? "Corridas" : "Entregas";
        infoSecundaria = `<p class="info-secundaria">${label}: ${item.qtd}</p>`;
      }

      li.innerHTML = `
          <div class="ganho-info">
              <p class="ganho-categoria">${
                categoriaNomes[item.categoria] || "Geral"
              }</p>
              <p class="ganho-data">${diaSemana}, ${new Date(
        item.data + "T12:00:00"
      ).toLocaleDateString("pt-BR")}</p>
              <p class="ganho-valor">${formatarMoeda(item.valor)}</p>
              ${infoSecundaria}
          </div>
          <div class="ganho-acoes">
              <button class="btn-menu-ganho">...</button>
              <div class="menu-ganho-opcoes" style="display: none;">
                  <a href="#" class="btn-editar">Editar</a>
                  <a href="#" class="btn-excluir">Excluir</a>
              </div>
          </div>`;

      // Eventos dos botões dentro do item da lista
      const btnMenu = li.querySelector(".btn-menu-ganho");
      if (btnMenu) {
        btnMenu.addEventListener("click", (e) => {
          e.stopPropagation();
          // Fecha outros menus abertos
          document
            .querySelectorAll(".menu-ganho-opcoes")
            .forEach((m) => (m.style.display = "none"));
          // Abre este
          const menu = e.currentTarget.nextElementSibling;
          if (menu) menu.style.display = "block";
        });
      }

      const btnEditar = li.querySelector(".btn-editar");
      if (btnEditar) {
        btnEditar.addEventListener("click", (e) => {
          e.preventDefault();
          this.editarGanho(item.id);
        });
      }

      const btnExcluir = li.querySelector(".btn-excluir");
      if (btnExcluir) {
        btnExcluir.addEventListener("click", (e) => {
          e.preventDefault();
          this.excluirGanho(item.id);
        });
      }

      lista.appendChild(li);
    });
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
