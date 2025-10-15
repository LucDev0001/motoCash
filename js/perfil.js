// js/perfil.js
// Gerencia a exibição e atualização dos dados do usuário.

import { $ } from "./utils.js";
import { storage } from "./storage.js";
import { formatarMoeda } from "./utils.js";

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
      btnSair.addEventListener("click", () => {
        storage.limparSessao();
        const bottomBar = document.getElementById("bottomBar");
        if (bottomBar) bottomBar.style.display = "none";

        if (this.navegarPara) {
          this.navegarPara("login");
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

  atualizarUI: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    // Atualiza elementos que podem estar em várias telas (como a tela de início)
    this.setElementText(
      "msgOlaInicio",
      `Olá, ${usuario.nome || usuario.usuario}`
    );

    // Atualiza elementos específicos da tela de perfil
    this.setElementText("perfilNome", usuario.nome || usuario.usuario);
    this.setElementText("perfilUsuario", usuario.usuario);
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

  handleAlterarDados: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    const usuarios = storage.getUsuarios();
    const idx = usuarios.findIndex((u) => u.usuario === usuario.usuario);
    if (idx === -1) return;

    const novoNome = $("novoNome");
    const novaSenha = $("novaSenha");
    const novaMeta = $("novaMetaSemanal");
    const novoTelefone = $("novoTelefone");
    const novaMoto = $("novaMoto");

    if (novoNome && novoNome.value.trim())
      usuarios[idx].nome = novoNome.value.trim();
    if (novaSenha && novaSenha.value) usuarios[idx].senha = novaSenha.value;
    if (novaMeta && novaMeta.value)
      usuarios[idx].metaSemanal = parseFloat(novaMeta.value);
    if (novoTelefone && novoTelefone.value.trim())
      usuarios[idx].telefone = novoTelefone.value.trim();
    if (novaMoto && novaMoto.value) usuarios[idx].moto = novaMoto.value;

    storage.setUsuarios(usuarios);
    storage.setUsuarioLogado(usuarios[idx]);
    this.atualizarUI();
    alert("Dados alterados com sucesso!");
  },
};
