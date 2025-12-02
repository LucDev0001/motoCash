import { loadDashboardData, deleteItem } from "../api.js";
import { openEditModal, openShareModal } from "../ui.js";

let currentChart = null;
export let unsubscribeListeners = [];
export let currentPeriod = "week";
export let currentShiftFilter = "all";
export let customRange = { start: null, end: null };

export async function renderDashboard(c) {
  c.innerHTML = await fetch("src/templates/views/dashboard.html").then((res) =>
    res.text()
  );
  const loadingOverlay = document.getElementById("loading-overlay");
  if (loadingOverlay) {
    loadingOverlay.classList.remove("hidden");
    loadingOverlay.classList.add("flex");
  }

  const unsub = loadDashboardData(
    "week",
    currentShiftFilter,
    updateDashboardUI
  );
  unsubscribeListeners.push(unsub);

  document
    .getElementById("filter-day")
    .addEventListener("click", () => filterDashboard("day"));
  document
    .getElementById("filter-week")
    .addEventListener("click", () => filterDashboard("week"));
  document
    .getElementById("filter-last-week")
    .addEventListener("click", () => filterDashboard("last-week"));
  document
    .getElementById("filter-month")
    .addEventListener("click", () => filterDashboard("month"));
  document
    .getElementById("filter-last-month")
    .addEventListener("click", () => filterDashboard("last-month"));
  document
    .getElementById("filter-custom")
    .addEventListener("click", toggleCustomPicker);
  document
    .getElementById("apply-custom-filter-btn")
    .addEventListener("click", applyCustomFilter);
  document
    .getElementById("open-share-modal-btn")
    .addEventListener("click", openShareModal);
}

function formatShortDateWithWeekday(dateObject) {
  if (!(dateObject instanceof Date) || isNaN(dateObject)) {
    return "Data inválida";
  }
  const options = { weekday: "short", day: "2-digit", month: "2-digit" };
  let formatted = new Intl.DateTimeFormat("pt-BR", options).format(dateObject);
  return formatted.replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
}

export function updateDashboardUI(stats, allItems, lineChartData, monthlyGoal) {
  document.getElementById("loading-overlay")?.classList.add("hidden");

  if (!document.getElementById("balance-value")) return;

  const balance = stats.earnings.total - stats.expenses.total;
  const balanceValueEl = document.getElementById("balance-value");

  balanceValueEl.innerText = `R$ ${balance.toFixed(2)}`;
  balanceValueEl.className = `text-4xl font-bold ${
    balance >= 0 ? "text-green-600" : "text-red-600"
  }`;

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
                      )}</span> ${shiftIcon ? `<span>${shiftIcon}</span>` : ""}
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
                    <button data-id="${i.id}" data-type="${
          i.type
        }" class="edit-item-btn bg-gray-100 p-2 rounded text-blue-500">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button> 
                    <button data-id="${i.id}" data-type="${
          i.type
        }" class="delete-item-btn bg-gray-100 p-2 rounded text-red-500">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>`;
      })
      .join("") ||
    '<p class="text-center text-gray-400 text-sm">Sem dados.</p>';

  document.querySelectorAll(".edit-item-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      openEditModal(btn.dataset.id, btn.dataset.type)
    );
  });
  document.querySelectorAll(".delete-item-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteItem(btn.dataset.id, btn.dataset.type)
    );
  });

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
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || "";
                if (label) label += ": ";
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
    "last-week": "Semana Passada",
    month: "Este Mês",
    "last-month": "Mês Passado",
  };
  document.getElementById("period-label").innerText =
    labels[p] || "Personalizado";
  const unsub = loadDashboardData(p, currentShiftFilter, updateDashboardUI);
  unsubscribeListeners.push(unsub);
}

export function filterByShift(shift) {
  currentShiftFilter = shift;
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

  const unsub = loadDashboardData(
    currentPeriod,
    currentShiftFilter,
    updateDashboardUI
  );
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
  const unsub = loadDashboardData(
    "custom",
    currentShiftFilter,
    updateDashboardUI
  );
  unsubscribeListeners.push(unsub);
}
