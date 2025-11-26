import { auth, db, appId } from "./config.js";
import { router, showVerificationBanner } from "./ui.js";

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

      userRef.get().then((doc) => {
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
