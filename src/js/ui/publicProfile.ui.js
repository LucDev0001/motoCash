import { db, appId } from "../config.js";

/**
 * Renderiza a página de perfil público de um usuário específico.
 * @param {HTMLElement} container - O elemento onde o conteúdo será renderizado.
 * @param {string} userId - O ID do usuário cujo perfil será exibido.
 */
export async function renderPublicProfile(container, userId) {
  container.innerHTML = await fetch(
    "src/templates/views/publicProfile.html"
  ).then((res) => res.text());

  try {
    // Busca os dados do usuário e das conquistas em paralelo
    const userRef = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error("Usuário não encontrado.");
    }

    const userData = userDoc.data();
    const publicProfile = userData.publicProfile || {};

    // Preenche os dados na tela
    document.getElementById("public-profile-name").textContent =
      publicProfile.name || "Motoboy";

    // Preenche a imagem da moto
    const imageContainer = document.getElementById("public-profile-image");
    if (publicProfile.motoImageUrl) {
      imageContainer.innerHTML = `<img src="${publicProfile.motoImageUrl}" class="w-full h-full object-cover rounded-full" alt="Foto da moto">`;
    } else {
      imageContainer.innerHTML = `<i data-lucide="bike" class="w-12 h-12 text-gray-400"></i>`;
    }

    // Preenche o modelo da moto
    document.getElementById("public-profile-moto").textContent =
      publicProfile.fipeModelText || "Não informado";

    // Preenche o Rank de Conquistas
    const unlockedCount = userData.achievements?.length || 0;
    let rankTitle = "Novato na Pista";
    if (unlockedCount >= 10) rankTitle = "Lenda do Asfalto";
    else if (unlockedCount >= 6) rankTitle = "Veterano das Ruas";
    else if (unlockedCount >= 3) rankTitle = "Piloto Experiente";
    document.getElementById("public-profile-rank").textContent = rankTitle;

    // Configura o botão de contato
    const contactBtn = document.getElementById("public-profile-contact-btn");
    if (publicProfile.whatsapp) {
      contactBtn.href = `https://wa.me/55${publicProfile.whatsapp}?text=Olá, vi seu perfil no AppMotoCash e gostaria de fazer um orçamento.`;
    } else {
      contactBtn.classList.add("hidden");
    }
  } catch (error) {
    container.innerHTML = `<div class="text-center text-red-500 p-8">
        <h2 class="text-2xl font-bold">Erro</h2>
        <p>${error.message}</p>
      </div>`;
  } finally {
    lucide.createIcons();
  }
}
