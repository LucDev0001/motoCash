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
  try {
    const usersSnapshot = await db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .get();

    const users = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // --- Métricas Principais ---
    const totalUsers = users.length;
    const onlineUsers = users.filter((u) => u.status?.isOnline).length;

    document.getElementById("metric-total-users").textContent = totalUsers;
    document.getElementById("metric-online-users").textContent = onlineUsers;

    // --- Tabela de Usuários ---
    const usersTableBody = document.getElementById("table-users-body");
    usersTableBody.innerHTML = ""; // Limpa a tabela
    const recentUsers = users
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
      .slice(0, 5); // Pega os 5 mais recentes

    recentUsers.forEach((user) => {
      const row = `
        <tr class="text-sm text-gray-700 border-b">
            <td class="p-3">${user.publicProfile?.name || "Não informado"}</td>
            <td class="p-3">${user.email || user.id}</td>
            <td class="p-3">${new Date(
              user.createdAt.seconds * 1000
            ).toLocaleDateString()}</td>
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

    // --- Gráfico de Novos Usuários (Exemplo) ---
    renderNewUsersChart(users);

    // TODO: Implementar lógicas para Ganhos e Despesas
    document.getElementById("metric-total-earnings").textContent = "R$ 0,00";
    document.getElementById("metric-total-expenses").textContent = "R$ 0,00";
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
      const userDate = user.createdAt.toDate();
      return userDate >= startOfDay && userDate <= endOfDay;
    }).length;

    data.push(usersOnDay);
  }

  new Chart(ctx, {
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

// TODO: Implementar a função para renderizar o gráfico de ganhos por categoria.
// function renderEarningsChart(transactions) { ... }
