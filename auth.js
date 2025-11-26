import { auth, db, appId } from "./config.js";
import {
  router,
  showVerificationBanner,
  showLoginError,
  showNotification,
} from "./ui.js";

export let currentUser = null;

export function initAuth() {
  auth.onAuthStateChanged((user) => {
    const loginScreen = document.getElementById("login-screen");
    const mainApp = document.getElementById("main-app");

    if (user) {
      currentUser = user;
      loginScreen.classList.add("hidden");
      mainApp.classList.remove("hidden");
      mainApp.classList.add("flex");
      router("dashboard");

      // Sincroniza o estado do toggle Online/Offline com o Firestore
      const userRef = db
        .collection("artifacts")
        .doc(appId)
        .collection("users")
        .doc(user.uid);

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

        listenForUserNotifications(user.uid);
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
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const notification = change.doc.data();

        // Mostra a notificação para o usuário
        showNotification(notification.message, notification.title);

        // Marca a notificação como lida para não mostrar novamente
        change.doc.ref.update({ read: true });
      }
    });
  });
}
