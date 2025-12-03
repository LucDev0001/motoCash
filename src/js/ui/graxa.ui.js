import { db, appId } from "../config.js";
import { currentUser } from "../auth.js";

let manualsKnowledgeBase = []; // **NOVO**: Armazena o conhecimento dos manuais
let knowledgeBase = [];
let userUsage = { count: 0, lastQuestionDate: "" };
let isPro = false;
const DAILY_LIMIT = 3;

/**
 * Renderiza a interface da Assistente Graxa.
 * @param {HTMLElement} container - O elemento onde o conteúdo será renderizado.
 */
export async function renderGraxa(container) {
  container.innerHTML = await fetch("src/templates/views/graxa.html").then(
    (res) => res.text()
  );

  await loadInitialData();
  checkUsageLimit();

  addMessage(
    "bot",
    "Olá! Eu sou a Graxa, sua assistente virtual. Como posso te ajudar hoje com sua moto ou suas corridas?"
  );

  const form = document.getElementById("graxa-form");
  form.addEventListener("submit", handleUserQuestion);
  renderSuggestions(); // **NOVO**: Renderiza as sugestões

  lucide.createIcons();
}

/**
 * Carrega a base de conhecimento e os dados de uso do usuário.
 */
async function loadInitialData() {
  // **OTIMIZAÇÃO: Implementa cache para a base de conhecimento**
  const CACHE_KEY_KB = "graxa_kb_cache";
  const CACHE_KEY_MANUALS = "graxa_manuals_cache";
  const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

  const now = new Date().getTime();

  // Função auxiliar para buscar e cachear dados
  async function getCachedOrFetch(key, collectionName) {
    const cachedItem = localStorage.getItem(key);
    if (cachedItem) {
      const { timestamp, data } = JSON.parse(cachedItem);
      if (now - timestamp < CACHE_DURATION_MS) {
        console.log(`[Graxa] Usando cache para ${collectionName}`);
        return data; // Retorna dados do cache se não estiver expirado
      }
    }

    // Se o cache não existe ou está expirado, busca no Firestore
    console.log(`[Graxa] Buscando dados frescos para ${collectionName}`);
    const snapshot = await db.collection(collectionName).get();
    const data =
      collectionName === "graxa_kb"
        ? snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        : snapshot.docs.map((doc) => doc.data());

    // Salva os novos dados e o timestamp no localStorage
    localStorage.setItem(key, JSON.stringify({ timestamp: now, data }));
    return data;
  }

  try {
    // Usa a função de cache para carregar as duas bases de conhecimento
    [knowledgeBase, manualsKnowledgeBase] = await Promise.all([
      getCachedOrFetch(CACHE_KEY_KB, "graxa_kb"),
      getCachedOrFetch(CACHE_KEY_MANUALS, "graxa_manuals_kb"),
    ]);
  } catch (error) {
    console.error("Erro ao carregar base de conhecimento da Graxa:", error);
    addMessage(
      "bot",
      "Desculpe, estou com problemas para acessar minha memória. Tente novamente mais tarde."
    );
    return; // Interrompe a execução se houver erro
  }

  // Carrega os dados do usuário (status Pro e uso da assistente)
  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);
  const userDoc = await userRef.get();
  const userData = userDoc.data() || {};

  isPro = userData.isPro === true;
  userUsage = userData.graxaUsage || { count: 0, lastQuestionDate: "" };
}

/**
 * Verifica se o usuário atingiu o limite de uso diário.
 */
function checkUsageLimit() {
  if (isPro) return; // Usuários Pro não têm limite.

  const today = new Date().toISOString().split("T")[0];

  // Se a última pergunta foi em um dia diferente, reseta a contagem.
  if (userUsage.lastQuestionDate !== today) {
    userUsage.count = 0;
    userUsage.lastQuestionDate = today;
  }

  if (userUsage.count >= DAILY_LIMIT) {
    const input = document.getElementById("graxa-input");
    const warning = document.getElementById("graxa-limit-warning");
    input.disabled = true;
    input.placeholder = "Limite diário atingido.";
    warning.classList.remove("hidden");
  }
}

/**
 * Lida com a pergunta enviada pelo usuário.
 * @param {Event} e - O evento de submit do formulário.
 */
async function handleUserQuestion(e) {
  e.preventDefault();
  const input = document.getElementById("graxa-input");
  const question = input.value.trim();

  if (!question) return;

  addMessage("user", question);
  input.value = "";

  // Atualiza a contagem de uso para usuários gratuitos
  if (!isPro) {
    userUsage.count++;
    const userRef = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(currentUser.uid);
    await userRef.set({ graxaUsage: userUsage }, { merge: true });
    checkUsageLimit(); // Re-verifica o limite após a pergunta
  }

  findAnswer(question);
}

/**
 * **NOVO**: Renderiza os botões de sugestão de perguntas.
 */
function renderSuggestions() {
  const suggestionsContainer = document.getElementById("graxa-suggestions");
  if (!suggestionsContainer) return;

  const suggestions = [
    "Como trocar o óleo?",
    "Qual a calibragem do pneu?",
    "Leis sobre baú de moto",
    "Melhorar consumo de combustível",
  ];

  suggestionsContainer.innerHTML = suggestions
    .map(
      (q) =>
        `<button class="suggestion-btn text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-full whitespace-nowrap">${q}</button>`
    )
    .join("");

  // Adiciona o listener para os botões de sugestão
  suggestionsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".suggestion-btn");
    if (btn) {
      const question = btn.textContent;
      const input = document.getElementById("graxa-input");
      input.value = question; // Preenche o input com a pergunta
      const form = document.getElementById("graxa-form");
      form.requestSubmit(); // Envia o formulário
    }
  });
}

/**
 * Encontra a melhor resposta na base de conhecimento.
 * @param {string} question - A pergunta do usuário.
 */
function findAnswer(question) {
  const questionWords = question
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2); // Ignora palavras muito curtas

  let bestMatch = { score: 0, answer: null };

  knowledgeBase.forEach((item) => {
    let score = 0;
    const keywords = item.keywords
      .split(",")
      .map((k) => k.trim().toLowerCase());

    questionWords.forEach((word) => {
      if (keywords.includes(word)) {
        score++;
      }
    });

    if (score > bestMatch.score) {
      bestMatch = { score, answer: item.answer };
    }
  });

  setTimeout(() => {
    if (bestMatch.score > 0) {
      addMessage("bot", bestMatch.answer);
    } else if (manualsKnowledgeBase.length > 0) {
      // **NOVO**: Se não achou na base principal, busca nos manuais
      let manualBestMatch = { score: 0, content: null, moto: null, page: null };

      manualsKnowledgeBase.forEach((chunk) => {
        let score = 0;
        const contentWords = chunk.content.toLowerCase().split(/\s+/);
        questionWords.forEach((qWord) => {
          if (contentWords.includes(qWord)) {
            score++;
          }
        });
        if (score > manualBestMatch.score) {
          manualBestMatch = {
            score,
            content: chunk.content,
            moto: chunk.moto,
            page: chunk.source_page,
          };
        }
      });

      if (manualBestMatch.score > 1) {
        // Exige uma pontuação mínima para ser relevante
        const answer = `<p>${
          manualBestMatch.content
        }</p><p class="text-xs text-gray-400 mt-2">Fonte: Manual da ${
          manualBestMatch.moto
        }, pág. ${manualBestMatch.page || "N/A"}</p>`;
        addMessage("bot", answer);
      } else {
        addMessage(
          "bot",
          "Desculpe, não encontrei uma resposta precisa para sua pergunta, nem mesmo nos manuais de serviço."
        );
      }
    } else {
      addMessage(
        "bot",
        "Desculpe, ainda não tenho a resposta para essa pergunta. Tente perguntar de outra forma ou sobre outro assunto."
      );
    }
  }, 1000); // Simula um tempo de "pensamento"
}

/**
 * Adiciona uma mensagem à interface de chat.
 * @param {'user' | 'bot'} sender - Quem enviou a mensagem.
 * @param {string} text - O conteúdo da mensagem (pode ser HTML).
 */
function addMessage(sender, text) {
  const messagesContainer = document.getElementById("graxa-messages");
  const messageDiv = document.createElement("div");

  const isUser = sender === "user";

  messageDiv.className = `flex ${isUser ? "justify-end" : "justify-start"}`;
  messageDiv.innerHTML = `
    <div class="max-w-[85%] p-3 px-4 rounded-2xl ${
      isUser
        ? "bg-yellow-500 text-black rounded-br-none"
        : "bg-white dark:bg-gray-800 rounded-bl-none"
    }">
      <div class="prose prose-sm dark:prose-invert max-w-none">${text}</div>
    </div>
  `;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
