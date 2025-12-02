import { router } from "../router.js";
import { manifest } from "../main.js"; // Importa o manifesto
import { showNotification } from "../ui.js";

export async function renderAbout(c) {
  c.innerHTML = await fetch("src/templates/views/about.html").then((res) =>
    res.text()
  );

  // **CORREÇÃO**: Adiciona a versão do app dinamicamente
  const versionEl = document.getElementById("app-version");
  if (versionEl) {
    versionEl.textContent = `Versão ${manifest.version || "2.0.0"}`;
  }
  // Adiciona a lógica dos botões que só existem nesta tela
  document
    .getElementById("back-to-profile-btn")
    .addEventListener("click", () => router("profile"));

  document.getElementById("copy-pix-btn").addEventListener("click", () => {
    const pixKey = "11661221408";
    navigator.clipboard
      .writeText(pixKey)
      .then(() => {
        showNotification(
          "Chave PIX copiada para a área de transferência!",
          "Copiado!"
        );
      })
      .catch((err) => {
        showNotification("Não foi possível copiar a chave.", "Erro");
      });
  });

  lucide.createIcons();
}
