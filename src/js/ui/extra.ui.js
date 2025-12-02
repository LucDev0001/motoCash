import { db, appId } from "../config.js";
import { currentUser } from "../auth.js";
import { getAchievements } from "../api.js";
import { unsubscribeListeners, openProfileModal } from "../ui.js";
import { router } from "../router.js";
import * as API from "../api.js";

/**
 * Renderiza a lista de vagas disponíveis no Hub.
 * @param {Array} jobs - A lista de vagas disponíveis.
 */
export function renderJobsList(jobs) {
  const container = document.getElementById("jobs-list-container");
  if (!container) return;

  if (jobs.length === 0) {
    container.innerHTML = `<p class="text-center text-gray-400 py-8">Nenhuma vaga disponível no momento.</p>`;
    return;
  }

  container.innerHTML = jobs
    .map((job) => {
      // Tenta extrair o endereço da empresa de forma mais completa
      const address = job.location?.fullAddress || "Endereço não informado";
      const payment = job.payment || "A combinar";
      const schedule = job.schedule || "Horário a combinar";

      return `
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border-l-4 border-yellow-500">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-bold text-lg dark:text-gray-200">${job.title}</h3>
            <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">${job.empresaName}</p>
          </div>
          <span class="text-lg font-bold text-green-500 shrink-0 ml-2">${payment}</span>
        </div>
        <div class="mt-3 border-t dark:border-gray-700 pt-3 space-y-2 text-sm text-gray-500 dark:text-gray-400">
          <div class="flex items-center gap-2">
            <i data-lucide="map-pin" class="w-4 h-4 shrink-0"></i>
            <span>${address}</span>
          </div>
          <div class="flex items-center gap-2">
            <i data-lucide="clock" class="w-4 h-4 shrink-0"></i>
            <span>${schedule}</span>
          </div>
        </div>
        <div class="mt-4 flex justify-end">
          <button onclick="window.acceptJob('${job.id}')" class="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg text-sm hover:bg-blue-500 transition-colors">
            Aceitar Vaga
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  lucide.createIcons();
}

// --- NOTIFICATIONS PAGE UI ---
export async function renderNotifications(c) {
  c.innerHTML = await fetch("src/templates/views/notifications.html").then(
    (res) => res.text()
  );

  const notificationsRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .collection("notifications")
    .orderBy("createdAt", "desc")
    .limit(50);

  const unsub = notificationsRef.onSnapshot((snapshot) => {
    const listEl = document.getElementById("notifications-list");
    if (!listEl) return;

    if (snapshot.empty) {
      listEl.innerHTML = `<p class="text-center text-gray-400 py-10">Nenhuma notificação encontrada.</p>`;
      return;
    }

    const batch = db.batch();
    let hasUnread = false;

    listEl.innerHTML = snapshot.docs
      .map((doc) => {
        const notification = doc.data();
        const isUnread = !notification.read;
        if (isUnread) {
          hasUnread = true;
          batch.update(doc.ref, { read: true });
        }

        const date = notification.createdAt
          ? new Date(notification.createdAt.seconds * 1000).toLocaleString(
              "pt-BR"
            )
          : "";

        return `
        <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border-l-4 ${
          isUnread
            ? "border-yellow-500"
            : "border-transparent dark:border-gray-700"
        }">
          <h4 class="font-bold text-gray-800 dark:text-gray-100">${
            notification.title
          }</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${
            notification.message
          }</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 text-right mt-3">${date}</p>
        </div>
      `;
      })
      .join("");

    if (hasUnread) {
      batch
        .commit()
        .catch((err) =>
          console.error("Erro ao marcar notificações como lidas:", err)
        );
    }
  });

  unsubscribeListeners.push(unsub);
}

// --- ACHIEVEMENTS UI ---
export async function renderAchievements(c) {
  c.innerHTML = await fetch("src/templates/views/achievements.html").then(
    (res) => res.text()
  );
  const unsub = getAchievements(updateAchievementsUI);
  unsubscribeListeners.push(unsub);
}

function updateAchievementsUI({ unlocked, allAchievements }) {
  const listEl = document.getElementById("achievements-list");
  if (!listEl) return;

  listEl.innerHTML = allAchievements
    .map((ach) => {
      const isUnlocked = unlocked.includes(ach.id);
      return `
        <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm text-center ${
          !isUnlocked ? "opacity-40" : ""
        }">
            <div class="w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
              isUnlocked
                ? "bg-yellow-100 dark:bg-yellow-900/50"
                : "bg-gray-100 dark:bg-gray-700"
            }">
                <i data-lucide="${ach.icon}" class="w-8 h-8 ${
        isUnlocked ? "text-yellow-500" : "text-gray-400 dark:text-gray-500"
      }"></i>
            </div>
            <h4 class="text-sm font-bold mt-2 dark:text-gray-200">${
              ach.title
            }</h4>
            <p class="text-xs text-gray-500 dark:text-gray-400">${
              ach.description
            }</p>
        </div>
        `;
    })
    .join("");
  lucide.createIcons();
}

// --- HISTÓRICO DE VAGAS UI (NOVO) ---
export async function renderHistoryJobs(c) {
  c.innerHTML = await fetch("src/templates/views/history-jobs.html").then(
    (res) => res.text()
  );

  const unsub = db
    .collection("jobs")
    .where("motoboyId", "==", currentUser.uid)
    .where("status", "in", ["concluida", "cancelada"])
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const listEl = document.getElementById("history-jobs-list");
      if (!listEl) return;

      if (jobs.length === 0) {
        listEl.innerHTML = `<p class="text-center text-gray-400 py-8">Seu histórico de vagas está vazio.</p>`;
        return;
      }

      listEl.innerHTML = jobs
        .map((job) => {
          const isConcluded = job.status === "concluida";
          return `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
              <div class="flex justify-between items-center">
                <h3 class="font-bold dark:text-gray-200">${job.title}</h3>
                <span class="text-xs font-bold px-2 py-1 rounded-full ${
                  isConcluded
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }">${job.status}</span>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400">Empresa: <span class="font-semibold">${
                job.empresaName
              }</span></p>
              <p class="text-xs text-gray-400 mt-1">Finalizada em: ${new Date(
                job.createdAt.seconds * 1000
              ).toLocaleDateString("pt-BR")}</p>
            </div>
          `;
        })
        .join("");
    });
  unsubscribeListeners.push(unsub);
}

// --- VAGAS ACEITAS UI ---
export async function renderAcceptedJobs(c) {
  c.innerHTML = await fetch("src/templates/views/accepted-jobs.html").then(
    (res) => res.text()
  );

  const unsub = db
    .collection("jobs")
    .where("motoboyId", "==", currentUser.uid)
    .where("status", "==", "negociando")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const listEl = document.getElementById("accepted-jobs-list");
      if (!listEl) return;

      if (jobs.length === 0) {
        // Se a lista de negociações está vazia, verifica se a última vaga aberta foi concluída
        if (window.currentJobId) {
          const lastJobRef = db.collection("jobs").doc(window.currentJobId);
          lastJobRef.get().then((jobDoc) => {
            if (jobDoc.exists && jobDoc.data().status === "concluida") {
              // Mostra a tela de conclusão para o motoboy
              showJobConcludedScreen(
                window.currentJobId,
                jobDoc.data().empresaName
              );
            }
            // Limpa o ID da vaga atual para não re-checar desnecessariamente
            window.currentJobId = null;
          });
        }

        // Se não houver vagas, exibe a mensagem padrão
        listEl.innerHTML = `<p class="text-center text-gray-400 py-8">Você não tem nenhuma vaga em negociação.</p>`;
        return;
      }

      listEl.innerHTML = jobs
        .map(
          (job) => `
        <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 class="font-bold text-lg dark:text-gray-200">${job.title}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">Publicado por: <span class="font-semibold">${job.empresaName}</span></p>
          <div class="mt-3 flex justify-end">
            <button data-job-id="${job.id}" class="open-chat-btn bg-blue-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
              <i data-lucide="message-square"></i> Abrir Negociação
            </button>
          </div>
        </div>
      `
        )
        .join("");

      document.querySelectorAll(".open-chat-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.currentJobId = btn.dataset.jobId;
          router("job-chat");
        });
      });
      lucide.createIcons();
    });
  unsubscribeListeners.push(unsub);
}

/**
 * Mostra uma tela de "Vaga Concluída" para o motoboy com opção de avaliar.
 * @param {string} jobId - O ID da vaga concluída.
 * @param {string} empresaName - O nome da empresa.
 */
function showJobConcludedScreen(jobId, empresaName) {
  const contentArea = document.getElementById("content-area");
  contentArea.innerHTML = `
        <div class="fade-in h-full flex flex-col items-center justify-center text-center p-4">
            <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md">
                <i data-lucide="party-popper" class="w-16 h-16 text-green-500 mx-auto mb-4"></i>
                <h2 class="text-2xl font-bold">Vaga Concluída!</h2>
                <p class="text-gray-500 dark:text-gray-400 mt-4">
                    A empresa <strong class="text-yellow-500">${empresaName}</strong> marcou esta vaga como concluída.
                </p>
                <p class="text-gray-500 dark:text-gray-400 mt-2">
                    O que você achou da experiência? Sua avaliação é importante!
                </p>
                <div class="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                    <button id="rate-company-btn" class="bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg">Avaliar Empresa</button>
                    <button id="back-to-hub-btn" class="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-3 px-6 rounded-lg">Voltar ao Início</button>
                </div>
            </div>
        </div>
    `;
  lucide.createIcons();
  document.getElementById("back-to-hub-btn").onclick = () =>
    router("dashboard");
  document.getElementById("rate-company-btn").onclick = () => {
    // Precisamos do ID da empresa, que está no documento da vaga.
    db.collection("jobs")
      .doc(jobId)
      .get()
      .then((jobDoc) => {
        if (jobDoc.exists)
          API.openCompanyRatingModal(
            jobId,
            jobDoc.data().empresaId,
            empresaName
          );
      });
  };
}

// --- CHAT DA VAGA UI ---
export async function renderJobChat(c) {
  const jobId = window.currentJobId;
  if (!jobId) {
    c.innerHTML = `<p class="text-center text-red-500">Erro: Nenhuma vaga selecionada.</p>`;
    return;
  }

  c.innerHTML = await fetch("src/templates/views/job-chat.html").then((res) =>
    res.text()
  );

  const chatHeaderEl = document.getElementById("chat-header-details-motoboy");
  const messagesContainer = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const notificationAudio = new Audio("./assets/notification.mp3");

  // Marca as mensagens como lidas pelo motoboy ao abrir o chat
  db.collection("jobs")
    .doc(jobId)
    .set({ readBy: { [currentUser.uid]: true } }, { merge: true });

  const jobRef = db.collection("jobs").doc(jobId);
  const unsubJob = jobRef.onSnapshot(async (jobSnap) => {
    if (!jobSnap.exists) return;
    const jobData = jobSnap.data();

    chatHeaderEl.innerHTML = `
      <h3 class="font-bold">${jobData.title}</h3>
      <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3">
        <span><i data-lucide="building-2" class="w-3 h-3 inline-block mr-1"></i>${
          jobData.empresaName
        }</span>
        <span><i data-lucide="dollar-sign" class="w-3 h-3 inline-block mr-1"></i>${
          jobData.payment
        }</span>
        <span><i data-lucide="clock" class="w-3 h-3 inline-block mr-1"></i>${
          jobData.schedule || "A combinar"
        }</span>
      </div>
    `;

    // Lógica dos botões de segurança
    document.getElementById("view-company-profile-btn").onclick = () => {
      // Busca os dados da empresa para exibir no modal
      db.collection("companies")
        .doc(jobData.empresaId)
        .get()
        .then((companySnap) => {
          if (companySnap.exists) {
            openProfileModal(companySnap.data(), "company");
          }
        });
    };
    document.getElementById("report-company-btn").onclick = () =>
      alert(`Função "Denunciar ${jobData.empresaName}" a ser implementada.`);
    document.getElementById("block-company-btn").onclick = () =>
      alert(`Função "Bloquear ${jobData.empresaName}" a ser implementada.`);
    lucide.createIcons();
  });

  // 2. Ouve por novas mensagens
  const messagesRef = jobRef.collection("messages");
  const q = messagesRef.orderBy("createdAt", "asc");

  const unsubMessages = q.onSnapshot(async (snapshot) => {
    // Precisamos dos dados da vaga para verificar o status de leitura
    const jobSnap = await jobRef.get();
    const jobData = jobSnap.exists ? jobSnap.data() : {};

    snapshot.docChanges().forEach((change) => {
      if (
        change.type === "added" &&
        change.doc.data().senderId !== currentUser.uid
      ) {
        notificationAudio
          .play()
          .catch((e) => console.warn("Audio play failed", e));
      }
    });

    messagesContainer.innerHTML = snapshot.docs
      .map((doc) => {
        const msg = doc.data();
        const isMe = msg.senderId === currentUser.uid;

        const timestamp = msg.createdAt
          ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";

        const isRead = jobData.readBy && jobData.readBy[jobData.empresaId];
        const readIcon = isRead ? "check-check" : "check";

        return `
          <div class="flex ${isMe ? "justify-end" : "justify-start"}">
            <div class="max-w-[75%] p-2 px-3 rounded-xl ${
              isMe ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-700"
            }">
              <p class="text-sm">${msg.text}</p>
              <div class="text-xs ${
                isMe ? "text-gray-800/70" : "text-gray-400"
              } text-right mt-1 flex items-center justify-end gap-1">
                <span>${timestamp}</span>
                ${
                  isMe
                    ? `<i data-lucide="${readIcon}" class="w-4 h-4 ${
                        isRead ? "text-blue-600" : ""
                      }"></i>`
                    : ""
                }
              </div>
            </div>
          </div>
        `;
      })
      .join("");
    lucide.createIcons(); // Renderiza os ícones de check
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  chatForm.onsubmit = async (e) => {
    e.preventDefault();
    // Envia a mensagem
    await API.sendChatMessage(e, jobId, currentUser.displayName);

    // Reseta o status de "lido" da empresa para que ela seja notificada
    const jobData = (await jobRef.get()).data();
    if (jobData && jobData.empresaId) {
      await jobRef.set(
        { readBy: { [jobData.empresaId]: false } },
        { merge: true }
      );
    }
  };

  unsubscribeListeners.push(unsubJob, unsubMessages);
}
