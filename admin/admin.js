import { initAds, renderAds } from './ads.js';

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
initAds(db); // Injeta a instância do DB no módulo de anúncios
const appId = "moto-manager-v1"; // O mesmo ID do seu app principal

const loginScreen = document.getElementById("login-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
let allUsersData = []; // Cache para todos os dados de usuários
let allCompaniesData = []; // Cache para todos os dados de empresas
let heatmap = null; // Variável global para o mapa
let unsubscribeDashboardListener = null; // Função para parar o listener do Firestore
let unsubscribeCompaniesListener = null; // Função para parar o listener de empresas
let currentEditingUserId = null; // Variável global para o ID do usuário atualmente em edição/visualização
let unsubscribePendingCompaniesListener = null; // Listener para aprovações

let currentDisplayedUserDetailsId = null; // ID do usuário atualmente exibido nos detalhes

// Expondo funções para o escopo global para serem chamadas pelo HTML
window.exportChartDataToCSV = exportChartDataToCSV;
window.exportAllUsersToCSV = exportAllUsersToCSV;
window.navigateToUserDetails = navigateToUserDetails; // Expondo a nova função
window.openUserFormModal = openUserFormModal; // Expondo a nova função
window.approveCompany = approveCompany; // Expondo a função de aprovar
window.reproveCompany = reproveCompany; // Expondo a função de reprovar
window.copyToClipboard = copyToClipboard; // Expondo a função de copiar
window.deleteUser = deleteUser; // Expondo a função de apagar.
window.editKbEntry = editKbEntry; // **NOVO**
window.deleteKbEntry = deleteKbEntry; // **NOVO**

window.renderConversationDetails = renderConversationDetails;

/**
 * Monitora o estado de autenticação do usuário.
 */
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // **CORREÇÃO DE SEGURANÇA: Verifica se o usuário é um admin**
    try {
      const settingsRef = db
        .collection("artifacts")
        .doc(appId)
        .collection("config")
        .doc("app_settings");
      const docSnap = await settingsRef.get();

      if (docSnap.exists) {
        const adminUids = docSnap.data().adminUids || [];
        if (adminUids.includes(user.uid)) {
          // Usuário é um admin, concede acesso.
          console.log("✅ Admin verificado:", user.email);
          loginScreen.style.display = "none";
          dashboardScreen.style.display = "block";
          lucide.createIcons();
          initNavigation();
          listenForDashboardUpdates();
        } else {
          // Usuário não é admin, nega o acesso.
          throw new Error("Acesso negado. Permissões insuficientes.");
        }
      } else {
        // **CORREÇÃO DE EMERGÊNCIA**: Se o documento de config não existe,
        // verifica se o usuário é o admin "mestre" e cria o documento.
        const masterAdminUid = "SzH8GsUtuNPJCRvkMkBclnStVr73"; // UID de Luciano
        if (user.uid === masterAdminUid) {
          console.warn(
            "Documento de configurações não encontrado. Criando um novo com o admin mestre."
          );
          await settingsRef.set({ adminUids: [masterAdminUid] });
          // Recarrega a página para que o próximo login funcione com o doc recém-criado.
          alert(
            "Configuração inicial de admin criada. A página será recarregada. Por favor, faça login novamente."
          );
          window.location.reload();
        } else {
          throw new Error("Configurações de admin não encontradas.");
        }
      }
    } catch (error) {
      console.error("Falha na verificação de admin:", error.message);
      loginError.textContent = "Acesso Negado.";
      auth.signOut(); // Desloga o usuário não autorizado.
    }
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

  // **NOVO**: Lógica para a sidebar responsiva
  const sidebar = document.getElementById("sidebar");
  const openSidebarBtn = document.getElementById("open-sidebar-btn");
  const closeSidebarBtn = document.getElementById("close-sidebar-btn");

  openSidebarBtn.addEventListener("click", () => {
    sidebar.classList.remove("-translate-x-full");
  });

  closeSidebarBtn.addEventListener("click", () => {
    sidebar.classList.add("-translate-x-full");
  });

  // Fecha a sidebar ao clicar em um link no modo mobile
  document.querySelectorAll("#sidebar a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 1024) {
        // lg breakpoint
        sidebar.classList.add("-translate-x-full");
      }
    });
  });

  document.getElementById("nav-approvals").addEventListener("click", (e) => {
    navigateTo("view-approvals");
  });

  // Adiciona listener para a nova tela de Configurações
  document.getElementById("nav-settings").addEventListener("click", (e) => {
    navigateTo("view-settings");
  });

  // Adiciona listener para a nova tela de Anúncios
  document.getElementById("nav-ads").addEventListener("click", (e) => {
    navigateTo("view-ads");
  });

  // **NOVO**: Adiciona listener para a tela da Assistente Graxa
  document.getElementById("nav-graxa-kb").addEventListener("click", (e) => {
    navigateTo("view-graxa-kb");
  });

  document
    .getElementById("nav-graxa-generator")
    .addEventListener("click", (e) => {
      navigateTo("view-graxa-generator");
    });
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
  document
    .getElementById("refresh-dashboard-btn")
    .addEventListener("click", () => {
      const btnIcon = document.querySelector("#refresh-dashboard-btn i");
      if (!btnIcon) return;
      btnIcon.classList.add("animate-spin");
      // A função processAndRenderData agora é chamada pelo listener, que vai recarregar tudo.
      // A animação será removida dentro da própria função.
    });

  // Event listeners para os botões de editar e apagar na view de detalhes do usuário
  document
    .getElementById("edit-user-details-btn")
    .addEventListener("click", () => {
      if (currentDisplayedUserDetailsId) {
        openUserFormModal(currentDisplayedUserDetailsId);
      } else {
        alert("Nenhum usuário selecionado para edição.");
      }
    });

  document
    .getElementById("delete-user-details-btn")
    .addEventListener("click", () => {
      if (currentDisplayedUserDetailsId) {
        deleteUser(currentDisplayedUserDetailsId);
      } else {
        alert("Nenhum usuário selecionado para apagar.");
      }
    });

  // Adiciona listener apenas se o botão existir
  const dossierBtn = document.getElementById("generate-dossier-btn");
  if (dossierBtn) {
    dossierBtn.addEventListener("click", () => {
      if (currentDisplayedUserDetailsId) {
        generateDossier(currentDisplayedUserDetailsId);
      } else {
        alert("Nenhum usuário selecionado para gerar dossiê.");
      }
    });
  }

  // Adiciona o listener para o botão de criar usuário
  document.getElementById("create-user-btn").onclick = () =>
    openUserFormModal(null, "motoboy");

  // Adiciona listener para o botão de broadcast
  document.getElementById("broadcast-notification-btn").onclick = () =>
    openBroadcastModal();

  // Adiciona o listener para o botão de criar empresa
  document.getElementById("create-company-btn").onclick = () =>
    openUserFormModal(null, "company");
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
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("bg-gray-700", "text-white");
    link.classList.add(
      "text-gray-300",
      "hover:bg-gray-700",
      "hover:text-white"
    );
  });
  const navLink = document.getElementById(viewId.replace("view-", "nav-"));
  // Apenas tenta adicionar a classe se o link de navegação correspondente existir.
  if (navLink) {
    navLink.classList.add("bg-gray-900", "text-white");
    navLink.classList.remove("text-gray-300", "hover:bg-gray-700");
  }

  // **NOVO**: Atualiza o título no header
  const pageTitleEl = document.getElementById("page-title");
  let titleText = "Dashboard"; // Padrão
  if (navLink && navLink.querySelector("span")) {
    titleText = navLink.querySelector("span").textContent;
  }
  // Casos especiais
  if (viewId === "view-user-details") {
    titleText = "Detalhes do Usuário";
  }

  pageTitleEl.textContent = titleText;

  // **NOVO**: Controla a visibilidade dos contadores
  const userCounter = document.getElementById("user-count-display");
  const companyCounter = document.getElementById("company-count-display");
  if (userCounter)
    userCounter.classList.toggle("hidden", viewId !== "view-users");
  if (companyCounter)
    companyCounter.classList.toggle("hidden", viewId !== "view-companies");

  // --- Funções específicas de inicialização para cada view ---
  if (viewId === "view-companies") {
    listenForCompaniesUpdates();
  }
  // **CORREÇÃO**: Chama a função para carregar a lista de usuários ao entrar na view.
  if (viewId === "view-users") {
    // A função loadAndRenderAllUsers já existe e faz o trabalho pesado.
    loadAndRenderAllUsers();
  }
  if (viewId === "view-approvals") {
    listenForPendingCompanies();
  }
  if (viewId === "view-chat") {
    // Garante que a view principal de lista seja mostrada ao navegar para a aba
    document.getElementById("chat-list-view").classList.remove("hidden");
    document.getElementById("chat-details-view").classList.add("hidden");
    listenForChats();
    document.getElementById("back-to-chats-btn").onclick = () =>
      navigateTo("view-chat");
  }
  if (viewId === "view-logs") {
    listenForAdminLogs();
  }
  if (viewId === "view-dashboard") {
    // **CORREÇÃO**: Inicializa e renderiza o mapa de calor apenas quando a view está visível.
    initHeatmap();
    renderUserHeatmap(allUsersData); // Re-renderiza com os dados atuais
    listenForDashboardUpdates();
  }
  if (viewId === "view-settings") {
    loadAppSettings();
  }
  if (viewId === "view-ads") {
    renderAds(document.getElementById('view-ads'));
  }
  if (viewId === "view-graxa-kb") {
    initGraxaKbView(); // **NOVO**: Inicializa a view da assistente
  }
  if (viewId === "view-graxa-generator") {
    initGraxaGeneratorView(); // **NOVO**: Inicializa a view do gerador
  }
}

/**
 * Navega para a tela de detalhes de um usuário específico.
 * @param {string} userId - O ID do usuário a ser detalhado.
 */
async function navigateToUserDetails(userId) {
  navigateTo("view-user-details");
  currentDisplayedUserDetailsId = userId;

  // Reset/Loading states
  document.getElementById("user-details-name").textContent = "Carregando...";
  document.getElementById(
    "user-details-content"
  ).innerHTML = `<div class="text-center p-10"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div></div>`;
  document.getElementById("user-stats-earnings").textContent = "...";
  document.getElementById("user-stats-expenses").textContent = "...";
  document.getElementById("user-stats-balance").textContent = "...";
  document.getElementById("user-stats-records").textContent = "...";
  document.getElementById("user-stats-avg-earning").textContent = "...";
  document.getElementById("user-stats-fav-category").textContent = "...";
  document.getElementById("user-recent-activity-table").innerHTML = "";

  try {
    // 1. Fetch all data in parallel
    const userPromise = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(userId)
      .get();
    const earningsPromise = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(userId)
      .collection("earnings")
      .get();
    const expensesPromise = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(userId)
      .collection("expenses")
      .get();

    const [userDoc, earningsSnap, expensesSnap] = await Promise.all([
      userPromise,
      earningsPromise,
      expensesPromise,
    ]);

    if (!userDoc.exists) {
      throw new Error("Usuário não encontrado.");
    }

    const user = { id: userDoc.id, ...userDoc.data() };
    const earnings = earningsSnap.docs.map((doc) => doc.data());
    const expenses = expensesSnap.docs.map((doc) => doc.data());

    // 2. Render Profile Details
    document.getElementById("user-details-name").textContent =
      user.publicProfile?.name || user.email;

    const contentDiv = document.getElementById("user-details-content");
    let userDetailsHtml = "";
    if (user.type === "company") {
      // Render company details (assuming they are in the same doc for simplicity)
      // This part can be expanded if company data is in a separate collection
      userDetailsHtml = `<p>Detalhes da empresa a serem implementados.</p>`;
    } else {
      // Render motoboy details
      const profile = user.publicProfile || {};
      userDetailsHtml = `
        <div class="bg-white p-6 rounded-lg shadow-md">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center"><i data-lucide="bike" class="w-8 h-8 text-gray-500"></i></div>
            <div>
              <h2 class="text-2xl font-bold text-gray-800">${
                profile.name || "Nome não informado"
              }</h2>
              <p class="text-sm text-gray-500">${user.email || userId}</p>
              <span class="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-800">Motoboy</span>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div><p class="text-xs text-gray-500">WhatsApp</p><p class="font-semibold">${
              profile.whatsapp || "N/A"
            }</p></div>
            <div><p class="text-xs text-gray-500">Placa</p><p class="font-semibold">${
              profile.motoPlate || "N/A"
            }</p></div>
            <div><p class="text-xs text-gray-500">Marca/Modelo</p><p class="font-semibold">${
              profile.fipeModelText || "N/A"
            }</p></div>
            <div><p class="text-xs text-gray-500">Ano/Cor</p><p class="font-semibold">${
              profile.motoYear || "N/A"
            } - ${profile.motoColor || "N/A"}</p></div>
            <div><p class="text-xs text-gray-500">RENAVAM</p><p class="font-semibold">${
              profile.motoRenavam || "N/A"
            }</p></div>
            <div><p class="text-xs text-gray-500">Estado</p><p class="font-semibold">${
              profile.motoState || "N/A"
            }</p></div>
            ${
              profile.motoImageUrl
                ? `
              <div class="col-span-full">
                <p class="text-xs text-gray-500 mb-1">Imagem da Moto</p>
                <img src="${profile.motoImageUrl}" class="max-h-48 rounded-lg border"/>
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;
    }
    contentDiv.innerHTML = userDetailsHtml;
    lucide.createIcons();

    // 3. Calculate and Render Stats
    const totalEarnings = earnings.reduce(
      (sum, item) => sum + item.totalValue,
      0
    );
    const totalExpenses = expenses.reduce(
      (sum, item) => sum + item.totalValue,
      0
    );
    const balance = totalEarnings - totalExpenses;
    const totalRecords = earnings.length + expenses.length;
    const avgEarning =
      earnings.length > 0 ? totalEarnings / earnings.length : 0;

    const expenseCategoryCounts = expenses.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});
    const favCategory = Object.keys(expenseCategoryCounts).reduce(
      (a, b) => (expenseCategoryCounts[a] > expenseCategoryCounts[b] ? a : b),
      "N/A"
    );

    document.getElementById(
      "user-stats-earnings"
    ).textContent = `R$ ${totalEarnings.toFixed(2)}`;
    document.getElementById(
      "user-stats-expenses"
    ).textContent = `R$ ${totalExpenses.toFixed(2)}`;
    document.getElementById(
      "user-stats-balance"
    ).textContent = `R$ ${balance.toFixed(2)}`;
    document.getElementById("user-stats-records").textContent = totalRecords;
    document.getElementById(
      "user-stats-avg-earning"
    ).textContent = `R$ ${avgEarning.toFixed(2)}`;
    document.getElementById("user-stats-fav-category").textContent =
      favCategory;

    // 4. Render Recent Activity
    const recentActivity = [...earnings, ...expenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    const activityTable = document.getElementById("user-recent-activity-table");
    if (recentActivity.length > 0) {
      activityTable.innerHTML = recentActivity
        .map((item) => {
          const isEarning = !item.category.startsWith("combustivel"); // Simplification
          return `
          <tr class="text-sm">
            <td class="p-2">${new Date(
              item.date + "T00:00:00"
            ).toLocaleDateString("pt-BR")}</td>
            <td class="p-2">
              <span class="px-2 py-1 text-xs font-bold rounded-full ${
                isEarning
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }">
                ${isEarning ? "Ganho" : "Despesa"}
              </span>
            </td>
            <td class="p-2">${item.category}</td>
            <td class="p-2 font-bold ${
              isEarning ? "text-green-600" : "text-red-600"
            }">R$ ${item.totalValue.toFixed(2)}</td>
          </tr>
        `;
        })
        .join("");
    } else {
      activityTable.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-gray-400">Nenhuma atividade recente.</td></tr>`;
    }

    // 5. Setup Action Buttons
    updateUserActionSection(user);
    document.getElementById("open-notification-modal-btn").onclick = () =>
      openNotificationModal(user);

    // **NOVO**: Adiciona listeners para os botões de gerenciamento de assinatura
    const expiryInput = document.getElementById("pro-expiry-date");
    if (user.proExpiryDate) {
      expiryInput.value = user.proExpiryDate;
    }
    document.getElementById("save-subscription-btn").onclick = () =>
      saveSubscription(userId, expiryInput.value);
    document.getElementById("remove-subscription-btn").onclick = () =>
      removeSubscription(userId);
    document.getElementById("remind-subscription-btn").onclick = () =>
      remindSubscription(userId, user.proExpiryDate);

    document.getElementById("edit-user-details-btn").onclick = () =>
      openUserFormModal(userId);
    document.getElementById("delete-user-details-btn").onclick = () =>
      deleteUser(userId);
    document.getElementById("generate-dossier-btn").onclick = () =>
      generateDossier(userId);
  } catch (error) {
    console.error("Erro ao buscar detalhes do usuário:", error);
    document.getElementById(
      "user-details-content"
    ).innerHTML = `<p class="text-red-500 text-center">Ocorreu um erro ao carregar os dados.</p>`;
  }
}

/**
 * Salva ou atualiza a assinatura de um usuário.
 * @param {string} userId - O ID do usuário.
 * @param {string} expiryDate - A data de expiração no formato YYYY-MM-DD.
 */
async function saveSubscription(userId, expiryDate) {
  if (!expiryDate) {
    return alert("Por favor, selecione uma data de vencimento.");
  }

  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(userId);
  await userRef.set(
    {
      isPro: true,
      proExpiryDate: expiryDate,
    },
    { merge: true }
  );

  alert("Assinatura salva com sucesso! O usuário agora é um Apoiador.");
  logAdminAction("update_subscription", userId, "N/A", {
    status: "active",
    expiry: expiryDate,
  });
  navigateToUserDetails(userId); // Recarrega os detalhes para mostrar o status atualizado
}

/**
 * Remove o status de Apoiador de um usuário.
 * @param {string} userId - O ID do usuário.
 */
async function removeSubscription(userId) {
  if (
    !confirm(
      "Tem certeza que deseja remover o status de Apoiador deste usuário?"
    )
  )
    return;

  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(userId);
  await userRef.update({
    isPro: firebase.firestore.FieldValue.delete(),
    proExpiryDate: firebase.firestore.FieldValue.delete(),
  });

  alert("Status de Apoiador removido com sucesso.");
  logAdminAction("remove_subscription", userId, "N/A");
  navigateToUserDetails(userId); // Recarrega os detalhes
}

/**
 * Envia uma notificação de lembrete de vencimento da assinatura.
 * @param {string} userId - O ID do usuário.
 * @param {string} expiryDate - A data de vencimento.
 */
async function remindSubscription(userId, expiryDate) {
  if (!expiryDate) {
    return alert(
      "Este usuário não tem uma assinatura ativa para ser lembrado."
    );
  }

  const title = "Sua assinatura está vencendo!";
  const message = `Olá! Sua assinatura do Plano Apoiador do AppMotoCash está próxima de vencer em ${new Date(
    expiryDate + "T12:00:00"
  ).toLocaleDateString(
    "pt-BR"
  )}. Renove para continuar aproveitando os benefícios!`;

  // Reutiliza a função de enviar notificação
  await sendNotificationToUser(userId, title, message);
  alert("Lembrete de vencimento enviado para o usuário.");
  logAdminAction("send_subscription_reminder", userId, "N/A", { message });
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

    try {
      await sendNotificationToUser(
        user.id,
        titleInput.value,
        messageInput.value,
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
 * Abre o modal para enviar uma notificação em massa (broadcast).
 */
function openBroadcastModal() {
  // Reutiliza o mesmo modal de notificação
  document.getElementById("notification-user-name").textContent =
    "TODOS OS USUÁRIOS";
  document.getElementById("notification-modal").classList.remove("hidden");
  lucide.createIcons();

  const form = document.getElementById("send-notification-form");
  const titleInput = document.getElementById("notification-title-input");
  const messageInput = document.getElementById("notification-message-input");

  form.reset();

  const closeModal = () =>
    document.getElementById("notification-modal").classList.add("hidden");

  document.getElementById("close-notification-modal-btn").onclick = closeModal;
  document.getElementById("cancel-notification-btn").onclick = closeModal;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const title = titleInput.value || "Aviso Importante";
    const message = messageInput.value;

    const confirmation = confirm(
      `Você está prestes a enviar uma notificação para ${allUsersData.length} usuários. Deseja continuar?`
    );

    if (!confirmation) {
      return;
    }

    try {
      await sendBroadcastNotification(title, message);
      alert("Notificação em massa enviada com sucesso!");
      closeModal();
    } catch (error) {
      console.error("Erro ao enviar notificação em massa:", error);
      alert(`Erro ao enviar notificação em massa: ${error.message}`);
    }
  };
}

/**
 * Envia uma notificação para todos os usuários.
 * @param {string} title - O título da notificação.
 * @param {string} message - A mensagem da notificação.
 */
async function sendBroadcastNotification(title, message) {
  // Busca a lista de usuários mais recente para garantir que todos recebam.
  const usersSnapshot = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .get();
  const allUserDocs = usersSnapshot.docs;

  if (allUserDocs.length === 0) {
    throw new Error("Nenhum usuário encontrado para enviar a notificação.");
  }

  // **AVISO IMPORTANTE:**
  // Esta abordagem de cliente é funcional para um número PEQUENO de usuários.
  // Para uma aplicação em produção com muitos usuários, o ideal é usar uma
  // Cloud Function do Firebase para evitar timeouts e sobrecarga no navegador.

  const batch = db.batch();
  const usersCollectionRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users");

  allUserDocs.forEach((user) => {
    const notificationRef = usersCollectionRef
      .doc(user.id)
      .collection("notifications")
      .doc();
    batch.set(notificationRef, {
      title,
      message,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  // Loga a ação de broadcast
  logAdminAction("broadcast_notification", "all_users", "N/A", { message });
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

  await notificationsRef.add({
    title,
    message,
    read: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Loga a ação do admin
  logAdminAction("send_notification", userId, userEmail, { message: message });
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
      await calculateAndRenderHeavyMetrics(); // **NOVO**: Calcula as métricas pesadas separadamente
    },
    (error) => {
      console.error("Erro no listener do dashboard:", error);
      alert("Erro ao receber atualizações em tempo real. Verifique o console.");
    }
  );

  // Inicia o listener para o log de atividades
  listenForAdminLogs(); // Agora esta função existe
}

/**
 * Processa os dados brutos dos usuários para atualizar as métricas do dashboard.
 * Esta função é otimizada para ser leve e não fazer leituras extras.
 * @param {Array} usersData - Dados brutos da coleção de usuários.
 */
function processAndRenderData(usersData) {
  try {
    allUsersData = usersData; // Atualiza o cache global com os dados brutos

    // --- Métricas Principais ---
    const totalUsers = usersData.length;
    const onlineUsers = usersData.filter((u) => u.status?.isOnline).length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyActiveUsers = usersData.filter((user) => {
      return user.status?.lastSeen?.toDate() >= thirtyDaysAgo;
    }).length;

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const dailyActiveUsers = usersData.filter((user) => {
      return user.status?.lastSeen?.toDate() >= oneDayAgo;
    }).length;

    const dauMauRatio =
      monthlyActiveUsers > 0
        ? (dailyActiveUsers / monthlyActiveUsers) * 100
        : 0;

    document.getElementById("metric-total-users").textContent = totalUsers;
    document.getElementById("metric-online-users").textContent = onlineUsers;
    document.getElementById("metric-monthly-active-users").textContent =
      monthlyActiveUsers;

    document.getElementById(
      "metric-dau-mau-ratio"
    ).textContent = `${dauMauRatio.toFixed(1)}%`;

    // --- Renderiza os Gráficos ---
    renderNewUsersChart(usersData);
    // **CORRIGIDO**: Só renderiza o mapa se a view do dashboard estiver visível
    if (
      !document.getElementById("view-dashboard").classList.contains("hidden")
    ) {
      renderUserHeatmap(usersData);
    }
  } catch (error) {
    console.error("Erro ao carregar dados do dashboard:", error);
    alert(
      "Não foi possível carregar os dados. Verifique as regras de segurança do Firestore."
    );
  } finally {
    // Garante que a animação do botão de refresh pare, mesmo se houver erro.
    const btnIcon = document.querySelector("#refresh-dashboard-btn i");
    if (btnIcon) btnIcon.classList.remove("animate-spin");
  }
}

/**
 * **NOVO**: Calcula e renderiza as métricas que exigem mais processamento.
 * Esta função é chamada sob demanda para não sobrecarregar o listener em tempo real.
 */
async function calculateAndRenderHeavyMetrics() {
  // Mostra estado de carregamento
  document.getElementById("metric-total-records").textContent = "···";
  document.getElementById("metric-most-active-user").textContent = "···";
  document.getElementById("table-users-body").innerHTML =
    '<tr><td colspan="4" class="text-center p-8 text-gray-400">Calculando ranking...</td></tr>';

  try {
    // Busca todos os registros de ganhos e despesas de todos os usuários
    const earningsPromises = allUsersData.map((user) =>
      db
        .collection("artifacts")
        .doc(appId)
        .collection("users")
        .doc(user.id)
        .collection("earnings")
        .get()
    );
    const expensesPromises = allUsersData.map((user) =>
      db
        .collection("artifacts")
        .doc(appId)
        .collection("users")
        .doc(user.id)
        .collection("expenses")
        .get()
    );

    const allEarningsSnapshots = await Promise.all(earningsPromises);
    const allExpensesSnapshots = await Promise.all(expensesPromises);

    let allRecords = [];
    const userRecordCounts = {};

    allUsersData.forEach((user, index) => {
      const earnings = allEarningsSnapshots[index].docs.map((doc) => ({
        ...doc.data(),
        type: "earning",
      }));
      const expenses = allExpensesSnapshots[index].docs.map((doc) => ({
        ...doc.data(),
        type: "expense",
      }));

      const userRecords = [...earnings, ...expenses];
      allRecords.push(...userRecords);

      userRecordCounts[user.id] = {
        count: userRecords.length,
        name: user.publicProfile?.name || user.email,
        email: user.email,
        status: user.status,
      };
    });

    // 1. Calcula Total de Registros no Mês
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyRecords = allRecords.filter((record) => {
      const recordDate = new Date(record.date + "T00:00:00"); // Adiciona T00:00:00 para evitar problemas de fuso
      return recordDate >= thirtyDaysAgo;
    }).length;
    document.getElementById("metric-total-records").textContent =
      monthlyRecords;

    // 2. Calcula Usuário Mais Ativo
    const sortedUsers = Object.values(userRecordCounts).sort(
      (a, b) => b.count - a.count
    );
    const mostActiveUser = sortedUsers[0];
    if (mostActiveUser) {
      document.getElementById("metric-most-active-user").textContent =
        mostActiveUser.name;
    }

    // 3. Renderiza a tabela de Ranking de Atividade
    const top5Users = sortedUsers.slice(0, 5);
    renderUsersRankingTable(top5Users);

    // 4. Renderiza o gráfico de atividade de registros
    renderRecordsActivityChart(allRecords);
  } catch (error) {
    console.error("Erro ao calcular métricas pesadas:", error);
    document.getElementById("metric-total-records").textContent = "Erro";
    document.getElementById("metric-most-active-user").textContent = "Erro";
    document.getElementById("table-users-body").innerHTML =
      '<tr><td colspan="4" class="text-center p-8 text-red-500">Erro ao calcular ranking.</td></tr>';
  } finally {
    // Garante que a animação do botão de refresh pare
    const btnIcon = document.querySelector("#refresh-dashboard-btn i");
    if (btnIcon) btnIcon.classList.remove("animate-spin");
  }
}

/**
 * **NOVA FUNÇÃO**
 * Carrega os dados completos dos usuários (incluindo contagem de registros)
 * e renderiza a tabela na aba "Usuários".
 * Esta função é chamada apenas quando o admin acessa a aba de usuários.
 */
async function loadAndRenderAllUsers() {
  const tableBody = document.getElementById("all-users-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-gray-400">Carregando usuários e processando dados...</td></tr>`;

  try {
    const usersSnapshot = await db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .get();

    const usersWithRecordCounts = await Promise.all(
      usersSnapshot.docs.map(async (doc) => {
        // **CORREÇÃO**: A sintaxe correta para a v8 do SDK é .get() em query.
        const earningsQuery = db
          .collection("artifacts")
          .doc(appId)
          .collection("users")
          .doc(doc.id)
          .collection("earnings");
        const expensesQuery = db
          .collection("artifacts")
          .doc(appId)
          .collection("users")
          .doc(doc.id)
          .collection("expenses");

        const [earningsCountSnap, expensesCountSnap] = await Promise.all([
          earningsQuery.get(),
          expensesQuery.get(),
        ]);

        return {
          id: doc.id,
          ...doc.data(),
          totalRecords: earningsCountSnap.size + expensesCountSnap.size,
        };
      })
    );

    // Ordena por total de registros para a renderização
    usersWithRecordCounts.sort((a, b) => b.totalRecords - a.totalRecords);

    // Atualiza o cache global com os dados completos
    allUsersData = usersWithRecordCounts;

    // Renderiza a tabela com os dados completos
    renderAllUsersTable();
  } catch (error) {
    console.error("Erro ao carregar lista de usuários:", error);
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Erro ao carregar usuários.</td></tr>`;
  }
}

/**
 * Apaga um usuário e todos os seus dados do Firestore.
 * @param {string} userId - O ID do usuário a ser apagado.
 */
async function deleteUser(userId) {
  // Busca os dados do usuário diretamente para garantir que temos as informações corretas
  const userDoc = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(userId)
    .get();
  const companyDoc = await db.collection("companies").doc(userId).get();

  let userEmail = "ID: " + userId;
  if (userDoc.exists && userDoc.data().email) {
    userEmail = userDoc.data().email;
  } else if (companyDoc.exists && companyDoc.data().email) {
    userEmail = companyDoc.data().email;
  }
  const confirmation = prompt(
    `ATENÇÃO: Esta ação é IRREVERSÍVEL.\n\nVocê está prestes a apagar o usuário ${userEmail} e todos os seus dados (incluindo perfil de empresa, se houver).\n\nPara confirmar, digite "APAGAR" no campo abaixo:`
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

    // Tenta apagar da coleção 'companies' se existir (para empresas)
    const companyRef = db.collection("companies").doc(userId);
    await companyRef
      .delete()
      .catch((e) =>
        console.log(
          "Usuário não era empresa ou já foi apagado da coleção 'companies'."
        )
      );

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
 * Gera um dossiê HTML completo para um usuário.
 * @param {string} userId - O ID do usuário.
 */
async function generateDossier(userId) {
  const dossierWindow = window.open("", "_blank");
  dossierWindow.document.write(
    "<html><head><title>Dossiê do Usuário</title><script src='https://cdn.tailwindcss.com'></script></head><body class='bg-gray-100 p-10'><h1 class='text-2xl font-bold mb-4'>Gerando Dossiê...</h1></body></html>"
  );

  try {
    // 1. Coleta de Dados em Paralelo
    const userRef = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(userId);
    const companyRef = db.collection("companies").doc(userId);

    const [
      userDoc,
      companyDoc,
      earningsSnap,
      expensesSnap,
      notificationsSnap,
      adminLogsSnap,
      chatsSnap,
    ] = await Promise.all([
      userRef.get(),
      companyRef.get(),
      userRef.collection("earnings").orderBy("date", "desc").get(),
      userRef.collection("expenses").orderBy("date", "desc").get(),
      userRef.collection("notifications").orderBy("createdAt", "desc").get(),
      db
        .collection("artifacts")
        .doc(appId)
        .collection("admin_logs")
        .where("targetUserId", "==", userId)
        .get(),
      db.collection("jobs").where("motoboyId", "==", userId).get(), // Isso pode precisar de ajuste dependendo de como o chat é modelado
    ]);

    const user = userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
    const company = companyDoc.exists
      ? { id: companyDoc.id, ...companyDoc.data() }
      : null;

    // Função auxiliar para formatar datas
    const formatDate = (timestamp) => {
      if (!timestamp) return "N/A";
      return new Date(timestamp.seconds * 1000).toLocaleString("pt-BR");
    };

    // 2. Construção do HTML do Dossiê
    let html = `
      <div class="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-lg">
        <div class="flex justify-between items-center border-b pb-4">
          <h1 class="text-3xl font-bold text-gray-800">Dossiê de Atividades</h1>
          <button onclick="window.print()" class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 mr-2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Imprimir / Salvar PDF
          </button>
        </div>
        <div class="mt-6">
          <h2 class="text-xl font-bold text-gray-700 border-b pb-2 mb-4">Informações Principais</h2>
    `;

    // Informações do Usuário/Empresa
    if (user) {
      html += `
        <div class="grid grid-cols-2 gap-4">
          <div><p class="text-sm text-gray-500">ID do Usuário</p><p class="font-semibold">${
            user.id
          }</p></div>
          <div><p class="text-sm text-gray-500">Email</p><p class="font-semibold">${
            user.email || "N/A"
          }</p></div>
          <div><p class="text-sm text-gray-500">Data de Cadastro</p><p class="font-semibold">${formatDate(
            user.createdAt
          )}</p></div>
          <div><p class="text-sm text-gray-500">Status da Conta</p><p class="font-semibold">${
            user.accountStatus || "N/A"
          }</p></div>
          <div><p class="text-sm text-gray-500">Último Acesso</p><p class="font-semibold">${formatDate(
            user.status?.lastSeen
          )}</p></div>
        </div>
      `;
      if (user.publicProfile) {
        html +=
          '<h3 class="text-lg font-bold text-gray-600 mt-4">Perfil Público (Motoboy)</h3>';
        html += '<div class="grid grid-cols-2 gap-4 mt-2">';
        for (const [key, value] of Object.entries(user.publicProfile)) {
          html += `<div><p class="text-sm text-gray-500">${key}</p><p class="font-semibold">${
            value || "N/A"
          }</p></div>`;
        }
        html += "</div>";
      }
    }
    if (company) {
      html +=
        '<h3 class="text-lg font-bold text-gray-600 mt-4">Dados da Empresa</h3>';
      html += '<div class="grid grid-cols-2 gap-4 mt-2">';
      for (const [key, value] of Object.entries(company)) {
        if (typeof value !== "object") {
          // Evita imprimir objetos aninhados
          html += `<div><p class="text-sm text-gray-500">${key}</p><p class="font-semibold">${
            value || "N/A"
          }</p></div>`;
        }
      }
      html += "</div>";
    }

    // Função para gerar tabelas
    const generateTable = (title, headers, data) => {
      let tableHtml = `<div class="mt-8"><h2 class="text-xl font-bold text-gray-700 border-b pb-2 mb-4">${title}</h2>`;
      if (data.length === 0) {
        tableHtml += '<p class="text-gray-500">Nenhum registro encontrado.</p>';
      } else {
        tableHtml += '<table class="w-full text-left border-collapse">';
        tableHtml +=
          "<thead><tr>" +
          headers
            .map((h) => `<th class="border-b p-2 bg-gray-50">${h}</th>`)
            .join("") +
          "</tr></thead>";
        tableHtml += "<tbody>";
        data.forEach((row) => {
          tableHtml +=
            "<tr>" +
            row
              .map((cell) => `<td class="border-b p-2">${cell}</td>`)
              .join("") +
            "</tr>";
        });
        tableHtml += "</tbody></table>";
      }
      return tableHtml + "</div>";
    };

    // Tabela de Ganhos
    html += generateTable(
      "Registros de Ganhos",
      ["Data", "Categoria", "Valor", "Origem", "Placa"],
      earningsSnap.docs.map((doc) => {
        const d = doc.data();
        return [d.date, d.category, `R$ ${d.value}`, d.origin, d.vehicleId];
      })
    );

    // Tabela de Despesas
    html += generateTable(
      "Registros de Despesas",
      ["Data", "Categoria", "Valor", "Descrição"],
      expensesSnap.docs.map((doc) => {
        const d = doc.data();
        return [d.date, d.category, `R$ ${d.value}`, d.description];
      })
    );

    // Tabela de Notificações
    html += generateTable(
      "Notificações Enviadas ao Usuário",
      ["Data", "Título", "Mensagem"],
      notificationsSnap.docs.map((doc) => {
        const d = doc.data();
        return [formatDate(d.createdAt), d.title, d.message];
      })
    );

    // Tabela de Logs do Admin
    html += generateTable(
      "Logs de Admin Relacionados",
      ["Data", "Ação", "Admin", "Detalhes"],
      adminLogsSnap.docs.map((doc) => {
        const d = doc.data();
        return [
          formatDate(d.timestamp),
          d.action,
          d.adminEmail,
          JSON.stringify(d.details),
        ];
      })
    );

    // Tabela de Chats
    html += generateTable(
      "Participação em Chats de Vagas",
      ["Vaga", "Empresa", "Status da Vaga"],
      chatsSnap.docs.map((doc) => {
        const d = doc.data();
        return [d.title, d.empresaName, d.status];
      })
    );

    html += "</div></div>"; // Fecha as tags principais

    // 3. Escreve o HTML final na nova janela
    dossierWindow.document.body.innerHTML = html;
    dossierWindow.document.close();
  } catch (error) {
    console.error("Erro ao gerar dossiê:", error);
    dossierWindow.document.body.innerHTML = `<p class="text-red-500 font-bold">Erro ao gerar dossiê: ${error.message}</p>`;
  }
}

/**
 * Salva (cria ou atualiza) os dados de um usuário no Firestore.
 * @param {object} formData - Os dados do formulário do usuário.
 */
async function saveUser(formData) {
  const userFormModal = document.getElementById("user-form-modal");
  const userId = formData.id; // Existing userId if editing, null if new
  const isNewUser = !userId;

  try {
    // 1. Prepare user data for Firestore
    const userData = {
      email: formData.email,
      publicProfile: {
        name: formData.name,
        whatsapp: formData.whatsapp,
        // Common motoboy fields
        motoPlate: formData.motoPlate,
        fipeModelText: formData.motoModel,
        motoYear: parseInt(formData.motoYear) || null,
        motoColor: formData.motoColor,
        motoRenavam: formData.motoRenavam,
        motoState: formData.motoState,
        motoImageUrl: formData.motoImageUrl,
      },
      type: formData.type, // 'motoboy' or 'company'
      accountStatus: "active", // Default status for new users
      createdAt: isNewUser
        ? firebase.firestore.FieldValue.serverTimestamp()
        : undefined, // Only set for new users
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // 2. Handle 'company' specific fields
    const companyData = {
      name: formData.name,
      email: formData.email,
      cnpj: formData.cnpj,
      phone: formData.phone,
      address: formData.address,
      createdAt: isNewUser
        ? firebase.firestore.FieldValue.serverTimestamp()
        : undefined,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    let targetUserId = userId; // Will be the same if editing, or new UID if creating Auth user

    if (isNewUser) {
      // For new users, we need to create a Firebase Auth user to get a UID
      // IMPORTANT: Directly creating users from client-side is generally NOT recommended for production apps
      // as it exposes admin credentials or allows unauthenticated creation.
      // A Cloud Function should be used for this. For this demo, we proceed with client-side for simplicity.
      const password = prompt(
        "Defina uma senha provisória para o novo usuário:"
      );
      if (!password) {
        alert("Senha é obrigatória para criar um novo usuário.");
        return;
      }
      if (password.length < 6) {
        alert("A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      const userCredential = await auth.createUserWithEmailAndPassword(
        formData.email,
        password
      );
      targetUserId = userCredential.user.uid;
      alert(
        "Usuário de autenticação criado com sucesso! Agora salvando os dados no Firestore."
      );
      userData.uid = targetUserId; // Store UID in Firestore document
    }

    // 3. Save/Update in Firestore
    const userDocRef = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(targetUserId);

    if (formData.type === "company") {
      // Save to 'companies' collection
      const companyDocRef = db.collection("companies").doc(targetUserId);
      await companyDocRef.set(companyData, { merge: true }); // Use merge for updates
      // Remove motoboy-specific publicProfile fields
      delete userData.publicProfile.motoPlate;
      delete userData.publicProfile.fipeModelText;
      delete userData.publicProfile.motoYear;
      delete userData.publicProfile.motoColor;
      delete userData.publicProfile.motoRenavam;
      delete userData.publicProfile.motoState;
      delete userData.publicProfile.motoImageUrl;
    } else {
      // 'motoboy' type
      // Ensure 'company' data is cleared/not set if type changes from company to motoboy
      // This is a simplification; in a real app, you might have separate forms/logic.
      const companyDocRef = db.collection("companies").doc(targetUserId);
      await companyDocRef
        .delete()
        .catch((e) =>
          console.log(
            "Não havia doc de empresa para este ID ou já foi apagado."
          )
        );
      // Ensure publicProfile exists
      if (!userData.publicProfile) userData.publicProfile = {};
    }

    await userDocRef.set(userData, { merge: true }); // Use merge for updates

    alert(`Usuário ${isNewUser ? "criado" : "atualizado"} com sucesso!`);
    userFormModal.classList.add("hidden"); // Esconde o modal
    navigateTo("view-users"); // Volta para a lista de usuários
    // O listener onSnapshot vai recarregar os dados.

    logAdminAction(
      isNewUser ? "create_user" : "update_user",
      targetUserId,
      formData.email,
      formData
    );
  } catch (error) {
    console.error("Erro ao salvar usuário:", error);
    alert(`Erro ao salvar usuário: ${error.message}`);
  }
}

/**
 * Inicia o listener do Firestore para atualizações em tempo real das empresas.
 */
function listenForCompaniesUpdates() {
  // Se já houver um listener, cancela antes de criar um novo
  if (unsubscribeCompaniesListener) unsubscribeCompaniesListener();

  const companiesQuery = db.collection("companies");

  unsubscribeCompaniesListener = companiesQuery.onSnapshot(
    (companiesSnapshot) => {
      console.log("🔄 Dados das empresas atualizados em tempo real!");
      const companiesData = companiesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        type: "company", // Adiciona o tipo para facilitar o reuso do formulário
      }));
      allCompaniesData = companiesData; // Atualiza o cache global com os dados mais recentes

      renderAllCompaniesTable(); // Renderiza a tabela completa na view de empresas
    },
    (error) => {
      console.error("Erro no listener de empresas:", error);
      alert(
        "Erro ao receber atualizações em tempo real das empresas. Verifique o console."
      );
    }
  );
}

/**
 * Inicia o listener do Firestore para empresas aguardando aprovação.
 */
function listenForPendingCompanies() {
  if (unsubscribePendingCompaniesListener)
    unsubscribePendingCompaniesListener();

  const pendingQuery = db
    .collection("companies")
    .where("status", "==", "pending");

  unsubscribePendingCompaniesListener = pendingQuery.onSnapshot(
    (snapshot) => {
      const pendingCompanies = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderPendingCompaniesTable(pendingCompanies);

      // Atualiza o indicador no menu
      const indicator = document.getElementById("pending-approvals-indicator");
      if (pendingCompanies.length > 0) {
        indicator.textContent = pendingCompanies.length;
        indicator.classList.remove("hidden");
      } else {
        indicator.classList.add("hidden");
      }
    },
    (error) => {
      console.error("Erro ao buscar empresas pendentes:", error);
      alert("Não foi possível carregar a lista de aprovações.");
    }
  );
}

/**
 * Renderiza a tabela de empresas aguardando aprovação.
 * @param {Array} companies - Lista de empresas com status 'pending'.
 */
function renderPendingCompaniesTable(companies) {
  const tableBody = document.getElementById("pending-companies-table-body");
  if (!tableBody) return;

  if (companies.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-400">Nenhuma empresa aguardando aprovação.</td></tr>`;
    return;
  }

  tableBody.innerHTML = companies
    .map(
      (company) => `
    <tr class="text-sm text-gray-700 border-b">
      <td class="p-3 font-medium">${company.name}</td>
      <td class="p-3">${company.cnpj}</td>
      <td class="p-3">${company.email}</td>
      <td class="p-3">${company.whatsapp || "N/A"}</td>
      <td class="p-3">${company.address || "N/A"}</td>
      <td class="p-3">${
        company.createdAt
          ? new Date(company.createdAt.seconds * 1000).toLocaleDateString()
          : "N/A"
      }</td>
      <td class="p-3 flex items-center space-x-2">
        <button onclick="approveCompany('${
          company.id
        }')" class="bg-green-500 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-green-600">Aprovar</button>
        <button onclick="reproveCompany('${
          company.id
        }')" class="bg-red-500 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-red-600">Reprovar</button>
      </td>
    </tr>
  `
    )
    .join("");
}

/**
 * Aprova o cadastro de uma empresa.
 * @param {string} companyId - O ID da empresa a ser aprovada.
 */
async function approveCompany(companyId) {
  if (!confirm("Tem certeza que deseja aprovar esta empresa?")) return;

  try {
    const companyRef = db.collection("companies").doc(companyId);
    const companySnap = await companyRef.get();
    if (!companySnap.exists()) {
      throw new Error("Empresa não encontrada.");
    }
    const companyData = companySnap.data();

    // Atualiza o status da empresa
    await companyRef.update({ status: "approved" });
    logAdminAction("approve_company", companyId, `Empresa ID: ${companyId}`);
    alert("Empresa aprovada com sucesso!");

    // Mostra o modal com as mensagens para copiar
    showApprovalMessages(companyData);
  } catch (error) {
    console.error("Erro ao aprovar empresa:", error);
    alert("Ocorreu um erro: " + error.message);
  }
}

/**
 * Exibe o modal com as mensagens de aprovação para copiar.
 * @param {object} companyData - Os dados da empresa aprovada.
 */
function showApprovalMessages(companyData) {
  const modal = document.getElementById("approval-message-modal");
  const whatsappMsgEl = document.getElementById("whatsapp-message");
  const emailMsgEl = document.getElementById("email-message");

  const loginLink = "http://localhost/motoCash/empresa/"; // Altere para o link de produção

  const whatsappMessage = `Olá, ${companyData.name}! 👋 Boas notícias! Seu cadastro no AppMotoCash foi aprovado. Você já pode acessar seu painel e começar a publicar vagas para os melhores motoboys da região. Acesse agora: ${loginLink}`;
  const emailMessage = `Assunto: Seu cadastro no AppMotoCash foi Aprovado!

Olá, ${companyData.name}!

Temos ótimas notícias! Sua conta para a empresa ${companyData.name} foi aprovada em nossa plataforma.

Você já pode acessar seu painel, publicar vagas e encontrar os melhores motoboys freelancers para suas entregas.

Acesse seu painel agora: ${loginLink}

Atenciosamente,
Equipe AppMotoCash`;

  whatsappMsgEl.value = whatsappMessage;
  emailMsgEl.value = emailMessage;

  modal.classList.remove("hidden");
  document.getElementById("close-approval-modal-btn").onclick = () =>
    modal.classList.add("hidden");
}

function copyToClipboard(elementId) {
  const textarea = document.getElementById(elementId);
  textarea.select();
  document.execCommand("copy");
  alert("Texto copiado para a área de transferência!");
}

/**
 * Reprova o cadastro de uma empresa.
 * @param {string} companyId - O ID da empresa a ser reprovada.
 */
async function reproveCompany(companyId) {
  if (
    !confirm(
      "Tem certeza que deseja reprovar e apagar o cadastro desta empresa? Esta ação não pode ser desfeita."
    )
  )
    return;
  // Por segurança, em vez de apagar o usuário do Auth (o que é complexo no cliente),
  // vamos apenas apagar o registro da empresa. O usuário no Auth ficará órfão, mas não conseguirá logar.
  await db.collection("companies").doc(companyId).delete();
  logAdminAction("reprove_company", companyId, `Empresa ID: ${companyId}`);
  alert("Cadastro da empresa foi reprovado e removido.");
}

/**
 * Inicia o listener para o log de atividades do admin.
 */
function listenForAdminLogs() {
  const logsQuery = db
    .collection("artifacts")
    .doc(appId)
    .collection("admin_logs")
    .orderBy("timestamp", "desc")
    .limit(50);

  logsQuery.onSnapshot(
    (snapshot) => {
      const logs = snapshot.docs.map((doc) => doc.data());
      renderAdminLogsTable(logs);
    },
    (error) => {
      console.error("Erro ao buscar logs de admin:", error);
    }
  );
}

/**
 * Renderiza a tabela de logs de atividades do admin.
 * @param {Array} logs - Lista de logs.
 */
function renderAdminLogsTable(logs) {
  const tableBody = document.getElementById("admin-logs-table-body");
  if (!tableBody) return;

  if (logs.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-400">Nenhum log de atividade encontrado.</td></tr>`;
    return;
  }

  tableBody.innerHTML = logs
    .map(
      (log) => `
    <tr class="text-xs text-gray-600 border-b">
      <td class="p-2">${
        log.timestamp
          ? new Date(log.timestamp.seconds * 1000).toLocaleString("pt-BR")
          : "N/A"
      }</td>
      <td class="p-2 font-mono">${log.action}</td>
      <td class="p-2">${log.adminEmail}</td>
      <td class="p-2">${log.targetUserEmail || "N/A"}</td>
      <td class="p-2 text-gray-500">${JSON.stringify(log.details)}</td>
    </tr>
  `
    )
    .join("");
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
      // **CORREÇÃO CORS:** Usando um proxy CORS estável
      const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${user.status.location.latitude}&lon=${user.status.location.longitude}`;
      const response = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`
      );
      if (!response.ok) continue; // Pula para o próximo se a resposta não for OK

      const data = await response.json();
      const city = data.address?.city || data.address?.town || "Desconhecida";

      if (city !== "Desconhecida") {
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
    } catch (error) {
      console.error("Erro no reverse geocoding:", error);
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

  // **CORRIGIDO**: Verifica se o elemento existe antes de atualizar
  const userCountDisplay = document.getElementById("user-count-display");
  if (userCountDisplay) userCountDisplay.textContent = filteredUsers.length;

  if (filteredUsers.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-gray-400">Nenhum usuário encontrado.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filteredUsers
    .map(
      (user) => `
        <tr class="text-sm text-gray-700 border-b hover:bg-gray-50">
            <td class="p-3 cursor-pointer" onclick="navigateToUserDetails('${
              user.id
            }')">${user.publicProfile?.name || "Não informado"}</td>
            <td class="p-3 cursor-pointer" onclick="navigateToUserDetails('${
              user.id
            }')">${user.email || user.id}</td>
            <td class="p-3 cursor-pointer" onclick="navigateToUserDetails('${
              user.id
            }')">${
        user.createdAt
          ? new Date(user.createdAt.seconds * 1000).toLocaleDateString()
          : "N/A"
      }</td>
            <td class="p-3 cursor-pointer" onclick="navigateToUserDetails('${
              user.id
            }')">${
        user.status?.lastSeen
          ? new Date(user.status.lastSeen.seconds * 1000).toLocaleString(
              "pt-BR"
            )
          : "Nunca"
      }</td>
            <td class="p-3 font-bold text-center cursor-pointer" onclick="navigateToUserDetails('${
              user.id
            }')">${user.totalRecords}</td>
            <td class="p-3 cursor-pointer" onclick="navigateToUserDetails('${
              user.id
            }')">
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
            <td class="p-3 cursor-pointer" onclick="navigateToUserDetails('${
              user.id
            }')">
              ${getSubscriptionStatus(user).status}
            </td>
            <td class="p-3 cursor-pointer" onclick="navigateToUserDetails('${
              user.id
            }')">
              ${getSubscriptionStatus(user).expiryDate}
            </td>
            <td class="p-3 flex items-center space-x-2">
                <button title="Editar Usuário" onclick="openUserFormModal('${
                  user.id
                }')" class="text-blue-600 hover:text-blue-800">
                    <i data-lucide="edit" class="w-4 h-4"></i>
                </button>
                <button title="Apagar Usuário" onclick="deleteUser('${
                  user.id
                }')" class="text-red-600 hover:text-red-800">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join("");
  lucide.createIcons(); // Renderiza os ícones recém-adicionados
}
/**
 * Retorna o status formatado da assinatura de um usuário.
 * @param {object} userData - Os dados do usuário do Firestore.
 * @returns {{status: string, expiryDate: string}}
 */
function getSubscriptionStatus(userData) {
  if (userData.isPro && userData.proExpiryDate) {
    const expiry = new Date(userData.proExpiryDate + "T12:00:00"); // Adiciona T12:00:00 para evitar problemas de fuso
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expiry < today) {
      return {
        status:
          '<span class="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Expirada</span>',
        expiryDate: expiry.toLocaleDateString("pt-BR"),
      };
    } else {
      return {
        status:
          '<span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Ativa</span>',
        expiryDate: expiry.toLocaleDateString("pt-BR"),
      };
    }
  }
  return {
    status:
      '<span class="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">N/A</span>',
    expiryDate: "-",
  };
}

/**
 * Renderiza a tabela completa de empresas com filtro de busca.
 * @param {string} searchTerm - Termo para filtrar empresas por nome ou email.
 */
function renderAllCompaniesTable(searchTerm = "") {
  const tableBody = document.getElementById("all-companies-table-body");
  if (!tableBody) return;

  const filteredCompanies = allCompaniesData.filter(
    (company) =>
      (company.name?.toLowerCase() || "").includes(searchTerm) ||
      (company.email?.toLowerCase() || "").includes(searchTerm) ||
      (company.cnpj?.toLowerCase() || "").includes(searchTerm)
  );

  // **CORRIGIDO**: Verifica se o elemento existe antes de atualizar
  const companyCountDisplay = document.getElementById("company-count-display");
  if (companyCountDisplay)
    companyCountDisplay.textContent = filteredCompanies.length;

  if (filteredCompanies.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-gray-400">Nenhuma empresa encontrada.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filteredCompanies
    .map(
      (company) => `
        <tr class="text-sm text-gray-700 border-b hover:bg-gray-50">
            <td class="p-3">${company.name || "Não informado"}</td>
            <td class="p-3">${company.email || company.id}</td>
            <td class="p-3">${company.cnpj || "N/A"}</td>
            <td class="p-3">${company.phone || "N/A"}</td>
            <td class="p-3">${company.address || "N/A"}</td>
            <td class="p-3">${
              company.createdAt
                ? new Date(
                    company.createdAt.seconds * 1000
                  ).toLocaleDateString()
                : "N/A"
            }</td>
            <td class="p-3 flex items-center space-x-2">
                <button title="Editar Empresa" onclick="openUserFormModal('${
                  company.id
                }', 'company')" class="text-blue-600 hover:text-blue-800">
                    <i data-lucide="edit" class="w-4 h-4"></i>
                </button>
                <button title="Apagar Empresa" onclick="deleteUser('${
                  company.id
                }')" class="text-red-600 hover:text-red-800">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join("");
  lucide.createIcons(); // Renderiza os ícones recém-adicionados
}

/**
 * Busca e renderiza a lista de conversas de vagas.
 */
function listenForChats() {
  const tableBody = document.getElementById("all-chats-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-400">Carregando conversas...</td></tr>`;

  // Busca vagas que estão ou estiveram em negociação
  db.collection("jobs")
    .where("status", "in", ["negociando", "concluida", "cancelada"])
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-400">Nenhuma conversa encontrada.</td></tr>`;
        return;
      }

      tableBody.innerHTML = snapshot.docs
        .map((doc) => {
          const job = doc.data();
          return `
          <tr class="text-sm text-gray-700 border-b hover:bg-gray-50">
            <td class="p-3 font-medium">${job.title}</td>
            <td class="p-3">${job.empresaName || "N/A"}</td>
            <td class="p-3">${job.motoboyName || "N/A"}</td>
            <td class="p-3">${new Date(
              job.createdAt.seconds * 1000
            ).toLocaleDateString()}</td>
            <td class="p-3">
              <button onclick="renderConversationDetails('${
                doc.id
              }')" class="text-blue-600 hover:underline text-xs font-bold">
                Ver Conversa
              </button>
            </td>
          </tr>
        `;
        })
        .join("");
    });
}

/**
 * Renderiza os detalhes e as mensagens de uma conversa específica.
 * @param {string} jobId - O ID da vaga (job) que contém a conversa.
 */
function renderConversationDetails(jobId) {
  document.getElementById("chat-list-view").classList.add("hidden");
  const detailsView = document.getElementById("chat-details-view");
  detailsView.classList.remove("hidden");

  const titleEl = document.getElementById("chat-details-title");
  const messagesContainer = document.getElementById("chat-messages-container");
  titleEl.textContent = "Carregando conversa...";
  messagesContainer.innerHTML = `<p class="text-center text-gray-500">Buscando mensagens...</p>`;

  // Busca os detalhes da vaga
  db.collection("jobs")
    .doc(jobId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const job = doc.data();
        titleEl.textContent = `Conversa: ${job.title}`;
      }
    });

  // Busca as mensagens da subcoleção
  db.collection("jobs")
    .doc(jobId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        messagesContainer.innerHTML = `<p class="text-center text-gray-500">Nenhuma mensagem nesta conversa.</p>`;
        return;
      }

      messagesContainer.innerHTML = snapshot.docs
        .map((doc) => {
          const msg = doc.data();
          const senderName =
            msg.senderName ||
            (msg.senderId === msg.empresaId ? "Empresa" : "Motoboy");
          const timestamp = msg.createdAt
            ? new Date(msg.createdAt.seconds * 1000).toLocaleString("pt-BR")
            : "";

          // Identifica o remetente para estilização
          const isCompany = msg.senderId !== msg.motoboyId;

          return `
        <div class="p-3 rounded-lg ${isCompany ? "bg-blue-50" : "bg-green-50"}">
          <div class="flex justify-between items-center">
            <p class="text-sm font-bold ${
              isCompany ? "text-blue-800" : "text-green-800"
            }">${senderName}</p>
            <p class="text-xs text-gray-500">${timestamp}</p>
          </div>
          <p class="mt-1 text-gray-800">${msg.text}</p>
        </div>
      `;
        })
        .join("");
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
 * @param {Array} allRecords - Lista de todos os registros (ganhos e despesas).
 */
function renderRecordsActivityChart(allRecords) {
  const chartCanvas = document.getElementById("chart-records-activity");
  if (window.myRecordsChart) window.myRecordsChart.destroy(); // Destroi gráfico antigo
  const ctx = chartCanvas?.getContext("2d");
  if (!ctx) return;

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

    const recordsOnDay = allRecords.filter((record) => {
      const recordDate = new Date(record.date + "T00:00:00");
      return recordDate >= startOfDay && recordDate <= endOfDay;
    }).length;

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

/**
 * **NOVO**: Renderiza a tabela de ranking de atividade no dashboard.
 * @param {Array} topUsers - Lista dos usuários mais ativos.
 */
function renderUsersRankingTable(topUsers) {
  const tableBody = document.getElementById("table-users-body");
  if (!tableBody) return;

  if (topUsers.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-gray-400">Nenhum usuário com atividade.</td></tr>`;
    return;
  }

  tableBody.innerHTML = topUsers
    .map(
      (user) => `
        <tr class="text-sm text-gray-700 border-b">
            <td class="p-3 font-medium">${user.name}</td>
            <td class="p-3">${user.email}</td>
            <td class="p-3 font-bold text-center">${user.count}</td>
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
    `
    )
    .join("");
}

// Helper Functions for User Management

/**
 * Alterna a visibilidade dos campos do formulário de usuário com base no tipo selecionado (Motoboy/Empresa).
 */
function toggleUserFormFields() {
  const userType = document.getElementById("user-form-type").value;
  document.querySelectorAll(".motoboy-field").forEach((field) => {
    if (userType === "motoboy") {
      field.classList.remove("hidden");
    } else {
      field.classList.add("hidden");
    }
  });
  document.querySelectorAll(".company-field").forEach((field) => {
    if (userType === "empresa") {
      field.classList.remove("hidden");
    } else {
      field.classList.add("hidden");
    }
  });
}

/**
 * Abre o modal de formulário para criar ou editar um usuário.
 * @param {string|null} userId - O ID do usuário a ser editado, ou null para criar um novo.
 * @param {string} [initialType='motoboy'] - O tipo inicial a ser selecionado ('motoboy' ou 'empresa').
 */
async function openUserFormModal(userId = null, initialType = "motoboy") {
  const userFormModal = document.getElementById("user-form-modal");
  const userFormTitle = document.getElementById("user-form-title");
  const userForm = document.getElementById("user-form");

  // Limpa o formulário e reseta o tipo
  userForm.reset();
  document.getElementById("user-form-type").value = initialType; // Set initial type
  currentEditingUserId = userId; // Define o ID do usuário em edição

  if (userId) {
    userFormTitle.textContent = "Editar Usuário";
    // Busca os dados do usuário (seja motoboy ou empresa) para preencher o formulário
    const user =
      allUsersData.find((u) => u.id === userId) ||
      allCompaniesData.find((c) => c.id === userId);

    if (user) {
      document.getElementById("user-form-type").value = user.type || "motoboy";
      document.getElementById("user-email-form").value = user.email || "";
      document.getElementById("user-form-name").value =
        user.publicProfile?.name || user.name || "";
      document.getElementById("user-form-whatsapp").value =
        user.publicProfile?.whatsapp || "";

      // Campos de Empresa
      document.getElementById("user-form-cnpj").value = user.cnpj || "";
      document.getElementById("user-form-address").value =
        user.fullAddress || "";

      // Campos de Motoboy
      document.getElementById("user-form-moto-plate").value =
        user.publicProfile?.motoPlate || "";
      document.getElementById("user-form-moto-model").value =
        user.publicProfile?.fipeModelText || "";
      document.getElementById("user-form-moto-year").value =
        user.publicProfile?.motoYear || "";
      document.getElementById("user-form-moto-color").value =
        user.publicProfile?.motoColor || "";
      document.getElementById("user-form-moto-renavam").value =
        user.publicProfile?.motoRenavam || "";
      document.getElementById("user-form-moto-state").value =
        user.publicProfile?.motoState || "";
      document.getElementById("user-form-moto-image-url").value =
        user.publicProfile?.motoImageUrl || "";
    }
  } else {
    userFormTitle.textContent = "Criar Novo Usuário";
  }

  toggleUserFormFields(); // Ajusta a visibilidade dos campos com base no tipo selecionado
  userFormModal.classList.remove("hidden"); // Mostra o modal
  lucide.createIcons(); // Renderiza ícones caso necessário
}

// =================================================================================
// CONFIGURAÇÕES GERAIS
// =================================================================================

/**
 * Carrega as configurações globais do app e preenche o formulário.
 */
async function loadAppSettings() {
  try {
    const settingsRef = db
      .collection("artifacts")
      .doc(appId)
      .collection("config")
      .doc("app_settings");
    const docSnap = await settingsRef.get();

    if (docSnap.exists) {
      const settings = docSnap.data();
      // Preenche Parâmetros do App
      document.getElementById("setting-search-radius").value =
        settings.searchRadius || "";
      document.getElementById("setting-motd").value =
        settings.motd?.message || "";
      document.getElementById("setting-motd-enabled").checked =
        settings.motd?.enabled || false;

      // Preenche Modo Manutenção
      document.getElementById("setting-maintenance-message").value =
        settings.maintenance?.message || "";
      document.getElementById("setting-maintenance-enabled").checked =
        settings.maintenance?.enabled || false;

      // Preenche Lista de Admins
      const adminListEl = document.getElementById("admin-list");
      const adminUids = settings.adminUids || [];
      if (adminUids.length > 0) {
        adminListEl.innerHTML = adminUids
          .map(
            (uid) =>
              `<li class="flex justify-between items-center"><span>${uid}</span><button onclick="removeAdmin('${uid}')" class="text-red-500 hover:text-red-700 text-xs font-bold">Remover</button></li>`
          )
          .join("");
      } else {
        adminListEl.innerHTML = `<li>Nenhum admin adicional encontrado.</li>`;
      }
    }
  } catch (error) {
    console.error("Erro ao carregar configurações:", error);
    alert("Não foi possível carregar as configurações do aplicativo.");
  }

  // Adiciona os listeners aos botões de salvar
  document.getElementById("save-app-settings-btn").onclick = saveAppSettings;
  document.getElementById("save-maintenance-settings-btn").onclick =
    saveMaintenanceSettings;
  document.getElementById("add-admin-btn").onclick = addAdmin;
}

/**
 * Salva os parâmetros gerais do aplicativo.
 */
async function saveAppSettings() {
  const settings = {
    searchRadius:
      parseInt(document.getElementById("setting-search-radius").value) || 10,
    motd: {
      message: document.getElementById("setting-motd").value,
      enabled: document.getElementById("setting-motd-enabled").checked,
    },
  };

  const settingsRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("config")
    .doc("app_settings");
  await settingsRef.set(settings, { merge: true });
  alert("Parâmetros do aplicativo salvos com sucesso!");
}

/**
 * Salva as configurações de modo manutenção.
 */
async function saveMaintenanceSettings() {
  const settings = {
    maintenance: {
      message: document.getElementById("setting-maintenance-message").value,
      enabled: document.getElementById("setting-maintenance-enabled").checked,
    },
  };

  const settingsRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("config")
    .doc("app_settings");
  await settingsRef.set(settings, { merge: true });
  alert("Configurações de manutenção salvas com sucesso!");
}

/**
 * Adiciona um novo UID à lista de administradores.
 */
async function addAdmin() {
  const newAdminUid = document
    .getElementById("setting-new-admin-uid")
    .value.trim();
  if (!newAdminUid) return alert("Por favor, insira um UID.");

  const settingsRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("config")
    .doc("app_settings");
  await settingsRef.update({
    adminUids: firebase.firestore.FieldValue.arrayUnion(newAdminUid),
  });

  alert("Administrador adicionado com sucesso!");
  loadAppSettings(); // Recarrega a lista
}

/**
 * Remove um UID da lista de administradores.
 * @param {string} uidToRemove - O UID a ser removido.
 */
window.removeAdmin = async function (uidToRemove) {
  if (
    !confirm(`Tem certeza que deseja remover o admin com UID: ${uidToRemove}?`)
  )
    return;

  const settingsRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("config")
    .doc("app_settings");
  await settingsRef.update({
    adminUids: firebase.firestore.FieldValue.arrayRemove(uidToRemove),
  });

  alert("Administrador removido com sucesso!");
  loadAppSettings(); // Recarrega a lista
};

// =================================================================================
// ASSISTENTE GRAXA - BASE DE CONHECIMENTO (KB)
// =================================================================================

/**
 * Inicializa a view de gerenciamento da Base de Conhecimento da Graxa.
 */
function initGraxaKbView() {
  listenForKbUpdates();

  const form = document.getElementById("kb-form");
  form.addEventListener("submit", saveKbEntry);

  const cancelButton = document.getElementById("kb-form-cancel");
  cancelButton.addEventListener("click", resetKbForm);

  // **NOVO**: Lógica para o upload de JSON
  const uploadBtn = document.getElementById("kb-upload-btn");
  const fileInput = document.getElementById("kb-json-upload");

  uploadBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleKbJsonUpload);

  const clearAllBtn = document.getElementById("kb-clear-all-btn");
  clearAllBtn.addEventListener("click", clearAllKbEntries);
}

/**
 * Ouve por atualizações na coleção da base de conhecimento e renderiza a tabela.
 */
function listenForKbUpdates() {
  db.collection("graxa_kb")
    .orderBy("question")
    .onSnapshot((snapshot) => {
      const tableBody = document.getElementById("kb-table-body");
      if (snapshot.empty) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-gray-400">Nenhum conhecimento cadastrado.</td></tr>`;
        return;
      }
      tableBody.innerHTML = snapshot.docs
        .map((doc) => {
          const entry = doc.data();
          return `
          <tr class="text-sm text-gray-700 border-b">
            <td class="p-3 font-medium">${entry.question}</td>
            <td class="p-3 font-mono text-xs">${entry.source || "geral"}</td>
            <td class="p-3 text-xs text-gray-500">${entry.keywords}</td>
            <td class="p-3 flex items-center space-x-2">
              <button onclick="editKbEntry('${
                doc.id
              }')" class="text-blue-600 hover:text-blue-800"><i data-lucide="edit" class="w-4 h-4"></i></button>
              <button onclick="deleteKbEntry('${
                doc.id
              }')" class="text-red-600 hover:text-red-800"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
          </tr>
        `;
        })
        .join("");
      lucide.createIcons();
    });
}

/**
 * Salva ou atualiza uma entrada na base de conhecimento.
 * @param {Event} e - O evento de submit do formulário.
 */
async function saveKbEntry(e) {
  e.preventDefault();
  const docId = document.getElementById("kb-doc-id").value;
  const entryData = {
    question: document.getElementById("kb-question").value,
    answer: document.getElementById("kb-answer").value,
    keywords: document.getElementById("kb-keywords").value,
    source: "manual", // Fonte padrão para edições/criações manuais
  };

  const collectionRef = db.collection("graxa_kb");

  try {
    if (docId) {
      // Atualiza um documento existente
      await collectionRef.doc(docId).update(entryData);
      alert("Conhecimento atualizado com sucesso!");
    } else {
      // Adiciona um novo documento
      await collectionRef.add(entryData);
      alert("Novo conhecimento adicionado com sucesso!");
    }
    resetKbForm();
  } catch (error) {
    console.error("Erro ao salvar conhecimento:", error);
    alert("Ocorreu um erro ao salvar: " + error.message);
  }
}

/**
 * Preenche o formulário para editar uma entrada existente.
 * @param {string} docId - O ID do documento a ser editado.
 */
async function editKbEntry(docId) {
  const doc = await db.collection("graxa_kb").doc(docId).get();
  if (!doc.exists) return alert("Erro: Documento não encontrado.");

  const data = doc.data();
  document.getElementById("kb-doc-id").value = doc.id;
  document.getElementById("kb-question").value = data.question;
  document.getElementById("kb-answer").value = data.answer;
  document.getElementById("kb-keywords").value = data.keywords;

  document.getElementById("kb-form-title").textContent = "Editar Conhecimento";
  document.getElementById("kb-form-cancel").classList.remove("hidden");
  window.scrollTo(0, 0); // Rola para o topo para ver o formulário
}

/**
 * Apaga uma entrada da base de conhecimento.
 * @param {string} docId - O ID do documento a ser apagado.
 */
async function deleteKbEntry(docId) {
  if (!confirm("Tem certeza que deseja apagar este conhecimento?")) return;
  await db.collection("graxa_kb").doc(docId).delete();
  alert("Conhecimento apagado com sucesso.");
}

/**
 * Reseta o formulário da base de conhecimento para o modo de adição.
 */
function resetKbForm() {
  document.getElementById("kb-form").reset();
  document.getElementById("kb-doc-id").value = "";
  document.getElementById("kb-form-title").textContent =
    "Adicionar Novo Conhecimento";
  document.getElementById("kb-form-cancel").classList.add("hidden");
}

/**
 * Lida com o upload de um arquivo JSON para a base de conhecimento.
 * @param {Event} event - O evento de change do input de arquivo.
 */
async function handleKbJsonUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsedJson = JSON.parse(e.target.result);
      if (!Array.isArray(parsedJson)) {
        throw new Error(
          "Formato de JSON inválido. O arquivo deve conter um array de objetos."
        );
      }

      // **NOVO: Lógica Anti-Duplicatas**
      // 1. Busca todas as perguntas existentes no banco de dados
      const existingKbSnap = await db.collection("graxa_kb").get();
      const existingQuestions = new Set(
        existingKbSnap.docs.map((doc) => doc.data().question)
      );

      // 2. Filtra as entradas do arquivo, mantendo apenas as que não existem
      const newEntries = parsedJson.filter(
        (entry) => !existingQuestions.has(entry.question)
      );

      const skippedCount = entriesFromFile.length - newEntries.length;

      if (newEntries.length === 0) {
        return alert(
          `Nenhum conhecimento novo para importar. ${skippedCount} conhecimento(s) já existente(s) foram ignorados.`
        );
      }

      // 3. Valida os campos das novas entradas
      let validEntries = newEntries.filter(
        (entry) => entry.question && entry.answer && entry.keywords
      );

      // **NOVO**: Pergunta pela fonte do conhecimento
      const defaultFileName = file.name.replace(".json", "").replace(/_/g, "-");
      const source =
        prompt(
          "Qual a 'fonte' deste conhecimento? (Ex: manual-cg-160, leis-transito, geral)",
          defaultFileName
        ) || "importado";

      // Adiciona a fonte a cada entrada válida
      validEntries = validEntries.map((entry) => ({ ...entry, source }));

      if (
        !confirm(
          `Foram encontrados ${validEntries.length} conhecimentos válidos no arquivo para a fonte '${source}'. Deseja importá-los?` +
            (skippedCount > 0
              ? `\n(${skippedCount} duplicados foram ignorados)`
              : "")
        )
      ) {
        event.target.value = null; // Limpa o input
        return;
      }

      const batch = db.batch();
      const collectionRef = db.collection("graxa_kb");

      validEntries.forEach((entry) => {
        const docRef = collectionRef.doc(); // Cria um novo documento com ID automático
        batch.set(docRef, entry);
      });

      await batch.commit();
      alert(
        `${validEntries.length} conhecimentos da fonte '${source}' foram importados com sucesso! ${skippedCount} duplicados foram ignorados.`
      );
    } catch (error) {
      console.error("Erro ao importar JSON:", error);
      alert("Erro ao processar o arquivo JSON: " + error.message);
    } finally {
      // Limpa o input para permitir o upload do mesmo arquivo novamente
      event.target.value = null;
    }
  };
  reader.readAsText(file);
}

/**
 * **NOVO**: Apaga todos os documentos da coleção da base de conhecimento.
 */
async function clearAllKbEntries() {
  if (
    !confirm(
      "ATENÇÃO: Esta ação é IRREVERSÍVEL e apagará TODA a base de conhecimento da assistente Graxa. Deseja continuar?"
    )
  ) {
    return;
  }

  try {
    const snapshot = await db.collection("graxa_kb").get();
    if (snapshot.empty) {
      return alert("A base de conhecimento já está vazia.");
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    alert(`Sucesso! ${snapshot.size} conhecimentos foram apagados.`);
  } catch (error) {
    alert("Erro ao limpar a base de conhecimento: " + error.message);
  }
}

// =================================================================================
// GERADOR DE CONHECIMENTO (KB)
// =================================================================================

const KB_TEMPLATES = [
  {
    id: "oleo",
    q: "Qual o óleo recomendado para a {moto}?",
    a: "<p>Para a <b>{moto}</b>, recomenda-se verificar o manual do proprietário.</p><p>Geralmente, motos Honda usam <b>10W30 Semissintético</b> e Yamaha <b>10W40 Semissintético</b> (Yamalube).</p><p>Troque a cada 1.000km em uso severo (entregas).</p>",
    k: "oleo, {moto}, motor, lubrificante",
  },
  {
    id: "pneu",
    q: "Qual a calibragem do pneu da {moto}?",
    a: "<p>Manter a calibração da <b>{moto}</b> correta economiza combustível.</p><ul><li><b>Dianteiro:</b> 25 a 28 PSI (verifique no protetor de corrente).</li><li><b>Traseiro:</b> 29 PSI (só) ou 33 PSI (com carga).</li></ul>",
    k: "pneu, calibragem, libras, ar, {moto}",
  },
  {
    id: "partida",
    q: "A {moto} não está ligando, o que fazer?",
    a: "<p>Problemas de partida na <b>{moto}</b>?</p><ol><li>Verifique o botão corta-corrente (vermelho).</li><li>Veja se o descanso lateral está recolhido.</li><li>Cheque se a bateria tem carga (buzina forte?).</li></ol>",
    k: "partida, eletrica, bateria, defeito, {moto}",
  },
  {
    id: "corrente",
    q: "De quanto em quanto tempo estico a corrente da {moto}?",
    a: "<p>Na <b>{moto}</b>, verifique a folga da corrente semanalmente.</p><p>A folga deve ser entre 2,0 e 3,0 cm. Lubrifique sempre que ajustar.</p>",
    k: "corrente, relacao, folga, {moto}",
  },
  {
    id: "vela",
    q: "Qual a vela de ignição da {moto}?",
    a: "<p>A vela da <b>{moto}</b> deve ser trocada a cada 10.000km ou 12.000km para garantir economia e desempenho.</p>",
    k: "vela, ignicao, falhando, {moto}",
  },
  {
    id: "consumo",
    q: "Quanto consome uma {moto} por litro?",
    a: "<p>O consumo da <b>{moto}</b> varia com a mão do piloto.</p><p>Em média, no trabalho de entrega, ela deve fazer entre 30km/l e 40km/l. Se fizer menos que 25km/l, revise filtro de ar e injeção.</p>",
    k: "consumo, gasolina, km/l, economia, {moto}",
  },
];

function initGraxaGeneratorView() {
  const templatesContainer = document.getElementById(
    "generator-templates-list"
  );
  templatesContainer.innerHTML = KB_TEMPLATES.map(
    (tpl) => `
        <label class="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <input type="checkbox" data-template-id="${tpl.id}" class="generator-template-check h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked>
            <span class="text-sm">${tpl.q}</span>
        </label>
    `
  ).join("");

  document.getElementById("generate-and-import-btn").onclick =
    generateAndImportKb;
}

async function generateAndImportKb() {
  const logEl = document.getElementById("generator-log");
  const motosText = document.getElementById("generator-motos-list").value;
  const motos = motosText
    .split("\n")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);

  const selectedTemplateIds = Array.from(
    document.querySelectorAll(".generator-template-check:checked")
  ).map((chk) => chk.dataset.templateId);
  const selectedTemplates = KB_TEMPLATES.filter((tpl) =>
    selectedTemplateIds.includes(tpl.id)
  );

  if (motos.length === 0 || selectedTemplates.length === 0) {
    return alert(
      "Por favor, insira pelo menos uma moto e selecione pelo menos um modelo de pergunta."
    );
  }

  const generatedEntries = [];
  motos.forEach((moto) => {
    selectedTemplates.forEach((tpl) => {
      const cleanMotoKeywords = moto.toLowerCase().replace(/ /g, ", ");
      generatedEntries.push({
        question: tpl.q.replace(/{moto}/g, moto),
        answer: tpl.a.replace(/{moto}/g, moto),
        keywords: tpl.k.replace(/{moto}/g, cleanMotoKeywords),
      });
    });
  });

  logEl.textContent = `Gerados ${generatedEntries.length} conhecimentos.\n`;
  if (
    !confirm(
      `Você está prestes a adicionar ${generatedEntries.length} novos conhecimentos à base da Graxa. Deseja continuar?`
    )
  ) {
    logEl.textContent += "Operação cancelada pelo usuário.";
    return;
  }

  logEl.textContent += "Iniciando importação para o Firestore...\n";
  const batch = db.batch();
  const collectionRef = db.collection("graxa_kb");
  generatedEntries.forEach((entry) => {
    const docRef = collectionRef.doc();
    batch.set(docRef, entry);
  });

  try {
    await batch.commit();
    logEl.textContent += `✅ Sucesso! ${generatedEntries.length} conhecimentos importados.`;
    alert("Importação concluída com sucesso!");
  } catch (error) {
    logEl.textContent += `❌ Erro na importação: ${error.message}`;
    alert("Ocorreu um erro durante a importação.");
  }
}
