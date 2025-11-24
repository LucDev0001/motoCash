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
  const listContainer = document.getElementById("list-content");
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
  // Adiciona o grupo de marcadores ao mapa assim que ele for inicializado
  if (!markerClusterGroup) {
    markerClusterGroup = L.markerClusterGroup();
  }

  if (map) return; // Não inicializa se já existir
  map = L.map("leaflet-map").setView([-14.235, -51.925], 4); // Centro do Brasil

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  map.addLayer(markerClusterGroup);
}

function updateMapMarkers(motoboys) {
  if (!markerClusterGroup) return;
  markerClusterGroup.clearLayers(); // Limpa marcadores antigos

  // Ícone de moto SVG para marcadores individuais
  const bikeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M19.82 19a2 2_0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m3 19-1-4-1-1"/><path d="m19 19 2-4 1-1"/><path d="M12 8s-2 4-4 4"/><path d="M12 8s2 4 4 4"/><path d="M12 8V5l-2-3h4l-2 3Z"/></svg>`;

  motoboys.forEach((m) => {
    if (m.status?.location) {
      const { latitude, longitude } = m.status.location;
      const marker = L.marker([latitude, longitude], {
        icon: L.divIcon({
          html: bikeSvg,
          className:
            "flex items-center justify-center bg-yellow-500 p-2 rounded-full shadow-lg",
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        }),
      });

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
  const bounds = markerClusterGroup.getBounds();
  if (bounds.isValid()) {
    const markerCount = markerClusterGroup.getLayers().length;
    if (markerCount > 1) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (markerCount === 1) {
      map.setView(bounds.getCenter(), 15); // Zoom mais próximo para um único motoboy
    }
  } else {
    // Se não houver marcadores, volta para a visão do Brasil
    map.setView([-14.235, -51.925], 4);
  }
}

window.openMotoboyDetails = function (motoboy) {
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

window.closeMotoboyDetails = function () {
  document.getElementById("hub-motoboy-details-modal").classList.add("hidden");
};

function setHubView(view) {
  const listView = document.getElementById("hub-view-list");
  const mapTab = document.getElementById("hub-tab-map");
  const listTab = document.getElementById("hub-tab-list");

  if (view === "map") {
    listView.classList.add("translate-y-full"); // Esconde o painel da lista
    mapTab.className =
      "fin-tab flex-1 py-3 text-sm font-bold bg-gray-900 dark:bg-yellow-500 dark:text-black text-white rounded-l-lg";
    listTab.className =
      "fin-tab flex-1 py-3 text-sm font-bold text-gray-500 rounded-r-lg";
  } else {
    listView.classList.remove("translate-y-full"); // Mostra o painel da lista
    listTab.className =
      "fin-tab flex-1 py-3 text-sm font-bold bg-gray-900 dark:bg-yellow-500 dark:text-black text-white rounded-r-lg";
    mapTab.className =
      "fin-tab flex-1 py-3 text-sm font-bold text-gray-500 rounded-l-lg";
  }
}

function centerOnViewerLocation() {
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
}

function getViewerLocation() {
  const handleSuccess = (position) => {
    // Esconde o modal de permissão se estiver visível
    document
      .getElementById("location-permission-modal")
      .classList.add("hidden");

    viewerLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    // **NOVO: Centraliza e aplica zoom na localização do usuário**
    if (map) {
      map.setView(
        [viewerLocation.latitude, viewerLocation.longitude],
        15, // Nível de zoom mais próximo
        { animate: true }
      );
    }

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
  };

  const handleError = (error) => {
    console.warn(
      "Não foi possível obter a localização do visualizador:",
      error.message
    );
    // Se o erro for de permissão negada, mostra o modal.
    if (error.code === error.PERMISSION_DENIED) {
      document
        .getElementById("location-permission-modal")
        .classList.remove("hidden");
    }
  };

  // Verifica o status da permissão antes de pedir
  navigator.permissions
    .query({ name: "geolocation" })
    .then((permissionStatus) => {
      if (permissionStatus.state === "granted") {
        // Se já tem permissão, pega a localização
        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
          enableHighAccuracy: true,
        });
      } else if (permissionStatus.state === "prompt") {
        // Se ainda não perguntou, mostra nosso modal customizado
        document
          .getElementById("location-permission-modal")
          .classList.remove("hidden");
      } else if (permissionStatus.state === "denied") {
        // Se foi negado, mostra nosso modal (o navegador pode não mostrar o prompt de novo)
        document
          .getElementById("location-permission-modal")
          .classList.remove("hidden");
      }

      // Ouve por mudanças na permissão
      permissionStatus.onchange = () => {
        if (permissionStatus.state === "granted") {
          navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
          });
        }
      };
    });
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  initMap();
  getViewerLocation(); // Verifica a permissão e/ou pede a localização do usuário
  getOnlineMotoboys(updateHubUI);

  // --- NOVOS EVENT LISTENERS ---
  // Botões de aba (Mapa/Lista)
  document
    .getElementById("hub-tab-map")
    .addEventListener("click", () => setHubView("map"));
  document
    .getElementById("hub-tab-list")
    .addEventListener("click", () => setHubView("list"));

  // Alça para fechar a lista
  document
    .getElementById("list-view-handle")
    .addEventListener("click", () => setHubView("map"));

  // Botão para centralizar no usuário
  document
    .getElementById("center-view-btn")
    .addEventListener("click", centerOnViewerLocation);

  // Botão no modal para solicitar permissão
  document
    .getElementById("request-location-btn")
    .addEventListener("click", () => {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {},
        {}
      ); // Apenas para acionar o prompt do navegador
    });
});
