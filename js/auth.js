// js/auth.js
// Lida com a lógica de login, cadastro e gerenciamento de sessão.

// Importa as ferramentas do Firebase
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { auth as firebaseAuth, db } from "./firebase-config.js";
import { $ } from "./utils.js";
import { storage } from "./storage.js";

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

    // Links para páginas legais
    if ($("linkTermos")) {
      $("linkTermos").onclick = (e) => {
        e.preventDefault();
        this.navegarPara("termos");
      };
    }
    if ($("linkPolitica")) {
      $("linkPolitica").onclick = (e) => {
        e.preventDefault();
        this.navegarPara("politica");
      };
    }

    document.querySelectorAll(".avatar-opcao").forEach((img) => {
      img.addEventListener("click", () => {
        document
          .querySelectorAll(".avatar-opcao")
          .forEach((i) => i.classList.remove("avatar-selecionado"));
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

    // Lógica para habilitar/desabilitar o botão de cadastro
    const aceiteCheckbox = $("aceiteTermos");
    const btnCadastrar = $("btnCadastrar");
    if (aceiteCheckbox && btnCadastrar) {
      aceiteCheckbox.addEventListener("change", () => {
        btnCadastrar.disabled = !aceiteCheckbox.checked;
      });
    }
  },

  handleLogin: async function () {
    const email = $("loginUsuario").value.trim(); // Agora é um e-mail
    const senha = $("loginSenha").value;

    if (!email || !senha) {
      return this.showError("loginErro", "Preencha e-mail e senha.");
    }

    try {
      await signInWithEmailAndPassword(firebaseAuth, email, senha);
      // O observador onAuthStateChanged no main.js cuidará da navegação.
      this.showError("loginErro", ""); // Limpa erros anteriores
    } catch (error) {
      console.error("Erro de login:", error.code);
      this.showError("loginErro", "E-mail ou senha inválidos!");
    }
  },

  handleCadastro: async function () {
    const email = $("cadastroUsuario").value.trim(); // Agora é um e-mail
    const senha = $("cadastroSenha").value;
    const avatar = $("avatarSelecionado").value;
    const aceite = $("aceiteTermos").checked;

    if (!email) return this.showError("cadastroErro", "E-mail inválido!");
    if (!avatar) return this.showError("cadastroErro", "Selecione um avatar!");
    if (!aceite)
      return this.showError(
        "cadastroErro",
        "Você deve aceitar os termos para continuar."
      );

    try {
      // 1. Cria o usuário no Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        senha
      );
      const user = userCredential.user;

      // 2. Cria o documento de perfil no Firestore
      const perfilData = {
        uid: user.uid,
        email: user.email,
        avatar,
        nome: $("cadastroNome").value.trim() || "Novo Usuário",
        telefone: $("cadastroTelefone").value.trim(),
        moto: $("cadastroMoto").value,
        metaSemanal: parseFloat($("cadastroMetaSemanal").value) || 1000,
      };

      // Salva os dados do perfil no Firestore, usando o UID do usuário como ID do documento
      await setDoc(doc(db, "usuarios", user.uid), perfilData);

      // O observador onAuthStateChanged no main.js cuidará da navegação.
    } catch (error) {
      console.error("Erro de cadastro:", error.code);
      if (error.code === "auth/email-already-in-use") {
        this.showError("cadastroErro", "Este e-mail já está em uso!");
      } else if (error.code === "auth/invalid-email") {
        this.showError("cadastroErro", "Por favor, insira um e-mail válido.");
      } else if (error.code === "auth/weak-password") {
        this.showError(
          "cadastroErro",
          "A senha deve ter pelo menos 6 caracteres."
        );
      } else {
        this.showError("cadastroErro", "Erro ao criar conta. Tente novamente.");
      }
    }
  },

  showError: (id, msg) => {
    const el = $(id);
    if (el) el.textContent = msg;
  },

  afterLogin: function () {
    const bottomBar = $("bottomBar");
    if (bottomBar) bottomBar.style.display = "flex";

    // Chama a função de navegação que foi armazenada no init
    if (this.navegarPara) {
      this.navegarPara("inicio");
    }
  },
};
