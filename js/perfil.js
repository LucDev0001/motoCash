// js/perfil.js
// Gerencia a exibição e atualização dos dados do usuário.

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

let localProfileCache = null; // Cache para o perfil do usuário

export const perfil = {
  navegarPara: null, // Propriedade para armazenar a função de navegação

  init: function (dependencies) {
    // Armazena a função de navegação dentro do próprio objeto
    this.navegarPara = dependencies.navegarPara;
    this.setupEventListeners();
  },

  // SUBSTITUA SUA FUNÇÃO POR ESTA VERSÃO PARA TESTE
  setupEventListeners: function () {
    console.log("1. setupEventListeners foi chamado."); // Log 1

    const formAlterar = document.getElementById("formAlterarCadastro");
    if (formAlterar) {
      formAlterar.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleAlterarDados();
      });
    }

    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
      btnSair.addEventListener("click", async () => {
        try {
          await firebaseAuth.signOut();
          // O observador onAuthStateChanged no main.js cuidará da navegação para a tela de login.
        } catch (error) {
          console.error("Erro ao fazer logout:", error);
        }
      });
    }

    const btnEditar = document.getElementById("btnEditarPerfil");
    const cardEdicao = document.getElementById("cardEdicao");

    console.log("2. Procurando elementos:"); // Log 2
    console.log("   - Botão Editar encontrado?", btnEditar); // Log 3
    console.log("   - Card de Edição encontrado?", cardEdicao); // Log 4

    if (btnEditar && cardEdicao) {
      console.log("3. Elementos encontrados! Adicionando evento de clique."); // Log 5
      btnEditar.addEventListener("click", () => {
        console.log("4. Botão Editar FOI CLICADO!"); // Log 6
        cardEdicao.classList.toggle("ativo");
      });
    } else {
      console.error(
        "ERRO: Um ou ambos os elementos (botão ou card) não foram encontrados no HTML."
      ); // Log de Erro
    }
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

  atualizarUI: async function () {
    const usuario = await this.fetchUserProfile();
    if (!usuario) return;

    // Atualiza elementos que podem estar em várias telas (como a tela de início)
    this.setElementText("msgOlaInicio", `Olá, ${usuario.nome || "Usuário"}`);

    // Configura o botão para ir para a nova tela de gerenciamento
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
    if (!user) return alert("Você precisa estar logado para alterar os dados.");

    const dadosParaAtualizar = {
      nome: $("novoNome").value.trim(),
      metaSemanal: parseFloat($("novaMetaSemanal").value) || 1000,
      telefone: $("novoTelefone").value.trim(),
      moto: $("novaMoto").value,
    };

    // TODO: Implementar lógica para alterar senha e avatar se necessário

    try {
      const docRef = doc(db, "usuarios", user.uid);
      await updateDoc(docRef, dadosParaAtualizar);

      localProfileCache = null; // Invalida o cache
      await this.atualizarUI(); // Atualiza a UI com os novos dados
      alert("Dados alterados com sucesso!");
      $("cardEdicao").classList.remove("ativo"); // Fecha o card de edição
    } catch (error) {
      console.error("Erro ao atualizar dados:", error);
      alert("Ocorreu um erro ao salvar suas alterações.");
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
};
