import { router } from "../router.js";
import { showNotification } from "../ui.js";

export async function renderAbout(c) {
  const appVersion = "1.3.0";
  c.innerHTML = await fetch("src/templates/views/about.html").then((res) =>
    res.text()
  );
  document.getElementById("app-version").textContent = `Versão ${appVersion}`;
  document
    .getElementById("support-link")
    .addEventListener("click", () => router("support"));
  document
    .getElementById("privacy-link")
    .addEventListener("click", () => router("privacy"));
  document.getElementById("copy-pix-btn").addEventListener("click", copyPixKey);
  document
    .getElementById("back-to-profile-btn")
    .addEventListener("click", () => router("profile"));
  lucide.createIcons();
}

export async function renderPrivacyPolicy(c) {
  c.innerHTML = await fetch("src/templates/views/privacy.html").then((res) =>
    res.text()
  );
  document
    .getElementById("privacy-back-btn")
    .addEventListener("click", () => window.history.back());
}

export async function renderSupport(c) {
  c.innerHTML = await fetch("src/templates/views/support.html").then((res) =>
    res.text()
  );
  document
    .getElementById("support-search")
    .addEventListener("keyup", searchSupportArticles);
  lucide.createIcons();
}

export function searchSupportArticles() {
  const searchTerm = document
    .getElementById("support-search")
    .value.toLowerCase();
  const articles = document.querySelectorAll(".support-article");
  const noResults = document.getElementById("no-results");
  let found = false;

  articles.forEach((article) => {
    const title = article.querySelector("h3").textContent.toLowerCase();
    const content = article.querySelector("p").textContent.toLowerCase();
    if (title.includes(searchTerm) || content.includes(searchTerm)) {
      article.style.display = "block";
      found = true;
    } else {
      article.style.display = "none";
    }
  });

  noResults.classList.toggle("hidden", found);
}

export function copyPixKey() {
  navigator.clipboard
    .writeText("11661221408")
    .then(() => {
      showNotification("Chave Pix copiada!", "Sucesso");
    })
    .catch(() => {
      showNotification("Não foi possível copiar a chave.", "Erro");
    });
}
