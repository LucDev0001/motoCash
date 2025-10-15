// js/auth.js
// Lida com a lógica de login, cadastro e gerenciamento de sessão.

import { $ } from './utils.js';
import { storage } from './storage.js';

export const auth = {
  navegarPara: null, // Propriedade para armazenar a função de navegação

  init: function (dependencies) {
    // Armazena a função de navegação dentro do próprio objeto
    this.navegarPara = dependencies.navegarPara;
    this.setupLoginCadastro();
  },

  setupLoginCadastro: function () {
    // Esses elementos só existem na tela de login, então os eventos são adicionados aqui.
    const linkCadastro = $("linkCadastro");
    if (linkCadastro) {
      linkCadastro.addEventListener("click", (e) => {
        e.preventDefault();
        $("formLogin").parentElement.style.display = "none";
        $("cadastroBox").style.display = "block";
      });
    }
      
    const linkLogin = $("linkLogin");
    if (linkLogin) {
      linkLogin.addEventListener("click", (e) => {
        e.preventDefault();
        $("cadastroBox").style.display = "none";
        $("formLogin").parentElement.style.display = "block";
      });
    }

    document.querySelectorAll(".avatar-opcao").forEach((img) => {
      img.addEventListener("click", () => {
        document.querySelectorAll(".avatar-opcao").forEach((i) => i.classList.remove("avatar-selecionado"));
        img.classList.add("avatar-selecionado");
        $("avatarSelecionado").value = img.dataset.avatar;
      });
    });
    
    const formLogin = $("formLogin");
    if (formLogin) {
      formLogin.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }
      
    const formCadastro = $("formCadastro");
    if (formCadastro) {
      formCadastro.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleCadastro();
      });
    }
  },

  handleLogin: function () {
    const usuario = $("loginUsuario").value.trim();
    const senha = $("loginSenha").value;
    const user = storage.getUsuarios().find((u) => u.usuario === usuario && u.senha === senha);
    
    if (user) {
      storage.setUsuarioLogado(user);
      this.showError("loginErro", "");
      this.afterLogin();
    } else {
      this.showError("loginErro", "Usuário ou senha inválidos!");
    }
  },

  handleCadastro: function () {
    const usuario = $("cadastroUsuario").value.trim();
    const avatar = $("avatarSelecionado").value;
    
    if (!usuario) return this.showError("cadastroErro", "Usuário inválido!");
    if (storage.getUsuarios().find((u) => u.usuario === usuario)) return this.showError("cadastroErro", "Usuário já existe!");
    if (!avatar) return this.showError("cadastroErro", "Selecione um avatar!");

    const usuarios = storage.getUsuarios();
    const novoUsuario = {
      usuario,
      avatar,
      senha: $("cadastroSenha").value,
      nome: $("cadastroNome").value.trim(),
      telefone: $("cadastroTelefone").value.trim(),
      moto: $("cadastroMoto").value,
      metaSemanal: parseFloat($("cadastroMetaSemanal").value) || 1000,
    };
    usuarios.push(novoUsuario);
    storage.setUsuarios(usuarios);
    storage.setUsuarioLogado(novoUsuario);
    this.afterLogin();
  },

  showError: (id, msg) => {
    const el = $(id);
    if (el) el.textContent = msg;
  },

  afterLogin: function () {
    const bottomBar = $("bottomBar");
    if (bottomBar) bottomBar.style.display = 'flex';
    
    // Chama a função de navegação que foi armazenada no init
    if (this.navegarPara) {
      this.navegarPara('inicio');
    }
  },
};

