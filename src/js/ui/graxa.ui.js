import { router } from "../router.js";
import { openMaintenanceModal } from "../ui.js";
import * as GraxaService from "../services/graxa.service.js";

// --- UI Elements ---
let messagesContainer;
let suggestionsContainer;
let form;
let input;
let limitWarning;

// Sugestões de perguntas padrão
const defaultSuggestions = [
  "Como trocar o óleo?",
  "Qual a calibragem do pneu?",
  "Me leve para a garagem",
  "Quanto falta para trocar a relação?",
  "Adicionar despesa de R$50 com gasolina",
  "Registrar ganho de R$120 no iFood",
  "Qual o meu saldo este mês?",
  "Melhorar consumo de combustível",
];

/**
 * Renderiza a interface da Assistente Graxa.
 * @param {HTMLElement} container - O elemento onde o conteúdo será renderizado.
 */
export async function renderGraxa(container) {
  container.innerHTML = await fetch("src/templates/views/graxa.html").then(
    (res) => res.text()
  );

  // Mapeia os elementos da UI
  messagesContainer = document.getElementById("graxa-messages");
  suggestionsContainer = document.getElementById("graxa-suggestions");
  form = document.getElementById("graxa-form");
  input = document.getElementById("graxa-input");
  limitWarning = document.getElementById("graxa-limit-warning");

  // Registra as funções de callback do UI no serviço
  GraxaService.registerUICallbacks(
    addMessage,
    (show) => (show ? showTypingIndicator() : hideTypingIndicator()),
    renderSuggestions
  );

  showTypingIndicator(); // Mostra "digitando" enquanto carrega

  // Carrega os dados iniciais e configura a UI
  const loaded = await GraxaService.loadInitialData();
  if (loaded) {
    hideTypingIndicator();
    checkUsageLimit();
    GraxaService.generateProactiveGreeting();
    renderSuggestions(null); // Renderiza as sugestões padrão
    form.addEventListener("submit", handleUserQuestion);
  } else {
    // Se houver erro no carregamento, a mensagem já foi exibida pelo serviço
    input.disabled = true;
    input.placeholder = "Assistente indisponível.";
  }

  lucide.createIcons();
}

/**
 * Lida com a pergunta enviada pelo usuário.
 * @param {Event} e - O evento de submit do formulário.
 */
async function handleUserQuestion(e) {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;

  // A verificação de limite agora é feita dentro do serviço,
  // mas podemos manter uma checagem inicial aqui para evitar processamento desnecessário.
  if (GraxaService.isLimitReached()) {
    checkUsageLimit();
    return;
  }

  input.value = "";
  const action = await GraxaService.processUserQuestion(question);

  // Após processar, a UI verifica se há uma ação a ser executada
  if (action) {
    if (action.type === 'navigate') {
      router(action.route);
    } else if (action.type === 'ui_action' && action.function === 'openMaintenanceModal') {
      openMaintenanceModal(...action.params);
    }
  }

  // Após cada pergunta, re-verifica o limite no caso de a pergunta ter sido a última
  if (GraxaService.isLimitReached()) {
    checkUsageLimit();
  }
}

/**
 * Verifica e atualiza a UI com base no limite de uso.
 */
function checkUsageLimit() {
  if (GraxaService.isLimitReached()) {
    input.disabled = true;
    input.placeholder = "Limite diário atingido.";
    limitWarning.classList.remove("hidden");
  }
}

/**
 * Renderiza os botões de sugestão.
 * @param {Array|null} suggestions - Uma lista de sugestões. Se null, usa as padrões.
 * @param {Function|null} onClick - Callback para quando um botão é clicado.
 */
function renderSuggestions(suggestions, onClick) {
  if (!suggestionsContainer) return;

  const suggestionList = suggestions || defaultSuggestions.map(s => ({ text: s, value: s }));

  suggestionsContainer.innerHTML = suggestionList
    .map(
      (s) =>
        `<button class="suggestion-btn text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-full whitespace-nowrap" data-value="${s.value}">${s.text}</button>`
    )
    .join("");

  // Adiciona o listener para os botões
  suggestionsContainer.onclick = (e) => {
    const btn = e.target.closest(".suggestion-btn");
    if (btn) {
      if (onClick) {
        // Se um callback customizado foi passado (para conversas)
        onClick(btn.dataset.value, btn.textContent);
      } else {
        // Comportamento padrão: preenche o input e envia
        input.value = btn.textContent;
        form.requestSubmit();
      }
    }
  };
}

/**
 * Adiciona uma mensagem à interface de chat.
 * @param {'user' | 'bot'} sender - Quem enviou a mensagem.
 * @param {string} text - O conteúdo da mensagem (pode ser HTML).
 */
function addMessage(sender, text) {
  hideTypingIndicator(); // Remove o "digitando" ao receber uma nova mensagem
  if (!messagesContainer) return;

  const isUser = sender === "user";
  const messageDiv = document.createElement("div");
  messageDiv.className = `flex items-end gap-2 animate-slide-in-bottom ${
    isUser ? "justify-end" : "justify-start"
  }`;

  const avatar = isUser
    ? `<div class="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center shrink-0 order-2"><i data-lucide="user" class="w-5 h-5"></i></div>`
    : `<div class="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shrink-0 order-1"><i data-lucide="bot" class="w-5 h-5 text-black"></i></div>`;

  const textBubble = `<div class="max-w-[80%] p-3 px-4 rounded-2xl ${
    isUser
      ? "bg-yellow-500 text-black rounded-br-lg"
      : "bg-white dark:bg-gray-800 rounded-bl-lg"
  } order-1">
      <div class="prose prose-sm dark:prose-invert max-w-none">${text}</div>
    </div>`;

  messageDiv.innerHTML = `${!isUser ? avatar : ""} ${textBubble} ${isUser ? avatar : ""}`;

  messagesContainer.appendChild(messageDiv);
  lucide.createIcons();
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
  if (document.getElementById("typing-indicator")) return; // Já existe
  if (!messagesContainer) return;

  const typingDiv = document.createElement("div");
  typingDiv.id = "typing-indicator";
  typingDiv.className = "flex items-end gap-2 justify-start animate-slide-in-bottom";
  typingDiv.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shrink-0">
      <i data-lucide="bot" class="w-5 h-5 text-black"></i>
    </div>
    <div class="p-3 px-4 rounded-2xl bg-white dark:bg-gray-800 rounded-bl-lg">
      <div class="flex items-center justify-center gap-1 h-5">
        <span class="typing-dot"></span>
        <span class="typing-dot" style="animation-delay: 0.2s;"></span>
        <span class="typing-dot" style="animation-delay: 0.4s;"></span>
      </div>
    </div>`;

  messagesContainer.appendChild(typingDiv);
  lucide.createIcons();
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) {
    indicator.remove();
  }
}