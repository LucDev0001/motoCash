// js/perfil.js
// Gerencia a exibição e atualização dos dados do usuário.

import { relatorios } from "./reports.js"; // Importa o módulo de relatórios
import { ganhos } from "./ganhos.js"; // Importa o módulo de ganhos
import { marketplace } from "./marketplace.js";
// Importa as ferramentas do Firebase
import { auth as firebaseAuth, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { $ } from "./utils.js";
import { storage } from "./storage.js";
import { formatarMoeda } from "./utils.js";
import { showToast } from "./toast.js"; // 1. Importe a nova função

let localProfileCache = null; // Cache para o perfil do usuário

export const perfil = {
  chartCategoriasInicio: null, // Propriedade para o gráfico da tela de início
  navegarPara: null, // Propriedade para armazenar a função de navegação

  init: function (dependencies) {
    // Armazena a função de navegação dentro do próprio objeto
    this.navegarPara = dependencies.navegarPara;
    // A função setupEventListeners foi movida para dentro de atualizarUI
  },

  fetchUserProfile: async function () {
    if (localProfileCache) return localProfileCache;

    const user = firebaseAuth.currentUser;
    if (!user) return null;

    const docRef = doc(db, "usuarios", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      localProfileCache = docSnap.data();
      return localProfileCache;
    } else {
      console.log("Documento de perfil não encontrado!");
      return null;
    }
  },

  atualizarUI: async function (ganhosUsuario) {
    const usuario = await this.fetchUserProfile();
    if (!usuario) return;

    this.atualizarTelaInicio(ganhosUsuario); // << CORREÇÃO: Passa os ganhos para a função

    // Atualiza elementos que podem estar em várias telas (como a tela de início)
    this.setElementText("msgOlaInicio", `Olá, ${usuario.nome || "Usuário"}`);

    // Configura o botão para ir para a nova tela de gerenciamento
    this.setupFerramentasInicio(); // << NOVA CHAMADA: Configura os botões da tela de início
    if ($("btn-gerenciar-anuncios")) {
      $("btn-gerenciar-anuncios").onclick = () =>
        this.navegarPara("gerenciar-anuncios");
    }

    // Mostra a seção de admin se o usuário tiver a role
    if (usuario.role === "admin") {
      const adminSection = $("admin-section");
      if (adminSection) {
        adminSection.style.display = "block";
        $("btnPainelAdmin").onclick = () => this.navegarPara("admin");
      }
    }

    // Atualiza elementos específicos da tela de perfil
    this.setElementText("perfilNome", usuario.nome || "Usuário");
    this.setElementText("perfilUsuario", usuario.email);
    this.setElementText("perfilTelefone", usuario.telefone || "");
    this.setElementText("perfilMoto", usuario.moto || "");
    this.setElementText(
      "perfilMeta",
      formatarMoeda(usuario.metaSemanal || 1000)
    );

    const fotoPerfil = $("fotoPerfil");
    if (fotoPerfil && usuario.avatar) fotoPerfil.src = usuario.avatar;

    this.preencherFormularioEdicao(usuario);
    this.setupProfilePageListeners(); // Chama a função que configura os listeners da página
  },

  // Nova função para configurar apenas os listeners da página de perfil
  setupProfilePageListeners: function () {
    // Botão Sair
    const btnSair = $("btnSair");
    if (btnSair) {
      btnSair.onclick = async () => {
        try {
          await firebaseAuth.signOut();
        } catch (error) {
          console.error("Erro ao fazer logout:", error);
        }
      };
    }

    // Botão Editar Perfil (toggle)
    const btnEditar = $("btnEditarPerfil");
    const cardEdicao = $("cardEdicao");
    if (btnEditar && cardEdicao) {
      btnEditar.onclick = () => cardEdicao.classList.toggle("ativo");
    }

    // Formulário de Alteração
    const formAlterar = $("formAlterarCadastro");
    if (formAlterar)
      formAlterar.onsubmit = (e) => {
        e.preventDefault();
        this.handleAlterarDados();
      };
  },

  setElementText: (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  },

  preencherFormularioEdicao: function (usuario) {
    const novoNome = $("novoNome");
    const novaMeta = $("novaMetaSemanal");
    const novoTel = $("novoTelefone");
    const novaSenha = $("novaSenha");

    if (novoNome) novoNome.value = usuario.nome || "";
    if (novaMeta) novaMeta.value = usuario.metaSemanal || "";
    if (novoTel) novoTel.value = usuario.telefone || "";
    if (novaSenha) novaSenha.value = "";
  },

  handleAlterarDados: async function () {
    const user = firebaseAuth.currentUser;
    if (!user)
      return showToast(
        "Você precisa estar logado para alterar os dados.",
        "error"
      );

    const dadosParaAtualizar = {
      nome: $("novoNome")?.value.trim(),
      metaSemanal: parseFloat($("novaMetaSemanal")?.value) || 1000,
      telefone: $("novoTelefone")?.value.trim(),
      moto: $("novaMoto")?.value,
    };

    // Validação simples
    if (!dadosParaAtualizar.nome) {
      showToast("O campo 'Nome Completo' não pode ficar vazio.", "warning");
      return;
    }

    // Remove chaves com valores indefinidos ou nulos para não sobrescrever dados existentes no Firebase com "undefined"
    Object.keys(dadosParaAtualizar).forEach((key) => {
      if (
        dadosParaAtualizar[key] === undefined ||
        dadosParaAtualizar[key] === null
      ) {
        delete dadosParaAtualizar[key];
      }
    });

    // TODO: Implementar lógica para alterar senha e avatar se necessário

    try {
      const docRef = doc(db, "usuarios", user.uid);
      await updateDoc(docRef, dadosParaAtualizar);

      localProfileCache = null; // Invalida o cache
      await this.atualizarUI(); // Atualiza a UI com os novos dados

      const cardEdicao = $("cardEdicao");
      if (cardEdicao) {
        cardEdicao.classList.remove("ativo"); // Fecha o card de edição
      }
      showToast("Dados alterados com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao atualizar dados:", error);
      showToast("Ocorreu um erro ao salvar suas alterações.", "error");
    }
  },

  initGerenciarAnuncios: async function () {
    const container = $("lista-meus-anuncios");
    if (!container) return;

    const user = firebaseAuth.currentUser;
    if (!user) return;

    container.innerHTML = "<p>Carregando seus anúncios...</p>";

    if ($("btn-voltar-perfil")) {
      $("btn-voltar-perfil").onclick = () => this.navegarPara("perfil");
    }

    try {
      // Cria uma consulta para buscar apenas os produtos do usuário logado.
      const q = query(
        collection(db, "produtos"),
        where("ownerId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);

      const myProducts = querySnapshot.docs.map((doc) => doc.data());

      if (myProducts.length === 0) {
        container.innerHTML = "<p>Você ainda não anunciou nenhum produto.</p>";
        return;
      }

      container.innerHTML = "";
      myProducts.forEach((product) => {
        container.insertAdjacentHTML(
          "beforeend",
          marketplace.createProductCardHTML(product)
        );
      });

      // Configura os botões de ação com a lógica de recarregar a página
      container.querySelectorAll(".btn-delete-product").forEach((button) => {
        button.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const productId = e.currentTarget.dataset.productId;
          const sucesso = await marketplace.handleDeleteProduct(productId);
          if (sucesso) {
            this.initGerenciarAnuncios(); // Recarrega a lista de anúncios
          }
        });
      });
      // Adicione a lógica para o botão de editar aqui quando for implementá-lo
    } catch (error) {
      console.error("Erro ao buscar 'Meus Anúncios':", error);
      container.innerHTML =
        "<p style='color:red;'>Erro ao carregar seus anúncios.</p>";
    }
  },

  // FUNÇÃO MOVIDA DE ganhos.js PARA CÁ
  atualizarTelaInicio: async function (ganhosUsuario) {
    const usuario = firebaseAuth.currentUser;
    if (!usuario) return;

    // Se os ganhos não forem passados, busca por segurança, mas o ideal é receber via parâmetro.
    if (!ganhosUsuario) ganhosUsuario = await ganhos.fetchGanhos(true);

    const hoje = new Date().toISOString().slice(0, 10);

    // Cálculo Hoje
    const ganhosHoje = ganhosUsuario
      .filter((g) => g.data === hoje)
      .reduce((s, g) => s + g.valor, 0);

    // Função auxiliar para obter o intervalo de datas
    const getDateRange = (periodo) => {
      const agora = new Date();
      agora.setHours(0, 0, 0, 0);
      if (periodo === "esta-semana") {
        const primeiroDia = new Date(agora);
        primeiroDia.setDate(agora.getDate() - agora.getDay());
        return { start: primeiroDia, end: agora };
      }
      if (periodo === "este-mes") {
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
        return { start: inicioMes, end: agora };
      }
      return { start: null, end: null };
    };

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

    // Atualiza textos na DOM da tela de início
    this.setElementText("resumoHoje", formatarMoeda(ganhosHoje));
    this.setElementText("resumoSemana", formatarMoeda(ganhosSemana));
    this.setElementText("resumoMes", formatarMoeda(ganhosMes));

    // << CORREÇÃO FINAL >>: Chamada para a função do gráfico de anéis.
    // Filtramos os ganhos para passar apenas os da semana para o gráfico.
    const ganhosDaSemanaParaGrafico = ganhosUsuario.filter(
      (g) =>
        new Date(g.data + "T00:00:00") >= semanaRange.start &&
        new Date(g.data + "T00:00:00") <= semanaRange.end
    );
    this.atualizarGraficoCategoriasInicio(ganhosDaSemanaParaGrafico);

    // --- CORREÇÃO: ADICIONANDO OS INDICADORES FALTANTES ---

    // 1. Último Ganho
    let ultimaEntrega = "-";
    if (ganhosUsuario.length > 0) {
      // Ordena para garantir que o mais recente esteja primeiro
      const ult = [...ganhosUsuario].sort(
        (a, b) => new Date(b.data) - new Date(a.data)
      )[0];
      ultimaEntrega = `${new Date(ult.data + "T12:00:00").toLocaleDateString(
        "pt-BR"
      )} (${formatarMoeda(ult.valor)})`;
    }

    // 2. Média de entregas por dia
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

    // 3. Melhor Dia
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

    // Atualiza os elementos no HTML
    this.setElementText("mediaEntregas", mediaEntregas.toFixed(1));
    this.setElementText("melhorDia", melhorDia);
    this.setElementText("ultimaEntrega", ultimaEntrega);

    // --- CORREÇÃO DA META SEMANAL ---
    // A lógica da meta agora está aqui, onde tem acesso direto ao perfil e aos ganhos da semana.
    try {
      const perfilUsuario = await this.fetchUserProfile(); // Reutiliza o perfil já buscado
      const metaSemanal = perfilUsuario
        ? perfilUsuario.metaSemanal || 1000
        : 1000;

      const faltaMeta = Math.max(0, metaSemanal - ganhosSemana);
      const metaMensagemEl = $("metaMensagem");
      if (metaMensagemEl) {
        metaMensagemEl.innerHTML =
          faltaMeta > 0
            ? `Faltam ${formatarMoeda(
                faltaMeta
              )} para bater sua meta de ${formatarMoeda(metaSemanal)}!`
            : `Parabéns! Você bateu sua meta de ${formatarMoeda(metaSemanal)}!`;
      }

      // Atualiza a barra de progresso (lógica que estava em ganhos.js)
      const progressoContainer = $("progresso-meta-container");
      if (progressoContainer) {
        const progresso =
          metaSemanal > 0
            ? Math.min(100, (ganhosSemana / metaSemanal) * 100)
            : 0;
        progressoContainer.innerHTML = `<div class="progresso-meta"><div class="progresso-barra" style="width: ${progresso}%"></div></div><div class="progresso-texto">${progresso.toFixed(
          0
        )}% da meta alcançada</div>`;
        if (progresso >= 100) {
          const barra = progressoContainer.querySelector(".progresso-barra");
          if (barra) barra.classList.add("meta-completa");
        }
      }
    } catch (e) {
      console.error("Erro ao carregar perfil para meta:", e);
    }
  },

  // FUNÇÃO MOVIDA DE ganhos.js E ADAPTADA PARA A TELA DE INÍCIO
  atualizarGraficoCategoriasInicio: function (ganhosDoPeriodo) {
    const container = $("grafico-categorias-inicio-container");
    const ctx = $("grafico-categorias-inicio");
    if (!ctx || !container) return;

    const totaisPorCategoria = ganhosDoPeriodo.reduce((acc, ganho) => {
      const categoria = ganho.categoria || "indefinida";
      acc[categoria] = (acc[categoria] || 0) + ganho.valor;
      return acc;
    }, {});

    const categorias = Object.keys(totaisPorCategoria);
    const totalGeral = Object.values(totaisPorCategoria).reduce(
      (s, v) => s + v,
      0
    );

    if (categorias.length === 0 || totalGeral === 0) {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";

    const configCat = {
      loja_fixa: { nome: "Loja Fixa", cor: "#3498db" },
      passageiros: { nome: "Passageiros", cor: "#f1c40f" },
      entregas: { nome: "Entregas App", cor: "#e74c3c" },
      indefinida: { nome: "Outros", cor: "#95a5a6" },
    };

    const datasets = categorias.map((cat, index) => {
      const valorCategoria = totaisPorCategoria[cat];
      const cor = configCat[cat]?.cor || "#bdc3c7";
      return {
        label: configCat[cat]?.nome || "Desconhecido",
        data: [valorCategoria, totalGeral - valorCategoria],
        backgroundColor: [cor, "rgba(0, 0, 0, 0.05)"],
        borderColor: "#fff",
        borderWidth: 2,
        cutout: `${65 - index * 15}%`,
      };
    });

    if (this.chartCategoriasInicio) {
      this.chartCategoriasInicio.destroy();
    }

    this.chartCategoriasInicio = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: datasets.map((d) => d.label),
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // --- MELHORIA DA ANIMAÇÃO ---
        animation: {
          duration: 1000, // Aumenta a duração da animação para 1 segundo
          easing: "easeInOutQuart", // Um efeito de aceleração/desaceleração suave
          delay: (context) => {
            // A mágica acontece aqui!
            // Atraso de 300ms para cada anel subsequente.
            // Anel 0 (externo): delay 0ms
            // Anel 1 (meio): delay 300ms
            // Anel 2 (interno): delay 600ms
            return context.datasetIndex * 300;
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, padding: 15 },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const valor = context.dataset.data[0];
                return `${context.dataset.label}: ${formatarMoeda(valor)}`;
              },
            },
          },
        },
      },
    });
  },

  // FUNÇÃO MOVIDA DE reports.js E CORRIGIDA
  setupFerramentasInicio: function () {
    // Botão Adicionar Ganho da tela inicial
    const atalhoAdicionarGanho = $("atalhoAdicionarGanho");
    if (atalhoAdicionarGanho) {
      atalhoAdicionarGanho.onclick = () => this.navegarPara("ganhos");
    }

    // Botão Exportar
    const atalhoExportar = $("atalhoExportar");
    if (atalhoExportar)
      atalhoExportar.onclick = () => relatorios.exportarRelatorioCSV();

    // Botão Compartilhar WhatsApp da tela inicial
    const atalhoCompartilhar = $("atalhoCompartilhar");
    if (atalhoCompartilhar)
      atalhoCompartilhar.onclick = () => relatorios.compartilharWhatsApp();
  },
};
