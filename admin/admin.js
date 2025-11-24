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
let heatmap = null; // Variável global para o mapa

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
    loadDashboardData(); // Carrega os dados do dashboard
  } else {
    // Usuário está deslogado
    console.log("Nenhum admin logado.");
    loginScreen.style.display = "flex";
    dashboardScreen.style.display = "none";
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
 * Carrega e exibe todos os dados do dashboard.
 */
async function loadDashboardData() {
  // Mostra um estado de carregamento inicial
  document.getElementById("table-users-body").innerHTML =
    '<tr><td colspan="4" class="text-center p-8 text-gray-400">Carregando dados de uso...</td></tr>';

  try {
    const usersSnapshot = await db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .get();

    // Busca a contagem de registros para cada usuário
    const usersWithRecordCounts = await Promise.all(
      usersSnapshot.docs.map(async (doc) => {
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

    // --- Métricas Principais ---
    const totalUsers = usersWithRecordCounts.length;
    const onlineUsers = usersWithRecordCounts.filter(
      (u) => u.status?.isOnline
    ).length;

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
  } catch (error) {
    console.error("Erro ao carregar dados do dashboard:", error);
    alert(
      "Não foi possível carregar os dados. Verifique as regras de segurança do Firestore."
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
