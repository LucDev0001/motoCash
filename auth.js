import { auth } from "./config.js";
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
