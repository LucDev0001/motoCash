import { db, appId } from "../config.js";
import { currentUser } from "../auth.js";
import { router } from "../router.js";
import * as API from "../api.js";
import {
  toggleTheme,
  openPublicProfileEditor,
  openModal,
  closeModal,
  showToast, // Importa a nova função
} from "../ui.js";

export async function renderProfile(c) {
  c.innerHTML = await fetch("src/templates/views/profile.html").then((res) =>
    res.text()
  );

  document.getElementById("profile-name-display").textContent =
    currentUser.displayName || currentUser.email || "User";
  document.getElementById(
    "profile-uid-display"
  ).textContent = `ID: ${currentUser.uid.slice(0, 8)}`;

  // **CORREÇÃO**: Busca os dados do usuário e SÓ ENTÃO adiciona os listeners.
  try {
    const doc = await db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(currentUser.uid)
      .get();

    if (doc.exists) {
      updateProfileStats(doc);
      addProfileListeners(doc.data());
    }
  } catch (error) {
    console.error("Erro ao carregar dados do perfil:", error);
  }
}

function addProfileListeners(userData = {}) {
  const isPro = userData.isPro === true;

  document
    .getElementById("theme-toggle")
    .addEventListener("click", toggleTheme);
  document
    .getElementById("edit-public-profile-btn")
    .addEventListener("click", openPublicProfileEditor);

  const shareProfileBtn = document.getElementById("share-profile-btn");
  if (shareProfileBtn) {
    shareProfileBtn.addEventListener("click", () =>
      sharePublicProfile(userData)
    );
  }
  document
    .getElementById("achievements-btn")
    .addEventListener("click", () => router("achievements"));
  document
    .getElementById("accepted-jobs-btn")
    .addEventListener("click", () => router("accepted-jobs"));
  document
    .getElementById("history-jobs-btn")
    .addEventListener("click", () => router("history-jobs"));
  document
    .getElementById("maintenance-shortcut-btn")
    .addEventListener("click", () => router("garage"));

  // --- Lógica para funcionalidades PRO ---
  const backupBtn = document.getElementById("backup-btn");
  const restoreBtn = document.getElementById("restore-btn");
  const restoreFileInput = document.getElementById("restore-file-input");
  const proPlanCard = document.getElementById("pro-plan-card");

  // Adiciona o clique para abrir o modal de apoiador
  if (proPlanCard) {
    proPlanCard.addEventListener("click", () => openModal("proPlanModal"));
  }

  if (isPro) {
    // Usuário é Apoiador: Habilita as funções
    if (backupBtn) backupBtn.onclick = API.backupData;
    if (restoreBtn) restoreBtn.onclick = () => restoreFileInput.click();
  } else {
    // Usuário NÃO é Apoiador: Desabilita e adiciona o convite
    if (backupBtn) {
      backupBtn.disabled = true;
      backupBtn.onclick = () => openModal("proPlanModal");
    }
    if (restoreBtn) {
      restoreBtn.disabled = true;
      restoreBtn.onclick = () => openModal("proPlanModal");
    }
  }

  // Listener para o input de arquivo (sempre ativo)
  if (restoreFileInput) {
    restoreFileInput.onchange = (event) => {
      const file = event.target.files[0];
      if (file) API.restoreData(file);
      event.target.value = null; // Limpa o input para permitir selecionar o mesmo arquivo novamente
    };
  }

  document
    .getElementById("about-btn")
    .addEventListener("click", () => router("about"));
  document.getElementById("logout-btn").addEventListener("click", API.logout);
  document
    .getElementById("delete-account-btn")
    .addEventListener("click", API.deleteUserAccount);
  document
    .getElementById("enable-notifications-btn")
    .addEventListener("click", API.requestNotificationPermission);

  lucide.createIcons();
}

function updateProfileStats(doc) {
  if (!doc.exists) return;

  // Garante que os elementos existam antes de tentar atualizá-los.
  const statsRatingEl = document.getElementById("stats-rating");
  const statsJobsEl = document.getElementById("stats-jobs");
  const statsEarningsEl = document.getElementById("stats-earnings");

  if (!statsRatingEl || !statsJobsEl || !statsEarningsEl) {
    return;
  }

  const data = doc.data();
  const profile = data.publicProfile || {};
  const isPro = data.isPro === true; // Verifica se o usuário é um Apoiador

  // Controla a visibilidade do selo e do card de assinatura
  const proBadge = document.getElementById("pro-badge");
  const proPlanCard = document.getElementById("pro-plan-card");
  const shareProfileBtn = document.getElementById("share-profile-btn");

  if (proBadge) {
    proBadge.classList.toggle("hidden", !isPro);
  }
  if (proPlanCard) proPlanCard.classList.toggle("hidden", isPro);
  // **NOVO**: Mostra o botão de compartilhar apenas para usuários Pro
  if (shareProfileBtn) shareProfileBtn.classList.toggle("hidden", !isPro);

  // **NOVO**: Controla os botões de Backup/Restauração
  const proFeatureLocks = document.querySelectorAll(".pro-feature-lock");
  proFeatureLocks.forEach((lock) => {
    lock.classList.toggle("hidden", isPro);
    lock.classList.toggle("flex", !isPro); // Usa 'flex' para mostrar
  });

  // Atualiza estatísticas
  statsRatingEl.textContent = profile.rating
    ? `${profile.rating.toFixed(1)} ★`
    : "N/A";

  lucide.createIcons(); // Garante que o novo ícone seja renderizado

  db.collection("jobs")
    .where("motoboyId", "==", currentUser.uid)
    .where("status", "==", "concluida")
    .get()
    .then((snap) => {
      statsJobsEl.textContent = snap.size;
    });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const earningsQuery = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .collection("earnings")
    .where("date", ">=", startOfMonth.toISOString().split("T")[0]);

  earningsQuery.get().then((snap) => {
    const monthlyEarnings = snap.docs.reduce(
      (acc, doc) => acc + doc.data().totalValue,
      0
    );
    statsEarningsEl.textContent = `R$ ${monthlyEarnings.toFixed(2)}`;
  });
}

/**
 * Abre o modal de compartilhamento do perfil público.
 * @param {object} userData - Os dados do usuário logado.
 */
async function sharePublicProfile(userData) {
  const modal = await openModal("shareProfileModal");

  const publicProfile = userData.publicProfile || {};
  const profileUrl = `${window.location.origin}${window.location.pathname}?profile=${currentUser.uid}`;

  // Preenche o preview
  const previewImage = modal.querySelector("#preview-profile-image");
  const previewName = modal.querySelector("#preview-profile-name");
  const previewMoto = modal.querySelector("#preview-profile-moto");

  if (publicProfile.motoImageUrl) {
    previewImage.innerHTML = `<img src="${publicProfile.motoImageUrl}" class="w-full h-full object-cover rounded-full">`;
  } else {
    previewImage.innerHTML = `<i data-lucide="bike" class="w-8 h-8 text-gray-400"></i>`;
    lucide.createIcons();
  }
  previewName.textContent = publicProfile.name || "Nome não definido";
  previewMoto.textContent =
    publicProfile.fipeModelText || "Moto não cadastrada";

  // Adiciona listeners aos botões de ação
  modal.querySelector("#copy-profile-link-btn").onclick = () => {
    navigator.clipboard
      .writeText(profileUrl)
      .then(() => {
        showToast("Link do perfil copiado!", "copy");
        closeModal();
      })
      .catch(() => {
        alert("Não foi possível copiar o link.");
      });
  };

  modal.querySelector("#whatsapp-share-btn").onclick = () => {
    const text = `Olá! Dê uma olhada no meu perfil profissional de motofretista no AppMotoCash: ${profileUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };
}
