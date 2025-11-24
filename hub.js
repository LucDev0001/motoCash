import { db, appId } from "./config.js";

let map = null; // Variável global para a instância do mapa
let markerClusterGroup = null; // Grupo para agrupar os marcadores
let viewerLocation = null; // Localização de quem está vendo o mapa
let viewerMarker = null; // Marcador para a localização do visualizador
let motoboysData = []; // Cache dos dados dos motoboys

/**
 * Busca motoboys com status online no Firestore e atualiza a UI.
 * @param {function} callback - Função para ser chamada com os dados dos motoboys.
 */
function getOnlineMotoboys(callback) {
  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .where("status.isOnline", "==", true)
    .onSnapshot(
      (snapshot) => {
        const onlineUsers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        motoboysData = onlineUsers; // Armazena os dados em cache
        callback(onlineUsers);
      },
      (error) => {
        console.error("Erro ao buscar motoboys online:", error);
        const listContainer = document.getElementById("hub-view-list");
        if (listContainer) {
          listContainer.innerHTML = `<p class="text-center text-red-400 py-8">Não foi possível carregar os dados do Hub. Verifique o console para mais detalhes.</p>`;
        }
      }
    );
}

/**
 * Atualiza a interface da lista de motoboys.
 * @param {Array} motoboys - Array de objetos de motoboys.
 */
function updateHubUI(motoboys) {
  const listContainer = document.getElementById("hub-view-list");
  if (!listContainer) return;

  if (motoboys.length === 0) {
    // Limpa o mapa se não houver motoboys
    if (markerClusterGroup) markerClusterGroup.clearLayers();
    listContainer.innerHTML = `<p class="text-center text-gray-400 py-8">Nenhum motoboy online no momento.</p>`;
    return;
  }

  listContainer.innerHTML = motoboys
    .map(
      (m) => `
    <div onclick='openMotoboyDetails(${JSON.stringify(m)})' 
         class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
      <div class="flex items-center gap-3">
        <div class="bg-gray-200 dark:bg-gray-700 p-2 rounded-full"><i data-lucide="bike" class="w-6 h-6 text-gray-600 dark:text-gray-300"></i></div>
        <div>
          <p class="font-bold text-gray-900 dark:text-white">${
            m.publicProfile.name
          }</p>
          <div class="flex items-center gap-2">
            <p class="text-xs text-gray-500">${m.publicProfile.motoModel}</p>
            ${
              viewerLocation && m.status?.location
                ? `<span class="text-xs text-blue-500 font-semibold">· ~${getDistance(
                    viewerLocation.latitude,
                    viewerLocation.longitude,
                    m.status.location.latitude,
                    m.status.location.longitude
                  ).toFixed(1)} km</span>`
                : ""
            }
          </div>
        </div>
      </div>
      <i data-lucide="chevron-right" class="text-gray-400"></i>
    </div>
  `
    )
    .join("");

  lucide.createIcons();
  updateMapMarkers(motoboys);
}

/**
 * Calcula a distância entre duas coordenadas usando a fórmula de Haversine.
 * @returns {number} Distância em quilômetros.
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

/**
 * Inicializa o mapa Leaflet.
 */
function initMap() {
  if (map) return; // Não inicializa se já existir
  map = L.map("leaflet-map").setView([-14.235, -51.925], 4); // Centro do Brasil

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

function updateMapMarkers(motoboys) {
  if (!markerClusterGroup) return;
  markerClusterGroup.clearLayers(); // Limpa marcadores antigos

  motoboys.forEach((m) => {
    if (m.status?.location) {
      const { latitude, longitude } = m.status.location;
      const marker = L.marker([latitude, longitude]);

      let distanceInfo = "";
      if (viewerLocation) {
        const distance = getDistance(
          viewerLocation.latitude,
          viewerLocation.longitude,
          latitude,
          longitude
        );
        distanceInfo = `<br>~ ${distance.toFixed(1)} km de distância`;
      }

      marker.bindPopup(
        `<b>${
          m.publicProfile.name
        }</b>${distanceInfo}<br><button onclick='openMotoboyDetails(${JSON.stringify(
          m
        )})' class='text-blue-500 underline mt-1'>Ver Detalhes</button>`
      );
      markerClusterGroup.addLayer(marker);
    }
  });

  // Ajusta o zoom do mapa para mostrar todos os marcadores
  const markers = markerClusterGroup.getLayers();
  if (markers.length > 1) {
    const bounds = markerClusterGroup.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  } else if (markers.length === 1) {
    // Se houver apenas um marcador, centraliza nele com um zoom fixo
    map.setView(markers[0].getLatLng(), 15);
  } else {
    // Se não houver marcadores, volta para a visão do Brasil
    map.setView([-14.235, -51.925], 4);
  }
}

window.openMotoboyDetails = (motoboy) => {
  const modal = document.getElementById("hub-motoboy-details-modal");
  const content = document.getElementById("motoboy-details-content");
  const whatsappLink = `https://wa.me/55${
    motoboy.publicProfile.whatsapp
  }?text=${encodeURIComponent(
    `Olá ${motoboy.publicProfile.name}, vi seu perfil no Hub do MotoCash e gostaria de solicitar uma entrega.`
  )}`;

  content.innerHTML = `
        <div class="flex justify-end"><button onclick="closeMotoboyDetails()" class="text-gray-400"><i data-lucide="x"></i></button></div>
        <div class="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto -mt-4 mb-4 flex items-center justify-center"><i data-lucide="user" class="w-10 text-gray-400"></i></div>
        <h3 class="text-xl font-bold dark:text-white">${
          motoboy.publicProfile.name
        }</h3>
        ${
          viewerLocation && motoboy.status?.location
            ? `<p class="text-sm text-blue-500 font-bold mt-2">~${getDistance(
                viewerLocation.latitude,
                viewerLocation.longitude,
                motoboy.status.location.latitude,
                motoboy.status.location.longitude
              ).toFixed(1)} km de você</p>`
            : ""
        }
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
};

window.closeMotoboyDetails = () => {
  document.getElementById("hub-motoboy-details-modal").classList.add("hidden");
};

window.setHubView = (view) => {
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
};

window.centerOnViewerLocation = () => {
  if (viewerLocation && map) {
    map.setView(
      [viewerLocation.latitude, viewerLocation.longitude],
      15 // Nível de zoom mais próximo
    );
  } else {
    alert(
      "Sua localização não está disponível. Por favor, permita o acesso à localização no seu navegador."
    );
  }
};

function getViewerLocation() {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      viewerLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      // Adiciona ou atualiza o marcador do visualizador no mapa
      if (viewerMarker) {
        viewerMarker.setLatLng([
          viewerLocation.latitude,
          viewerLocation.longitude,
        ]);
      } else {
        viewerMarker = L.circleMarker(
          [viewerLocation.latitude, viewerLocation.longitude],
          {
            radius: 8,
            color: "#3b82f6", // Azul
            fillColor: "#60a5fa",
            fillOpacity: 0.8,
          }
        )
          .addTo(map)
          .bindPopup("Sua localização");
      }

      // Atualiza a UI com os dados já em cache para exibir as distâncias imediatamente
      updateHubUI(motoboysData);
    },
    (error) => {
      console.warn(
        "Não foi possível obter a localização do visualizador:",
        error.message
      );
    },
    { enableHighAccuracy: true } // Solicita a localização mais precisa possível
  );
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  initMap();
  getViewerLocation(); // Pede a localização do usuário
  getOnlineMotoboys(updateHubUI);
});
