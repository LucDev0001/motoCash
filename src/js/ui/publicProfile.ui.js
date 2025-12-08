import { getPublicProfile } from "../api.js";

/**
 * Renderiza a página de perfil público de um usuário específico.
 * @param {HTMLElement} container - O elemento onde o conteúdo será renderizado.
 * @param {string} userId - O ID do usuário cujo perfil será exibido.
 */
export async function renderPublicProfileView(container, userId) {
  // 1. Carrega o template HTML da view
  container.innerHTML = await fetch(
    "src/templates/views/publicProfile.html"
  ).then((res) => res.text());

  try {
    // 2. Busca os dados do perfil público usando a função da API
    const profile = await getPublicProfile(userId);

    if (profile) {
      // 3. Se o perfil foi encontrado, preenche os dados na tela
      document.getElementById("public-profile-name").textContent =
        profile.name || "Usuário";

      const imageContainer = document.getElementById("public-profile-image");
      if (profile.motoImageUrl) {
        imageContainer.innerHTML = `<img src="${profile.motoImageUrl}" class="w-full h-full object-cover rounded-full" alt="Foto da moto de ${profile.name}">`;
      } else {
        imageContainer.innerHTML = `<i data-lucide="bike" class="w-12 h-12 text-gray-400"></i>`;
      }

      document.getElementById("public-profile-moto").textContent =
        profile.fipeModelText || "Moto não informada";

      // Lógica de Rank (exemplo, pode ser ajustado)
      // Como não temos acesso às conquistas aqui, usamos um valor padrão.
      document.getElementById("public-profile-rank").textContent =
        "Piloto Experiente";

      const contactBtn = document.getElementById("public-profile-contact-btn");
      if (profile.whatsapp) {
        contactBtn.href = `https://wa.me/55${profile.whatsapp}?text=Olá, ${profile.name}! Vi seu perfil no AppMotoCash e gostaria de te contratar.`;
        contactBtn.classList.remove("hidden");
      } else {
        contactBtn.classList.add("hidden");
      }
    } else {
      // 4. Se o perfil não foi encontrado, lança um erro para ser tratado no bloco catch
      throw new Error("Usuário não encontrado ou perfil não é público.");
    }
  } catch (error) {
    // 5. Exibe a mensagem de erro de forma limpa dentro do container
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-screen bg-gray-100 dark:bg-gray-900 text-center p-4">
        <i data-lucide="alert-triangle" class="w-16 h-16 text-red-500 mb-4"></i>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200">Erro</h2>
        <p class="text-gray-600 dark:text-gray-400">${error.message}</p>
      </div>
    `;
  } finally {
    // 6. Garante que os ícones sejam renderizados em qualquer cenário
    lucide.createIcons();
  }
}
