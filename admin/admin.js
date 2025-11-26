// ======================================================
// ⚠️ SUAS CHAVES FIREBASE AQUI ⚠️
// ======================================================
const firebaseConfig = {
  apiKey: "AIzaSyDv_ZbrWZGmsdHSQ6oqfxNvJFKdPQRI8II",
  authDomain: "app-da-web-7d419.firebaseapp.com",
  projectId: "app-da-web-7d419",
  storageBucket: "app-da-web-7d419.firebasestorage.app",
  messagingSenderId: "398968396582",
  appId: "1:398968396582:web:a40503a0a03304e27b7fe7",
  measurementId: "G-GE1VWW7VY4",
};
// ======================================================

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const appId = "moto-manager-v1"; // O mesmo ID do seu app principal

const loginScreen = document.getElementById("login-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
let allUsersData = []; // Cache para todos os dados de usuários
let heatmap = null; // Variável global para o mapa
let unsubscribeDashboardListener = null; // Função para parar o listener do Firestore

// Expondo funções para o escopo global para serem chamadas pelo HTML
window.exportChartDataToCSV = exportChartDataToCSV;
window.exportAllUsersToCSV = exportAllUsersToCSV;
window.navigateToUserDetails = navigateToUserDetails; // Expondo a nova função

/**
 * Monitora o estado de autenticação do usuário.
 */
auth.onAuthStateChanged((user) => {
  if (user) {
    // Usuário está logado
    // TODO: Verificar se o usuário é um admin antes de mostrar o dashboard
    console.log("✅ Admin logado:", user.email);
    console.log("🔑 Seu UID de Admin é:", user.uid); // Esta linha mostrará seu ID
    loginScreen.style.display = "none";
    dashboardScreen.style.display = "block";
    lucide.createIcons(); // Renderiza os ícones
    initHeatmap(); // Inicializa o mapa de calor
    initNavigation(); // Inicializa a navegação da sidebar
    listenForDashboardUpdates(); // Inicia o listener para dados em tempo real
  } else {
    // Usuário está deslogado
    console.log("Nenhum admin logado.");
    loginScreen.style.display = "flex";
    dashboardScreen.style.display = "none";
    if (unsubscribeDashboardListener) unsubscribeDashboardListener(); // Para o listener ao deslogar
  }
});

/**
 * Lida com o submit do formulário de login.
 */
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("admin-email").value;
  const pass = document.getElementById("admin-password").value;
  loginError.textContent = "";

  auth.signInWithEmailAndPassword(email, pass).catch((error) => {
    console.error("Erro no login:", error.message);
    loginError.textContent = "Email ou senha inválidos.";
  });
});

/**
 * Lida com o logout.
 */
logoutBtn.addEventListener("click", () => {
  auth.signOut();
});

/**
 * Inicializa os eventos de clique para a navegação da sidebar.
 */
function initNavigation() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const viewId = e.currentTarget.id.replace("nav-", "view-");
      navigateTo(viewId);
    });
  });

  // Adiciona o listener para a busca de usuários
  document
    .getElementById("user-search-input")
    .addEventListener("keyup", (e) => {
      renderAllUsersTable(e.target.value.toLowerCase());
    });

  // Adiciona listener para o botão de voltar
  document
    .getElementById("back-to-users-btn")
    .addEventListener("click", () => navigateTo("view-users"));

  // Adiciona o listener para o botão de recarregar
  document.getElementById("refresh-data-btn").addEventListener("click", () => {
    const btnIcon = document.querySelector("#refresh-data-btn i");
    if (!btnIcon) return;
    btnIcon.classList.add("animate-spin");
    // A função processAndRenderData agora é chamada pelo listener, que vai recarregar tudo.
    // A animação será removida dentro da própria função.
  });
}

/**
 * Controla a visibilidade das "páginas" do dashboard.
 * @param {string} viewId - O ID da view a ser mostrada (ex: "view-dashboard").
 */
function navigateTo(viewId) {
  // Esconde todas as views
  document.querySelectorAll("main > div[id^='view-']").forEach((view) => {
    view.classList.add("hidden");
  });
  // Mostra a view correta
  document.getElementById(viewId).classList.remove("hidden");

  // Atualiza o estado ativo na sidebar
  document
    .querySelectorAll(".nav-link")
    .forEach((link) => link.classList.remove("bg-gray-700"));
  const navLink = document.getElementById(viewId.replace("view-", "nav-"));
  // Apenas tenta adicionar a classe se o link de navegação correspondente existir.
  if (navLink) {
    navLink.classList.add("bg-gray-700");
  }
}

/**
 * Navega para a tela de detalhes de um usuário específico.
 * @param {string} userId - O ID do usuário a ser detalhado.
 */
async function navigateToUserDetails(userId) {
  navigateTo("view-user-details");
  const contentDiv = document.getElementById("user-details-content");
  contentDiv.innerHTML = `<div class="text-center p-10"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div><p class="mt-4 text-gray-500">Carregando detalhes do usuário...</p></div>`;

  const user = allUsersData.find((u) => u.id === userId);
  if (!user) {
    contentDiv.innerHTML = `<p class="text-red-500 text-center">Usuário não encontrado.</p>`;
    return;
  }

  const totalEarnings = user.earnings.reduce((sum, e) => sum + e.totalValue, 0);
  const totalExpenses = user.expenses.reduce((sum, e) => sum + e.totalValue, 0);
  const balance = totalEarnings - totalExpenses;

  const allRecords = [
    ...user.earnings.map((e) => ({ ...e, type: "Ganho" })),
    ...user.expenses.map((e) => ({ ...e, type: "Despesa" })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  contentDiv.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow-md">
      <div class="flex items-center gap-4">
        <div class="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center"><i data-lucide="user" class="w-10 h-10 text-gray-500"></i></div>
        <div>
          <h2 class="text-2xl font-bold text-gray-800">${
            user.publicProfile?.name || "Nome não informado"
          }</h2>
          <p class="text-sm text-gray-500">${user.email || user.id}</p>
          <p class="text-xs text-gray-400 mt-1">ID: ${user.id}</p>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 border-t pt-4">
        <div class="text-center"><p class="text-sm text-gray-500">Ganhos Totais</p><p class="font-bold text-lg text-green-600">R$ ${totalEarnings.toFixed(
          2
        )}</p></div>
        <div class="text-center"><p class="text-sm text-gray-500">Despesas Totais</p><p class="font-bold text-lg text-red-600">R$ ${totalExpenses.toFixed(
          2
        )}</p></div>
        <div class="text-center"><p class="text-sm text-gray-500">Saldo Geral</p><p class="font-bold text-lg ${
          balance >= 0 ? "text-blue-600" : "text-orange-600"
        }">R$ ${balance.toFixed(2)}</p></div>
      </div>
    </div>

    <div class="mt-8 bg-white p-6 rounded-lg shadow-md">
      <h3 class="font-bold text-lg text-gray-800 mb-4">Histórico de Lançamentos (${
        allRecords.length
      })</h3>
      <div class="overflow-x-auto max-h-96">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="text-xs font-bold text-gray-500 border-b">
              <th class="p-2">Data</th>
              <th class="p-2">Tipo</th>
              <th class="p-2">Categoria/Observação</th>
              <th class="p-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${
              allRecords.length > 0
                ? allRecords
                    .map(
                      (r) => `
              <tr class="border-b hover:bg-gray-50">
                <td class="p-2">${new Date(
                  r.date + "T12:00:00"
                ).toLocaleDateString("pt-BR")}</td>
                <td class="p-2"><span class="px-2 py-1 text-xs rounded-full ${
                  r.type === "Ganho"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }">${r.type}</span></td>
                <td class="p-2">${r.category || r.observation || "-"}</td>
                <td class="p-2 text-right font-mono ${
                  r.type === "Ganho" ? "text-green-700" : "text-red-700"
                }">R$ ${r.totalValue.toFixed(2)}</td>
              </tr>`
                    )
                    .join("")
                : '<tr><td colspan="4" class="text-center p-8 text-gray-400">Nenhum lançamento encontrado.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
  lucide.createIcons();

  // Adiciona o listener para o botão de apagar
  updateUserActionSection(user);

  // Adiciona listener para abrir o modal de notificação
  document.getElementById("open-notification-modal-btn").onclick = () => {
    openNotificationModal(user);
  };
}

/**
 * Abre o modal para enviar uma notificação para um usuário.
 * @param {object} user - O objeto do usuário.
 */
function openNotificationModal(user) {
  document.getElementById("notification-user-name").textContent =
    user.publicProfile?.name || user.email;
  document.getElementById("notification-modal").classList.remove("hidden");
  lucide.createIcons(); // Garante que o ícone 'x' seja renderizado

  const form = document.getElementById("send-notification-form");
  const titleInput = document.getElementById("notification-title-input");
  const messageInput = document.getElementById("notification-message-input");

  // Limpa o formulário
  form.reset();

  const closeModal = () =>
    document.getElementById("notification-modal").classList.add("hidden");

  document.getElementById("close-notification-modal-btn").onclick = closeModal;
  document.getElementById("cancel-notification-btn").onclick = closeModal;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const title = titleInput.value || "Mensagem do Administrador";
    const message = messageInput.value;

    try {
      await sendNotificationToUser(
        user.id,
        title,
        message,
        user.email || user.id
      );
      alert("Notificação enviada com sucesso!");
      closeModal();
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      alert(`Erro ao enviar notificação: ${error.message}`);
    }
  };
}
/**
 * Suspende ou reativa a conta de um usuário.
 * @param {string} userId - O ID do usuário.
 * @param {string} newStatus - O novo status ('suspended' ou 'active').
 */

/**
 * Atualiza a seção de ação do usuário (suspender/reativar) na página de detalhes.
 * @param {object} user - O objeto do usuário.
 */
function updateUserActionSection(user) {
  const container = document.getElementById("user-action-container");
  if (!container) return;

  const isSuspended = user.accountStatus === "suspended";

  const title = isSuspended ? "Reativar Usuário" : "Suspender Usuário";
  const description = isSuspended
    ? "Reativar a conta permitirá que o usuário faça login e acesse o aplicativo novamente."
    : "Suspender a conta impedirá que o usuário faça login. Seus dados serão mantidos, mas o acesso será bloqueado.";
  const buttonText = isSuspended ? "Reativar Usuário" : "Suspender Usuário";
  const buttonClass = isSuspended
    ? "bg-green-600 text-white hover:bg-green-700"
    : "bg-yellow-500 text-black hover:bg-yellow-600";

  container.innerHTML = `
    <div>
        <h4 class="font-bold text-gray-800">${title}</h4>
        <p class="text-sm text-gray-600 mt-1">${description}</p>
    </div>
    <button id="user-action-btn" class="${buttonClass} font-bold px-6 py-2 rounded-lg transition-colors shrink-0">
        ${buttonText}
    </button>
  `;

  document.getElementById("user-action-btn").onclick = () =>
    updateUserStatus(user.id, isSuspended ? "active" : "suspended");
}

/**
 * Envia uma notificação para um usuário específico.
 * @param {string} userId - O ID do usuário.
 * @param {string} title - O título da notificação.
 * @param {string} message - A mensagem da notificação.
 * @param {string} userEmail - O email do usuário alvo.
 */
async function sendNotificationToUser(userId, title, message, userEmail) {
  if (!userId || !message) {
    throw new Error("ID do usuário e mensagem são obrigatórios.");
  }

  const notificationsRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(userId)
    .collection("notifications");

  return notificationsRef.add({
    title,
    message,
    read: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Registra uma ação do administrador no log de auditoria.
 * @param {string} action - O tipo de ação (ex: 'suspend_user').
 * @param {string} targetUserId - O ID do usuário afetado.
 * @param {string} targetUserEmail - O email do usuário afetado.
 * @param {object} [details={}] - Detalhes adicionais da ação.
 */
async function logAdminAction(
  action,
  targetUserId,
  targetUserEmail,
  details = {}
) {
  const adminUser = auth.currentUser;
  if (!adminUser) {
    console.error("Tentativa de log sem admin autenticado.");
    return;
  }

  const logEntry = {
    action,
    adminId: adminUser.uid,
    adminEmail: adminUser.email,
    targetUserId,
    targetUserEmail,
    details,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await db
      .collection("artifacts")
      .doc(appId)
      .collection("admin_logs")
      .add(logEntry);
  } catch (error) {
    console.error("Falha ao registrar ação do admin:", error);
    // Não notificar o usuário para não interromper o fluxo, apenas logar o erro.
  }
}

/**
 * Inicia o listener do Firestore para atualizações em tempo real dos usuários.
 */
function listenForDashboardUpdates() {
  // Se já houver um listener, cancela antes de criar um novo
  if (unsubscribeDashboardListener) unsubscribeDashboardListener();

  const usersQuery = db.collection("artifacts").doc(appId).collection("users");

  unsubscribeDashboardListener = usersQuery.onSnapshot(
    async (usersSnapshot) => {
      console.log("🔄 Dados do dashboard atualizados em tempo real!");
      const usersData = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      allUsersData = usersData; // Atualiza o cache global com os dados mais recentes

      // Processa e renderiza os dados
      await processAndRenderData(usersData);
    },
    (error) => {
      console.error("Erro no listener do dashboard:", error);
      alert("Erro ao receber atualizações em tempo real. Verifique o console.");
    }
  );

  // Inicia o listener para o log de atividades
  listenForAdminLogs();
}

async function processAndRenderData(usersData) {
  document.getElementById("table-users-body").innerHTML =
    '<tr><td colspan="4" class="text-center p-8 text-gray-400">Carregando dados de uso...</td></tr>';

  try {
    const usersSnapshot = await db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .get(); // Usamos get() aqui para a contagem de registros, que não é em tempo real

    const usersWithRecordCounts = await Promise.all(
      usersData.map(async (user) => {
        const doc = usersSnapshot.docs.find((d) => d.id === user.id);
        if (!doc) return user;

        const earningsPromise = doc.ref.collection("earnings").get();
        const expensesPromise = doc.ref.collection("expenses").get();

        const [earningsSnap, expensesSnap] = await Promise.all([
          earningsPromise,
          expensesPromise,
        ]);

        const totalRecords = earningsSnap.size + expensesSnap.size;

        return {
          id: doc.id,
          ...doc.data(),
          totalRecords: totalRecords,
          earnings: earningsSnap.docs.map((d) => d.data()),
          expenses: expensesSnap.docs.map((d) => d.data()),
        };
      })
    );

    allUsersData = usersWithRecordCounts; // Atualiza o cache global com os dados completos

    // --- Métricas Principais ---
    const totalUsers = usersWithRecordCounts.length;
    const onlineUsers = usersWithRecordCounts.filter(
      (u) => u.status?.isOnline
    ).length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyActiveUsers = usersWithRecordCounts.filter((user) => {
      return user.status?.lastSeen?.toDate() >= thirtyDaysAgo;
    }).length;

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const dailyActiveUsers = usersWithRecordCounts.filter((user) => {
      return user.status?.lastSeen?.toDate() >= oneDayAgo;
    }).length;

    const dauMauRatio =
      monthlyActiveUsers > 0
        ? (dailyActiveUsers / monthlyActiveUsers) * 100
        : 0;

    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalRecordsThisMonth = usersWithRecordCounts.reduce((acc, user) => {
      const userRecordsThisMonth = [...user.earnings, ...user.expenses].filter(
        (record) => {
          const recordDate = new Date(record.date + "T00:00:00");
          return recordDate >= startOfMonth;
        }
      ).length;
      return acc + userRecordsThisMonth;
    }, 0);

    const mostActiveUser = usersWithRecordCounts.sort(
      (a, b) => b.totalRecords - a.totalRecords
    )[0];

    document.getElementById("metric-total-users").textContent = totalUsers;
    document.getElementById("metric-online-users").textContent = onlineUsers;
    document.getElementById("metric-monthly-active-users").textContent =
      monthlyActiveUsers;

    document.getElementById(
      "metric-dau-mau-ratio"
    ).textContent = `${dauMauRatio.toFixed(1)}%`;

    document.getElementById("metric-total-records").textContent =
      totalRecordsThisMonth;
    document.getElementById("metric-most-active-user").textContent =
      mostActiveUser?.publicProfile?.name || mostActiveUser?.email || "N/A";

    // --- Tabela de Ranking de Atividade ---
    const usersTableBody = document.getElementById("table-users-body");
    usersTableBody.innerHTML = ""; // Limpa a tabela

    // Ordena por total de registros e pega os 10 mais ativos
    const topUsers = usersWithRecordCounts
      .sort((a, b) => b.totalRecords - a.totalRecords)
      .slice(0, 10);

    if (topUsers.length === 0) {
      usersTableBody.innerHTML =
        '<tr><td colspan="4" class="text-center p-8 text-gray-400">Nenhum usuário encontrado.</td></tr>';
    } else {
      topUsers.forEach((user) => {
        const row = `
        <tr class="text-sm text-gray-700 border-b">
            <td class="p-3">${user.publicProfile?.name || "Não informado"}</td>
            <td class="p-3">${user.email || user.id}</td>
            <td class="p-3 font-bold">${user.totalRecords}</td>
            <td class="p-3">
                <span class="px-2 py-1 text-xs font-bold rounded-full ${
                  user.status?.isOnline
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-600"
                }">
                    ${user.status?.isOnline ? "Online" : "Offline"}
                </span>
            </td>
        </tr>
      `;
        usersTableBody.innerHTML += row;
      });
    }

    // --- Renderiza os Gráficos ---
    renderNewUsersChart(usersWithRecordCounts);
    renderRecordsActivityChart(usersWithRecordCounts);
    renderUserHeatmap(usersWithRecordCounts);
    await renderLocationReports(usersWithRecordCounts); // Adicionado await para garantir que os dados de localização sejam processados
    renderCategoryDistributionChart(usersWithRecordCounts);
    renderAllUsersTable(); // Renderiza a tabela completa na view de usuários
  } catch (error) {
    console.error("Erro ao carregar dados do dashboard:", error);
    alert(
      "Não foi possível carregar os dados. Verifique as regras de segurança do Firestore."
    );
  } finally {
    // Garante que a animação do botão de refresh pare, mesmo se houver erro.
    const btnIcon = document.querySelector("#refresh-data-btn i");
    if (btnIcon) btnIcon.classList.remove("animate-spin");
  }
}

/**
 * Apaga um usuário e todos os seus dados do Firestore.
 * @param {string} userId - O ID do usuário a ser apagado.
 */
async function deleteUser(userId) {
  const user = allUsersData.find((u) => u.id === userId);
  const confirmation = prompt(
    `ATENÇÃO: Esta ação é IRREVERSÍVEL.\n\nVocê está prestes a apagar o usuário ${
      user.email || user.id
    } e todos os seus dados.\n\nPara confirmar, digite "APAGAR" no campo abaixo:`
  );

  if (confirmation !== "APAGAR") {
    alert("Ação cancelada.");
    return;
  }

  try {
    alert("Apagando usuário e dados... Aguarde a confirmação.");
    const userRef = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(userId);

    // Idealmente, usaríamos uma Cloud Function para apagar subcoleções de forma recursiva.
    // Como estamos no cliente, esta é uma simplificação.
    // Para um app em produção, a exclusão de subcoleções deve ser feita no backend.
    await userRef.delete();

    alert("Usuário apagado com sucesso!");
    navigateTo("view-users"); // Volta para a lista de usuários
    // O listener onSnapshot irá recarregar os dados automaticamente.
  } catch (error) {
    console.error("Erro ao apagar usuário:", error);
    alert(
      `Erro ao apagar usuário: ${error.message}. Verifique as regras de segurança do Firestore.`
    );
  }
}
/**
 * Renderiza o gráfico de novos usuários.
 * @param {Array} users - Lista de todos os usuários.
 */
function renderNewUsersChart(users) {
  const chartCanvas = document.getElementById("chart-new-users");
  if (window.myNewUsersChart) window.myNewUsersChart.destroy(); // Destroi gráfico antigo
  const ctx = document.getElementById("chart-new-users").getContext("2d");

  const labels = [];
  const data = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    labels.push(
      date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    );

    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const usersOnDay = users.filter((user) => {
      const userDate = user.createdAt?.toDate(); // Checagem de segurança
      return userDate >= startOfDay && userDate <= endOfDay;
    }).length;

    data.push(usersOnDay);
  }

  window.myNewUsersChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Novos Usuários",
          data: data,
          borderColor: "#FBBF24", // Amarelo
          backgroundColor: "rgba(251, 191, 36, 0.2)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1, // Garante que o eixo Y conte de 1 em 1
          },
        },
      },
    },
  });
}

/**
 * Busca dados de geolocalização e renderiza os relatórios de localização.
 * @param {Array} users - Lista de todos os usuários.
 */
async function renderLocationReports(users) {
  const usersWithLocation = users.filter(
    (user) => user.status?.location?.latitude
  );

  // Para evitar sobrecarregar a API, podemos fazer cache das localizações
  const cityCounts = {};

  // Processa as requisições sequencialmente para não sobrecarregar a API
  for (const user of usersWithLocation) {
    try {
      // API gratuita de reverse geocoding. Cuidado com limites de uso para apps grandes.
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${user.status.location.latitude}&lon=${user.status.location.longitude}`,
        {
          headers: {
            "User-Agent": "AppMotoCashAdmin/1.0", // Política da Nominatim exige um User-Agent
          },
        }
      );
      if (!response.ok) continue; // Pula para o próximo se a resposta não for OK

      const data = await response.json();
      const city = data.address?.city || data.address?.town || "Desconhecida";

      if (city !== "Desconhecida") {
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
    } catch (error) {
      console.warn("Erro no reverse geocoding:", error);
    }
  }

  // Ordena as cidades por contagem de usuários e pega o top 5
  const sortedCities = Object.entries(cityCounts).sort(([, a], [, b]) => b - a);
  const top5Cities = sortedCities.slice(0, 5);

  renderUsersByCityChart(top5Cities);
}

/**
 * Renderiza o gráfico de barras de usuários por cidade.
 * @param {Array} cityData - Array com os dados das cidades [["Cidade", contagem], ...].
 */
function renderUsersByCityChart(cityData) {
  const chartCanvas = document.getElementById("chart-users-by-city");
  if (!chartCanvas) return;
  if (window.myCityChart) window.myCityChart.destroy();

  const ctx = chartCanvas.getContext("2d");
  const labels = cityData.map((item) => item[0]);
  const data = cityData.map((item) => item[1]);

  window.myCityChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Nº de Usuários",
          data: data,
          backgroundColor: "rgba(168, 85, 247, 0.7)", // Roxo
          borderColor: "rgba(168, 85, 247, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y", // Transforma em gráfico de barras horizontais
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
      },
    },
  });
}

/**
 * Exporta os dados de um gráfico para um arquivo CSV.
 * @param {string} chartId - O ID do elemento canvas do gráfico.
 * @param {string} filename - O nome do arquivo CSV a ser gerado.
 */
function exportChartDataToCSV(chartId, filename) {
  const chartInstance = Chart.getChart(chartId);
  if (!chartInstance) {
    alert("Gráfico não encontrado ou ainda não renderizado.");
    return;
  }

  const labels = chartInstance.data.labels;
  const data = chartInstance.data.datasets[0].data;

  let csvContent = "data:text/csv;charset=utf-8,Categoria,Valor\n";
  labels.forEach((label, index) => {
    csvContent += `${label},${data[index]}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporta a lista completa de usuários para um arquivo CSV.
 */
function exportAllUsersToCSV() {
  if (allUsersData.length === 0) {
    alert("Não há dados de usuários para exportar.");
    return;
  }

  let csvContent =
    "data:text/csv;charset=utf-8,Nome,Email,DataCadastro,TotalRegistros,Status\n";
  allUsersData.forEach((user) => {
    const name = `"${user.publicProfile?.name || "N/A"}"`;
    const email = user.email || "N/A";
    const joinDate = user.createdAt
      ? new Date(user.createdAt.seconds * 1000).toLocaleDateString("pt-BR")
      : "N/A";
    const records = user.totalRecords;
    const status = user.status?.isOnline ? "Online" : "Offline";
    csvContent += `${name},${email},${joinDate},${records},${status}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "lista_completa_usuarios.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Renderiza o gráfico de pizza com a distribuição de registros por categoria.
 * @param {Array} users - Lista de todos os usuários com seus registros.
 */
function renderCategoryDistributionChart(users) {
  const chartCanvas = document.getElementById("chart-category-distribution");
  if (!chartCanvas) return;
  if (window.myCategoryChart) window.myCategoryChart.destroy(); // Destroi gráfico antigo

  const ctx = chartCanvas.getContext("2d");

  const categoryCounts = {
    "iFood/Entregas": 0,
    "Uber/99": 0,
    "Loja Fixa": 0,
    Despesas: 0,
  };

  users.forEach((user) => {
    user.earnings.forEach((earning) => {
      if (earning.category === "app_entrega")
        categoryCounts["iFood/Entregas"]++;
      if (earning.category === "app_passageiro") categoryCounts["Uber/99"]++;
      if (earning.category === "loja_fixa") categoryCounts["Loja Fixa"]++;
    });
    categoryCounts["Despesas"] += user.expenses.length;
  });

  window.myCategoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(categoryCounts),
      datasets: [
        {
          label: "Distribuição de Registros",
          data: Object.values(categoryCounts),
          backgroundColor: [
            "rgba(251, 191, 36, 0.8)", // Amarelo (iFood)
            "rgba(59, 130, 246, 0.8)", // Azul (Uber)
            "rgba(239, 68, 68, 0.8)", // Vermelho (Loja)
            "rgba(107, 114, 128, 0.7)", // Cinza (Despesas)
          ],
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: document.documentElement.classList.contains("dark")
              ? "#d1d5db"
              : "#374151",
          },
        },
      },
    },
  });
}

/**
 * Renderiza a tabela completa de usuários com filtro de busca.
 * @param {string} searchTerm - Termo para filtrar usuários por nome ou email.
 */
function renderAllUsersTable(searchTerm = "") {
  const tableBody = document.getElementById("all-users-table-body");
  if (!tableBody) return;

  const filteredUsers = allUsersData.filter(
    (user) =>
      (user.publicProfile?.name?.toLowerCase() || "").includes(searchTerm) ||
      (user.email?.toLowerCase() || "").includes(searchTerm)
  );

  document.getElementById("user-count-display").textContent =
    filteredUsers.length;

  if (filteredUsers.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-400">Nenhum usuário encontrado.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filteredUsers
    .map(
      (user) => `
        <tr class="text-sm text-gray-700 border-b hover:bg-gray-50 cursor-pointer" onclick="navigateToUserDetails('${
          user.id
        }')">
            <td class="p-3">${user.publicProfile?.name || "Não informado"}</td>
            <td class="p-3">${user.email || user.id}</td>
            <td class="p-3">${
              user.createdAt
                ? new Date(user.createdAt.seconds * 1000).toLocaleDateString()
                : "N/A"
            }</td>
            <td class="p-3">${
              user.status?.lastSeen
                ? new Date(user.status.lastSeen.seconds * 1000).toLocaleString(
                    "pt-BR"
                  )
                : "Nunca"
            }</td>
            <td class="p-3 font-bold text-center">${user.totalRecords}</td>
            <td class="p-3">
              ${
                user.accountStatus === "suspended"
                  ? `<span class="px-2 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800">Suspenso</span>`
                  : `<span class="px-2 py-1 text-xs font-bold rounded-full ${
                      user.status?.isOnline
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-600"
                    }">
                    ${user.status?.isOnline ? "Online" : "Offline"}
                </span>`
              }
            </td>
        </tr>
    `
    )
    .join("");
}

/**
 * Inicializa o mapa Leaflet para o heatmap.
 */
function initHeatmap() {
  if (heatmap) return; // Não inicializa se já existir
  heatmap = L.map("heatmap-container").setView([-14.235, -51.925], 4); // Centro do Brasil

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(heatmap);
}

/**
 * Renderiza o mapa de calor com a localização dos usuários.
 * @param {Array} users - Lista de todos os usuários.
 */
function renderUserHeatmap(users) {
  if (!heatmap) return;

  // Extrai os pontos de localização dos usuários que têm essa informação
  const heatPoints = users
    .filter(
      (user) =>
        user.status?.location?.latitude && user.status?.location?.longitude
    )
    .map((user) => {
      // O formato é [latitude, longitude, intensidade]
      return [user.status.location.latitude, user.status.location.longitude, 1];
    });

  // Limpa a camada de calor antiga, se houver
  heatmap.eachLayer((layer) => {
    if (layer instanceof L.HeatLayer) {
      heatmap.removeLayer(layer);
    }
  });

  if (heatPoints.length > 0) {
    // Adiciona a nova camada de calor ao mapa
    L.heatLayer(heatPoints, { radius: 25, blur: 15, maxZoom: 12 }).addTo(
      heatmap
    );
  }
}

/**
 * Renderiza o gráfico de atividade de registros.
 * @param {Array} users - Lista de todos os usuários com seus registros.
 */
function renderRecordsActivityChart(users) {
  const chartCanvas = document.getElementById("chart-records-activity");
  if (window.myRecordsChart) window.myRecordsChart.destroy(); // Destroi gráfico antigo
  const ctx = chartCanvas.getContext("2d");

  const labels = [];
  const data = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    labels.push(
      date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    );

    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    let recordsOnDay = 0;
    users.forEach((user) => {
      const userRecordsOnDay = [...user.earnings, ...user.expenses].filter(
        (record) => {
          const recordDate = new Date(record.date + "T00:00:00");
          return recordDate >= startOfDay && recordDate <= endOfDay;
        }
      ).length;
      recordsOnDay += userRecordsOnDay;
    });

    data.push(recordsOnDay);
  }

  window.myRecordsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Registros Criados",
          data: data,
          backgroundColor: "rgba(59, 130, 246, 0.7)", // Azul
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
      },
    },
  });
}
