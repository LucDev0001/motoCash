import { db, appId } from "../config.js";
import { currentUser } from "../auth.js";
import { unsubscribeListeners, showNotification } from "../ui.js";
import { router } from "../router.js";
import * as API from "../api.js";

export async function renderHub(c) {
  c.innerHTML = await fetch("src/templates/views/hub.html").then((res) =>
    res.text()
  );

  document
    .getElementById("hub-view-toggle-list")
    .addEventListener("click", () => setHubView("list"));
  document
    .getElementById("hub-view-toggle-map")
    .addEventListener("click", () => setHubView("map"));

  // Pede a localização do usuário para centralizar o mapa
  navigator.geolocation.getCurrentPosition(
    (position) => {
      initializeMap([position.coords.latitude, position.coords.longitude]);
    },
    () => initializeMap([-23.5505, -46.6333]) // Fallback para São Paulo
  );

  const unsub = db
    .collection("jobs")
    .where("status", "==", "disponivel")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      updateJobsUI(jobs, currentUser.uid);
    });
  unsubscribeListeners.push(unsub);
}

let map = null;

async function updateJobsUI(jobs, motoboyId) {
  const listContainer = document.getElementById("jobs-list-container");
  if (!listContainer) return;
  if (!currentUser) return;

  if (jobs.length === 0) {
    listContainer.innerHTML = `<p class="text-center text-gray-400 py-8">Nenhuma vaga publicada no momento.</p>`;
    return;
  }

  // Pré-busca o histórico de trabalhos do motoboy para otimizar
  const historySnap = await db
    .collection("jobs")
    .where("motoboyId", "==", motoboyId)
    .where("status", "==", "concluida")
    .get();

  const companyHistory = {};
  historySnap.forEach((doc) => {
    const job = doc.data();
    companyHistory[job.empresaId] = (companyHistory[job.empresaId] || 0) + 1;
  });

  const jobPromises = jobs.map(async (job) => {
    const completedCount = companyHistory[job.empresaId] || 0;
    let historyHtml = "";
    if (completedCount > 0) {
      historyHtml = `
        <div class="mt-2 p-2 bg-green-50 dark:bg-green-900/30 rounded-lg text-xs text-green-700 dark:text-green-300 font-semibold flex items-center gap-2">
          <i data-lucide="award" class="w-4 h-4"></i>
          Você já concluiu ${completedCount} vaga(s) para esta empresa.
        </div>
      `;
    }

    return `
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm space-y-2">
          <div class="flex justify-between items-start">
            <h3 class="font-bold text-lg dark:text-gray-200">${job.title}</h3>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 -mt-1">Publicado por: <span class="font-semibold">${
            job.empresaName
          }</span></p>
          ${historyHtml}
          <p class="text-sm text-gray-600 dark:text-gray-400 pt-2">${
            job.description
          }</p>
          <div class="border-t dark:border-gray-700 mt-2 pt-3 flex justify-between items-center">
              <span class="text-xs text-gray-400">
                  ${new Date(job.createdAt.seconds * 1000).toLocaleDateString(
                    "pt-BR"
                  )}
              </span> 
              <button data-id="${
                job.id
              }" class="accept-job-btn bg-green-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm">
                  <i data-lucide="check" class="w-4 h-4"></i> Aceitar Vaga
              </button>
          </div>
      </div>
      `;
  });

  listContainer.innerHTML = (await Promise.all(jobPromises)).join("");

  document.querySelectorAll(".accept-job-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      API.acceptJob(btn.dataset.id);
    });
  });

  // Atualiza os marcadores no mapa
  if (map) {
    // Limpa marcadores antigos
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    addMarkersToMap(jobs);
  }

  lucide.createIcons();
}

function addMarkersToMap(jobs) {
  if (!map) return;

  jobs.forEach((job) => {
    if (job.location && job.location.latitude && job.location.longitude) {
      const marker = L.marker([
        job.location.latitude,
        job.location.longitude,
      ]).addTo(map);
      marker.bindPopup(`
                <div class="font-sans">
                    <h3 class="font-bold">${job.title}</h3>
                    <p class="text-sm">${job.empresaName}</p>
                    <p class="text-xs text-gray-500">${
                      job.payment || "Pagamento a combinar"
                    }</p>
                    <button onclick="window.acceptJobFromMap('${
                      job.id
                    }')" class="mt-2 w-full bg-green-500 text-white text-xs font-bold py-1 px-2 rounded">Aceitar Vaga</button>
                </div>
            `);
    }
  });

  // Expondo a função para o escopo global para ser chamada pelo popup do Leaflet
  window.acceptJobFromMap = (jobId) => API.acceptJob(jobId);
}
export async function renderAddJob(c) {
  c.innerHTML = await fetch("src/templates/views/add-job.html").then((res) =>
    res.text()
  );
  document.getElementById("job-form").addEventListener("submit", API.submitJob);
  document
    .getElementById("job-cancel-btn")
    .addEventListener("click", () => router("hub"));
}

function setHubView(view) {
  const listView = document.getElementById("jobs-list-view");
  const mapView = document.getElementById("jobs-map-view");
  const listBtn = document.getElementById("hub-view-toggle-list");
  const mapBtn = document.getElementById("hub-view-toggle-map");

  const activeClasses =
    "bg-gray-900 dark:bg-yellow-500 dark:text-black text-white";
  const inactiveClasses = "text-gray-500";

  if (view === "list") {
    listView.classList.remove("hidden");
    mapView.classList.add("hidden");
    listBtn.className = `flex-1 py-2 text-sm font-bold rounded ${activeClasses}`;
    mapBtn.className = `flex-1 py-2 text-sm font-bold rounded ${inactiveClasses}`;
  } else {
    listView.classList.add("hidden");
    mapView.classList.remove("hidden");
    mapBtn.className = `flex-1 py-2 text-sm font-bold rounded ${activeClasses}`;
    listBtn.className = `flex-1 py-2 text-sm font-bold rounded ${inactiveClasses}`;
    // Força o mapa a se redimensionar corretamente
    if (map) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  }
}

function initializeMap(centerCoordinates) {
  if (map) return; // Não inicializa duas vezes

  const mapContainer = document.getElementById("jobs-map-view");
  if (!mapContainer) return;

  map = L.map(mapContainer).setView(centerCoordinates, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
}
