import { db, appId } from "../config.js";
import { currentUser } from "../auth.js";
import { router } from "../router.js";
import * as API from "../api.js";
import { toggleTheme, openPublicProfileEditor } from "../ui.js";

export async function renderProfile(c) {
  c.innerHTML = await fetch("src/templates/views/profile.html").then((res) =>
    res.text()
  );

  // **CORREÇÃO**: Todo o código que manipula os elementos do perfil
  // foi movido para DEPOIS do carregamento do HTML.

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
    .getElementById("achievements-btn")
    .addEventListener("click", () => router("achievements"));
  document
    .getElementById("market-btn")
    .addEventListener("click", () => router("market"));
  document
    .getElementById("accepted-jobs-btn")
    .addEventListener("click", () => router("accepted-jobs"));
  document
    .getElementById("history-jobs-btn")
    .addEventListener("click", () => router("history-jobs"));
  document
    .getElementById("backup-btn")
    .addEventListener("click", API.backupData);
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

  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .onSnapshot((doc) => {
      // O listener agora só precisa se preocupar em atualizar os dados,
      // pois a configuração inicial já foi feita.
      updateProfileStats(doc);
    });

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

  // Atualiza estatísticas
  statsRatingEl.textContent = profile.rating
    ? `${profile.rating.toFixed(1)} ★`
    : "N/A";

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
