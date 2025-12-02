import { db, appId } from "../config.js";
import { currentUser } from "../auth.js";
import { calculateAndRenderCostPerKm } from "../api.js";
import {
  openDebitsModal,
  openDocumentsModal,
  openOdometerModal,
  openMaintenanceModal,
  showNotification,
  openPublicProfileEditor,
  checkAndDisplayDocumentAlerts,
} from "../ui.js";

export async function renderGarage(c) {
  c.innerHTML = await fetch("src/templates/views/garage.html").then((res) =>
    res.text()
  );

  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get()
    .then((doc) => {
      if (doc.exists) {
        // Inicia o cálculo de custo por Km
        if (typeof calculateAndRenderCostPerKm === "function") {
          calculateAndRenderCostPerKm(doc.id);
        }

        // Renderiza o novo checklist de manutenção
        renderMaintenanceChecklist(
          doc.data()?.maintenanceItems || [],
          doc.data()?.odometer || 0
        );

        const publicProfile = doc.data()?.publicProfile || {};
        if (
          publicProfile.fipeBrandCode &&
          publicProfile.fipeModelCode &&
          publicProfile.motoYear
        ) {
          updateGarageHeader({
            motoModel: publicProfile.fipeModelText,
            motoYear: publicProfile.motoYear,
            motoColor: publicProfile.motoColor,
          });
          updateGarageImage(publicProfile.motoImageUrl);
          fetchFipePrice(
            publicProfile.fipeBrandCode,
            publicProfile.fipeModelCode,
            publicProfile.motoYear
          );

          // Verifica e exibe os alertas de vencimento na tela da garagem
          const documentDates = doc.data()?.documentDates || {};
          checkAndDisplayDocumentAlerts(
            documentDates,
            document.getElementById("garage-alerts-container")
          );
        } else {
          openPublicProfileEditor();
        }
      }
    });

  document
    .getElementById("debits-btn")
    .addEventListener("click", openDebitsModal);
  document
    .getElementById("docs-btn")
    .addEventListener("click", openDocumentsModal);
  document
    .getElementById("odometer-btn")
    .addEventListener("click", openOdometerModal);
  document
    .getElementById("maintenance-btn")
    .addEventListener("click", openMaintenanceModal);
}

function updateGarageHeader(profile) {
  const header = document.getElementById("garage-header");
  if (header) {
    header.innerHTML = `
      <div class="flex justify-center items-center gap-3">
        <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200">${
          profile.motoModel || "Moto não cadastrada"
        }</h2>
        <button id="edit-moto-profile-btn" class="text-blue-500 dark:text-blue-400 p-1">
          <i data-lucide="pencil" class="w-4 h-4"></i>
        </button>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">${
        profile.motoYear ? `${profile.motoYear} - ${profile.motoColor}` : ""
      }</p>
    `;
    document
      .getElementById("edit-moto-profile-btn")
      .addEventListener("click", openPublicProfileEditor);
    lucide.createIcons();
  }
}

function updateGarageImage(imageUrl) {
  const container = document.getElementById("model-viewer-container");
  if (imageUrl) {
    container.innerHTML = `<img src="${imageUrl}" class="h-full w-full object-contain"/>`;
  } else {
    container.innerHTML = `<div class="text-center text-gray-400"><i data-lucide="image-off" class="w-12 h-12 mx-auto"></i><p class="text-sm mt-2">Nenhuma imagem<br>cadastrada</p></div>`;
    lucide.createIcons();
  }
}

async function fetchFipePrice(brandCode, modelCode, year) {
  const fipeValueEl = document.getElementById("fipe-value");
  if (!brandCode || !modelCode || !year) {
    fipeValueEl.textContent = "Dados incompletos";
    fipeValueEl.classList.remove("animate-pulse");
    return;
  }

  try {
    const yearsResponse = await fetch(
      `https://parallelum.com.br/fipe/api/v1/motos/marcas/${brandCode}/modelos/${modelCode}/anos`
    );
    const availableYears = await yearsResponse.json();

    const yearInfo = availableYears.find((y) => y.nome.startsWith(year));

    if (yearInfo) {
      const fipeResponse = await fetch(
        `https://parallelum.com.br/fipe/api/v1/motos/marcas/${brandCode}/modelos/${modelCode}/anos/${yearInfo.codigo}`
      );
      const fipeData = await fipeResponse.json();
      fipeValueEl.textContent = fipeData.Valor;
    } else {
      fipeValueEl.textContent = "Ano não encontrado";
    }
  } catch (error) {
    console.error("Erro ao buscar FIPE:", error);
    fipeValueEl.textContent = "Erro ao buscar";
  } finally {
    fipeValueEl.classList.remove("animate-pulse");
  }
}

const MAINTENANCE_CATEGORIES = {
  engine: { name: "Motor e Transmissão", icon: "cog" },
  wheels: { name: "Rodas e Freios", icon: "disc-3" },
  electrical: { name: "Elétrica e Iluminação", icon: "flashlight" },
  structure: { name: "Estrutura e Estética", icon: "bike" },
  others: { name: "Outros", icon: "wrench" },
};

function renderMaintenanceChecklist(items, odometer) {
  const container = document.getElementById("maintenance-checklist-container");
  if (!container) return;

  container.innerHTML = Object.entries(MAINTENANCE_CATEGORIES)
    .map(([key, category]) => {
      const categoryItems = items.filter((item) => item.category === key);

      return `
            <details class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden" ${
              key === "engine" ? "open" : ""
            }>
                <summary class="p-4 font-bold cursor-pointer flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <i data-lucide="${
                          category.icon
                        }" class="w-5 h-5 text-gray-500"></i>
                        <span>${category.name}</span>
                    </div>
                    <i data-lucide="chevron-down" class="w-5 h-5 transition-transform transform details-arrow"></i>
                </summary>
                <div class="p-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                    ${
                      categoryItems.length > 0
                        ? categoryItems
                            .map((item) =>
                              renderMaintenanceItem(item, odometer)
                            )
                            .join("")
                        : '<p class="text-sm text-gray-400">Nenhum item nesta categoria.</p>'
                    }
                </div>
            </details>
        `;
    })
    .join("");

  lucide.createIcons();
}

function renderMaintenanceItem(item, odometer) {
  const lastService = item.lastServiceKm || 0;
  const interval = item.interval || 1;
  const currentKm = odometer || 0;
  const kmSinceService = currentKm - lastService;
  const progress = Math.min((kmSinceService / interval) * 100, 100);

  let progressBarColor = "bg-green-500";
  if (progress > 90) progressBarColor = "bg-red-500";
  else if (progress > 70) progressBarColor = "bg-yellow-500";

  return `
        <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg shadow-inner space-y-3">
            <div class="flex justify-between items-center">
                <span class="font-bold dark:text-gray-200">${item.name}</span>
                <div class="flex gap-2"> 
                    <button data-id="${
                      item.id
                    }" class="edit-maintenance-btn text-gray-400 hover:text-blue-500"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    <button data-id="${
                      item.id
                    }" class="delete-maintenance-btn text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div class="${progressBarColor} h-2.5 rounded-full" style="width: ${progress}%"></div>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                <span>Última: ${lastService} Km</span>
                <span>Próxima em: ${
                  interval - kmSinceService > 0 ? interval - kmSinceService : 0
                } Km</span>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-2">
                <button data-id="${
                  item.id
                }" class="history-service-btn w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                    <i data-lucide="history" class="w-4 h-4"></i> Histórico
                </button>
                <button data-id="${
                  item.id
                }" class="register-service-btn w-full bg-blue-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i> Registrar
                </button>
            </div>
        </div>
    `;
}
