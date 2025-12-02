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
  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .onSnapshot((doc) => {
      // A configuração inicial dos listeners é feita uma vez.
      // Este listener agora só atualiza os dados dinâmicos.
      updateProfileStats(doc);
    });

  // **CORREÇÃO**: Adiciona os listeners DEPOIS que o HTML foi carregado.
  document.getElementById("profile-name-display").textContent =
    currentUser.displayName || currentUser.email || "User";
  document.getElementById(
    "profile-uid-display"
  ).textContent = `ID: ${currentUser.uid.slice(0, 8)}`;

  document
    .getElementById("theme-toggle")
    .addEventListener("click", toggleTheme);
  document
    .getElementById("edit-public-profile-btn")
    .addEventListener("click", openPublicProfileEditor);
  document
    .getElementById("pro-plan-card")
    .addEventListener("click", () => openModal("proPlanModal"));
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
  document
    .getElementById("backup-btn")
    .addEventListener("click", API.backupData);

  const restoreBtn = document.getElementById("restore-btn");
  const restoreFileInput = document.getElementById("restore-file-input");

  if (restoreBtn && restoreFileInput) {
    restoreBtn.addEventListener("click", () => {
      restoreFileInput.click();
    });

    restoreFileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        API.restoreData(file);
      }
      event.target.value = null;
    });
  }

  // **NOVO**: Lógica para o botão de Compartilhar Perfil
  const shareProfileBtn = document.getElementById("share-profile-btn");
  if (shareProfileBtn) {
    shareProfileBtn.addEventListener("click", async () => {
      const shareUrl = `${window.location.origin}/?profile=${currentUser.uid}`;
      const shareData = {
        title: "Meu Perfil no AppMotoCash",
        text: "Confira meu perfil profissional de motoboy no AppMotoCash!",
        url: shareUrl,
      };

      try {
        // Tenta usar a API de compartilhamento nativa do dispositivo
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          // Fallback para navegadores que não suportam a API de compartilhamento
          await navigator.clipboard.writeText(shareUrl);
          showToast("Link do perfil copiado para a área de transferência!");
        }
      } catch (err) {
        console.error("Erro ao compartilhar:", err);
      }
    });
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
