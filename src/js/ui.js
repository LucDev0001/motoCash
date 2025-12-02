import * as API from "./api.js";
import { allLoadedItems, currentStats } from "./api.js"; // Keep for shareCategory

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

  await openModal("editModal");

  const modalTitle = document.querySelector("#edit-modal h3");
  // O código para preencher os campos do modal de edição permanece aqui por enquanto
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

async function openModal(modalName) {
  const modalContainer = document.getElementById("modal-container");
  const response = await fetch(`src/templates/modals/${modalName}.html`);
  modalContainer.innerHTML = await response.text();
  lucide.createIcons();
  modalContainer
    .querySelector(".close-modal-btn")
    ?.addEventListener("click", closeModal);
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
  await openModal("notificationModal");
  const modal = document.getElementById("notification-modal"); // O modal agora está no DOM
  const titleEl = document.getElementById("notification-title");
  const messageEl = document.getElementById("notification-message");
  const buttonsEl = document.getElementById("notification-buttons");

  titleEl.innerText = title;
  messageEl.innerText = message;
  buttonsEl.innerHTML = `<button id="notification-ok-btn" class="bg-gray-900 dark:bg-yellow-500 dark:text-black text-white font-bold py-2 px-8 rounded-lg">OK</button>`;

  document
    .getElementById("notification-ok-btn")
    .addEventListener("click", closeModal);
}

export function showConfirmation(
  message,
  title = "Confirmação",
  onConfirm,
  requireTextInput = null,
  customHTML = ""
) {
  openModal("notificationModal").then(() => {
    const modal = document.getElementById("notification-modal");
    const titleEl = document.getElementById("notification-title");
    const messageEl = document.getElementById("notification-message");
    const buttonsEl = document.getElementById("notification-buttons");

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

    document.getElementById("confirm-btn").onclick = () => {
      onConfirm();
      closeModal();
    };
    document
      .getElementById("notification-cancel-btn")
      .addEventListener("click", closeModal);

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
  });
}

export async function showCompleteProfileModal() {
  await openModal("completeProfileModal");
  document
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

  const cnhInput = document.getElementById("doc-cnh-expiry");
  const licensingInput = document.getElementById("doc-licensing-expiry");

  if (cnhInput) cnhInput.value = documentDates.cnh || "";
  if (licensingInput) licensingInput.value = documentDates.licensing || "";

  checkAndDisplayDocumentAlerts(documentDates);

  document
    .getElementById("save-docs-btn")
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
  await openModal("odometerModal");
  // Busca e preenche a quilometragem atual
  const userDoc = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get();
  const odometer = userDoc.data()?.odometer || "";
  const odometerInput = document.getElementById("current-odometer");
  if (odometerInput) odometerInput.value = odometer;

  document
    .getElementById("save-odometer-btn")
    .addEventListener("click", API.saveOdometer);
}

export async function openDebitsModal() {
  await openModal("debitsModal");
  document
    .getElementById("consult-debits-btn")
    .addEventListener("click", API.consultDebits);
}

export async function openMaintenanceModal(itemId = null) {
  await openModal("maintenanceModal");
  const modal = document.getElementById("maintenance-modal");
  const titleEl = document.getElementById("maintenance-modal-title");
  const form = modal.querySelector("form");
  form.reset();
  document.getElementById("maintenance-item-category").value = "engine"; // Default
  document.getElementById("maintenance-item-id").value = "";

  // Adiciona a div da lista se não existir
  if (!modal.querySelector("#maintenance-list")) {
    const listContainer = document.createElement("div");
    listContainer.innerHTML = `<div id="maintenance-list" class="space-y-3 mt-4 border-t dark:border-gray-700 pt-4"></div>`;
    form.insertAdjacentElement("afterend", listContainer.firstChild);
  }

  if (itemId) {
    // Modo de Edição
    titleEl.textContent = "Editar Item";
    const userDoc = await db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(currentUser.uid)
      .get();
    const items = userDoc.data()?.maintenanceItems || [];
    const item = items.find((i) => i.id === itemId);

    if (item) {
      document.getElementById("maintenance-item-id").value = item.id;
      document.getElementById("maintenance-item-name").value = item.name;
      document.getElementById("maintenance-item-interval").value =
        item.interval;
      document.getElementById("maintenance-item-category").value =
        item.category || "engine";
    }
  } else {
    // Modo de Adição
    titleEl.textContent = "Adicionar Item";
  }

  // Carrega e exibe a lista de manutenção sempre que o modal é aberto
  API.getMaintenanceData(({ items, odometer }) => {
    // A lista agora é renderizada na tela da garagem, não mais no modal.
  });

  document
    .getElementById("maintenance-form")
    .addEventListener("submit", API.saveMaintenanceItem);
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

    await showCompleteProfileModal();

    document.getElementById("public-profile-modal-title").textContent =
      "Editar Perfil da Moto";
    document
      .getElementById("public-profile-submit-btn")
      .querySelector("span").textContent = "Salvar Alterações";

    document.getElementById("public-name").value = publicProfile.name || "";
    document.getElementById("public-whatsapp").value =
      publicProfile.whatsapp || "";
    document.getElementById("public-moto-plate").value =
      publicProfile.motoPlate || "";
    document.getElementById("public-moto-year").value =
      publicProfile.motoYear || "";
    document.getElementById("public-moto-color").value =
      publicProfile.motoColor || "";
    document.getElementById("public-moto-renavam").value =
      publicProfile.motoRenavam || "";
    document.getElementById("public-moto-state").value =
      publicProfile.motoState || "";

    const imageUrlInput = document.getElementById("public-moto-image-url");
    if (publicProfile.motoImageUrl) {
      imageUrlInput.value = publicProfile.motoImageUrl;
      updateImagePreview(publicProfile.motoImageUrl);
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

function updateImagePreview(imageUrl) {
  const previewImg = document.getElementById("image-preview");
  const placeholder = document.getElementById("image-placeholder-icon");

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
  await openModal("serviceRecordModal");

  const userDoc = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get();
  const items = userDoc.data()?.maintenanceItems || [];
  const item = items.find((i) => i.id === itemId);

  if (!item) return closeModal();

  document.getElementById(
    "service-record-title"
  ).textContent = `Registrar: ${item.name}`;
  document.getElementById("service-item-id").value = itemId;
  document.getElementById("service-date").valueAsDate = new Date();
  document.getElementById("service-km").value = userDoc.data()?.odometer || "";

  document
    .getElementById("service-record-form")
    .addEventListener("submit", API.saveServiceRecord);
}

export function checkAndDisplayDocumentAlerts(dates) {
  const alertsContainer = document.getElementById("doc-alerts-container");
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
  await openModal("serviceHistoryModal");

  const userDoc = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get();
  const items = userDoc.data()?.maintenanceItems || [];
  const item = items.find((i) => i.id === itemId);

  if (!item || !item.history || item.history.length === 0) {
    document.getElementById(
      "service-history-list"
    ).innerHTML = `<p class="text-center text-gray-400 py-10">Nenhum serviço registrado para este item.</p>`;
    return;
  }

  document.getElementById(
    "service-history-title"
  ).textContent = `Histórico: ${item.name}`;

  const historyListEl = document.getElementById("service-history-list");
  historyListEl.innerHTML = item.history
    .sort((a, b) => new Date(b.date) - new Date(a.date)) // Ordena do mais recente para o mais antigo
    .map(
      (record) => `
      <div class="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border-l-4 border-gray-300 dark:border-gray-600">
        <div class="flex justify-between items-center text-sm font-bold">
          <span>${new Date(record.date + "T12:00:00").toLocaleDateString(
            "pt-BR"
          )}</span>
          <span class="text-red-500">R$ ${record.cost.toFixed(2)}</span>
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
  openModal("notificationModal").then(() => {
    const modal = document.getElementById("notification-modal");
    const titleEl = document.getElementById("notification-title");
    const messageEl = document.getElementById("notification-message");
    const buttonsEl = document.getElementById("notification-buttons");

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
    const submitBtn = document.getElementById("submit-rating-btn");

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

    document.getElementById("skip-rating-btn").onclick = closeModal;
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
