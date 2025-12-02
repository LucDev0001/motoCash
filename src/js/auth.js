import { auth, db, appId } from "./config.js";
import { router } from "./router.js";
import { showVerificationBanner, showLoginError, showToast } from "./ui.js";
import { handleEmailLogin, handlePasswordReset } from "./api.js";

export let currentUser = null;

export function initAuth() {
  // Adiciona os listeners para os botões da tela de login
  const btnSignin = document.getElementById("btn-signin");
  const btnSignup = document.getElementById("btn-signup");
  const btnForgotPassword = document.getElementById("btn-forgot-password");

  if (btnSignin) {
    btnSignin.addEventListener("click", () => handleEmailLogin("login"));
  }
  if (btnSignup) {
    btnSignup.addEventListener("click", () => handleEmailLogin("register"));
  }
  if (btnForgotPassword) {
    btnForgotPassword.addEventListener("click", handlePasswordReset);
  }

  const privacyLink = document.getElementById("login-privacy-link");
  if (privacyLink) {
    privacyLink.addEventListener("click", (e) => {
      e.preventDefault(); // Impede a navegação padrão
      router("privacy"); // Usa o router do app
    });
  }

  // Listener para mostrar/esconder o checkbox de termos
  document.addEventListener("click", function (event) {
    if (event.target && event.target.id === "btn-signup") {
      document.getElementById("terms-container")?.classList.remove("hidden");
    } else if (event.target && event.target.id === "btn-signin") {
      document.getElementById("terms-container")?.classList.add("hidden");
    }
  });

  auth.onAuthStateChanged((user) => {
    const loginScreen = document.getElementById("login-screen");
    const mainApp = document.getElementById("main-app");

    if (user) {
      currentUser = user;
      loginScreen.classList.add("hidden");
      mainApp.classList.remove("hidden");
      mainApp.classList.add("flex");

      unlockAudio(); // **NOVO: Tenta "desbloquear" o áudio para futuras notificações.**

      router("dashboard");

      // Sincroniza o estado do toggle Online/Offline com o Firestore
      const userRef = db
        .collection("artifacts")
        .doc(appId)
        .collection("users")
        .doc(user.uid);

      // Inicia o listener de notificações assim que o usuário é autenticado.
      listenForUserNotifications(user.uid);

      // NOVO: Inicia o listener para vagas ativas
      listenForActiveJobs(user.uid);

      userRef.onSnapshot((doc) => {
        const userData = doc.data();

        // **NOVO: Verifica se a conta está suspensa**
        if (userData?.accountStatus === "suspended") {
          console.warn("Conta suspensa tentou fazer login. Deslogando...");
          auth.signOut().then(() => {
            // A chamada a signOut vai re-trigger onAuthStateChanged, que cuidará de mostrar a tela de login.
            // A mensagem de erro é mostrada após um pequeno delay para garantir que a UI de login esteja visível.
            setTimeout(
              () =>
                showLoginError(
                  "Sua conta está suspensa. Entre em contato com o suporte."
                ),
              100
            );
          });
          return; // Interrompe a execução para este usuário
        }

        const isOnline = doc.data()?.status?.isOnline || false;
        const toggle = document.getElementById("user-status-toggle");
        const dot = document.getElementById("user-status-toggle-dot");
        const text = document.getElementById("user-status-text");

        if (toggle && dot && text) {
          toggle.classList.toggle("bg-green-600", isOnline);
          toggle.classList.toggle("bg-gray-700", !isOnline);
          dot.classList.toggle("translate-x-6", isOnline);
          text.textContent = isOnline ? "ONLINE" : "OFFLINE";
          text.classList.toggle("text-green-500", isOnline);
          text.classList.toggle("text-gray-400", !isOnline);
        }
      });

      // Verifica se o e-mail foi verificado (apenas para contas de e-mail/senha)
      if (
        user.providerData.some((p) => p.providerId === "password") &&
        !user.emailVerified
      ) {
        showVerificationBanner();
      }
    } else {
      currentUser = null;
      loginScreen.classList.remove("hidden");
      mainApp.classList.add("hidden");
      mainApp.classList.remove("flex");
    }
  });
}

let audioUnlocked = false;
/**
 * Toca um som silencioso após a primeira interação do usuário para "desbloquear"
 * a permissão de áudio do navegador. Isso permite que as notificações futuras
 * consigam tocar som.
 */
function unlockAudio() {
  if (audioUnlocked) return;

  const audio = new Audio("./assets/notification.mp3");
  audio.volume = 0.01; // Volume muito baixo, quase inaudível
  audio.play().catch(() => {
    // A primeira tentativa pode falhar, mas prepara o terreno.
  });

  audioUnlocked = true;
}

let unsubscribeUserNotifications = null;

/**
 * Ouve por novas notificações não lidas para o usuário atual.
 * @param {string} uid - O ID do usuário.
 */
function listenForUserNotifications(uid) {
  // Cancela o listener anterior se houver, para evitar duplicação
  if (unsubscribeUserNotifications) {
    unsubscribeUserNotifications();
  }

  const notificationsRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(uid)
    .collection("notifications")
    .where("read", "==", false)
    .orderBy("createdAt", "desc");

  unsubscribeUserNotifications = notificationsRef.onSnapshot((snapshot) => {
    const unreadCount = snapshot.size;
    const indicator = document.getElementById("notification-indicator");
    const previousUnreadCount = parseInt(indicator.textContent) || 0;

    if (indicator) {
      if (unreadCount > 0) {
        indicator.textContent = unreadCount;
        indicator.classList.remove("hidden");
        // Toca o som apenas se o número de notificações não lidas aumentou
        if (unreadCount > previousUnreadCount) {
          const audio = new Audio("./assets/notification.mp3");
          audio
            .play()
            .catch((e) =>
              console.warn("Não foi possível tocar o som de notificação:", e)
            );
        }
      } else {
        indicator.classList.add("hidden");
      }
    }

    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        // **NOVO**: Exibe um toast para cada nova notificação.
        const newNotification = change.doc.data();
        if (newNotification.title) {
          showToast(newNotification.title, "bell");
        }
      }
    });
  });
}

let unsubscribeActiveJobs = null;

/**
 * Ouve por vagas em negociação para o usuário atual e mostra/esconde o indicador.
 * @param {string} uid - O ID do usuário.
 */
function listenForActiveJobs(uid) {
  if (unsubscribeActiveJobs) {
    unsubscribeActiveJobs();
  }

  const jobsRef = db
    .collection("jobs")
    .where("motoboyId", "==", uid)
    .where("status", "==", "negociando");

  unsubscribeActiveJobs = jobsRef.onSnapshot((snapshot) => {
    const indicator = document.getElementById("active-job-indicator");
    const indicatorBtn = document.getElementById("active-job-btn");

    if (!indicator || !indicatorBtn) return;

    if (!snapshot.empty) {
      const activeJob = snapshot.docs[0]; // Pega a primeira vaga ativa
      indicator.classList.remove("hidden");
      indicatorBtn.onclick = () => {
        window.currentJobId = activeJob.id;
        router("job-chat");
      };
    } else {
      indicator.classList.add("hidden");
    }
  });
}
