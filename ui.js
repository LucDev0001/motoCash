import {
  loadDashboardData,
  allLoadedItems,
  currentStats,
  listenForMarketplaceItems,
  getOnlineMotoboys,
} from "./api.js";
import { currentUser } from "./auth.js";
import { auth, db, appId } from "./config.js";
let currentChart = null;
let unsubscribeListeners = [];
export let currentPeriod = "week";
export let currentShiftFilter = "all"; // 'all', 'dia', 'noite'
export let customRange = { start: null, end: null };

// --- ROUTER ---
export function router(view) {
  unsubscribeListeners.forEach((u) => u());
  unsubscribeListeners = [];
  const content = document.getElementById("content-area");
  const title = document.getElementById("page-title");
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.remove("text-yellow-600", "font-bold");
    b.classList.add("text-gray-400");
  });

  if (view === "dashboard") {
    const userName = currentUser.displayName?.split(" ")[0] || "Usuário";
    title.innerText = `Olá, ${userName}`;
    document
      .getElementById("nav-dashboard")
      .classList.add("text-yellow-600", "font-bold");
    renderDashboard(content);
  } else if (view === "hub") {
    title.innerText = "FreelancerMoto";
    document
      .getElementById("nav-hub")
      .classList.add("text-yellow-600", "font-bold");
    renderHub(content);
  } else if (view === "finance") {
    title.innerText = "Adicionar Ganho  ou  Despesas";
    renderAddFinance(content);
  } else if (view === "market") {
    title.innerText = "Classificados";
    document
      .getElementById("nav-market")
      .classList.add("text-yellow-600", "font-bold");
    renderMarketplace(content);
  } else if (view === "market-add") {
    title.innerText = "Criar Anúncio";
    renderAddMarketItem(content);
  } else if (view === "profile") {
    title.innerText = "Perfil";
    document
      .getElementById("nav-profile")
      .classList.add("text-yellow-600", "font-bold");
    renderProfile(content);
  } else if (view === "about") {
    title.innerText = "Sobre o AppMotoCash";
    renderAbout(content);
  } else if (view === "privacy") {
    title.innerText = "Política de Privacidade";
    renderPrivacyPolicy(content);
  } else if (view === "support") {
    title.innerText = "Suporte e Tutoriais";
    renderSupport(content);
  } else if (view === "notifications") {
    title.innerText = "Notificações";
    // Não precisa de botão ativo na barra de navegação
    renderNotifications(content);
  }
  setTimeout(() => lucide.createIcons(), 100);
}

// --- DASHBOARD UI ---
function renderDashboard(c) {
  c.innerHTML = `
        <div class="space-y-4 fade-in pb-10">
            <div class="flex flex-col space-y-2">
                <div class="flex bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm overflow-x-auto">
                    <button onclick="filterDashboard('day')" class="filter-btn px-3 py-2 text-xs font-bold uppercase rounded text-gray-500 whitespace-nowrap" id="filter-day">Hoje</button>
                    <button onclick="filterDashboard('week')" class="filter-btn px-3 py-2 text-xs font-bold uppercase rounded bg-gray-900 dark:bg-yellow-500 dark:text-black text-white whitespace-nowrap" id="filter-week">Esta Semana</button>
                    <button onclick="filterDashboard('last-week')" class="filter-btn px-3 py-2 text-xs font-bold uppercase rounded text-gray-500 whitespace-nowrap" id="filter-last-week">Semana Passada</button>
                    <button onclick="filterDashboard('month')" class="filter-btn px-3 py-2 text-xs font-bold uppercase rounded text-gray-500 whitespace-nowrap" id="filter-month">Este Mês</button>
                    <button onclick="filterDashboard('last-month')" class="filter-btn px-3 py-2 text-xs font-bold uppercase rounded text-gray-500 whitespace-nowrap" id="filter-last-month">Mês Passado</button>
                    <button onclick="toggleCustomPicker()" class="filter-btn px-3 py-2 text-xs font-bold uppercase rounded text-gray-500 whitespace-nowrap border-l border-gray-100" id="filter-custom">Personalizado</button>
                </div>
                <div id="custom-date-picker" class="hidden bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex gap-2 items-end">
                    <div class="flex-1"><label class="text-[10px] font-bold text-gray-500 dark:text-gray-400">Início</label><input type="date" id="custom-start" class="w-full p-1 border dark:bg-gray-700 dark:border-gray-600 rounded text-sm"></div>
                    <div class="flex-1"><label class="text-[10px] font-bold text-gray-500 dark:text-gray-400">Fim</label><input type="date" id="custom-end" class="w-full p-1 border dark:bg-gray-700 dark:border-gray-600 rounded text-sm"></div>
                    <button onclick="applyCustomFilter()" class="bg-gray-900 dark:bg-yellow-500 dark:text-black text-white p-2 rounded hover:bg-gray-700 h-8 flex items-center"><i data-lucide="check" class="w-4 h-4"></i></button>
                </div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex flex-col relative overflow-hidden">
                <button onclick="openShareModal()" class="absolute top-4 right-4 text-green-600 bg-green-50 dark:bg-green-900/50 dark:text-green-400 p-2 rounded-full z-10">
                    <i data-lucide="share-2" class="w-5 h-5"></i>
                </button>
                <div class="text-center"><h2 class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1" id="period-label">Esta Semana</h2><p class="text-4xl font-bold text-gray-900 dark:text-white" id="balance-value">R$ 0.00</p><p class="text-sm text-green-600 mt-1 font-semibold" id="balance-label">Saldo no período</p></div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 p-4 rounded-xl shadow-sm text-center"><p class="text-xs text-green-800 dark:text-green-300 font-bold uppercase">Ganhos</p><p class="text-2xl font-bold text-green-700 dark:text-green-400" id="total-earnings">R$ 0.00</p></div>
                <div class="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 p-4 rounded-xl shadow-sm text-center"><p class="text-xs text-red-800 dark:text-red-300 font-bold uppercase">Despesas</p><p class="text-2xl font-bold text-red-700 dark:text-red-400" id="total-expenses">R$ 0.00</p></div>
            </div>
            <div id="goal-progress-container" class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 hidden">
                <div class="flex justify-between items-center mb-1">
                    <h3 class="font-bold text-gray-800 dark:text-gray-200 text-sm">Progresso da Meta Semanal</h3><span id="goal-percentage" class="text-sm font-bold text-green-600 dark:text-green-400">0%</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5"><div id="goal-progress-bar" class="bg-green-600 h-2.5 rounded-full" style="width: 0%"></div></div>
                <div id="goal-values" class="text-xs text-gray-500 dark:text-gray-400 text-right mt-1">R$ 0,00 / R$ 0,00</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col">
                    <h3 class="font-bold text-gray-800 dark:text-gray-200 mb-2 text-sm">Resumo de Ganhos</h3>
                    <div class="w-full border-t border-gray-100 dark:border-gray-700 mb-2"></div>
                    <div class="grid grid-cols-3 gap-2">
                        <div class="bg-red-50 dark:bg-red-900/50 p-2 rounded-lg border border-red-100 dark:border-red-800 flex flex-col justify-between h-24"><p class="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase border-b border-red-200 dark:border-red-700 pb-1 mb-1">Loja Fixa</p><div class="flex flex-col gap-0.5"><div class="flex justify-between text-[9px] text-gray-600 dark:text-gray-400"><span>Diárias:</span><span class="font-bold" id="lbl-loja-daily">R$0</span></div><div class="flex justify-between text-[9px] text-gray-600 dark:text-gray-400"><span>Entregas:</span><span class="font-bold" id="lbl-loja-qtd">0</span></div></div><p class="text-xs font-bold text-gray-900 dark:text-gray-200 text-right mt-1" id="lbl-loja-total">R$ 0</p></div>
                        <div class="bg-blue-50 dark:bg-blue-900/50 p-2 rounded-lg border border-blue-100 dark:border-blue-800 flex flex-col justify-between h-24"><p class="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase border-b border-blue-200 dark:border-blue-700 pb-1 mb-1">Uber/99</p><div class="flex flex-col gap-0.5 mt-2"><div class="flex justify-between text-[9px] text-gray-600 dark:text-gray-400"><span>Corridas:</span><span class="font-bold" id="lbl-pass-qtd">0</span></div></div><p class="text-xs font-bold text-gray-900 dark:text-gray-200 text-right mt-auto" id="lbl-pass-total">R$ 0</p></div>
                        <div class="bg-yellow-50 dark:bg-yellow-900/50 p-2 rounded-lg border border-yellow-100 dark:border-yellow-800 flex flex-col justify-between h-24"><p class="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase border-b border-yellow-200 dark:border-yellow-700 pb-1 mb-1">iFood</p><div class="flex flex-col gap-0.5 mt-2"><div class="flex justify-between text-[9px] text-gray-600 dark:text-gray-400"><span>Entregas:</span><span class="font-bold" id="lbl-deliv-qtd">0</span></div></div><p class="text-xs font-bold text-gray-900 dark:text-gray-200 text-right mt-auto" id="lbl-deliv-total">R$ 0</p></div>
                    </div>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col">
                    <h3 class="font-bold text-gray-800 dark:text-gray-200 mb-2 text-sm">Resumo de Despesas</h3>
                    <div class="w-full border-t border-gray-100 dark:border-gray-700 mb-2"></div>
                    <div class="space-y-1 text-xs">
                        <div class="flex justify-between items-center"><span class="text-gray-600 dark:text-gray-400">Combustível</span><span class="font-bold text-gray-800 dark:text-gray-200" id="exp-cat-combustivel">R$ 0.00</span></div>
                        <div class="flex justify-between items-center"><span class="text-gray-600 dark:text-gray-400">Manutenção</span><span class="font-bold text-gray-800 dark:text-gray-200" id="exp-cat-manutencao">R$ 0.00</span></div>
                        <div class="flex justify-between items-center"><span class="text-gray-600 dark:text-gray-400">Peças/Acessórios</span><span class="font-bold text-gray-800 dark:text-gray-200" id="exp-cat-pecas">R$ 0.00</span></div>
                        <div class="flex justify-between items-center"><span class="text-gray-600 dark:text-gray-400">Alimentação</span><span class="font-bold text-gray-800 dark:text-gray-200" id="exp-cat-alimentacao">R$ 0.00</span></div>
                        <div class="flex justify-between items-center"><span class="text-gray-600 dark:text-gray-400">Outros</span><span class="font-bold text-gray-800 dark:text-gray-200" id="exp-cat-outros">R$ 0.00</span></div>
                    </div>
                </div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 h-64 flex justify-center items-center relative"><canvas id="lineChart"></canvas></div>
            <div class="space-y-2" id="history-list"><p class="text-center text-gray-400 py-4">Carregando...</p></div>
        </div>`;

  // Mostra o spinner de carregamento
  const loadingOverlay = document.getElementById("loading-overlay");
  if (loadingOverlay) {
    loadingOverlay.classList.remove("hidden");
    loadingOverlay.classList.add("flex");
  }

  const unsub = loadDashboardData("week", updateDashboardUI);
  unsubscribeListeners.push(unsub);
}

/**
 * Formata uma data para exibir o dia da semana abreviado e a data (DD/MM).
 * Ex: new Date() -> "Qua, 17/07"
 * @param {Date} dateObject - O objeto de data a ser formatado.
 * @returns {string} A data formatada.
 */
function formatShortDateWithWeekday(dateObject) {
  if (!(dateObject instanceof Date) || isNaN(dateObject)) {
    return "Data inválida";
  }
  const options = { weekday: "short", day: "2-digit", month: "2-digit" };
  let formatted = new Intl.DateTimeFormat("pt-BR", options).format(dateObject);
  return formatted.replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
}

export function updateDashboardUI(stats, allItems, lineChartData, monthlyGoal) {
  // Esconde o spinner de carregamento assim que os dados chegam
  document.getElementById("loading-overlay")?.classList.add("hidden");

  if (!document.getElementById("balance-value")) return;

  const balance = stats.earnings.total - stats.expenses.total;
  const balanceColor = balance >= 0 ? "text-green-600" : "text-red-600";
  const balanceValueEl = document.getElementById("balance-value");

  balanceValueEl.innerText = `R$ ${balance.toFixed(2)}`;
  balanceValueEl.className = `text-4xl font-bold ${balanceColor}`;

  document.getElementById(
    "total-earnings"
  ).innerText = `R$ ${stats.earnings.total.toFixed(2)}`;
  document.getElementById(
    "total-expenses"
  ).innerText = `R$ ${stats.expenses.total.toFixed(2)}`;

  // Ganhos
  document.getElementById(
    "lbl-loja-daily"
  ).innerText = `R$${stats.earnings.loja.dailySum.toFixed(0)}`;
  document.getElementById("lbl-loja-qtd").innerText =
    stats.earnings.loja.deliveries;
  document.getElementById(
    "lbl-loja-total"
  ).innerText = `R$ ${stats.earnings.loja.val.toFixed(2)}`;
  document.getElementById("lbl-pass-qtd").innerText = stats.earnings.pass.runs;
  document.getElementById(
    "lbl-pass-total"
  ).innerText = `R$ ${stats.earnings.pass.val.toFixed(2)}`;
  document.getElementById("lbl-deliv-qtd").innerText =
    stats.earnings.deliv.deliveries;
  document.getElementById(
    "lbl-deliv-total"
  ).innerText = `R$ ${stats.earnings.deliv.val.toFixed(2)}`;

  // Despesas
  const expCategories = stats.expenses.categories;
  document.getElementById(
    "exp-cat-combustivel"
  ).innerText = `R$ ${expCategories.combustivel.toFixed(2)}`;
  document.getElementById(
    "exp-cat-manutencao"
  ).innerText = `R$ ${expCategories.manutencao.toFixed(2)}`;
  document.getElementById(
    "exp-cat-pecas"
  ).innerText = `R$ ${expCategories.pecas.toFixed(2)}`;
  document.getElementById(
    "exp-cat-alimentacao"
  ).innerText = `R$ ${expCategories.alimentacao.toFixed(2)}`;
  document.getElementById(
    "exp-cat-outros"
  ).innerText = `R$ ${expCategories.outros.toFixed(2)}`;

  // Meta Semanal
  const goalContainer = document.getElementById("goal-progress-container");
  if (monthlyGoal && monthlyGoal > 0) {
    goalContainer.classList.remove("hidden");
    const earningsThisMonth = stats.earnings.total; // Assumindo que o filtro 'month' está correto
    const percentage = Math.min((earningsThisMonth / monthlyGoal) * 100, 100);

    document.getElementById("goal-progress-bar").style.width = `${percentage}%`;
    document.getElementById("goal-percentage").innerText = `${Math.floor(
      percentage
    )}%`;
    document.getElementById(
      "goal-values"
    ).innerText = `R$ ${earningsThisMonth.toFixed(
      2
    )} / R$ ${monthlyGoal.toFixed(2)}`;
  } else {
    goalContainer.classList.add("hidden");
  }

  // Histórico
  document.getElementById("history-list").innerHTML =
    allItems
      .slice(0, 30)
      .map((i) => {
        const isExpense = i.type === "expense";
        const borderColor = isExpense ? "border-red-500" : "border-green-500";
        const valueColor = isExpense ? "text-red-600" : "text-green-600";
        const sign = isExpense ? "-" : "+";
        const title = isExpense
          ? i.category.charAt(0).toUpperCase() + i.category.slice(1)
          : i.category === "loja_fixa"
          ? "Loja Fixa"
          : i.category === "app_passageiro"
          ? "Uber/99 Moto"
          : "iFood/Entregas";

        let shiftIcon = "";
        if (i.shift === "dia") {
          shiftIcon = `<i data-lucide="sun" class="w-3 h-3 text-yellow-500"></i>`;
        } else if (i.shift === "noite") {
          shiftIcon = `<i data-lucide="moon" class="w-3 h-3 text-blue-400"></i>`;
        }

        return `
            <div class="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border-l-4 ${borderColor} mb-2 flex justify-between items-center group">
                <div class="flex-1">
                    <p class="font-bold text-sm text-gray-800 dark:text-gray-200">${title}</p>
                    <div class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                      <span>${formatShortDateWithWeekday(
                        new Date(i.date + "T00:00:00")
                      )}</span>
                      ${shiftIcon ? `<span>${shiftIcon}</span>` : ""}
                    </div>
                    ${
                      i.observation
                        ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${i.observation}</p>`
                        : ""
                    }
                    <div class="text-xs text-gray-500 mt-1 flex items-center gap-3">
                        ${
                          i.type === "earning" &&
                          i.category === "loja_fixa" &&
                          i.details
                            ? `<span>Diária: <strong>R$${
                                i.details.daily || 0
                              }</strong></span> <span>Entregas: <strong>${
                                i.details.count || 0
                              }</strong></span>`
                            : ""
                        }
                        ${
                          i.type === "earning" &&
                          (i.category === "app_passageiro" ||
                            i.category === "app_entrega")
                            ? `<span>Qtd: <strong>${
                                i.count || 0
                              }</strong></span>`
                            : ""
                        }
                    </div>
                </div>
                <div class="text-right mr-3">
                    <p class="font-bold ${valueColor}">${sign} R$ ${parseFloat(
          i.totalValue
        ).toFixed(2)}</p>
                </div>
                <div class="flex gap-1">
                    <button onclick="openEditModal('${i.id}', '${
          i.type
        }')" class="bg-gray-100 p-2 rounded text-blue-500">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteItem('${i.id}', '${
          i.type
        }')" class="bg-gray-100 p-2 rounded text-red-500">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>`;
      })
      .join("") ||
    '<p class="text-center text-gray-400 text-sm">Sem dados.</p>';

  // Gráfico
  if (currentChart) currentChart.destroy();
  const ctx = document.getElementById("lineChart");
  if (ctx && lineChartData.data.length > 0) {
    const gradient = ctx
      .getContext("2d")
      .createLinearGradient(0, 0, 0, ctx.height);
    const isDark = document.documentElement.classList.contains("dark");
    const chartBorderColor = isDark ? "#22c55e" : "#16A34A"; // green-500 vs green-600
    gradient.addColorStop(
      0,
      isDark ? "rgba(34, 197, 94, 0.4)" : "rgba(22, 163, 74, 0.5)"
    );
    gradient.addColorStop(1, "rgba(22, 163, 74, 0)");

    currentChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: lineChartData.labels,
        datasets: [
          {
            label: "Saldo Acumulado",
            data: lineChartData.data,
            borderColor: chartBorderColor,
            backgroundColor: gradient,
            borderWidth: 3,
            pointBackgroundColor: chartBorderColor,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4, // Linha suave
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
            labels: { color: isDark ? "#d1d5db" : "#374151" },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || "";
                if (label) {
                  label += ": ";
                }
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(context.parsed.y);
                }
                return label;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: { color: isDark ? "#9ca3af" : "#6b7281" },
            grid: {
              color: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            },
          },
          x: {
            ticks: { color: isDark ? "#9ca3af" : "#6b7281" },
            grid: { display: false },
          },
        },
      },
    });
  }
  lucide.createIcons();
}

export function filterDashboard(p) {
  document.getElementById("custom-date-picker").classList.add("hidden");
  document
    .querySelectorAll(".filter-btn")
    .forEach(
      (b) =>
        (b.className =
          "filter-btn px-3 py-2 text-xs font-bold uppercase rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap")
    );
  document.getElementById(`filter-${p}`).className =
    "filter-btn px-3 py-2 text-xs font-bold uppercase rounded bg-gray-900 dark:bg-yellow-500 dark:text-black text-white whitespace-nowrap";
  currentPeriod = p;
  const labels = {
    day: "Hoje",
    week: "Esta Semana",
    "last-week": "Semana Passada", // Adicionado
    month: "Este Mês",
    "last-month": "Mês Passado",
  };
  document.getElementById("period-label").innerText =
    labels[p] || "Personalizado";
  const unsub = loadDashboardData(p, updateDashboardUI); // A função já passa os 3 parâmetros
  unsubscribeListeners.push(unsub);
}

export function filterByShift(shift) {
  currentShiftFilter = shift;

  // Atualiza a aparência dos botões de turno
  document.querySelectorAll(".shift-filter-btn").forEach((btn) => {
    btn.classList.remove(
      "bg-gray-900",
      "dark:bg-yellow-500",
      "dark:text-black",
      "text-white"
    );
    btn.classList.add("text-gray-500");
  });

  const activeBtn = document.getElementById(`shift-filter-${shift}`);
  activeBtn.classList.add(
    "bg-gray-900",
    "dark:bg-yellow-500",
    "dark:text-black",
    "text-white"
  );
  activeBtn.classList.remove("text-gray-500");

  // Recarrega os dados do dashboard com o período atual e o novo filtro de turno
  const unsub = loadDashboardData(currentPeriod, updateDashboardUI);
  unsubscribeListeners.push(unsub);
}

export function toggleCustomPicker() {
  document.getElementById("custom-date-picker").classList.toggle("hidden");
}

export function applyCustomFilter() {
  const s = document.getElementById("custom-start").value,
    e = document.getElementById("custom-end").value;
  if (!s || !e)
    return showNotification("Selecione as datas de início e fim.", "Atenção");
  customRange = {
    start: new Date(s + "T00:00:00"),
    end: new Date(e + "T23:59:59"),
  };
  document.getElementById("custom-date-picker").classList.add("hidden");
  currentPeriod = "custom";
  document.getElementById("period-label").innerText = `${new Date(
    s + "T00:00:00"
  ).toLocaleDateString()} - ${new Date(e + "T00:00:00").toLocaleDateString()}`;
  const unsub = loadDashboardData("custom", updateDashboardUI); // A função já passa os 3 parâmetros
  unsubscribeListeners.push(unsub);
}

// --- MODAL/ACTIONS UI ---
export function openEditModal(id, type) {
  const item = allLoadedItems.find((i) => i.id === id);
  if (!item) return;

  const modalTitle = document.querySelector("#edit-modal h3");
  document.getElementById("edit-id").value = id;
  document.getElementById("edit-type").value = type;
  document.getElementById("edit-date").value = item.date;

  const fieldsApp = document.getElementById("edit-fields-app");
  const fieldsLoja = document.getElementById("edit-fields-loja");
  const fieldsExpense = document.getElementById("edit-fields-expense");

  // Dynamically handle required fields
  document.getElementById("edit-exp-total").required = type === "expense";

  // Reset all fields visibility
  fieldsApp.classList.add("hidden");
  fieldsLoja.classList.add("hidden");
  fieldsExpense.classList.add("hidden");

  if (type === "earning") {
    modalTitle.innerText = "Editar Ganho";
    document.getElementById("edit-category").value = item.category;

    if (item.category === "loja_fixa") {
      fieldsLoja.classList.remove("hidden");
      document.getElementById("edit-daily").value = item.details?.daily || 0;
      document.getElementById("edit-loja-count").value =
        item.details?.count || item.count || 0;
      document.getElementById("edit-fee").value = item.details?.fee || 0;
      document.getElementById("edit-extra").value = item.details?.extra || 0;
    } else {
      fieldsApp.classList.remove("hidden");
      document.getElementById("edit-total").value = item.totalValue;
      document.getElementById("edit-count").value = item.count;
    }
  } else if (type === "expense") {
    modalTitle.innerText = "Editar Despesa";
    fieldsExpense.classList.remove("hidden");
    document.getElementById("edit-exp-category").value = item.category;
    document.getElementById("edit-exp-total").value = item.totalValue;
    document.getElementById("edit-exp-desc").value = item.description || "";
  }

  document.getElementById("edit-modal").classList.remove("hidden");
}

export function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
}

export function openShareModal() {
  document.getElementById("share-modal").classList.remove("hidden");
}

export function closeShareModal() {
  document.getElementById("share-modal").classList.add("hidden");
}

export function shareCategory(type) {
  const pn = document.getElementById("period-label").innerText;
  let txt = `🏍️ *Relatório AppMotoCash - ${pn}*\n\n`;

  const earnings = currentStats.earnings;
  const expenses = currentStats.expenses;

  if (type === "earning_loja_fixa") {
    txt += `🔴 *Ganhos (Loja Fixa)*\nDiárias: R$ ${earnings.loja.dailySum.toFixed(
      2
    )}\nEntregas: ${
      earnings.loja.deliveries
    }\n💰 *Total: R$ ${earnings.loja.val.toFixed(2)}*`;
  } else if (type === "earning_app_passageiro") {
    txt += `🔵 *Ganhos (Uber/99)*\nCorridas: ${
      earnings.pass.runs
    }\n💰 *Total: R$ ${earnings.pass.val.toFixed(2)}*`;
  } else if (type === "earning_app_entrega") {
    txt += `🟡 *Ganhos (iFood/Entregas)*\nEntregas: ${
      earnings.deliv.deliveries
    }\n💰 *Total: R$ ${earnings.deliv.val.toFixed(2)}*`;
  } else if (type === "earning_total") {
    txt += `🟢 *Relatório de Ganhos*\n\n`;
    txt += `Loja Fixa: R$ ${earnings.loja.val.toFixed(2)}\n`;
    txt += `Uber/99: R$ ${earnings.pass.val.toFixed(2)}\n`;
    txt += `iFood: R$ ${earnings.deliv.val.toFixed(2)}\n\n`;
    txt += `💰 *Total de Ganhos: R$ ${earnings.total.toFixed(2)}*`;
  } else if (type === "expense_total") {
    txt += `🔴 *Relatório de Despesas*\n\n`;
    // Aqui poderíamos detalhar as despesas por categoria se quiséssemos
    txt += `💰 *Total de Despesas: R$ ${expenses.total.toFixed(2)}*`;
  } else {
    // Relatório Geral
    const balance = earnings.total - expenses.total;
    txt += `📊 *Relatório Geral*\n\n`;
    txt += `🟢 Ganhos: R$ ${earnings.total.toFixed(2)}\n`;
    txt += `🔴 Despesas: R$ ${expenses.total.toFixed(2)}\n\n`;
    txt += `💰 *Saldo Final: R$ ${balance.toFixed(2)}*`;
  }
  txt += `\n\n_Gerado via AppMotoCash_`;
  window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  closeShareModal();
}

// --- FINANCE UI ---
export function renderAddFinance(c) {
  c.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden fade-in">
            <div class="flex border-b dark:border-gray-700">
                <button onclick="setTransactionType('earning')" id="tab-earning" class="fin-tab flex-1 py-3 text-sm font-bold bg-green-100 text-green-700 border-b-2 border-green-500">Ganho</button>
                <button onclick="setTransactionType('expense')" id="tab-expense" class="fin-tab flex-1 py-3 text-sm font-bold text-gray-500">Despesa</button>
            </div>

            <!-- Formulário de Ganhos -->
            <form onsubmit="submitFinance(event)" id="form-earning" class="p-6 space-y-4">
                <input type="hidden" id="fin-category" value="app_entrega">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Data</label>
                        <input required type="date" id="fin-date-earning" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded border border-gray-200 outline-none">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Turno</label>
                        <select id="fin-shift" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded border border-gray-200 outline-none"><option value="dia">Dia</option><option value="noite">Noite</option></select>
                    </div>
                </div>
                <div class="flex border-b dark:border-gray-700">
                    <button type="button" onclick="setFinanceTab('app_entrega')" id="tab-app_entrega" class="fin-tab-inner flex-1 py-2 text-[11px] font-bold bg-yellow-100 text-yellow-700 border-b-2 border-yellow-500 px-1">iFood</button>
                    <button type="button" onclick="setFinanceTab('app_passageiro')" id="tab-app_passageiro" class="fin-tab-inner flex-1 py-2 text-[11px] font-bold text-gray-500 px-1">Uber/99</button>
                    <button type="button" onclick="setFinanceTab('loja_fixa')" id="tab-loja_fixa" class="fin-tab-inner flex-1 py-2 text-[11px] font-bold text-gray-500 px-1">Loja Fixa</button>
                </div>
                <div id="dynamic-fields">
                    <div id="fields-app">
                        <div class="mb-4"><label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Quantidade</label><input type="number" id="fin-count" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded border border-gray-200" placeholder="0"></div>
                        <div><label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Valor Total (R$)</label><input type="number" step="0.01" id="fin-total" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded border border-gray-200 text-lg font-semibold" placeholder="0.00"></div>
                    </div>
                    <div id="fields-loja" class="hidden space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div><label class="text-xs font-bold text-gray-500 dark:text-gray-400">Diária</label><input type="number" step="0.01" id="fin-daily" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded"></div>
                            <div><label class="text-xs font-bold text-gray-500 dark:text-gray-400">Qtd</label><input type="number" id="fin-loja-count" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded"></div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div><label class="text-xs font-bold text-gray-500 dark:text-gray-400">Taxa</label><input type="number" step="0.01" id="fin-fee" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded"></div>
                            <div><label class="text-xs font-bold text-gray-500 dark:text-gray-400">Extra</label><input type="number" step="0.01" id="fin-extra" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded"></div>
                        </div>
                    </div>
                </div>
                <div><label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Observação (Opcional)</label><textarea id="fin-observation" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded border border-gray-200" placeholder="Ex: Corrida com valor dinâmico"></textarea></div>
                <button id="btn-save-fin" type="submit" class="w-full bg-gray-900 text-white font-bold py-4 rounded-lg hover:bg-gray-800 shadow-lg mt-4 transition-transform active:scale-95">Salvar Ganho</button>
            </form>

            <!-- Formulário de Despesas -->
            <form onsubmit="submitExpense(event)" id="form-expense" class="p-6 space-y-4 hidden">
                <div><label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Data</label><input required type="date" id="fin-date-expense" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded border border-gray-200 outline-none"></div>
                <div><label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Categoria</label>
                    <select id="exp-category" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded border border-gray-200 outline-none">
                        <option value="combustivel">Combustível</option>
                        <option value="manutencao">Manutenção</option>
                        <option value="pecas">Peças e Acessórios</option>
                        <option value="documentacao">Documentação</option>
                        <option value="alimentacao">Alimentação</option>
                        <option value="outros">Outros</option>
                    </select>
                </div>
                <div><label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Valor (R$)</label><input required type="number" step="0.01" id="exp-total" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded border border-gray-200 text-lg font-semibold" placeholder="0.00"></div>
                <div><label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Observação (Opcional)</label><textarea id="exp-desc" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded border border-gray-200" placeholder="Ex: Troca de óleo"></textarea></div>
                <button id="btn-save-exp" type="submit" class="w-full bg-red-600 text-white font-bold py-4 rounded-lg hover:bg-red-500 shadow-lg mt-4 transition-transform active:scale-95">Salvar Despesa</button>
            </form>
        </div>`;
  document.getElementById("fin-date-earning").valueAsDate = new Date();
  document.getElementById("fin-date-expense").valueAsDate = new Date();
}

export function setTransactionType(type) {
  const formEarning = document.getElementById("form-earning");
  const formExpense = document.getElementById("form-expense");
  const tabEarning = document.getElementById("tab-earning");
  const tabExpense = document.getElementById("tab-expense");

  if (type === "earning") {
    formEarning.classList.remove("hidden");
    formExpense.classList.add("hidden");
    tabEarning.className =
      "fin-tab flex-1 py-3 text-sm font-bold bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 border-b-2 border-green-500";
    tabExpense.className =
      "fin-tab flex-1 py-3 text-sm font-bold text-gray-500 dark:text-gray-400";
  } else {
    formEarning.classList.add("hidden");
    formExpense.classList.remove("hidden");
    tabEarning.className =
      "fin-tab flex-1 py-3 text-sm font-bold text-gray-500 dark:text-gray-400";
    tabExpense.className =
      "fin-tab flex-1 py-3 text-sm font-bold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 border-b-2 border-red-500";
    // Esconde o checkbox de termos na aba de despesa (e login)
    document.getElementById("terms-container")?.classList.add("hidden");
  }
}

export function setFinanceTab(cat) {
  document.getElementById("fin-category").value = cat;
  document
    .querySelectorAll(".fin-tab-inner")
    .forEach(
      (t) =>
        (t.className =
          "fin-tab-inner flex-1 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 px-1")
    );
  document.getElementById(
    `tab-${cat}`
  ).className = `fin-tab-inner flex-1 py-2 text-[11px] font-bold border-b-2 px-1 ${
    cat === "app_entrega"
      ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 border-yellow-500"
      : cat === "app_passageiro"
      ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border-blue-500"
      : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 border-red-500"
  }`;
  if (cat === "loja_fixa") {
    document.getElementById("fields-app").classList.add("hidden");
    document.getElementById("fields-loja").classList.remove("hidden");
  } else {
    document.getElementById("fields-app").classList.remove("hidden");
    document.getElementById("fields-loja").classList.add("hidden");
  }
}

// --- MARKETPLACE UI ---
export function renderMarketplace(c) {
  c.innerHTML = `<div class="sticky top-0 bg-gray-100 dark:bg-gray-900 pt-2 pb-4 z-10 fade-in"><input onkeyup="searchMarket()" id="market-search" type="text" placeholder="Buscar..." class="w-full p-3 rounded-full shadow-sm outline-none mb-3 dark:bg-gray-800 dark:border-gray-700"><button onclick="router('market-add')" class="w-full bg-yellow-500 text-black font-bold py-3 rounded-lg shadow flex justify-center gap-2"><i data-lucide="plus-circle"></i> Criar Anúncio</button></div><div id="market-list" class="grid grid-cols-1 gap-4 fade-in"><p class="text-center text-gray-400 mt-10">Carregando...</p></div>`;
  const unsub = listenForMarketplaceItems(updateMarketplaceUI);
  unsubscribeListeners.push(unsub);
  setTimeout(() => lucide.createIcons(), 100);
}

function updateMarketplaceUI(items) {
  const listEl = document.getElementById("market-list");
  if (!listEl) return;

  listEl.innerHTML =
    items
      .map(
        (x) => ` 
        <div class="market-item bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700" data-title="${x.title.toLowerCase()}">
            ${
              x.image
                ? `<div class="h-48 bg-gray-200"><img src="${x.image}" class="w-full h-full object-cover"></div>`
                : ""
            }
            <div class="p-4">
                <h3 class="font-bold text-lg dark:text-gray-200">${x.title}</h3>
                <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-2">${
                  x.description
                }</p>
                <div class="mt-3 flex justify-between items-center">
                    <span class="text-xl font-bold text-green-600">R$ ${parseFloat(
                      x.price
                    ).toFixed(2)}</span>
                    ${
                      x.userId === currentUser.uid
                        ? `<button onclick="deleteMarketItem('${x.id}')" class="text-red-500"><i data-lucide="trash-2"></i></button>`
                        : `<a href="https://wa.me/55${
                            x.whatsapp
                          }?text=${encodeURIComponent(
                            "Olá, vi seu anúncio " + x.title
                          )}" target="_blank" class="bg-green-500 text-white px-3 py-2 rounded font-bold text-sm flex gap-1"><i data-lucide="message-circle" class="w-4"></i> Zap</a>`
                    }
                </div>
            </div>
        </div>`
      )
      .join("") || '<p class="text-center text-gray-400">Sem anúncios.</p>';
  lucide.createIcons();
}

export function renderAddMarketItem(c) {
  c.innerHTML = `<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 fade-in"><h2 class="text-xl font-bold mb-4 dark:text-gray-200">Novo Anúncio</h2><form onsubmit="submitAd(event)" class="space-y-3"><input required id="ad-title" placeholder="Título" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded"><div class="grid grid-cols-2 gap-3"><input required type="number" id="ad-price" placeholder="Preço" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded"><select id="ad-cat" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded"><option>Peças</option><option>Acessórios</option><option>Motos</option><option>Outros</option></select></div><textarea required id="ad-desc" placeholder="Descrição" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded"></textarea><input type="url" id="ad-img" placeholder="Link Imagem" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded"><input required type="tel" id="ad-zap" placeholder="WhatsApp (DDD+Num)" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded"><button type="submit" class="w-full bg-yellow-500 text-black font-bold py-3 rounded">Publicar</button></form><button onclick="router('market')" class="w-full text-gray-500 mt-3">Cancelar</button></div>`;
}

export function searchMarket() {
  const term = document.getElementById("market-search").value.toLowerCase();
  document.querySelectorAll(".market-item").forEach((el) => {
    const title = el.getAttribute("data-title");
    el.style.display = title.includes(term) ? "flex" : "none";
  });
}

// --- PROFILE UI ---
function renderProfile(c) {
  c.innerHTML = `<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center fade-in"><div class="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center"><i data-lucide="user" class="w-10 text-gray-400"></i></div><h2 class="text-xl font-bold dark:text-gray-200">${
    currentUser.displayName || currentUser.email || "User"
  }</h2><p class="text-gray-400 text-sm mb-4">ID: ${currentUser.uid.slice(
    0,
    6
  )}</p>
  <div class="text-left space-y-3 border-b dark:border-gray-700 pb-4 mb-4">
    <label class="text-xs font-bold text-gray-500 dark:text-gray-400">Nome</label>
    <input id="prof-name" value="${
      currentUser.displayName || ""
    }" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded">
    <button onclick="saveProfile()" class="w-full bg-gray-900 text-white py-3 rounded font-bold mt-2">Salvar Perfil</button>
  </div>
  <div class="text-left space-y-3">
    <div class="flex justify-between items-center">
        <label class="font-bold text-gray-500 dark:text-gray-300">Tema Escuro</label>
        <button onclick="toggleTheme()" id="theme-toggle" class="w-12 h-6 flex items-center bg-gray-300 rounded-full p-1 duration-300 ease-in-out">
            <div id="theme-toggle-dot" class="w-4 h-4 bg-white rounded-full shadow-md transform duration-300 ease-in-out"></div>
        </button>
    </div>
  </div>
  <div class="border-t dark:border-gray-700 my-4"></div>
  <div class="text-left space-y-3">
    <label class="text-xs font-bold text-gray-500 dark:text-gray-400">Meta de Ganhos Mensal (R$)</label>
    <input type="number" id="monthly-goal-input" placeholder="Ex: 3000.00" class="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border rounded">
    <button onclick="saveMonthlyGoal()" class="w-full bg-green-600 text-white py-3 rounded font-bold mt-2">Salvar Meta</button>
  </div>
  <div class="border-t dark:border-gray-700 my-4"></div>
  <div class="text-left space-y-3">
    <h3 class="font-bold text-gray-500 dark:text-gray-400 text-sm">MODO FREELANCER</h3>
    <div class="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-lg text-center">
      <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">EM BREVE</p>
    </div>
  </div>
  <div class="text-left space-y-2 mt-6">
    <button onclick="backupData()" class="w-full bg-blue-600 text-white py-3 rounded font-bold mt-4 flex items-center justify-center gap-2">
        <i data-lucide="download"></i> Fazer Backup dos Dados
    </button>
    <button onclick="document.getElementById('restore-input').click()" class="w-full bg-orange-600 text-white py-3 rounded font-bold mt-2 flex items-center justify-center gap-2">
        <i data-lucide="upload"></i> Restaurar Backup
    </button>
    <button onclick="router('about')" class="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 rounded font-bold mt-2 flex items-center justify-center gap-2">
        <i data-lucide="info"></i> Sobre o App
    </button>
    <input type="file" id="restore-input" class="hidden" accept=".json" onchange="handleFileSelect(event)">
  </div>
  <div class="border-t dark:border-gray-700 my-4"></div>
    <button onclick="logout()" class="w-full flex justify-center gap-2 text-gray-500 dark:text-gray-400 font-bold p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><i data-lucide="log-out"></i> Sair</button>
    <button onclick="deleteUserAccount()" class="w-full flex justify-center gap-2 text-red-600 font-bold p-3 mt-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50">
        <i data-lucide="trash-2"></i> Apagar Conta Permanentemente
    </button>
  </div>`;

  // Carregar a meta atual do usuário
  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get()
    .then((doc) => {
      if (doc.exists && doc.data().monthlyGoal) {
        document.getElementById("monthly-goal-input").value =
          doc.data().monthlyGoal;
      }
    });

  lucide.createIcons();
}

// --- ABOUT UI ---
function renderAbout(c) {
  const appVersion = "1.2.0"; // Você pode atualizar esta versão manualmente
  c.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center fade-in">
        <div class="bg-yellow-500 p-4 rounded-full inline-block mb-4">
          <i data-lucide="bike" class="w-12 h-12 text-black"></i>
        </div>
        <h2 class="text-2xl font-bold dark:text-white">AppMotoCash</h2>
        <p class="text-gray-500 dark:text-gray-400 mb-6">Versão ${appVersion}</p>
        
        <div class="space-y-2 text-left">
            <a href="#" onclick="router('support')" class="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
                <i data-lucide="help-circle"></i> <span>Suporte e Tutoriais</span>
            </a>
            <a href="mailto:lucianosantosseverino@gmail.com?subject=Bug%20no%20MotoManager%20v${appVersion}" class="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
                <i data-lucide="bug"></i> <span>Reportar um Bug</span>
            </a>
            <a href="mailto:lucianosantosseverino@gmail.com?subject=Sugestão%20para%20o%20MotoManager" class="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
                <i data-lucide="lightbulb"></i> <span>Sugerir Melhoria</span>
            </a>
            <a href="#" onclick="router('privacy')" class="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
                <i data-lucide="shield"></i> <span>Política de Privacidade</span>
            </a>
        </div>

        <div class="border-t dark:border-gray-700 my-6"></div>

        <div>
            <h3 class="text-lg font-bold dark:text-white mb-2">💜 Apoie o Projeto</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">Se este projeto te ajudou, considere apoiar com qualquer valor.</p>
            <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                <span class="text-gray-800 dark:text-gray-200 font-mono text-sm">11661221408 (CPF)</span>
                <button onclick="copyPixKey()" class="bg-yellow-500 text-black font-bold px-3 py-1 rounded-md text-xs flex items-center gap-1">
                    <i data-lucide="copy" class="w-3 h-3"></i> Copiar
                </button>
            </div>
        </div>

        <button onclick="router('profile')" class="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-3 rounded-lg mt-8">Voltar</button>
    </div>`;
  lucide.createIcons();
}

// --- NOTIFICATIONS PAGE UI ---
function renderNotifications(c) {
  c.innerHTML = `<div id="notifications-list" class="space-y-3 fade-in pb-10">
    <p class="text-center text-gray-400 py-10">Carregando notificações...</p>
  </div>`;

  const notificationsRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .collection("notifications")
    .orderBy("createdAt", "desc")
    .limit(50); // Limita para as 50 mais recentes

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
          // Adiciona a operação de marcar como lida ao batch
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
          <div class="flex justify-between items-start">
            <h4 class="font-bold text-gray-800 dark:text-gray-100">${
              notification.title
            }</h4>
            ${
              isUnread
                ? '<div class="w-2 h-2 bg-yellow-500 rounded-full shrink-0 mt-1.5"></div>'
                : ""
            }
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${
            notification.message
          }</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 text-right mt-3">${date}</p>
        </div>
      `;
      })
      .join("");

    // Se houver notificações não lidas, executa o batch para marcá-las como lidas
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

// --- PRIVACY POLICY UI ---
function renderPrivacyPolicy(c) {
  c.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6 fade-in text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Política de Privacidade e Termos de Uso</h2>
        <p><strong>Última atualização:</strong> ${new Date().toLocaleDateString(
          "pt-BR"
        )}</p>
        <p>Sua privacidade é importante para nós. Esta política explica como coletamos, usamos, compartilhamos e protegemos suas informações ao usar o aplicativo AppMotoCash ("Serviço"). Ao criar uma conta, você concorda com os termos aqui descritos.</p>

        <div class="space-y-2">
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">1. Informações que Coletamos</h3>
            <p><strong>a. Dados Fornecidos por Você:</strong> Coletamos as informações que você insere diretamente no aplicativo, incluindo: nome, endereço de e-mail, e todos os dados de lançamentos financeiros, como valores, datas, categorias, observações e turnos.</p>
            <p><strong>b. Dados de Uso (Anônimos):</strong> Podemos coletar informações anônimas sobre como você interage com o aplicativo, como quais funcionalidades são mais usadas. Estes dados nos ajudam a entender o uso do app e a identificar áreas para melhoria, mas não identificam você pessoalmente.</p>
        </div>

        <div class="space-y-2">
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">2. Como Usamos Suas Informações</h3>
            <p>Suas informações são usadas exclusivamente para:</p>
            <ul class="list-disc list-inside pl-4 space-y-1">
                <li>Fornecer a funcionalidade principal do aplicativo, como registrar e exibir seus dados financeiros.</li>
                <li>Calcular estatísticas, balanços e exibir gráficos sobre suas finanças.</li>
                <li>Personalizar sua experiência, como salvar seu nome e metas.</li>
                <li>Garantir a segurança da sua conta e enviar comunicações importantes, como e-mails de verificação ou redefinição de senha.</li>
                <li>Melhorar e otimizar o aplicativo com base nos dados de uso anônimos.</li>
            </ul>
        </div>

        <div class="space-y-2">
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">3. Armazenamento e Compartilhamento</h3>
            <p><strong>Nós não vendemos seus dados.</strong> Suas informações são armazenadas de forma segura nos servidores do Google Firebase, nosso provedor de infraestrutura de banco de dados e autenticação. Não compartilhamos seus dados pessoais com terceiros, exceto nas seguintes circunstâncias:</p>
            <ul class="list-disc list-inside pl-4 space-y-1">
                <li>Para cumprir uma obrigação legal ou ordem judicial.</li>
                <li>Para proteger os direitos, a propriedade ou a segurança do AppMotoCash e de seus usuários.</li>
            </ul>
        </div>

        <div class="space-y-2">
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">4. Segurança</h3>
            <p>Levamos a segurança a sério. Utilizamos as práticas de segurança fornecidas pelo Google Firebase, incluindo criptografia para dados em trânsito (HTTPS). No entanto, é importante lembrar que nenhum método de transmissão pela internet ou armazenamento eletrônico é 100% seguro.</p>
        </div>

        <div class="space-y-2">
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">5. Seus Direitos</h3>
            <p>Você tem total controle sobre seus dados. A qualquer momento, você pode:</p>
            <ul class="list-disc list-inside pl-4 space-y-1">
                <li><strong>Acessar e Editar:</strong> Visualizar e editar todos os seus lançamentos financeiros diretamente no aplicativo.</li>
                <li><strong>Excluir:</strong> Apagar lançamentos individuais ou todos os seus dados através da função de restauração (substituindo por um backup vazio, se desejar).</li>
                <li><strong>Exportar (Backup):</strong> Fazer o backup completo de seus dados em um arquivo JSON a partir da tela de Perfil.</li>
            </ul>
        </div>

        <div class="border-t dark:border-gray-700 my-6"></div>

        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Termos de Uso</h2>

        <div class="space-y-2">
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">1. Aceitação dos Termos</h3>
            <p>Ao acessar e usar o AppMotoCash, você confirma que leu, entendeu e concorda em estar vinculado a estes Termos de Uso. Se você não concorda com estes termos, não deve usar o aplicativo.</p>
        </div>

        <div class="space-y-2">
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">2. Uso do Serviço</h3>
            <p>O AppMotoCash é fornecido para seu uso pessoal e não comercial. Você é responsável por manter a confidencialidade de sua conta e senha e por todas as atividades que ocorrem em sua conta.</p>
        </div>

        <div class="space-y-2">
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">3. Conduta do Usuário</h3>
            <p>Você concorda em não usar o Serviço para qualquer finalidade ilegal ou proibida por estes termos. Você não deve tentar obter acesso não autorizado a qualquer parte do Serviço ou aos seus sistemas.</p>
        </div>

        <div class="space-y-2">
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">4. Limitação de Responsabilidade</h3>
            <p>O aplicativo é fornecido "como está", sem garantias de qualquer tipo. Não nos responsabilizamos por qualquer perda de dados ou danos resultantes do uso do nosso Serviço. É sua responsabilidade realizar backups regulares de seus dados.</p>
        </div>

        <div class="space-y-2">
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">5. FreelancerMoto</h3>
            <p>Ao ativar o status "Online" no painel FreelancerMoto, você concorda em compartilhar publicamente as seguintes informações: seu nome completo, modelo, placa da sua moto e sua localização aproximada. Estes dados serão visíveis para empresas que acessarem a plataforma com o propósito de contratar serviços de entrega.</p>
        </div>

        <button onclick="window.history.back()" class="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-3 rounded-lg mt-4">Voltar</button>
    </div>
    `;
}

// --- SUPPORT PAGE UI ---
function renderSupport(c) {
  c.innerHTML = `
    <div class="space-y-4 fade-in">
        <div class="relative">
            <input onkeyup="searchSupportArticles()" id="support-search" type="text" placeholder="Buscar artigo..." class="w-full p-3 pl-10 rounded-full shadow-sm outline-none dark:bg-gray-800 dark:border-gray-700 border">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5"></i>
        </div>

        <div id="support-articles-list" class="space-y-3">
            <!-- Artigos Detalhados -->
            <div class="support-article bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <h3 class="font-bold text-gray-900 dark:text-white">Como adicionar um ganho?</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Clique no botão amarelo com o sinal de '+' na barra de navegação. Na tela de 'Adicionar', selecione a aba 'Ganho'. Escolha o tipo de ganho (iFood, Uber/99 ou Loja Fixa), preencha os detalhes e clique em 'Salvar Ganho'.</p>
            </div>
            <div class="support-article bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <h3 class="font-bold text-gray-900 dark:text-white">Como registrar uma despesa?</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Clique no botão '+' e selecione a aba 'Despesa'. Escolha a data, a categoria da despesa (ex: Combustível), insira o valor e uma observação (opcional). Depois, clique em 'Salvar Despesa'.</p>
            </div>
            <div class="support-article bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <h3 class="font-bold text-gray-900 dark:text-white">Como usar os filtros do Painel?</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">No topo do Painel, você pode filtrar seus dados por 'Hoje', 'Esta Semana', 'Semana Passada', 'Este Mês' e 'Mês Passado'. Use o filtro 'Personalizado' para escolher um intervalo de datas específico.</p>
            </div>
            <div class="support-article bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <h3 class="font-bold text-gray-900 dark:text-white">Como editar ou apagar um lançamento?</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">No Painel, role para baixo até a lista de 'Histórico'. Cada lançamento tem dois botões: um lápis (para editar) e uma lixeira (para apagar). Clique no botão desejado para realizar a ação.</p>
            </div>
            <div class="support-article bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <h3 class="font-bold text-gray-900 dark:text-white">Como definir uma Meta Semanal?</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Vá para a tela de 'Perfil', encontre a seção 'Meta de Ganhos Mensal', digite o valor desejado e clique em 'Salvar Meta'. O progresso aparecerá no seu Painel quando o filtro 'Este Mês' estiver ativo.</p>
            </div>
            <div class="support-article bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <h3 class="font-bold text-gray-900 dark:text-white">Como fazer backup dos meus dados?</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Na tela de 'Perfil', clique em 'Fazer Backup dos Dados'. Um arquivo JSON com todos os seus ganhos e despesas será salvo no seu dispositivo. Guarde este arquivo em um local seguro.</p>
            </div>
            <div class="support-article bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <h3 class="font-bold text-gray-900 dark:text-white">Como restaurar um backup?</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Na tela de 'Perfil', clique em 'Restaurar Backup' e selecione o arquivo JSON que você salvou anteriormente. ATENÇÃO: Isso substituirá todos os dados atuais pelos dados do arquivo.</p>
            </div>
            <div class="support-article bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <h3 class="font-bold text-gray-900 dark:text-white">Como compartilhar um relatório?</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">No Painel, clique no ícone de compartilhamento (canto superior direito do card de saldo). Uma janela aparecerá para você escolher qual parte do relatório (ganhos, despesas ou geral) deseja compartilhar no WhatsApp.</p>
            </div>
            <div class="support-article bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <h3 class="font-bold text-gray-900 dark:text-white">Como apagar minha conta?</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Vá em 'Perfil' e role até o final. Clique em 'Apagar Conta Permanentemente'. Você precisará confirmar a ação digitando a palavra 'APAGAR'. Esta ação é irreversível e todos os seus dados serão perdidos.</p>
            </div>
            <div id="no-results" class="hidden text-center text-gray-500 py-8">
                <i data-lucide="frown" class="w-10 h-10 mx-auto mb-2"></i>
                <p>Nenhum artigo encontrado.</p>
            </div>
        </div>
    </div>
    `;
  lucide.createIcons();
}

export function searchSupportArticles() {
  const searchTerm = document
    .getElementById("support-search")
    .value.toLowerCase();
  const articles = document.querySelectorAll(".support-article");
  const noResults = document.getElementById("no-results");
  let found = false;

  articles.forEach((article) => {
    const title = article.querySelector("h3").textContent.toLowerCase();
    const content = article.querySelector("p").textContent.toLowerCase();
    if (title.includes(searchTerm) || content.includes(searchTerm)) {
      article.style.display = "block";
      found = true;
    } else {
      article.style.display = "none";
    }
  });

  if (found) {
    noResults.classList.add("hidden");
  } else {
    noResults.classList.remove("hidden");
  }
}

export function copyPixKey() {
  const pixKey = "11661221408";
  navigator.clipboard
    .writeText(pixKey)
    .then(() => {
      showNotification("Chave Pix copiada!", "Sucesso");
    })
    .catch((err) => {
      showNotification("Não foi possível copiar a chave.", "Erro");
      console.error("Erro ao copiar: ", err);
    });
}

export function showVerificationBanner() {
  const banner = document.getElementById("email-verification-banner");
  if (banner) banner.classList.remove("hidden");
}

export function showLoginError(msg) {
  document.getElementById("login-error-msg").innerText = msg;
  const errorBox = document.getElementById("login-error-box");
  if (errorBox) errorBox.classList.remove("hidden");
}

// --- NOTIFICATION UI ---
export function showNotification(message, title = "Aviso") {
  // Já era exportada, mas confirmando
  const modal = document.getElementById("notification-modal");
  const titleEl = modal.querySelector("#notification-title");
  const messageEl = modal.querySelector("#notification-message");
  const buttonsEl = document.getElementById("notification-buttons");

  titleEl.innerText = title;
  messageEl.innerText = message;
  buttonsEl.innerHTML = `<button onclick="closeNotification()" class="bg-gray-900 dark:bg-yellow-500 dark:text-black text-white font-bold py-2 px-8 rounded-lg">OK</button>`;

  modal.classList.remove("hidden");
}

export function showConfirmation(
  message,
  title = "Confirmação",
  onConfirm,
  requireTextInput = null
) {
  const modal = document.getElementById("notification-modal");
  const titleEl = document.getElementById("notification-title");
  const messageEl = document.getElementById("notification-message");
  const buttonsEl = document.getElementById("notification-buttons");

  titleEl.innerText = title;
  let textInputHTML = "";
  if (requireTextInput) {
    textInputHTML = `<p class="text-xs text-gray-500 dark:text-gray-400 mt-4 mb-2">Para confirmar, digite <strong>${requireTextInput}</strong> no campo abaixo:</p>
    <input id="confirmation-input" type="text" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" autocomplete="off">`;
  }
  messageEl.innerHTML = `<p>${message}</p>${textInputHTML}`;

  buttonsEl.innerHTML = `
        <button onclick="closeNotification()" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-6 rounded-lg">Cancelar</button>
        <button id="confirm-btn" class="bg-red-600 text-white font-bold py-2 px-6 rounded-lg disabled:bg-red-400 dark:disabled:bg-red-800 disabled:cursor-not-allowed">Confirmar</button>
    `;

  document.getElementById("confirm-btn").onclick = () => {
    onConfirm();
    closeNotification();
  };

  if (requireTextInput) {
    const confirmBtn = document.getElementById("confirm-btn");
    const confirmInput = document.getElementById("confirmation-input");
    confirmBtn.disabled = true;

    confirmInput.addEventListener("input", () => {
      if (confirmInput.value === requireTextInput) {
        confirmBtn.disabled = false;
      } else {
        confirmBtn.disabled = true;
      }
    });
  }

  modal.classList.remove("hidden");
}

export function closeNotification() {
  document.getElementById("notification-modal").classList.add("hidden");
}

// Adicionado para controlar a visibilidade do checkbox de termos
document.addEventListener("click", function (event) {
  if (event.target && event.target.getAttribute("data-mode") === "register") {
    document.getElementById("terms-container")?.classList.remove("hidden");
  } else if (event.target && event.target.id === "btn-signin") {
    document.getElementById("terms-container")?.classList.add("hidden");
  }
});

// --- HUB UI ---
function renderHub(c) {
  c.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="flex border-b dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg">
          <button onclick="setHubView('map')" id="hub-tab-map" class="fin-tab flex-1 py-3 text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-b-2 border-yellow-500">Mapa</button>
          <button onclick="setHubView('list')" id="hub-tab-list" class="fin-tab flex-1 py-3 text-sm font-bold text-gray-500">Lista</button> 
      </div>

      <div id="hub-view-map">
        <div class="bg-gray-200 dark:bg-gray-800 h-64 rounded-lg flex items-center justify-center text-center text-gray-500 p-4">
          <p>A visualização do mapa estará disponível em breve. Por enquanto, use a aba 'Lista'.</p>
          <!-- Placeholder para o mapa real. Ex: <div id="leaflet-map" class="h-full w-full"></div> -->
        </div>
      </div>

      <div id="hub-view-list" class="hidden space-y-2">
        <!-- A lista de motoboys será injetada aqui -->
        <p class="text-center text-gray-400 py-8">Buscando entregadores online...</p>
      </div>
    </div>

    <!-- Modal de Detalhes do Motoboy -->
    <div id="hub-motoboy-details-modal" class="hidden absolute inset-0 z-[90] bg-black/80 flex items-center justify-center p-4">
        <div id="motoboy-details-content" class="bg-white dark:bg-gray-800 w-full max-w-sm rounded-xl p-6 modal-enter shadow-2xl text-center">
            <!-- Conteúdo injetado por JS -->
        </div>
    </div>
  `;

  getOnlineMotoboys(updateHubUI);
}

export function setHubView(view) {
  const mapView = document.getElementById("hub-view-map");
  const listView = document.getElementById("hub-view-list");
  const mapTab = document.getElementById("hub-tab-map");
  const listTab = document.getElementById("hub-tab-list");

  if (view === "map") {
    mapView.classList.remove("hidden");
    listView.classList.add("hidden");
    mapTab.className =
      "fin-tab flex-1 py-3 text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-b-2 border-yellow-500";
    listTab.className = "fin-tab flex-1 py-3 text-sm font-bold text-gray-500";
  } else {
    mapView.classList.add("hidden");
    listView.classList.remove("hidden");
    listTab.className =
      "fin-tab flex-1 py-3 text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-b-2 border-yellow-500";
    mapTab.className = "fin-tab flex-1 py-3 text-sm font-bold text-gray-500";
  }
}

function updateHubUI(motoboys) {
  const listContainer = document.getElementById("hub-view-list");
  if (!listContainer) return;

  if (motoboys.length === 0) {
    listContainer.innerHTML = `<p class="text-center text-gray-400 py-8">Nenhum entregador online no momento.</p>`;
    return;
  }

  listContainer.innerHTML = motoboys
    .map(
      (m) => `
    <div onclick='openMotoboyDetails(${JSON.stringify(
      m
    )})' class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex items-center justify-between cursor-pointer">
      <div class="flex items-center gap-3">
        <div class="bg-gray-200 dark:bg-gray-700 p-2 rounded-full"><i data-lucide="bike" class="w-6 h-6 text-gray-600 dark:text-gray-300"></i></div>
        <div>
          <p class="font-bold text-gray-900 dark:text-white">${
            m.publicProfile.name
          }</p>
          <p class="text-xs text-gray-500">${m.publicProfile.motoModel}</p>
        </div>
      </div>
      <i data-lucide="chevron-right" class="text-gray-400"></i>
    </div>
  `
    )
    .join("");

  lucide.createIcons();
}

export function openMotoboyDetails(motoboy) {
  const modal = document.getElementById("hub-motoboy-details-modal");
  const content = document.getElementById("motoboy-details-content");
  const whatsappLink = `https://wa.me/55${
    motoboy.publicProfile.whatsapp
  }?text=${encodeURIComponent(
    `Olá ${motoboy.publicProfile.name}, vi seu perfil no FreelancerMoto e gostaria de solicitar uma entrega.`
  )}`;

  content.innerHTML = `
        <div class="flex justify-end"><button onclick="closeMotoboyDetails()" class="text-gray-400"><i data-lucide="x"></i></button></div>
        <div class="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto -mt-4 mb-4 flex items-center justify-center"><i data-lucide="user" class="w-10 text-gray-400"></i></div>
        <h3 class="text-xl font-bold dark:text-white">${motoboy.publicProfile.name}</h3>
        <div class="text-sm text-gray-500 dark:text-gray-400 mt-2 space-y-1">
            <p><strong>Moto:</strong> ${motoboy.publicProfile.motoModel}</p>
            <p><strong>Placa:</strong> ${motoboy.publicProfile.motoPlate}</p>
        </div>
        <a href="${whatsappLink}" target="_blank" class="w-full mt-6 bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
            <i data-lucide="message-circle"></i> Chamar no WhatsApp
        </a>
    `;
  modal.classList.remove("hidden");
  lucide.createIcons();
}

export function closeMotoboyDetails() {
  document.getElementById("hub-motoboy-details-modal").classList.add("hidden");
}

export function showCompleteProfileModal() {
  document.getElementById("complete-profile-modal").classList.remove("hidden");
}

export async function openPublicProfileEditor() {
  const user = auth.currentUser;
  if (!user) return;

  document.getElementById("loading-overlay")?.classList.remove("hidden");

  try {
    const userDoc = await db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(user.uid)
      .get();
    const publicProfile = userDoc.data()?.publicProfile || {};

    // Altera o título e o texto do botão para o modo de edição
    document.getElementById("public-profile-modal-title").textContent =
      "Editar Perfil Freelancer";
    document
      .getElementById("public-profile-submit-btn")
      .querySelector("span").textContent = "Salvar Alterações";

    // Preenche o formulário com os dados existentes
    document.getElementById("public-name").value = publicProfile.name || "";
    document.getElementById("public-whatsapp").value =
      publicProfile.whatsapp || "";
    document.getElementById("public-moto-model").value =
      publicProfile.motoModel || "";
    document.getElementById("public-moto-plate").value =
      publicProfile.motoPlate || "";

    showCompleteProfileModal();
  } catch (error) {
    console.error("Erro ao carregar perfil público:", error);
    showNotification("Erro ao carregar seus dados. Tente novamente.", "error");
  } finally {
    document.getElementById("loading-overlay")?.classList.add("hidden");
  }
}
export function closeCompleteProfileModal() {
  const modal = document.getElementById("complete-profile-modal");
  if (!modal) return;

  modal.classList.add("hidden");
  // Reseta o formulário e os textos do modal para o padrão
  modal.querySelector("form")?.reset();
  document.getElementById("public-profile-modal-title").textContent =
    "Complete seu Perfil Público";
  document
    .getElementById("public-profile-submit-btn")
    .querySelector("span").textContent = "Ficar Online";
}
