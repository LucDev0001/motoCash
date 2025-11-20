// js/perfil.js
// Gerencia a exibição e atualização dos dados do usuário.

// Importa as ferramentas do Firebase
import { auth as firebaseAuth, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
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
};
