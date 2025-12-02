import * as API from "../api.js";

export async function renderAddFinance(c) {
  c.innerHTML = await fetch("src/templates/views/finance.html").then((res) =>
    res.text()
  );
  document.getElementById("fin-date-earning").valueAsDate = new Date();
  document.getElementById("fin-date-expense").valueAsDate = new Date();

  // Adiciona listeners para os formulários e abas
  document
    .getElementById("tab-earning")
    .addEventListener("click", () => setTransactionType("earning"));
  document
    .getElementById("tab-expense")
    .addEventListener("click", () => setTransactionType("expense"));

  document
    .getElementById("tab-app_entrega")
    .addEventListener("click", () => setFinanceTab("app_entrega"));
  document
    .getElementById("tab-app_passageiro")
    .addEventListener("click", () => setFinanceTab("app_passageiro"));
  document
    .getElementById("tab-loja_fixa")
    .addEventListener("click", () => setFinanceTab("loja_fixa"));

  document
    .getElementById("form-earning")
    .addEventListener("submit", API.submitFinance);
  document
    .getElementById("form-expense")
    .addEventListener("submit", API.submitExpense);

  // **LÓGICA DE PRÉ-PREENCHIMENTO**
  const prefillData = localStorage.getItem("prefillExpense");
  if (prefillData) {
    const data = JSON.parse(prefillData);
    // Muda para a aba de despesa
    setTransactionType("expense");
    // Preenche os campos
    document.getElementById("exp-category").value = data.category;
    document.getElementById("exp-total").value = data.totalValue;
    document.getElementById("exp-desc").value = data.observation;
    // Limpa o localStorage para não preencher de novo
    localStorage.removeItem("prefillExpense");
  }
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
