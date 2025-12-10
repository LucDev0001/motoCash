document.addEventListener("DOMContentLoaded", async () => {
  const {
    auth,
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    deleteDoc,
    updateDoc,
    orderBy,
    runTransaction,
    arrayUnion,
    deleteField,
    arrayRemove,
    serverTimestamp,
    limit,
  } = window.firebaseTools;

  let currentCompanyData = null; // Variável para guardar os dados da empresa
  let currentAppSettings = {}; // Variável para guardar as configurações do app

  // Carrega as configurações globais e verifica o modo manutenção
  const maintenanceActive = await loadGlobalSettings();
  if (maintenanceActive) {
    // Se a manutenção estiver ativa, não continua a inicialização do app.
    return;
  }

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const authError = document.getElementById("auth-error");
  const authScreen = document.getElementById("auth-screen");
  const pendingScreen = document.getElementById("pending-approval-screen");
  const appScreen = document.getElementById("app-screen");

  // Variáveis de estado para o modal de avaliação
  let currentRatingJobId = null;
  let currentRatingMotoboyId = null;
  let currentStarRating = 0;

  // Controle das abas
  tabLogin.addEventListener("click", () => {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    tabLogin.classList.add("border-yellow-500", "text-yellow-500");
    tabRegister.classList.remove("border-yellow-500", "text-yellow-500");
    tabRegister.classList.add("text-gray-400");
  });

  tabRegister.addEventListener("click", () => {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    tabRegister.classList.add("border-yellow-500", "text-yellow-500");
    tabLogin.classList.remove("border-yellow-500", "text-yellow-500");
    tabLogin.classList.add("text-gray-400");
  });

  // Função para mostrar erros
  function showError(message) {
    authError.textContent = message;
    authError.classList.remove("hidden");
  }

  // Lógica de Cadastro
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(""); // Limpa erros anteriores

    const name = document.getElementById("register-name").value;
    const cnpj = document.getElementById("register-cnpj").value;
    const address = {
      cep: document.getElementById("register-cep").value,
      logradouro: document.getElementById("register-logradouro").value,
      numero: document.getElementById("register-numero").value,
      bairro: document.getElementById("register-bairro").value,
      cidade: document.getElementById("register-cidade").value,
      estado: document.getElementById("register-estado").value,
    };
    const fullAddressString = `${address.logradouro}, ${address.numero} - ${address.bairro}, ${address.cidade} - ${address.estado}, ${address.cep}`;

    const whatsapp = document.getElementById("register-whatsapp").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    // Validação do CNPJ
    if (!validateCNPJ(cnpj)) {
      return showError(
        "O CNPJ informado é inválido. Verifique os números e tente novamente."
      );
    }

    // Mostra um feedback de carregamento no botão
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>`;

    // Geocodifica o endereço para obter as coordenadas
    const location = await getCoordinatesFromAddress(address);

    try {
      // 1. Cria o usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // 2. Salva os dados da empresa em uma nova coleção 'companies'
      const companyRef = doc(db, "companies", user.uid);
      await setDoc(companyRef, {
        name: name,
        cnpj,
        address, // Salva o objeto de endereço
        whatsapp,
        email,
        status: "pending", // Status inicial de aprovação
        fullAddress: fullAddressString, // Salva a string completa para buscas/exibição
        location: location, // Salva as coordenadas geográficas
        createdAt: new Date(),
      });

      // 3. Mostra a tela de "Aguardando Aprovação"
      document.getElementById("pending-email").textContent = email;
      authScreen.classList.add("hidden");
      pendingScreen.classList.remove("hidden");
    } catch (error) {
      console.error("Erro no cadastro:", error);
      showError("Erro ao cadastrar: " + error.message);
    }
  });

  /**
   * Converte um objeto de endereço em coordenadas (latitude, longitude) usando a API Nominatim.
   * @param {object} address - O objeto de endereço com logradouro, numero, cidade, estado.
   * @returns {Promise<object|null>} - Um objeto com {lat, lon} ou null se não for encontrado.
   */
  async function getCoordinatesFromAddress(address) {
    if (!address.logradouro || !address.cidade || !address.estado) {
      console.warn("Endereço incompleto para geocodificação.");
      return null;
    }
    const addressString = `${address.logradouro}, ${address.numero}, ${address.cidade}, ${address.estado}, Brasil`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      addressString
    )}`;
    // Usamos um proxy para contornar a política de CORS do Nominatim
    // Este proxy adiciona os cabeçalhos necessários para a requisição ser aceita.
    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(
      nominatimUrl
    )}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        console.log(
          `Coordenadas encontradas para '${addressString}': Lat: ${lat}, Lon: ${lon}`
        );
        return { lat: parseFloat(lat), lon: parseFloat(lon) };
      }
      return null;
    } catch (error) {
      console.error("Erro na geocodificação:", error);
      return null;
    }
  }

  // Função para buscar endereço pelo CEP
  async function fetchAddressByCep(cep, formPrefix) {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cleanCep}/json/`
      );
      if (!response.ok) throw new Error("CEP não encontrado.");

      const data = await response.json();
      if (data.erro) throw new Error("CEP inválido.");

      document.getElementById(`${formPrefix}-logradouro`).value =
        data.logradouro;
      document.getElementById(`${formPrefix}-bairro`).value = data.bairro;
      document.getElementById(`${formPrefix}-cidade`).value = data.localidade;
      document.getElementById(`${formPrefix}-estado`).value = data.uf;

      // Foca no campo de número para o usuário preencher
      document.getElementById(`${formPrefix}-numero`).focus();
    } catch (error) {
      console.warn("Erro ao buscar CEP:", error.message);
      // Não mostra alerta para não atrapalhar o usuário, apenas loga no console.
    }
  }

  // Adiciona o listener para o campo de CEP no formulário de registro
  document.getElementById("register-cep").addEventListener("blur", (e) => {
    fetchAddressByCep(e.target.value, "register");
  });

  // Lógica de Login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O onAuthStateChanged vai lidar com o redirecionamento
    } catch (error) {
      console.error("Erro no login:", error);
      showError("E-mail ou senha inválidos.");
    }
  });

  // Monitora o estado de autenticação
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const companyRef = doc(db, "companies", user.uid);
      const companySnap = await getDoc(companyRef);

      if (companySnap.exists() && companySnap.data().status === "approved") {
        authScreen.classList.add("hidden");
        pendingScreen.classList.add("hidden");
        appScreen.classList.remove("hidden");
        initDashboard(companySnap.data()); // Inicia o dashboard com os dados da empresa
      } else {
        // Se não for aprovado, ou não existir, mostra a tela de pendente
        document.getElementById("pending-email").textContent = user.email;
        authScreen.classList.add("hidden");
        appScreen.classList.add("hidden");
        pendingScreen.classList.remove("hidden");
      }
    } else {
      authScreen.classList.remove("hidden");
      pendingScreen.classList.add("hidden");
      appScreen.classList.add("hidden");
    }
  });

  // Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => auth.signOut());
  }

  const createJobBtn = document.getElementById("open-create-job-modal-btn");
  if (createJobBtn) {
    createJobBtn.addEventListener("click", openCreateJobModal);
  }

  // Navegação do Dashboard da Empresa
  document
    .getElementById("nav-company-dashboard")
    .addEventListener("click", () => navigateCompanyDashboard("dashboard"));
  document
    .getElementById("nav-company-history")
    .addEventListener("click", () => navigateCompanyDashboard("history"));
  document
    .getElementById("nav-company-chat")
    .addEventListener("click", () => navigateCompanyDashboard("chat"));
  document
    .getElementById("nav-company-profile")
    .addEventListener("click", () => navigateCompanyDashboard("profile"));

  let map = null;
  let motoboyMarkers = [];

  function initDashboard(companyData) {
    currentCompanyData = companyData; // Salva os dados da empresa
    document.getElementById("company-name-header").textContent =
      companyData.name;
    initializeMotoboysMap(companyData); // Prepara o mapa e inicia o listener de motoboys
    listenForPublishedJobs(); // NOVO: Inicia o listener para as vagas da empresa
    listenForPastJobs(); // NOVO: Inicia o listener para o histórico
    listenForAcceptedJobs(); // NOVO: Inicia o listener para vagas que foram aceitas

    // Adiciona o listener para o formulário de perfil
    const profileForm = document.getElementById("company-profile-form");
    if (profileForm) {
      // Garante que o listener seja adicionado apenas uma vez
      profileForm.removeEventListener("submit", handleUpdateProfile);
      profileForm.addEventListener("submit", handleUpdateProfile);
    }
  }

  function initializeMotoboysMap(companyData) {
    const mapNotice = document.getElementById("map-notice");

    // Se a empresa tem uma localização válida
    if (companyData.location && companyData.location.lat) {
      const centerCoordinates = [
        companyData.location.lat,
        companyData.location.lon,
      ];

      if (map) {
        // Se o mapa já existe, apenas atualiza a visão e esconde o aviso
        map.setView(centerCoordinates, 15);
        if (mapNotice) mapNotice.classList.add("hidden");
      } else {
        // Se o mapa não existe, cria um novo já centralizado
        map = L.map("motoboys-map-container").setView(centerCoordinates, 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
      }

      if (mapNotice) mapNotice.classList.add("hidden");
    } else {
      // Se não houver localização, cria o mapa com aviso (se não existir)
      if (!map) {
        map = L.map("motoboys-map-container").setView([-23.5505, -46.6333], 14); // Fallback para São Paulo
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
      }
      // Garante que o aviso seja exibido
      mapNotice.classList.remove("hidden");
      mapNotice.innerHTML = `<i data-lucide="alert-triangle" class="w-5 h-5 text-yellow-500"></i><span>Para ver sua localização no mapa, adicione seu endereço no <a href="#" onclick="document.getElementById('nav-company-profile').click()" class="font-bold underline">Perfil</a>.</span>`;
      lucide.createIcons(); // Garante que o ícone do aviso seja renderizado
    }

    // Adiciona o botão de centralizar
    const centerBtn = document.getElementById("center-map-btn");
    if (centerBtn) {
      lucide.createIcons(); // Garante que o ícone do botão seja renderizado
      centerBtn.classList.remove("hidden");
      centerBtn.onclick = () => {
        if (companyData.location && companyData.location.lat) {
          map.setView([companyData.location.lat, companyData.location.lon], 16);
        } else {
          alert("Adicione seu endereço no perfil para usar esta função.");
        }
      };
    }

    // Inicia (ou reinicia) o listener de motoboys com os dados mais recentes da empresa
    listenForOnlineMotoboys(companyData);
  }

  function listenForOnlineMotoboys(companyData) {
    const usersRef = collection(db, "artifacts", "moto-manager-v1", "users");
    const q = query(usersRef, where("status.isOnline", "==", true));

    onSnapshot(q, (snapshot) => {
      let onlineMotoboys = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const searchRadius = currentAppSettings.searchRadius || 10; // Raio em KM, com fallback para 10km

      // Filtra os motoboys com base no raio de busca, se a empresa tiver localização
      if (companyData?.location?.lat) {
        onlineMotoboys = onlineMotoboys.filter((motoboy) => {
          // CORREÇÃO: Adicionado .location no caminho
          if (
            !motoboy.status?.location?.latitude ||
            !motoboy.status?.location?.longitude
          )
            return false;

          const distance = getDistance(
            companyData.location.lat,
            companyData.location.lon,
            motoboy.status.location.latitude, // <--- AQUI
            motoboy.status.location.longitude // <--- AQUI
          );
          return distance <= searchRadius;
        });
      }

      updateMapMarkers(onlineMotoboys, searchRadius);
    });
  }
  function updateMapMarkers(motoboys) {
    if (!map) return;

    // 1. Limpa marcadores antigos
    motoboyMarkers.forEach((marker) => map.removeLayer(marker));
    motoboyMarkers = [];

    // 2. Define o ícone usando o arquivo LOCAL (bike.svg)
    // Usamos L.divIcon para manter o estilo de bolinha branca (definido no CSS)
    const motoboyIcon = L.divIcon({
      html: `<img src="../assets/img/moto.png"  
      class="rounded-full border-2 border-white shadow-md"
      style="width: 100%; height: 100%;" />`,
      className: "", // Remove estilos padrão do Leaflet para usar o nosso CSS
      iconSize: [20, 20], // Tamanho total do ícone
      iconAnchor: [20, 20], // Ponto de ancoragem (centro do ícone)
      popupAnchor: [0, -20], // Onde o balão abre em relação ao ícone
    });

    motoboys.forEach((motoboy) => {
      // 3. A CORREÇÃO CRÍTICA DE LÓGICA:
      // Acessamos 'status.location' em vez de 'motoboy.location' direto
      const locationData = motoboy.status?.location;

      if (locationData?.latitude && locationData?.longitude) {
        const { latitude, longitude } = locationData;

        // Cria o marcador com o ícone SVG local
        const marker = L.marker([latitude, longitude], {
          icon: motoboyIcon,
        }).addTo(map);

        const profile = motoboy.publicProfile || {};
        const rating = profile.rating
          ? `${profile.rating.toFixed(1)} ★`
          : "N/A";
        const ratingCount = profile.ratingCount || 0;

        marker.bindPopup(`
        <div class="font-sans">
            <h3 class="font-bold">${profile.name || "Motoboy"}</h3>
            <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                <p>${profile.fipeModelText || "Moto não informada"}</p>
                <p class="text-xs">Placa: ${profile.motoPlate || "N/A"}</p>
                <p class="text-xs font-bold mt-2">Avaliação: ${rating} (${ratingCount} ${
          ratingCount === 1 ? "avaliação" : "avaliações"
        })</p>
            </div>
        </div>
      `);

        motoboyMarkers.push(marker);
      }
    });
  }

  /**
   * Valida um número de CNPJ.
   * @param {string} cnpj - O CNPJ a ser validado.
   * @returns {boolean} - Retorna true se o CNPJ for válido, false caso contrário.
   */
  function validateCNPJ(cnpj) {
    cnpj = cnpj.replace(/[^\d]+/g, "");

    if (cnpj == "") return false;
    if (cnpj.length != 14) return false;

    // Elimina CNPJs invalidos conhecidos
    if (/^(\d)\1+$/.test(cnpj)) return false;

    // Valida DVs
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != digitos.charAt(0)) return false;

    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != digitos.charAt(1)) return false;

    return true;
  }

  function navigateCompanyDashboard(view) {
    // Esconde todas as views
    document.getElementById("view-company-dashboard").classList.add("hidden");
    document.getElementById("view-company-history").classList.add("hidden");
    document.getElementById("view-company-chat").classList.add("hidden");
    document.getElementById("view-company-profile").classList.add("hidden");

    // Mostra a view correta
    document.getElementById(`view-company-${view}`).classList.remove("hidden");

    // Se a view for de perfil, carrega os dados no formulário
    if (view === "profile") {
      renderCompanyProfile();
    }

    // Se a view for de chat, inicia o listener da lista de chats
    if (view === "chat") {
      // A lista de chats já é atualizada em tempo real por listenForAcceptedJobs
    }

    // Atualiza o estilo das abas
    document.querySelectorAll(".company-nav-btn").forEach((btn) => {
      btn.classList.remove("text-yellow-500", "border-yellow-500");
      btn.classList.add("text-gray-500");
    });
    document
      .getElementById(`nav-company-${view}`)
      .classList.add("text-yellow-500", "border-yellow-500");
  }

  function listenForPublishedJobs() {
    const user = auth.currentUser;
    if (!user) return;

    const jobsRef = collection(db, "jobs");
    // Busca vagas que são da empresa e estão com status 'disponivel'
    const q = query(
      jobsRef,
      where("empresaId", "==", user.uid),
      where("status", "==", "disponivel"),
      orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
      const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderPublishedJobsList(jobs);
    });
  }

  function listenForAcceptedJobs() {
    const user = auth.currentUser;
    if (!user) return;

    const jobsRef = collection(db, "jobs");
    // Busca vagas que são da empresa e estão com status 'negociando'
    const q = query(
      jobsRef,
      where("empresaId", "==", user.uid),
      where("status", "==", "negociando"),
      orderBy("createdAt", "desc")
    );

    const chatNav = document.getElementById("nav-company-chat");
    const chatBadge = document.getElementById("chat-notification-badge");

    onSnapshot(q, (snapshot) => {
      // Remove os cards de negociação antigos antes de renderizar os novos
      document
        .querySelectorAll(".negotiating-job-card")
        .forEach((card) => card.remove());

      const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderChatList(jobs); // Renderiza a lista na nova tela de chat
      renderPublishedJobsList(jobs, true); // Passa um flag para indicar que são vagas em negociação

      // Controla a visibilidade da aba de Chat
      if (jobs.length > 0) {
        chatNav.classList.remove("hidden");
      } else {
        chatNav.classList.add("hidden");
        // Se não há mais chats, e o usuário está na tela de chat, redireciona para o dashboard
        if (
          !document
            .getElementById("view-company-chat")
            .classList.contains("hidden")
        ) {
          navigateCompanyDashboard("dashboard");
        }
      }
    });
  }

  function listenForPastJobs() {
    const user = auth.currentUser;
    if (!user) return;

    const jobsRef = collection(db, "jobs");
    // Busca vagas que são da empresa e estão com status 'concluida' ou 'cancelada'
    const q = query(
      jobsRef,
      where("empresaId", "==", user.uid),
      where("status", "in", ["concluida", "cancelada"]),
      orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
      const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderPastJobsList(jobs);
    });
  }

  function renderPublishedJobsList(jobs, isNegotiating = false) {
    const container = document.getElementById("published-jobs-container");
    if (!container) return;

    // Se for a primeira renderização (sem ser de negociação), limpa o container
    if (!isNegotiating) {
      container.innerHTML = "";
    }

    if (jobs.length === 0 && !isNegotiating) {
      container.innerHTML = `<p class="text-center text-gray-400 py-8">Você ainda não publicou nenhuma vaga.</p>`;
      return;
    }

    jobs.forEach((job) => {
      // Remove card antigo se existir, para atualizar
      const existingCard = document.getElementById(`job-card-${job.id}`);
      if (existingCard) existingCard.remove();

      const card = document.createElement("div");
      card.id = `job-card-${job.id}`; // Adiciona um ID único ao card
      card.className = // Estilos do card
        "bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-700";

      if (isNegotiating) {
        card.classList.add("negotiating-job-card");
      }

      let actionButton = `
            <button onclick="window.openEditJobModal('${job.id}')" class="text-blue-500 hover:text-blue-700"><i data-lucide="edit" class="w-4 h-4"></i></button>
            <button onclick="window.deleteJob('${job.id}')" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;

      if (isNegotiating) {
        actionButton = `
                <button onclick="window.navigateToChatView('${job.id}')" class="bg-orange-500 text-white text-xs font-bold py-1 px-2 rounded-md flex items-center gap-1 animate-pulse">
                    <i data-lucide="message-square" class="w-3 h-3"></i> Em Negociação
                </button>
            `;
      }

      card.innerHTML = `
            <div class="flex justify-between items-start">
                <h4 class="font-bold text-sm pr-2">${job.title}</h4>
                <div class="flex gap-2 shrink-0">
                    ${actionButton}
                </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${job.payment}</p>
        `;
      container.prepend(card); // Adiciona no topo da lista
    });

    lucide.createIcons();
  }

  function renderPastJobsList(jobs) {
    const container = document.getElementById("past-jobs-container");
    if (!container) return;

    if (jobs.length === 0) {
      container.innerHTML = `<p class="text-center text-gray-400 py-8">Nenhuma vaga no seu histórico.</p>`;
      return;
    }

    container.innerHTML = jobs
      .map((job) => {
        const isConcluded = job.status === "concluida";
        const hasMotoboy = job.motoboyId && job.motoboyName;
        let ratingSection = "";

        if (isConcluded && hasMotoboy) {
          ratingSection = `
                <div class="mt-3 pt-3 border-t dark:border-gray-700">
                    <p class="text-xs font-bold text-gray-500 mb-2">Avalie o serviço de ${
                      job.motoboyName
                    }:</p>
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-1 rating-stars" data-job-id="${
                          job.id
                        }" data-motoboy-id="${job.motoboyId}">
                            ${[1, 2, 3, 4, 5]
                              .map(
                                (star) => `
                                <i data-lucide="star" class="w-6 h-6 cursor-pointer ${
                                  job.ratingGiven && job.ratingGiven >= star
                                    ? "text-yellow-400 fill-current"
                                    : "text-gray-300 dark:text-gray-600"
                                }"></i>
                            `
                              )
                              .join("")}
                        </div>
                        <button data-motoboy-id="${
                          job.motoboyId
                        }" class="toggle-favorite-btn text-gray-300 dark:text-gray-600 hover:text-red-500 p-1 rounded-full">
                            <i data-lucide="heart" class="w-6 h-6 ${
                              currentCompanyData?.favoriteMotoboys?.includes(
                                job.motoboyId
                              )
                                ? "text-red-500 fill-current"
                                : ""
                            }"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                <div class="flex justify-between items-center">
                    <h4 class="font-bold">${job.title}</h4>
                    <span class="text-xs font-bold px-2 py-1 rounded-full ${
                      isConcluded
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }">${job.status}</span>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Motoboy: ${
                  job.motoboyName || "N/A"
                }</p>
                ${ratingSection}
            </div>
        `;
      })
      .join("");

    // Adiciona listeners para as estrelas de avaliação
    container.querySelectorAll(".rating-stars").forEach((starContainer) => {
      const jobId = starContainer.dataset.jobId;
      const job = jobs.find((j) => j.id === jobId); // Encontra o job correspondente

      if (job && !job.ratingGiven) {
        // Verifica se o job existe e não foi avaliado
        const stars = starContainer.querySelectorAll("i");
        stars.forEach((star, index) => {
          star.addEventListener("click", () => {
            const rating = index + 1;
            const motoboyId = starContainer.dataset.motoboyId;
            window.rateMotoboy(jobId, motoboyId, rating);
          });
        }); // Fim do forEach das estrelas
      }
    });

    // Adiciona listeners para os botões de favoritar
    container.querySelectorAll(".toggle-favorite-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        window.toggleFavoriteMotoboy(btn.dataset.motoboyId)
      );
    });

    lucide.createIcons();
  }

  window.rateMotoboy = async (jobId, motoboyId, rating) => {
    const jobRef = doc(db, "jobs", jobId);
    const motoboyRef = doc(
      db,
      "artifacts",
      "moto-manager-v1",
      "users",
      motoboyId
    );

    try {
      await runTransaction(db, async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        if (jobDoc.data().ratingGiven) {
          throw "Você já avaliou este serviço.";
        }

        const motoboyDoc = await transaction.get(motoboyRef);
        const motoboyData = motoboyDoc.data().publicProfile || {};
        const currentRating = motoboyData.rating || 0;
        const ratingCount = motoboyData.ratingCount || 0;

        const newRatingCount = ratingCount + 1;
        const newTotalRating = currentRating * ratingCount + rating;
        const newAverageRating = newTotalRating / newRatingCount;

        transaction.update(motoboyRef, {
          "publicProfile.rating": newAverageRating,
          "publicProfile.ratingCount": newRatingCount,
        });
        transaction.update(jobRef, { ratingGiven: rating });
      });
      alert("Avaliação enviada com sucesso!");
      // Re-renderiza a lista de histórico para refletir a mudança
      listenForPastJobs();
    } catch (error) {
      alert("Erro ao enviar avaliação: " + error);
    }
  };

  window.toggleFavoriteMotoboy = async (motoboyId) => {
    const user = auth.currentUser;
    if (!user || !motoboyId) return;

    const companyRef = doc(db, "companies", user.uid);
    const isCurrentlyFavorite =
      currentCompanyData?.favoriteMotoboys?.includes(motoboyId);

    try {
      if (isCurrentlyFavorite) {
        // Remove da lista de favoritos
        await updateDoc(companyRef, {
          favoriteMotoboys: arrayRemove(motoboyId),
        });
        // Atualiza o estado local
        currentCompanyData.favoriteMotoboys =
          currentCompanyData.favoriteMotoboys.filter((id) => id !== motoboyId);
      } else {
        // Adiciona à lista de favoritos
        await updateDoc(companyRef, {
          favoriteMotoboys: arrayUnion(motoboyId),
        });
        // Atualiza o estado local
        if (!currentCompanyData.favoriteMotoboys)
          currentCompanyData.favoriteMotoboys = [];
        currentCompanyData.favoriteMotoboys.push(motoboyId);
      }
      // Re-renderiza a lista de histórico para refletir a mudança em todos os cards do mesmo motoboy
      listenForPastJobs();
    } catch (error) {
      console.error("Erro ao favoritar motoboy:", error);
      alert("Não foi possível atualizar os favoritos.");
    }
  };

  function renderCompanyProfile() {
    if (!currentCompanyData) return;

    document.getElementById("profile-name").value =
      currentCompanyData.name || "";
    document.getElementById("profile-cnpj").value =
      currentCompanyData.cnpj || "";

    // Preenche os campos de endereço a partir do objeto 'address'
    const address = currentCompanyData.address || {};
    document.getElementById("profile-cep").value = address.cep || "";
    document.getElementById("profile-logradouro").value =
      address.logradouro || "";
    document.getElementById("profile-numero").value = address.numero || "";
    document.getElementById("profile-bairro").value = address.bairro || "";
    document.getElementById("profile-cidade").value = address.cidade || "";
    document.getElementById("profile-estado").value = address.estado || "";

    document.getElementById("profile-whatsapp").value =
      currentCompanyData.whatsapp || "";
    document.getElementById("profile-email").value =
      currentCompanyData.email || "";

    // Adiciona o listener para o campo de CEP no formulário de perfil
    document
      .getElementById("profile-cep")
      .addEventListener("blur", (e) =>
        fetchAddressByCep(e.target.value, "profile")
      );
  }

  async function handleUpdateProfile(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-black mx-auto"></div>`;

    const user = auth.currentUser;
    if (!user) return;

    const name = document.getElementById("profile-name").value;
    const cnpj = document.getElementById("profile-cnpj").value;
    const address = {
      cep: document.getElementById("profile-cep").value,
      logradouro: document.getElementById("profile-logradouro").value,
      numero: document.getElementById("profile-numero").value,
      bairro: document.getElementById("profile-bairro").value,
      cidade: document.getElementById("profile-cidade").value,
      estado: document.getElementById("profile-estado").value,
    };
    const fullAddressString = `${address.logradouro}, ${address.numero} - ${address.bairro}, ${address.cidade} - ${address.estado}, ${address.cep}`;
    const whatsapp = document.getElementById("profile-whatsapp").value;

    if (!validateCNPJ(cnpj)) {
      alert("O CNPJ informado é inválido.");
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      return;
    }

    // Geocodifica o novo endereço para obter as coordenadas
    const location = await getCoordinatesFromAddress(address);

    const updatedData = {
      name,
      cnpj,
      address,
      fullAddress: fullAddressString,
      whatsapp,
    };
    if (location) updatedData.location = location; // Adiciona a localização apenas se for encontrada

    try {
      await updateDoc(doc(db, "companies", user.uid), updatedData);
      alert("Perfil atualizado com sucesso!");
      // Atualiza os dados locais e o cabeçalho
      currentCompanyData = { ...currentCompanyData, ...updatedData }; // <-- ESTA É A LINHA CRÍTICA
      document.getElementById("company-name-header").textContent = name;
      // Re-inicializa o mapa para refletir o novo endereço, se houver
      initializeMotoboysMap(currentCompanyData);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      alert("Não foi possível atualizar o perfil. Tente novamente.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }

  async function renderChatList(negotiatingJobs) {
    const container = document.getElementById("chat-list-container");
    if (!container) return;

    if (negotiatingJobs.length === 0) {
      container.innerHTML = `<p class="text-center text-gray-400 p-4">Nenhuma conversa ativa.</p>`;
      resetChatView(); // Limpa a view de detalhes se não houver mais chats
      return;
    }

    // 1. Mapeia cada vaga para buscar sua última mensagem e seu timestamp
    const jobsWithLastMessage = await Promise.all(
      negotiatingJobs.map(async (job) => {
        const messagesQuery = query(
          collection(db, "jobs", job.id, "messages"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const messagesSnap = await getDocs(messagesQuery);

        let lastMessage = null;
        if (!messagesSnap.empty) {
          lastMessage = messagesSnap.docs[0].data();
        }

        return {
          job,
          // Usa o timestamp da última mensagem, ou o da criação da vaga como fallback
          lastActivity: lastMessage?.createdAt || job.createdAt,
          lastMessageText: lastMessage?.text || "Nenhuma mensagem ainda.",
        };
      })
    );

    // 2. Ordena a lista de vagas pela data da última atividade (mensagem mais recente)
    jobsWithLastMessage.sort((a, b) => {
      const timeA = a.lastActivity?.seconds || 0;
      const timeB = b.lastActivity?.seconds || 0;
      return timeB - timeA; // Descendente (mais recente primeiro)
    });

    // 3. Gera o HTML a partir da lista ordenada
    container.innerHTML = jobsWithLastMessage
      .map(({ job, lastActivity, lastMessageText }) => {
        const lastMessageTimestamp = lastActivity
          ? new Date(lastActivity.seconds * 1000).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })
          : "";

        return `
        <div id="chat-list-item-${job.id}" onclick="window.navigateToChatView('${job.id}')" class="p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 border-transparent">
          <div class="flex justify-between items-start">
            <h4 class="font-bold text-sm truncate pr-2">${job.title}</h4>
            <span class="text-xs text-gray-400 shrink-0">${lastMessageTimestamp}</span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">com ${job.motoboyName}</p>
          <p class="text-xs text-gray-600 dark:text-gray-300 mt-2 truncate italic">"${lastMessageText}"</p>
        </div>
      `;
      })
      .join("");
  }

  function resetChatView() {
    document.getElementById("chat-header-details").innerHTML =
      '<p class="text-center text-gray-400">Selecione uma conversa para começar</p>';
    document.getElementById("chat-security-options").classList.add("hidden");
    document.getElementById("chat-action-buttons").innerHTML = "";
    document.getElementById("chat-messages-container").innerHTML = "";
    const chatForm = document.getElementById("company-chat-form");
    chatForm.querySelector("input").disabled = true;
    chatForm.querySelector("button").disabled = true;
  }

  let activeChatListener = null; // Variável para o listener do chat
  let currentOpenChatId = null;

  window.navigateToChatView = (jobId) => {
    // 1. Navega para a view de chat
    navigateCompanyDashboard("chat");

    // 2. Remove o destaque de outros itens da lista
    document.querySelectorAll('[id^="chat-list-item-"]').forEach((item) => {
      item.classList.remove(
        "bg-yellow-50",
        "dark:bg-yellow-500/10",
        "border-yellow-500"
      );
    });
    // 3. Adiciona destaque ao item clicado
    document
      .getElementById(`chat-list-item-${jobId}`)
      ?.classList.add(
        "bg-yellow-50",
        "dark:bg-yellow-500/10",
        "border-yellow-500"
      );

    // Nova lógica: apenas renderiza os detalhes na view de chat
    renderChatInterface(jobId);
  };

  function renderChatInterface(jobId) {
    const chatHeaderDetailsEl = document.getElementById("chat-header-details");
    const chatSecurityOptionsEl = document.getElementById(
      "chat-security-options"
    );
    const chatActionButtonsEl = document.getElementById("chat-action-buttons");
    const messagesContainer = document.getElementById(
      "chat-messages-container"
    );
    const chatForm = document.getElementById("company-chat-form");
    const notificationAudio = new Audio("../assets/notification.mp3"); // Caminho para o som de notificação

    currentOpenChatId = jobId; // Define o chat que está aberto

    chatForm.querySelector("input").disabled = false;
    chatForm.querySelector("button").disabled = false;
    // 1. Busca detalhes da vaga e do motoboy
    getDoc(doc(db, "jobs", jobId)).then((jobSnap) => {
      if (!jobSnap.exists()) return;
      const jobData = jobSnap.data();

      // Preenche os detalhes no cabeçalho
      chatHeaderDetailsEl.innerHTML = `
        <h3 class="font-bold text-lg">${jobData.title}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">Negociando com: <span class="font-semibold">${jobData.motoboyName}</span></p>
      `;
      chatSecurityOptionsEl.classList.remove("hidden");

      // Preenche os botões de ação
      chatActionButtonsEl.innerHTML = `
        <button onclick="window.cancelNegotiation('${jobId}')" class="bg-red-600 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-1"><i data-lucide="x-circle" class="w-4 h-4"></i> Cancelar</button>
        <button onclick="window.concludeJob('${jobId}')" class="bg-green-600 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-1"><i data-lucide="check-circle" class="w-4 h-4"></i> Concluir</button>
      `;

      // Lógica dos botões de segurança
      document.getElementById("view-motoboy-profile-btn").onclick = () => {
        // Busca os dados mais completos do perfil público do motoboy
        getDoc(
          doc(db, "artifacts", "moto-manager-v1", "users", jobData.motoboyId)
        ).then((motoboySnap) => {
          if (motoboySnap.exists()) {
            openProfileModal(motoboySnap.data().publicProfile, "motoboy");
          }
        });
      };

      // 2. Ouve por novas mensagens em tempo real (MOVIDO PARA DENTRO DO .then())
      const messagesRef = collection(db, "jobs", jobId, "messages");
      const q = query(messagesRef, orderBy("createdAt", "asc"));

      // Marca mensagens como lidas
      const user = auth.currentUser;
      if (user) {
        updateDoc(doc(db, "jobs", jobId), { [`readBy.${user.uid}`]: true });
      }

      if (activeChatListener) activeChatListener(); // Garante que não haja listeners duplicados
      activeChatListener = onSnapshot(q, (snapshot) => {
        // Lógica de Notificação
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const msgData = change.doc.data();
            // Se a mensagem não for minha e a tela de chat não estiver visível
            if (
              false && // Desativado temporariamente para não tocar som na tela de chat
              msgData.senderId !== auth.currentUser.uid &&
              document
                .getElementById("view-company-chat")
                .classList.contains("hidden")
            ) {
              notificationAudio.play();
              // Aqui você pode adicionar um "badge" no ícone do chat
            }
          }
        });

        messagesContainer.innerHTML = snapshot.docs
          .map((doc) => {
            const msg = doc.data();
            const isMe = msg.senderId === auth.currentUser.uid;
            const timestamp = msg.createdAt
              ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString(
                  "pt-BR",
                  { hour: "2-digit", minute: "2-digit" }
                )
              : "";

            // Lógica de Status da Mensagem (Read Receipt) - AGORA FUNCIONA
            const isRead = jobData.readBy && jobData.readBy[jobData.motoboyId];
            const readIcon = isRead ? "check-check" : "check";

            return `
                  <div class="flex ${isMe ? "justify-end" : "justify-start"}">
                      <div class="max-w-[75%] p-2 px-3 rounded-xl ${
                        isMe
                          ? "bg-blue-600 text-white"
                          : "bg-white dark:bg-gray-700"
                      }">
                          <p class="text-sm">${msg.text}</p>
                          <div class="text-xs ${
                            isMe ? "text-blue-200" : "text-gray-400"
                          } text-right mt-1 flex items-center justify-end gap-1">
                              <span>${timestamp}</span>
                              ${
                                isMe
                                  ? `<i data-lucide="${readIcon}" class="w-4 h-4 ${
                                      isRead ? "text-sky-300" : ""
                                    }"></i>`
                                  : ""
                              }
                          </div>
                      </div>
                  </div>
              `;
          })
          .join("");
        // Auto-scroll para a última mensagem
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        lucide.createIcons(); // Renderiza os ícones de check
      });
    });

    // 3. Configura o formulário de envio
    chatForm.onsubmit = (e) => handleSendMessage(e, jobId);
  }

  /**
   * Abre um modal para exibir os detalhes do perfil de um motoboy ou empresa.
   * @param {object} profileData - Os dados do perfil a serem exibidos.
   * @param {string} type - O tipo de perfil ('motoboy' ou 'company').
   */
  function openProfileModal(profileData, type) {
    const modalContainer = document.getElementById("company-modal-container");
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

  async function handleSendMessage(e, jobId) {
    e.preventDefault();
    const input = document.getElementById("company-chat-input");
    const text = input.value.trim();
    if (!text) return;

    const user = auth.currentUser;
    if (!user) return;

    const messageData = {
      text,
      senderId: user.uid,
      senderName: currentCompanyData.name, // Usa o nome da empresa salvo
      createdAt: serverTimestamp(),
      // Adiciona os IDs da empresa e do motoboy para referência futura
      empresaId: currentCompanyData.id || user.uid,
      motoboyId: (await getDoc(doc(db, "jobs", jobId))).data().motoboyId,
    };

    try {
      await addDoc(collection(db, "jobs", jobId, "messages"), messageData);
      input.value = ""; // Limpa o campo de texto
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Não foi possível enviar a mensagem.");
    }

    // Reseta o status de "lido" do destinatário
    const jobData = (await getDoc(doc(db, "jobs", jobId))).data();
    if (jobData && jobData.motoboyId) {
      await updateDoc(doc(db, "jobs", jobId), {
        [`readBy.${jobData.motoboyId}`]: false,
      });
    }
  }

  window.concludeJob = async (jobId) => {
    // A avaliação agora é feita no histórico. Esta função apenas conclui a vaga.
    if (!confirm("Tem certeza que deseja marcar esta vaga como concluída?"))
      return;

    try {
      // Primeiro, buscamos os dados da vaga para pegar o ID e nome do motoboy
      const jobRef = doc(db, "jobs", jobId);
      const jobSnap = await getDoc(jobRef);

      if (!jobSnap.exists()) {
        throw new Error("Vaga não encontrada.");
      }
      const jobData = jobSnap.data();

      // Atualiza o status da vaga
      await updateDoc(jobRef, {
        status: "concluida",
      });

      alert("Vaga concluída com sucesso!");

      // Após concluir, abre o modal de avaliação se houver um motoboy associado
      if (jobData.motoboyId && jobData.motoboyName) {
        openRatingModal(jobId, jobData.motoboyId, jobData.motoboyName);
      } else {
        // Se não houver motoboy, apenas volta para o dashboard
        navigateCompanyDashboard("dashboard");
      }
    } catch (error) {
      console.error("Erro ao concluir vaga:", error);
      alert("Não foi possível concluir a vaga: " + error.message);
    }
  };

  // Função que efetivamente conclui a vaga após a avaliação
  /**
   * Abre o modal de avaliação para um motoboy específico.
   * @param {string} jobId - O ID da vaga concluída.
   * @param {string} motoboyId - O ID do motoboy a ser avaliado.
   * @param {string} motoboyName - O nome do motoboy.
   */
  async function openRatingModal(jobId, motoboyId, motoboyName) {
    currentRatingJobId = jobId;
    currentRatingMotoboyId = motoboyId;
    currentStarRating = 0;

    // Carrega o modal dinamicamente para evitar conflitos
    const modalContainer = document.getElementById("company-modal-container");
    const response = await fetch(`modals/ratingModal.html`);
    modalContainer.innerHTML = await response.text();

    const modal = modalContainer.querySelector("#rating-modal");
    const motoboyNameEl = document.getElementById("rating-motoboy-name");
    const ratingForm = document.getElementById("rating-form");

    motoboyNameEl.textContent = motoboyName;
    ratingForm.reset();
    window.renderStars(0); // Reseta as estrelas

    modal.classList.remove("hidden");

    // Lida com o envio do formulário de avaliação
    ratingForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (currentStarRating === 0) {
        alert("Por favor, selecione uma nota de 1 a 5 estrelas.");
        return;
      }
      const comment = document.getElementById("rating-comment").value;
      saveRating(
        currentRatingJobId,
        currentRatingMotoboyId,
        currentStarRating,
        comment
      );
    });

    // Permite fechar o modal clicando fora dele ou no botão de fechar implícito
    modalContainer
      .querySelector(".close-company-modal-btn")
      .addEventListener("click", () => {
        closeRatingModal();
      });
  }

  function closeRatingModal() {
    const modalContainer = document.getElementById("company-modal-container");
    if (modalContainer) modalContainer.innerHTML = ""; // Limpa o container

    // Após fechar o modal, volta para o dashboard
    navigateCompanyDashboard("dashboard");
    // Redireciona para a aba de histórico para ver o resultado
    navigateCompanyDashboard("history");
  }

  /**
   * Renderiza as estrelas de avaliação no container.
   * @param {number} rating - A nota atual (0 a 5).
   */
  window.renderStars = (rating) => {
    const starContainer = document.getElementById("star-rating-container");
    starContainer.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const starWrapper = document.createElement("span");
      starWrapper.className = "cursor-pointer";
      starWrapper.onclick = () => window.handleStarClick(i);
      starWrapper.innerHTML = `<i data-lucide="star" class="w-10 h-10 transition-colors ${
        i <= rating
          ? "text-yellow-400 fill-current"
          : "text-gray-300 dark:text-gray-600"
      }"></i>`;
      starContainer.appendChild(starWrapper);
    }
    lucide.createIcons();
  };

  window.handleStarClick = (rating) => {
    currentStarRating = rating;
    window.renderStars(rating);
  };

  /**
   * Salva a avaliação no Firestore.
   * @param {string} jobId
   * @param {string} motoboyId
   * @param {number} rating
   * @param {string} comment
   */
  async function saveRating(jobId, motoboyId, rating, comment) {
    const user = auth.currentUser;
    if (!user) {
      alert(
        "Erro: Não foi possível identificar a empresa. Faça login novamente."
      );
      return;
    }

    const motoboyRef = doc(
      db,
      "artifacts",
      "moto-manager-v1",
      "users",
      motoboyId
    );
    const jobRef = doc(db, "jobs", jobId);

    try {
      await runTransaction(db, async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        if (jobDoc.data().ratingGiven) {
          // Se já foi avaliado, não faz nada para evitar duplicidade.
          // Pode ser melhorado para lançar um erro se o modal não deveria ter sido aberto.
          console.warn("Este serviço já foi avaliado.");
          return;
        }

        const motoboyDoc = await transaction.get(motoboyRef);
        if (!motoboyDoc.exists()) {
          throw "Este usuário não existe mais.";
        }

        // Atualiza a avaliação média no perfil do motoboy
        const currentData = motoboyDoc.data().publicProfile || {};
        const currentTotalRatings = currentData.ratingCount || 0;
        const currentAvgRating = currentData.rating || 0;

        const newTotalRatings = currentTotalRatings + 1;
        const newAvgRating =
          (currentAvgRating * currentTotalRatings + rating) / newTotalRatings;

        // 1. Atualiza o perfil do motoboy
        transaction.update(motoboyRef, {
          "publicProfile.rating": newAvgRating,
          "publicProfile.ratingCount": newTotalRatings,
        });

        // 2. Marca a vaga como avaliada para não pedir de novo
        transaction.update(jobRef, {
          ratingGiven: rating,
          ratingComment: comment, // Opcional: salvar o comentário também na vaga
        });
      });

      alert("Avaliação enviada com sucesso! Obrigado.");
      closeRatingModal();
    } catch (error) {
      console.error("Erro ao salvar avaliação:", error);
      // Exibe a mensagem de erro específica (ex: "Você já avaliou este serviço.")
      alert("Erro ao enviar avaliação: " + error);
      closeRatingModal();
    }
  }

  window.cancelNegotiation = async (jobId) => {
    if (
      !confirm(
        "Tem certeza que deseja cancelar a negociação? A vaga voltará a ficar disponível para outros motoboys."
      )
    )
      return;

    try {
      await updateDoc(doc(db, "jobs", jobId), {
        status: "disponivel",
        motoboyId: deleteField(),
        motoboyName: deleteField(),
        motoboyContact: deleteField(),
      });
      alert("Negociação cancelada. A vaga está disponível novamente.");
      navigateCompanyDashboard("dashboard"); // Volta para o dashboard principal
    } catch (error) {
      console.error("Erro ao cancelar negociação:", error);
      alert("Não foi possível cancelar a negociação.");
    }
  };

  window.deleteJob = async (jobId) => {
    if (!confirm("Tem certeza que deseja apagar esta vaga?")) return;

    try {
      await deleteDoc(doc(db, "jobs", jobId));
      alert("Vaga apagada com sucesso.");
    } catch (error) {
      console.error("Erro ao apagar vaga:", error);
      alert("Não foi possível apagar a vaga.");
    }
  };

  async function handleUpdateJobSubmit(e, jobId) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>`;

    try {
      const updatedJob = {
        title: document.getElementById("job-title").value,
        payment: document.getElementById("job-payment").value,
        description: document.getElementById("job-description").value,
      };

      // Lógica para o novo campo de horário
      const startTime = document.getElementById("job-start-time").value;
      const endTime = document.getElementById("job-end-time").value;
      if (startTime && endTime) {
        updatedJob.schedule = `Das ${startTime} às ${endTime}`;
      } else {
        updatedJob.schedule = ""; // Limpa se os campos não estiverem preenchidos
      }

      await updateDoc(doc(db, "jobs", jobId), updatedJob);

      alert("Vaga atualizada com sucesso!");
      document.getElementById("company-modal-container").innerHTML = "";
    } catch (error) {
      console.error("Erro ao atualizar vaga:", error);
      alert("Erro ao atualizar vaga: " + error.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Atualizar Vaga</span>`;
    }
  }

  window.openEditJobModal = async (jobId) => {
    const modalContainer = document.getElementById("company-modal-container");
    if (!modalContainer) return;

    const response = await fetch(`modals/createJobModal.html`);
    modalContainer.innerHTML = await response.text();

    const jobSnap = await getDoc(doc(db, "jobs", jobId));
    if (!jobSnap.exists()) {
      alert("Vaga não encontrada.");
      return;
    }
    const jobData = jobSnap.data();

    // Preenche o formulário com os dados existentes
    document.getElementById("job-title").value = jobData.title;
    document.getElementById("job-payment").value = jobData.payment;
    // Extrai o horário do texto para preencher os inputs de tempo
    if (jobData.schedule) {
      const timeParts = jobData.schedule.match(/(\d{2}:\d{2})/g);
      if (timeParts && timeParts.length >= 2) {
        document.getElementById("job-start-time").value = timeParts[0];
        document.getElementById("job-end-time").value = timeParts[1];
      }
    }

    document.getElementById("job-description").value = jobData.description;
    document.querySelector("#create-job-modal h3").textContent = "Editar Vaga";

    lucide.createIcons();

    modalContainer
      .querySelectorAll(".close-company-modal-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () => (modalContainer.innerHTML = ""));
      });

    // Altera o submit para ATUALIZAR em vez de criar
    document.getElementById("create-job-form").onsubmit = (e) =>
      handleUpdateJobSubmit(e, jobId);
  };

  /**
   * Abre um modal com os detalhes de uma vaga do histórico.
   */
  async function openJobDetailsModal(jobId) {
    const jobSnap = await getDoc(doc(db, "jobs", jobId));
    if (!jobSnap.exists()) return;
    const jobData = jobSnap.data();

    // Reutilizando o modal de avaliação como base para um modal de detalhes
    const modalContainer = document.getElementById("company-modal-container");
    // A implementação completa do modal de detalhes pode ser adicionada aqui,
    // mostrando todos os campos de jobData.
    alert(
      `Detalhes da Vaga: ${jobData.title}\nStatus: ${
        jobData.status
      }\nMotoboy: ${jobData.motoboyName || "N/A"}`
    );
  }

  /**
   * Abre o modal para criar uma nova vaga.
   */
  async function openCreateJobModal() {
    const modalContainer = document.getElementById("company-modal-container");
    if (!modalContainer) return;

    const response = await fetch(`modals/createJobModal.html`);
    modalContainer.innerHTML = await response.text();
    lucide.createIcons();

    // Adiciona listeners para fechar o modal
    modalContainer
      .querySelectorAll(".close-company-modal-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          modalContainer.innerHTML = "";
        });
      });

    // Adiciona listener para o submit do formulário
    document
      .getElementById("create-job-form")
      .addEventListener("submit", handleCreateJobSubmit);
  }

  /**
   * Lida com o envio do formulário de criação de vaga.
   * @param {Event} e - O evento de submit.
   */
  async function handleCreateJobSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>`;

    const user = auth.currentUser;
    if (!user) {
      alert("Erro: você não está logado.");
      return;
    }

    try {
      const companyRef = doc(db, "companies", user.uid);
      const companySnap = await getDoc(companyRef);
      if (!companySnap.exists()) {
        throw new Error("Dados da empresa não encontrados.");
      }
      const companyData = companySnap.data();

      const newJob = {
        title: document.getElementById("job-title").value,
        payment: document.getElementById("job-payment").value,
        description: document.getElementById("job-description").value,
        empresaId: user.uid,
        empresaName: companyData.name,
        empresaContact: companyData.whatsapp,
        location: companyData.location, // Usa a localização já salva da empresa
        status: "disponivel",
        createdAt: serverTimestamp(),
      };

      // Lógica para o novo campo de horário
      const startTime = document.getElementById("job-start-time").value;
      const endTime = document.getElementById("job-end-time").value;
      if (startTime && endTime) {
        newJob.schedule = `Das ${startTime} às ${endTime}`;
      }

      await addDoc(collection(db, "jobs"), newJob);

      alert("Vaga publicada com sucesso!");
      document.getElementById("company-modal-container").innerHTML = ""; // Fecha o modal
    } catch (error) {
      console.error("Erro ao publicar vaga:", error);
      alert("Erro ao publicar vaga: " + error.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Publicar Vaga</span>`; // Restaura o botão
    }
  }

  /**
   * Carrega as configurações globais do Firestore e as aplica.
   * @returns {Promise<boolean>} - Retorna true se o app estiver em manutenção, false caso contrário.
   */
  async function loadGlobalSettings() {
    try {
      const settingsRef = doc(
        db,
        "artifacts",
        "moto-manager-v1",
        "config",
        "app_settings"
      );
      const docSnap = await getDoc(settingsRef);

      if (docSnap.exists()) {
        const settings = docSnap.data();
        currentAppSettings = settings; // Armazena as configurações globalmente no escopo do script

        // 1. Verifica o Modo Manutenção
        if (settings.maintenance?.enabled) {
          const message =
            settings.maintenance.message ||
            "Estamos em manutenção. Voltamos em breve!";
          document.body.innerHTML = `
          <div class="h-screen w-screen flex flex-col items-center justify-center text-center p-4 bg-gray-900 text-white">
            <i data-lucide="wrench" class="w-20 h-20 text-yellow-500 mb-6"></i>
            <h1 class="text-3xl font-bold">Sistema em Manutenção</h1>
            <p class="text-gray-400 mt-4 max-w-md">${message}</p>
          </div>
        `;
          lucide.createIcons();
          return true; // Interrompe o carregamento do app
        }

        // 2. Verifica a Mensagem do Dia (MOTD)
        if (settings.motd?.enabled && settings.motd?.message) {
          displayMotd(settings.motd.message);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações globais:", error);
    }
    return false; // App não está em manutenção
  }

  /**
   * Exibe um banner com a Mensagem do Dia.
   * @param {string} message - A mensagem a ser exibida.
   */
  function displayMotd(message) {
    const motdBanner = document.createElement("div");
    motdBanner.className =
      "bg-yellow-500 text-black text-center p-2 text-sm font-semibold";
    motdBanner.textContent = message;
    document.body.prepend(motdBanner);
  }

  /**
   * Calcula a distância em KM entre duas coordenadas geográficas.
   */
  window.getDistance = (lat1, lon1, lat2, lon2) => {
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
    return R * c;
  };
}); // FIM DO 'DOMContentLoaded'
