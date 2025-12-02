import * as API from "./api.js";
import { allLoadedItems, currentStats } from "./api.js"; // Keep for shareCategory
import { router } from "./router.js";

import { auth, db, appId } from "./config.js";
import { currentUser } from "./auth.js";

export let unsubscribeListeners = [];

export function initTheme() {
  const themeToggle = document.getElementById("theme-toggle");
  const themeToggleDot = document.getElementById("theme-toggle-dot");
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add("dark");
    if (themeToggle) {
      themeToggle.classList.add("bg-green-600");
      themeToggleDot.classList.add("translate-x-6");
    }
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");

  const themeToggle = document.getElementById("theme-toggle");
  const themeToggleDot = document.getElementById("theme-toggle-dot");

  if (themeToggle && themeToggleDot) {
    themeToggle.classList.toggle("bg-green-600", isDark);
    themeToggleDot.classList.toggle("translate-x-6", isDark);
  }
}

export async function openEditModal(id, type) {
  const item = allLoadedItems.find((i) => i.id === id);
  if (!item) return;

  const modal = await openModal("editModal");

  // Preenche os campos escondidos
  modal.querySelector("#edit-id").value = id;
  modal.querySelector("#edit-type").value = type;
  modal.querySelector("#edit-category").value = item.category;

  // Preenche a data
  modal.querySelector("#edit-date").value = item.date;

  // Mostra/esconde campos baseado no tipo (ganho ou despesa)
  const earningFieldsApp = modal.querySelector("#edit-fields-app");
  const earningFieldsLoja = modal.querySelector("#edit-fields-loja");
  const expenseFields = modal.querySelector("#edit-fields-expense");
  const shiftContainer = modal.querySelector("#edit-shift-container");
  const observationContainer = modal.querySelector(
    "#edit-observation-container"
  );

  if (type === "earning") {
    expenseFields.classList.add("hidden");
    shiftContainer.classList.remove("hidden");
    observationContainer.classList.remove("hidden");

    modal.querySelector("#edit-shift").value = item.shift || "dia";
    modal.querySelector("#edit-observation").value = item.observation || "";

    if (item.category === "loja_fixa") {
      earningFieldsApp.classList.add("hidden");
      earningFieldsLoja.classList.remove("hidden");
      modal.querySelector("#edit-daily").value = item.details?.daily || 0;
      modal.querySelector("#edit-loja-count").value = item.details?.count || 0;
      modal.querySelector("#edit-fee").value = item.details?.fee || 0;
      modal.querySelector("#edit-extra").value = item.details?.extra || 0;
    } else {
      // app_passageiro ou app_entrega
      earningFieldsApp.classList.remove("hidden");
      earningFieldsLoja.classList.add("hidden");
      modal.querySelector("#edit-count").value = item.count || 0;
      modal.querySelector("#edit-total").value = item.totalValue || 0;
    }
  } else {
    // type === 'expense'
    earningFieldsApp.classList.add("hidden");
    earningFieldsLoja.classList.add("hidden");
    shiftContainer.classList.add("hidden");
    observationContainer.classList.add("hidden"); // Esconde observação para despesas no edit modal
    expenseFields.classList.remove("hidden");

    modal.querySelector("#edit-exp-category").value = item.category;
    modal.querySelector("#edit-exp-total").value = item.totalValue;
    modal.querySelector("#edit-exp-desc").value = item.observation || "";
  }
}

export async function openShareModal() {
  await openModal("shareModal");
  // Adiciona listeners para os botões de compartilhamento
  document.querySelectorAll("[data-share-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      shareCategory(btn.dataset.shareType);
    });
  });
}

/**
 * Abre o modal do Plano Pro e adiciona o listener para o botão de assinatura.
 */
export async function openProPlanModal() {
  // Agora o modal é apenas informativo, então só precisamos abri-lo.
  await openModal("proPlanModal");
}

export function shareCategory(type) {
  const periodLabel = document.getElementById("period-label");
  if (!periodLabel) return;
  const pn = periodLabel.innerText;
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
  closeModal();
}

export function openModal(modalName) {
  return new Promise(async (resolve) => {
    const modalContainer = document.getElementById("modal-container");
    const response = await fetch(`src/templates/modals/${modalName}.html`);
    modalContainer.innerHTML = await response.text();
    lucide.createIcons();
    modalContainer
      .querySelector(".close-modal-btn")
      ?.addEventListener("click", closeModal);
    // Resolve a promessa com o elemento do modal recém-criado
    resolve(modalContainer.firstElementChild);
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

export async function showNotification(message, title = "Aviso") {
  const modal = await openModal("notificationModal");
  const titleEl = modal.querySelector("#notification-title");
  const messageEl = modal.querySelector("#notification-message");
  const buttonsEl = modal.querySelector("#notification-buttons");
  titleEl.innerText = title;
  messageEl.innerText = message;
  buttonsEl.innerHTML = `<button id="notification-ok-btn" class="bg-gray-900 dark:bg-yellow-500 dark:text-black text-white font-bold py-2 px-8 rounded-lg">OK</button>`;

  document
    .getElementById("notification-ok-btn")
    .addEventListener("click", closeModal);
}

/**
 * Exibe uma notificação rápida (toast) que desaparece sozinha.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} [icon='check-circle'] - O ícone do Lucide a ser usado.
 */
export function showToast(message, icon = "check-circle") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `w-full bg-gray-800 border border-green-600 shadow-2xl rounded-lg p-4 flex items-start gap-4 pointer-events-auto toast-enter`;
  toast.innerHTML = `
    <div>
        <i data-lucide="${icon}" class="w-6 h-6 text-green-500"></i>
    </div>
    <div class="flex-1">
        <p class="text-sm font-semibold text-white">${message}</p>
    </div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  // Remove o toast após alguns segundos
  setTimeout(() => {
    toast.classList.remove("toast-enter");
    toast.classList.add("toast-leave");
    setTimeout(() => toast.remove(), 500); // Remove o elemento após a animação
  }, 3000); // O toast fica visível por 3 segundos
}

export function showConfirmation(
  message,
  title = "Confirmação",
  onConfirm,
  onCancel = closeModal, // Define closeModal como o padrão se onCancel não for fornecido
  requireTextInput = null,
  customHTML = ""
) {
  openModal("notificationModal").then((modal) => {
    const titleEl = modal.querySelector("#notification-title");
    const messageEl = modal.querySelector("#notification-message");
    const buttonsEl = modal.querySelector("#notification-buttons");

    titleEl.innerText = title;
    let textInputHTML = customHTML; // Usa o HTML customizado se fornecido

    // Se não houver HTML customizado, verifica se precisa de um input de texto
    if (!customHTML && requireTextInput) {
      textInputHTML = `<p class="text-xs text-gray-500 dark:text-gray-400 mt-4 mb-2">Para confirmar, digite <strong>${requireTextInput}</strong> no campo abaixo:</p>
    <input id="confirmation-input" type="text" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" autocomplete="off">`;
    }
    messageEl.innerHTML = `<p>${message}</p>${textInputHTML}`;

    buttonsEl.innerHTML = `
        <button id="notification-cancel-btn" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-6 rounded-lg">Cancelar</button>
        <button id="confirm-btn" class="bg-red-600 text-white font-bold py-2 px-6 rounded-lg disabled:bg-red-400 dark:disabled:bg-red-800 disabled:cursor-not-allowed">Confirmar</button>
    `;

    modal.querySelector("#confirm-btn").onclick = () => {
      onConfirm();
      closeModal();
    };
    // Usa a função onCancel fornecida ou o padrão (closeModal)
    modal.querySelector("#notification-cancel-btn").onclick = onCancel;

    if (requireTextInput) {
      const confirmBtn = modal.querySelector("#confirm-btn");
      const confirmInput = modal.querySelector("#confirmation-input");
      confirmBtn.disabled = true;

      confirmInput.addEventListener("input", () => {
        if (confirmInput.value === requireTextInput) {
          confirmBtn.disabled = false;
        } else {
          confirmBtn.disabled = true;
        }
      });
    }
  });
}

export async function showCompleteProfileModal() {
  const modal = await openModal("completeProfileModal");
  modal
    .getElementById("public-profile-form")
    .addEventListener("submit", API.savePublicProfile);
}

export async function openDocumentsModal() {
  await openModal("documentsModal");

  // Busca e preenche as datas salvas
  const userDoc = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get();
  const documentDates = userDoc.data()?.documentDates || {};

  const cnhInput = modal.querySelector("#doc-cnh-expiry");
  const licensingInput = modal.querySelector("#doc-licensing-expiry");

  if (cnhInput) cnhInput.value = documentDates.cnh || "";
  if (licensingInput) licensingInput.value = documentDates.licensing || "";

  checkAndDisplayDocumentAlerts(documentDates);

  modal
    .querySelector("#save-docs-btn")
    .addEventListener("click", API.saveDocumentDates);

  // Adiciona listeners para os botões de scan
  document.getElementById("scan-cnh-btn").addEventListener("click", () => {
    document.getElementById("cnh-scan-input").click();
  });
  document.getElementById("scan-crlv-btn").addEventListener("click", () => {
    document.getElementById("crlv-scan-input").click();
  });

  // Adiciona listeners para os inputs de arquivo
  document.getElementById("cnh-scan-input").addEventListener("change", (e) => {
    handleImageScan(e.target.files[0], "cnh");
  });
  document.getElementById("crlv-scan-input").addEventListener("change", (e) => {
    handleImageScan(e.target.files[0], "crlv");
  });
}

async function handleImageScan(file, docType) {
  if (!file) return;

  const statusEl = document.getElementById(`${docType}-scan-status`);
  statusEl.classList.remove("hidden");

  try {
    const worker = await Tesseract.createWorker("por"); // 'por' para português
    const {
      data: { text },
    } = await worker.recognize(file);
    await worker.terminate();

    // Agora, processamos o texto extraído
    processOcrText(text, docType);
  } catch (error) {
    console.error("Erro no OCR:", error);
    showNotification(
      "Não foi possível ler o documento. Tente uma foto com melhor iluminação e mais nítida.",
      "Erro de Leitura"
    );
  } finally {
    statusEl.classList.add("hidden");
  }
}

function processOcrText(text, docType) {
  console.log("Texto extraído:", text); // Ótimo para depuração

  if (docType === "cnh") {
    // Expressões Regulares para encontrar os dados na CNH
    const cnhNumberMatch = text.match(/Nº\s?REGISTRO\s*(\d+)/i);
    const expiryDateMatch = text.match(/VALIDADE\s*(\d{2}\/\d{2}\/\d{4})/i);

    if (cnhNumberMatch)
      document.getElementById("doc-cnh-number").value = cnhNumberMatch[1];
    if (expiryDateMatch) {
      const [day, month, year] = expiryDateMatch[1].split("/");
      document.getElementById(
        "doc-cnh-expiry"
      ).value = `${year}-${month}-${day}`;
    }
  } else if (docType === "crlv") {
    // Expressões Regulares para encontrar os dados no CRLV
    const plateMatch = text.match(/PLACA\s*([A-Z0-9]+)/i);
    const renavamMatch = text.match(/RENAVAM\s*(\d+)/i);

    if (plateMatch) document.getElementById("doc-plate").value = plateMatch[1];
    if (renavamMatch)
      document.getElementById("doc-renavam").value = renavamMatch[1];
  }
  showNotification(
    "Dados extraídos! Verifique se estão corretos antes de salvar.",
    "Sucesso"
  );
}

export async function openOdometerModal() {
  const modal = await openModal("odometerModal");
  // Busca e preenche a quilometragem atual
  const userDoc = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get();
  const odometer = userDoc.data()?.odometer || "";
  const odometerInput = modal.querySelector("#current-odometer");
  if (odometerInput) odometerInput.value = odometer;

  modal
    .querySelector("#save-odometer-btn")
    .addEventListener("click", API.saveOdometer);
}

export async function openDebitsModal() {
  const modal = await openModal("debitsModal");
  document
    .getElementById("consult-debits-btn")
    .addEventListener("click", API.consultDebits);
}

/**
 * Roteador para modais de manutenção.
 * @param {string|Event} [itemIdOrEvent] - O ID do item ou o objeto de evento do clique.
 * @param {string} [action="add"] - A ação a ser executada: 'add', 'edit', 'register', 'history'.
 */
export async function openMaintenanceModal(
  itemIdOrEvent = null,
  action = "add"
) {
  // Se o primeiro argumento for um evento, o itemId é nulo.
  const itemId = typeof itemIdOrEvent === "string" ? itemIdOrEvent : null;

  switch (action) {
    case "register":
      // Abre o modal para registrar um novo serviço para um item existente.
      if (itemId) openServiceRecordModal(itemId);
      break;

    case "history":
      // Abre o modal para ver o histórico de serviços de um item.
      if (itemId) openServiceHistoryModal(itemId);
      break;

    case "edit":
    case "add":
      // Abre o modal principal para adicionar um novo item ou editar um existente.
      const modal = await openModal("maintenanceModal");
      const titleEl = modal.querySelector("#maintenance-modal-title");
      const form = modal.querySelector("form");
      form.reset();
      modal.querySelector("#maintenance-item-id").value = "";

      if (itemId && action === "edit") {
        // Modo de Edição: preenche o formulário com os dados do item.
        titleEl.textContent = "Editar Item de Manutenção";
        const userDoc = await db
          .collection("artifacts")
          .doc(appId)
          .collection("users")
          .doc(currentUser.uid)
          .get();
        const items = userDoc.data()?.maintenanceItems || [];
        const item = items.find((i) => i.id === itemId);

        if (item) {
          modal.querySelector("#maintenance-item-id").value = item.id;
          modal.querySelector("#maintenance-item-name").value = item.name;
          modal.querySelector("#maintenance-item-interval").value =
            item.interval;
          modal.querySelector("#maintenance-item-category").value =
            item.category || "engine";
        }
      } else {
        // Modo de Adição: prepara o formulário para um novo item.
        titleEl.textContent = "Adicionar Novo Item";
        modal.querySelector("#maintenance-item-category").value = "engine"; // Categoria padrão
      }

      modal
        .querySelector("#maintenance-form")
        .addEventListener("submit", API.saveMaintenanceItem);
      break;
  }
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

    const modal = await openModal("completeProfileModal");

    modal.querySelector("#public-profile-modal-title").textContent =
      "Editar Perfil da Moto";
    modal
      .querySelector("#public-profile-submit-btn")
      .querySelector("span").textContent = "Salvar Alterações";

    modal.querySelector("#public-name").value = publicProfile.name || "";
    modal.querySelector("#public-whatsapp").value =
      publicProfile.whatsapp || "";
    modal.querySelector("#public-moto-plate").value =
      publicProfile.motoPlate || "";
    modal.querySelector("#public-moto-year").value =
      publicProfile.motoYear || "";
    modal.querySelector("#public-moto-color").value =
      publicProfile.motoColor || "";
    modal.querySelector("#public-moto-renavam").value =
      publicProfile.motoRenavam || "";
    modal.querySelector("#public-moto-state").value =
      publicProfile.motoState || "";

    const imageUrlInput = modal.querySelector("#public-moto-image-url");
    if (publicProfile.motoImageUrl) {
      imageUrlInput.value = publicProfile.motoImageUrl;
      updateImagePreview(publicProfile.motoImageUrl, modal);
    }

    initFipeSelectors(publicProfile.fipeBrandCode, publicProfile.fipeModelCode);

    imageUrlInput.addEventListener("input", () =>
      updateImagePreview(imageUrlInput.value)
    );
  } catch (error) {
    console.error("Erro ao carregar perfil público:", error);
    showNotification("Erro ao carregar seus dados. Tente novamente.", "error");
  } finally {
    document.getElementById("loading-overlay")?.classList.add("hidden");
  }
}

function updateImagePreview(imageUrl, modal) {
  const previewImg = modal.querySelector("#image-preview");
  const placeholder = modal.querySelector("#image-placeholder-icon");

  if (imageUrl && previewImg && placeholder) {
    previewImg.src = imageUrl;
    previewImg.classList.remove("hidden");
    placeholder.classList.add("hidden");
  }
}

async function initFipeSelectors(brandCode, modelCode) {
  const brandSelect = document.getElementById("fipe-brand");
  const modelSelect = document.getElementById("fipe-model");

  if (!brandSelect || !modelSelect) return;

  modelSelect.innerHTML = '<option value="">Selecione o Modelo...</option>';
  modelSelect.disabled = true;

  try {
    const res = await fetch(
      "https://parallelum.com.br/fipe/api/v1/motos/marcas"
    );
    const brands = await res.json();
    brandSelect.innerHTML = '<option value="">Selecione a Marca...</option>';
    brands.forEach((brand) => {
      brandSelect.innerHTML += `<option value="${brand.codigo}" ${
        brand.codigo === brandCode ? "selected" : ""
      }>${brand.nome}</option>`;
    });

    if (brandCode) {
      await loadFipeModels(brandCode, modelCode);
    }
  } catch (e) {
    showNotification("Erro ao carregar marcas da FIPE.", "Erro");
  }

  brandSelect.onchange = async () => {
    const selectedBrandCode = brandSelect.value;
    if (selectedBrandCode) {
      await loadFipeModels(selectedBrandCode);
    }
  };
}

async function loadFipeModels(brandCode, modelCodeToSelect = null) {
  const modelSelect = document.getElementById("fipe-model");
  modelSelect.innerHTML = '<option value="">Carregando modelos...</option>';
  modelSelect.disabled = false;

  try {
    const res = await fetch(
      `https://parallelum.com.br/fipe/api/v1/motos/marcas/${brandCode}/modelos`
    );
    const data = await res.json();
    modelSelect.innerHTML = '<option value="">Selecione o Modelo...</option>';
    data.modelos.forEach((model) => {
      modelSelect.innerHTML += `<option value="${model.codigo}" ${
        model.codigo == modelCodeToSelect ? "selected" : ""
      }>${model.nome}</option>`;
    });
  } catch (e) {
    modelSelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

export function closeModal() {
  const modalContainer = document.getElementById("modal-container");
  if (modalContainer) modalContainer.innerHTML = "";
}

export async function resendVerificationEmail() {
  // Esta função foi movida do api.js para cá para evitar importação circular
  if (!currentUser) return;
  currentUser
    .sendEmailVerification()
    .then(() => {
      showNotification(
        "Um novo e-mail de verificação foi enviado. Verifique sua caixa de entrada.",
        "E-mail Reenviado"
      );
    })
    .catch((error) => {
      showNotification(`Erro ao reenviar e-mail: ${error.message}`, "Erro");
    });
}

export async function toggleUserOnlineStatus() {
  // Esta função foi movida do api.js para cá para evitar importação circular
  const toggle = document.getElementById("user-status-toggle");
  const isGoingOnline = !toggle.classList.contains("bg-green-600");

  try {
    await API.setUserOnlineStatus(isGoingOnline);
    // A UI será atualizada automaticamente pelo listener em auth.js
  } catch (error) {
    // Se o perfil estiver incompleto, a promessa será rejeitada e o erro será capturado aqui.
    // Não é necessário fazer nada, pois o modal de perfil já foi aberto pela função setUserOnlineStatus.
    console.log("Ação de ficar online interrompida:", error);
  }
}

export async function openServiceRecordModal(itemId) {
  const modal = await openModal("serviceRecordModal");

  const userDoc = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get();
  const items = userDoc.data()?.maintenanceItems || [];
  const item = items.find((i) => i.id === itemId);

  if (!item) return closeModal();

  modal.querySelector(
    "#service-record-title"
  ).textContent = `Registrar: ${item.name}`;
  modal.querySelector("#service-item-id").value = itemId;
  modal.querySelector("#service-date").valueAsDate = new Date();
  modal.querySelector("#service-km").value = userDoc.data()?.odometer || "";

  modal
    .querySelector("#service-record-form")
    .addEventListener("submit", API.saveServiceRecord);
}

export function checkAndDisplayDocumentAlerts(dates, container) {
  const alertsContainer =
    container || document.getElementById("doc-alerts-container");
  if (!alertsContainer) return;

  alertsContainer.innerHTML = ""; // Limpa alertas antigos
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDate = (dateString, docName) => {
    if (!dateString) return;

    const expiryDate = new Date(dateString + "T12:00:00");
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let alertClass = "";
    let alertMessage = "";

    if (diffDays <= 0) {
      alertClass =
        "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-500";
      alertMessage = `Seu ${docName} venceu!`;
    } else if (diffDays <= 30) {
      alertClass =
        "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-500";
      alertMessage = `Seu ${docName} vence em ${diffDays} dia(s).`;
    }

    if (alertMessage) {
      alertsContainer.innerHTML += `<div class="p-3 rounded-lg border-l-4 text-sm font-semibold ${alertClass} flex items-center gap-2"><i data-lucide="alert-triangle" class="w-5 h-5"></i> ${alertMessage}</div>`;
    }
  };

  checkDate(dates.cnh, "CNH");
  checkDate(dates.licensing, "Licenciamento");
  lucide.createIcons();
}

export async function openServiceHistoryModal(itemId) {
  const modal = await openModal("serviceHistoryModal");

  const userDoc = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get();
  const items = userDoc.data()?.maintenanceItems || [];
  const item = items.find((i) => i.id === itemId);

  const historyListEl = modal.querySelector("#service-history-list");

  if (!item || !item.history || item.history.length === 0) {
    historyListEl.innerHTML = `<p class="text-center text-gray-400 py-10">Nenhum serviço registrado para este item.</p>`;
    return;
  }

  modal.querySelector(
    "#service-history-title"
  ).textContent = `Histórico: ${item.name}`;
  historyListEl.innerHTML = item.history
    .sort((a, b) => new Date(b.date) - new Date(a.date)) // Ordena do mais recente para o mais antigo
    .map(
      (record) => `
      <div class="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border-l-4 border-gray-300 dark:border-gray-600">
        <div class="flex justify-between items-start text-sm">
          <div>
            <p class="font-bold">${new Date(
              record.date + "T12:00:00"
            ).toLocaleDateString("pt-BR")}</p>
            <p class="font-bold text-red-500">R$ ${record.cost.toFixed(2)}</p>
          </div>
          <button data-item-id="${item.id}" data-record-id="${
        record.id
      }" class="delete-service-record-btn text-gray-400 hover:text-red-500 p-1">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          <p><strong>Km:</strong> ${record.km}</p>
          ${
            record.location
              ? `<p><strong>Local:</strong> ${record.location}</p>`
              : ""
          }
          ${record.notes ? `<p class="mt-2 italic">"${record.notes}"</p>` : ""}
        </div>
      </div>
    `
    )
    .join("");

  // Adiciona o listener para os novos botões de apagar
  historyListEl
    .querySelectorAll(".delete-service-record-btn")
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const currentButton = e.currentTarget;
        const itemId = currentButton.dataset.itemId;
        const recordId = currentButton.dataset.recordId;
        API.deleteServiceRecord(itemId, recordId);
      });
    });
  lucide.createIcons();
}

/**
 * Abre um modal para exibir os detalhes do perfil de um motoboy ou empresa.
 * @param {object} profileData - Os dados do perfil a serem exibidos.
 * @param {string} type - O tipo de perfil ('motoboy' ou 'company').
 */
export function openProfileModal(profileData, type) {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer || !profileData) return;

  let modalContent = "";
  if (type === "motoboy") {
    modalContent = `
      <div class="flex items-center gap-4 mb-4">
        <div class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center"><i data-lucide="bike" class="w-8 h-8 text-gray-500"></i></div>
        <div>
          <h4 class="text-xl font-bold">${profileData.name || "Motoboy"}</h4>
          <p class="text-sm text-gray-500">Avaliação: ${
            profileData.rating ? `${profileData.rating.toFixed(1)} ★` : "N/A"
          }</p>
        </div>
      </div>
      <div class="border-t dark:border-gray-700 pt-4 grid grid-cols-2 gap-4 text-sm">
        <div><p class="text-gray-500">Modelo da Moto</p><p class="font-semibold">${
          profileData.fipeModelText || "Não informado"
        }</p></div>
        <div><p class="text-gray-500">Placa</p><p class="font-semibold">${
          profileData.motoPlate || "Não informada"
        }</p></div>
        <div><p class="text-gray-500">Contato</p><p class="font-semibold">${
          profileData.whatsapp || "Não informado"
        }</p></div>
      </div>
    `;
  } else {
    // type === 'company'
    modalContent = `
      <div class="flex items-center gap-4 mb-4">
        <div class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center"><i data-lucide="building-2" class="w-8 h-8 text-gray-500"></i></div>
        <div>
          <h4 class="text-xl font-bold">${profileData.name || "Empresa"}</h4>
          <p class="text-sm text-gray-500">${
            profileData.cnpj || "CNPJ não informado"
          }</p>
        </div>
      </div>
      <div class="border-t dark:border-gray-700 pt-4 grid grid-cols-1 gap-4 text-sm">
        <div><p class="text-gray-500">Endereço</p><p class="font-semibold">${
          profileData.fullAddress || "Não informado"
        }</p></div>
        <div><p class="text-gray-500">Contato</p><p class="font-semibold">${
          profileData.whatsapp || "Não informado"
        }</p></div>
      </div>
    `;
  }

  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-[500]">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md m-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold">Perfil</h3>
          <button class="close-profile-modal text-gray-500 hover:text-gray-800 dark:hover:text-white">&times;</button>
        </div>
        ${modalContent}
      </div>
    </div>
  `;

  lucide.createIcons();
  modalContainer
    .querySelector(".close-profile-modal")
    .addEventListener("click", () => (modalContainer.innerHTML = ""));
}

/**
 * Abre um modal para o motoboy avaliar a empresa após a conclusão de uma vaga.
 * @param {string} jobId - O ID da vaga.
 * @param {string} empresaId - O ID da empresa.
 * @param {string} empresaName - O nome da empresa.
 */
export function openCompanyRatingModal(jobId, empresaId, empresaName) {
  openModal("notificationModal").then((modal) => {
    const titleEl = modal.querySelector("#notification-title");
    const messageEl = modal.querySelector("#notification-message");
    const buttonsEl = modal.querySelector("#notification-buttons");

    titleEl.textContent = "Avaliar Empresa";
    messageEl.innerHTML = `
      <p class="text-sm text-gray-500 mb-4">Como foi a sua experiência com a empresa <strong class="text-yellow-500">${empresaName}</strong>?</p>
      <div class="flex justify-center items-center gap-2 my-6 rating-stars" id="modal-rating-stars">
        ${[1, 2, 3, 4, 5]
          .map(
            (star) =>
              `<i data-lucide="star" class="w-8 h-8 cursor-pointer text-gray-300 dark:text-gray-600 transition-colors"></i>`
          )
          .join("")}
      </div>
    `;
    lucide.createIcons();

    buttonsEl.innerHTML = `
      <button id="skip-rating-btn" class="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-2 px-6 rounded-lg">Pular</button>
      <button id="submit-rating-btn" class="bg-green-600 text-white font-bold py-2 px-6 rounded-lg disabled:bg-green-400" disabled>Enviar Avaliação</button>
    `;

    let currentRating = 0;
    const stars = modal.querySelectorAll("#modal-rating-stars i");
    const submitBtn = modal.querySelector("#submit-rating-btn");

    stars.forEach((star, index) => {
      star.addEventListener("click", () => {
        currentRating = index + 1;
        submitBtn.disabled = false;
        stars.forEach((s, i) => {
          s.classList.toggle("text-yellow-400", i < currentRating);
          s.classList.toggle("fill-current", i < currentRating);
          s.classList.toggle("text-gray-300", i >= currentRating);
        });
      });
    });

    modal.querySelector("#skip-rating-btn").onclick = closeModal;
    submitBtn.onclick = () => API.rateCompany(jobId, empresaId, currentRating);
  });
}

let jobsMap = null; // Variável para guardar a instância do mapa
let jobMarkers = []; // Array para guardar os marcadores

/**
 * Renderiza o mapa de vagas disponíveis.
 */
export function renderJobsMap() {
  const mapView = document.getElementById("jobs-map-view");
  if (!mapView) return;

  // Inicializa o mapa apenas uma vez
  if (!jobsMap) {
    jobsMap = L.map(mapView).setView([-14.235, -51.925], 4); // Centro do Brasil
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(jobsMap);
  }

  // Limpa marcadores antigos
  jobMarkers.forEach((marker) => jobsMap.removeLayer(marker));
  jobMarkers = [];

  const jobIcon = L.icon({
    iconUrl: "https://unpkg.com/lucide-static@latest/icons/briefcase.svg",
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -40],
    className: "job-marker-icon", // Classe para estilização customizada se necessário
  });

  // Escuta por vagas disponíveis
  API.listenForAvailableJobs((jobs) => {
    // Limpa marcadores antigos antes de adicionar novos
    jobMarkers.forEach((marker) => jobsMap.removeLayer(marker));
    jobMarkers = [];

    if (jobs.length === 0) {
      // Centraliza no usuário se não houver vagas
      navigator.geolocation.getCurrentPosition((pos) => {
        jobsMap.setView([pos.coords.latitude, pos.coords.longitude], 13);
      });
      return;
    }

    jobs.forEach((job) => {
      if (job.location && job.location.lat && job.location.lon) {
        const marker = L.marker([job.location.lat, job.location.lon], {
          icon: jobIcon,
        }).addTo(jobsMap);

        marker.bindPopup(`
          <div class="font-sans p-1">
            <h3 class="font-bold text-base">${job.title}</h3>
            <p class="text-sm text-gray-600">${job.empresaName}</p>
            <p class="text-sm font-bold text-green-600 mt-1">${job.payment}</p>
            <button onclick="window.acceptJob('${job.id}')" class="w-full mt-3 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-sm">
              Ver Detalhes e Aceitar
            </button>
          </div>
        `);
        jobMarkers.push(marker);
      }
    });
  });
}
