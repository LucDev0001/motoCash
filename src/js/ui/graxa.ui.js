import { db, appId } from "../config.js";
import { currentUser } from "../auth.js";
import * as API from "../api.js"; // **NOVO**: Importa a API para executar ações
import { openMaintenanceModal } from "../ui.js";

let manualsKnowledgeBase = []; // **NOVO**: Armazena o conhecimento dos manuais
let knowledgeBase = [];
let userUsage = { count: 0, lastQuestionDate: "" };
let isPro = false;
let userData = {}; // **NOVO**: Armazena os dados completos do usuário
const DAILY_LIMIT = 3;

// **MELHORIA**: Estado para gerenciar conversas de múltiplos passos.
let conversationState = {
  isConversing: false,
  intent: null,
  data: {},
  currentStep: 0,
};

// **NOVO**: Estado para gerenciar o contexto da conversa.
let lastContext = {
  subject: null, // O assunto da última pergunta, ex: 'dk160'
  timestamp: null, // Quando o contexto foi definido
};
const CONTEXT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos para o contexto expirar
const CONTEXT_KEYWORDS = ["dk160", "cg 160", "fan 160", "titan 160"]; // Palavras-chave que definem um contexto

// **MELHORIA**: Base de conhecimento padrão para garantir respostas às perguntas sugeridas.
const defaultKnowledgeBase = [
  {
    question: "Como trocar o óleo?",
    answer:
      '<p>Trocar o óleo é vital para a saúde do motor. O processo básico é:</p><ol class="list-decimal list-inside space-y-1"><li>Aqueça o motor por alguns minutos.</li><li>Coloque um recipiente sob o bujão do cárter.</li><li>Remova o bujão e deixe o óleo velho escorrer completamente.</li><li>Troque o anel de vedação e recoloque o bujão sem apertar demais.</li><li>Remova o filtro de óleo antigo e instale um novo, lubrificando a borracha de vedação.</li><li>Adicione o óleo novo. Verifique a quantidade e especificação no manual (ex: 10W30 Semissintético).</li></ol>',
    keywords:
      "trocar, troca, oleo, óleo, motor, manutencao, manutenção, filtro",
    // **NOVO**: Adiciona suporte a mídia na resposta.
    media: {
      type: "image",
      url: "src/images/tutorial/troca-oleo.jpg",
    },
  },
  {
    question: "Qual a calibragem do pneu?",
    answer:
      '<p>A calibragem correta é crucial para segurança e economia. Verifique a etiqueta no protetor de corrente da sua moto, mas como regra geral para motos de baixa cilindrada:</p><ul class="list-disc list-inside space-y-1"><li><strong>Pneu Dianteiro:</strong> 29 psi.</li><li><strong>Pneu Traseiro (sozinho):</strong> 33 psi.</li><li><strong>Pneu Traseiro (com garupa ou carga):</strong> 36 a 41 psi.</li></ul><p>Lembre-se de calibrar com os pneus frios!</p>',
    keywords: "pneu, calibragem, libras, pressao, calibrar, psi",
  },
  {
    question: "Leis sobre baú de moto",
    answer:
      '<p>As regras para baús (ou caixas) em motos são definidas pelo CONTRAN. Os pontos principais são:</p><ul class="list-disc list-inside space-y-1"><li><strong>Dimensões:</strong> A largura não pode exceder a largura do guidão. O comprimento não pode passar a extremidade traseira da moto.</li><li><strong>Faixas Refletivas:</strong> É obrigatório o uso de faixas refletivas no baú para aumentar a visibilidade.</li><li><strong>Fixação:</strong> O baú deve estar bem fixo no bagageiro, sem folgas.</li><li><strong>Alteração de Característica:</strong> Se o baú for instalado, é necessário atualizar o documento da moto (CRLV) para constar a alteração. Rodar sem essa atualização pode gerar multa.</li></ul>',
    keywords: "leis, lei, baú, bau, caixa, bagageiro, contran, multa, cnh",
  },
  {
    question: "Melhorar consumo de combustível",
    answer:
      '<p>Para sua moto ser mais econômica, siga estas dicas:</p><ol class="list-decimal list-inside space-y-1"><li><strong>Calibragem:</strong> Mantenha os pneus sempre na pressão correta.</li><li><strong>Aceleração:</strong> Evite aceleradas e freadas bruscas. Pilote de forma suave.</li><li><strong>Manutenção:</strong> Filtro de ar limpo, vela em bom estado e óleo trocado em dia fazem muita diferença.</li><li><strong>Corrente:</strong> Mantenha a corrente limpa, lubrificada e com a folga correta.</li><li><strong>Peso:</strong> Evite carregar peso desnecessário.</li></ol>',
    keywords:
      "melhorar, consumo, combustivel, combustível, gasolina, economia, econômica, gastando muito",
  },
];

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

  // **NOVO**: Gera uma saudação proativa e personalizada
  generateProactiveGreeting();

  const form = document.getElementById("graxa-form");
  form.addEventListener("submit", handleUserQuestion);
  renderSuggestions(); // **NOVO**: Renderiza as sugestões

  lucide.createIcons();
}

/**
 * **NOVA FUNÇÃO**
 * Gera uma saudação personalizada com base nos dados do usuário.
 */
function generateProactiveGreeting() {
  // **MELHORIA**: Adiciona um resumo financeiro da semana na saudação.
  const maintenanceItems = userData.maintenanceItems || [];
  const odometer = userData.odometer || 0;
  let proactiveMessage = null;

  // 1. Tenta gerar uma mensagem de manutenção
  if (maintenanceItems.length > 0 && odometer > 0) {
    for (const item of maintenanceItems) {
      const kmSinceLastService = odometer - (item.lastServiceKm || 0);
      const progress = (kmSinceLastService / item.interval) * 100;
      if (progress >= 90) {
        proactiveMessage = `Notei que a manutenção de <strong>${
          item.name
        }</strong> está próxima (${Math.round(
          progress
        )}% atingido). Que tal agendar um serviço em breve?`;
        break; // Pega a primeira manutenção crítica e para.
      }
    }
  }

  // 2. Se não houver alerta de manutenção, gera um resumo financeiro da semana
  if (!proactiveMessage) {
    getFinancialSummaryForPeriod("week").then((summary) => {
      if (summary.totalEarnings > 0 || summary.totalExpenses > 0) {
        const balance = summary.totalEarnings - summary.totalExpenses;
        const balanceColor = balance >= 0 ? "text-green-500" : "text-red-500";
        proactiveMessage = `Resumo da sua semana até agora: <strong>Ganhos de R$ ${summary.totalEarnings.toFixed(
          2
        )}</strong> e Despesas de R$ ${summary.totalExpenses.toFixed(
          2
        )}. Seu saldo está em <strong class="${balanceColor}">R$ ${balance.toFixed(
          2
        )}</strong>.`;
      }
      // Monta a mensagem final
      const greeting = `Olá, ${
        userData.publicProfile?.name?.split(" ")[0] || "piloto"
      }!`;
      const finalMessage = proactiveMessage
        ? `${greeting} ${proactiveMessage}`
        : `${greeting} Eu sou a Graxa, sua assistente virtual. Como posso te ajudar hoje?`;
      addMessage("bot", finalMessage);
    });
  } else {
    // Se já tinha mensagem de manutenção, usa ela
    const greeting = `Olá, ${
      userData.publicProfile?.name?.split(" ")[0] || "piloto"
    }!`;
    addMessage("bot", `${greeting} ${proactiveMessage}`);
  }
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
    let firestoreKb = [];
    [firestoreKb, manualsKnowledgeBase] = await Promise.all([
      getCachedOrFetch(CACHE_KEY_KB, "graxa_kb"),
      getCachedOrFetch(CACHE_KEY_MANUALS, "graxa_manuals_kb"),
    ]);
    // **MELHORIA**: Junta a base padrão com a base do Firestore.
    knowledgeBase = [...defaultKnowledgeBase, ...firestoreKb];

    // **MELHORIA**: Carrega a base de conhecimento de leis de trânsito
    try {
      const response = await fetch(`src/data/leis_transito.json`);
      if (response.ok) {
        const transitLawData = await response.json();
        knowledgeBase = [...knowledgeBase, ...transitLawData];
        console.log(`[Graxa] Conhecimento de leis de trânsito carregado!`);
      }
    } catch (error) {
      console.error("Erro ao carregar JSON de leis de trânsito:", error);
    }

    // **NOVO**: Carrega a base de conhecimento da Central de Ajuda
    try {
      const response = await fetch(`src/data/ajuda.json`);
      if (response.ok) {
        const helpCenterData = await response.json();
        const helpArticles = [];
        for (const categoryKey in helpCenterData) {
          const category = helpCenterData[categoryKey];
          category.articles.forEach((article) => {
            helpArticles.push({
              ...article, // Inclui id, question, answer
              source: "Central de Ajuda", // Identifica a origem
            });
          });
        }
        knowledgeBase = [...knowledgeBase, ...helpArticles];
        console.log(`[Graxa] Conhecimento da Central de Ajuda carregado!`);
      }
    } catch (error) {
      console.error("Erro ao carregar JSON da Central de Ajuda:", error);
    }
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
  userData = userDoc.data() || {}; // Salva os dados do usuário globalmente

  isPro = userData.isPro === true;
  userUsage = userData.graxaUsage || { count: 0, lastQuestionDate: "" };

  // **NOVO: Carrega a base de conhecimento específica da moto do usuário**
  const motoModel = userData.publicProfile?.fipeModelText;
  if (motoModel) {
    // Transforma o nome do modelo em um nome de arquivo válido (ex: "CG 160 FAN" -> "cg-160-fan.json")
    const fileName =
      motoModel.toLowerCase().replace(/ /g, "-").replace(/\//g, "-") + ".json";
    try {
      const response = await fetch(`src/data/manuals/${fileName}`);
      if (response.ok) {
        const manualData = await response.json();
        // Adiciona os dados do manual à base de conhecimento principal
        knowledgeBase = [...knowledgeBase, ...manualData];
        console.log(
          `[Graxa] Conhecimento do manual '${fileName}' carregado com sucesso!`
        );
      } else {
        console.log(
          `[Graxa] Manual para '${fileName}' não encontrado. Usando base de conhecimento genérica.`
        );
      }
    } catch (error) {
      console.error("Erro ao carregar manual da moto:", error);
    }
  }
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
  let processedQuestion = question;

  // **MELHORIA: Lógica de contexto**
  // 1. Verifica se o contexto expirou
  if (
    lastContext.timestamp &&
    new Date().getTime() - lastContext.timestamp > CONTEXT_TIMEOUT_MS
  ) {
    lastContext.subject = null;
    lastContext.timestamp = null;
  }

  // 2. Se a pergunta é curta e existe um contexto, combina os dois.
  // Ex: User pergunta "Qual o óleo da DK160?", depois "e a calibragem?".
  // A nova pergunta se torna "e a calibragem da dk160?".
  if (
    lastContext.subject &&
    question.length < 20 &&
    !hasContextKeyword(question)
  ) {
    processedQuestion = `${question} ${lastContext.subject}`;
    console.log(`[Graxa] Contexto aplicado: "${processedQuestion}"`);
  } else {
    // Se a pergunta é longa ou contém uma nova palavra-chave de contexto,
    // o contexto antigo é provavelmente irrelevante.
    lastContext.subject = null;
    lastContext.timestamp = null;
  }

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

  // **MELHORIA**: Verifica se está no meio de uma conversa ou iniciando uma nova.
  if (conversationState.isConversing) {
    await handleConversationStep(processedQuestion);
  } else {
    // Tenta processar a pergunta como uma ação antes de buscar uma resposta
    const wasAction = await processIntent(processedQuestion);
    if (!wasAction) {
      showTypingIndicator(); // Mostra "digitando" enquanto busca a resposta
      // Se não foi uma ação, busca uma resposta na base de conhecimento
      findAnswer(processedQuestion);
    }
  }
}

/**
 * Renderiza os botões de sugestão de perguntas.
 * **MODIFICADO**: Adiciona sugestões de ações.
 */
function renderSuggestions() {
  const suggestionsContainer = document.getElementById("graxa-suggestions");
  if (!suggestionsContainer) return;

  const suggestions = [
    "Como trocar o óleo?",
    "Qual a calibragem do pneu?",
    "Leis sobre baú de moto",
    "Adicionar despesa de R$50 com gasolina",
    "Registrar ganho de R$120 no iFood",
    "Multa por andar sem capacete",
    "Qual o óleo da DK160?",
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
 * **NOVA FUNÇÃO**
 * Lida com os passos de uma conversa em andamento (ex: adicionar despesa).
 * @param {string} answer - A resposta do usuário à pergunta da Graxa.
 */
async function handleConversationStep(answer) {
  const flow = CONVERSATION_FLOWS[conversationState.intent];
  if (!flow) return resetConversation();

  const step = flow.steps[conversationState.currentStep];
  if (!step) return resetConversation();

  // Salva a resposta do usuário
  conversationState.data[step.key] = answer;

  // Avança para o próximo passo
  conversationState.currentStep++;

  if (conversationState.currentStep < flow.steps.length) {
    // Se ainda há perguntas, faz a próxima
    askNextQuestion();
  } else {
    // Se a conversa terminou, executa a ação final
    showTypingIndicator();
    await flow.finalize(conversationState.data);
    resetConversation();
  }
}

/**
 * **NOVA FUNÇÃO**
 * Faz a próxima pergunta do fluxo de conversa atual.
 */
function askNextQuestion() {
  const flow = CONVERSATION_FLOWS[conversationState.intent];
  const step = flow.steps[conversationState.currentStep];

  addMessage("bot", step.question);

  // Se o passo tiver opções, mostra como botões de sugestão
  if (step.type === "select" && step.options) {
    const suggestionsContainer = document.getElementById("graxa-suggestions");
    suggestionsContainer.innerHTML = step.options
      .map(
        (opt) =>
          `<button class="suggestion-btn text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-full whitespace-nowrap" data-value="${opt.value}">${opt.text}</button>`
      )
      .join("");

    // Adiciona um listener específico para estas opções
    suggestionsContainer.onclick = (e) => {
      const btn = e.target.closest(".suggestion-btn");
      if (btn) {
        const value = btn.dataset.value;
        addMessage("user", btn.textContent); // Mostra a escolha do usuário no chat
        handleConversationStep(value); // Processa a escolha
        suggestionsContainer.innerHTML = ""; // Limpa as sugestões
        suggestionsContainer.onclick = null; // Remove o listener
      }
    };
  } else {
    // Se for um campo de texto livre, limpa as sugestões
    renderSuggestions();
  }
}

/**
 * **NOVA FUNÇÃO**
 * Reseta o estado da conversa.
 */
function resetConversation() {
  conversationState = {
    isConversing: false,
    intent: null,
    data: {},
    currentStep: 0,
  };
  // Restaura as sugestões padrão
  renderSuggestions();
}

/**
 * **NOVA FUNÇÃO**
 * Inicia um fluxo de conversa.
 * @param {string} intentName - O nome da intenção (ex: 'add_expense').
 */
function startConversation(intentName) {
  if (!CONVERSATION_FLOWS[intentName]) return;

  conversationState = {
    isConversing: true,
    intent: intentName,
    data: {},
    currentStep: 0,
  };

  askNextQuestion();
}

/**
 * **NOVA FUNÇÃO**
 * Cancela a conversa atual.
 */
function cancelConversation() {
  if (conversationState.isConversing) {
    resetConversation();
    addMessage("bot", "Ok, operação cancelada.");
    return true;
  }
  return false;
}

/**
 * **NOVA FUNÇÃO**
 * Tenta identificar e executar uma ação a partir da pergunta do usuário.
 * @param {string} question - A pergunta do usuário.
 * @returns {Promise<boolean>} - Retorna true se uma ação foi executada, false caso contrário.
 */
async function processIntent(question) {
  const intents = [
    {
      // **NOVA INTENÇÃO**: Cancelar uma operação
      name: "cancel",
      regex: /^(cancelar|deixa pra lá|esquece)$/i,
      action: async () => {
        return cancelConversation();
      },
    },
    {
      name: "add_expense",
      regex:
        /(?:adicione|registre|lance) (?:uma )?despesa de R?\$?\s?(\d+[\.,]?\d*)\s?(?:com|de|para)\s?(.+)/i,
      action: async (matches) => {
        const value = parseFloat(matches[1].replace(",", "."));
        const description = matches[2].trim();
        let category = "outros"; // Categoria padrão

        // Mapeia a descrição para uma categoria
        if (/gasolina|combust[ií]vel|etanol|posto/i.test(description))
          category = "combustivel";
        if (/manuten[cç][aã]o|troca de [oó]leo|revis[aã]o/i.test(description))
          category = "manutencao";
        if (/almo[cç]o|janta|comida|lanche/i.test(description))
          category = "alimentacao";

        await API.submitExpense(null, {
          category,
          totalValue: value,
          observation: description,
        });
        addMessage(
          "bot",
          `Ok, registrei uma despesa de <strong>R$ ${value.toFixed(
            2
          )}</strong> na categoria <strong>${category}</strong>.`
        );
        return true;
      },
    },
    {
      name: "add_earning",
      regex:
        /(?:adicione|registre|lance) (?:um )?ganho de R?\$?\s?(\d+[\.,]?\d*)\s?(?:no|na|em)\s?(.+)/i,
      action: async (matches) => {
        const value = parseFloat(matches[1].replace(",", "."));
        const source = matches[2].trim();
        let category = "app_entrega"; // Padrão

        if (/ifood|rappi|entregas/i.test(source)) category = "app_entrega";
        if (/uber|99|passageiro/i.test(source)) category = "app_passageiro";
        if (/loja/i.test(source)) category = "loja_fixa";

        await API.submitFinance(null, {
          category,
          totalValue: value,
          count: 1, // Assume 1 corrida/entrega
        });
        addMessage(
          "bot",
          `Beleza! Registrei um ganho de <strong>R$ ${value.toFixed(
            2
          )}</strong> de <strong>${source}</strong>.`
        );
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO**: Iniciar conversa para adicionar despesa
      name: "start_add_expense",
      regex:
        /(?:quero|gostaria de) (?:adicionar|lançar|registrar) (?:uma )?despesa/i,
      action: async () => {
        startConversation("add_expense_flow");
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO**: Iniciar conversa para adicionar ganho
      name: "start_add_earning",
      regex:
        /(?:quero|gostaria de) (?:adicionar|lançar|registrar) (?:um )?ganho/i,
      action: async () => {
        startConversation("add_earning_flow");
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO**: Iniciar conversa para adicionar item de manutenção
      name: "start_add_maintenance",
      regex:
        /(?:quero|gostaria de) (?:adicionar|cadastrar) (?:um novo )?item de manuten[cç][aã]o/i,
      action: async () => {
        startConversation("add_maintenance_flow");
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO**: Abrir modal para editar item de manutenção
      name: "edit_maintenance_item",
      regex: /(?:editar|alterar|modificar) o item de manuten[cç][aã]o (.+)/i,
      action: async (matches) => {
        const itemName = matches[1].trim().toLowerCase();
        const itemToEdit = userData.maintenanceItems?.find(
          (item) => item.name.toLowerCase() === itemName
        );

        if (itemToEdit) {
          addMessage(
            "bot",
            `Ok, abrindo o editor para <strong>${itemToEdit.name}</strong>.`
          );
          openMaintenanceModal(itemToEdit.id, "edit");
        } else {
          addMessage(
            "bot",
            `Desculpe, não encontrei um item de manutenção chamado "${matches[1].trim()}".`
          );
        }
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO: Buscar previsão do tempo**
      name: "get_weather",
      regex: /(?:previsão do tempo|como est[áa] o tempo) (?:para|em) (.+)/i,
      action: async (matches) => {
        // 1. Substitua pela sua chave de API do OpenWeatherMap.
        const apiKey = "b39ef98f3edca5d6de39c4fcd9b78c7c"; // Lembre-se de substituir
        if (apiKey === "b39ef98f3edca5d6de39c4fcd9b78c7c") {
          addMessage(
            "bot",
            "Ainda não fui configurada para consultar o tempo. Peça ao meu desenvolvedor para adicionar uma chave de API do OpenWeatherMap!"
          );
          return true;
        }

        const city = matches[1].trim();
        showTypingIndicator();
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          city
        )}&appid=${apiKey}&units=metric&lang=pt_br`;

        try {
          const response = await fetch(url);
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error("Não encontrei essa cidade.");
            }
            throw new Error("Não consegui consultar o tempo agora.");
          }
          const data = await response.json();
          const description = data.weather[0].description;
          const temp = data.main.temp.toFixed(1);
          const feels_like = data.main.feels_like.toFixed(1);

          let answer = `A previsão para <strong>${data.name}</strong> é de ${description}, com temperatura de <strong>${temp}°C</strong> (sensação de ${feels_like}°C).`;

          // **MELHORIA**: Adiciona uma dica de segurança com base no tempo.
          const safetyTip = getSafetyTipForWeather(data.weather[0], data.main);
          if (safetyTip) {
            answer += safetyTip;
          }

          hideTypingIndicator();
          addMessage("bot", answer);
        } catch (error) {
          hideTypingIndicator();
          addMessage("bot", `Desculpe, tive um problema: ${error.message}`);
        }
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO: Responder a saudações**
      name: "greeting",
      regex: /^(oi|olá|e aí|salve|bom dia|boa tarde|boa noite)$/i,
      action: async () => {
        const greetings = [
          "Olá! Como posso ajudar?",
          "E aí! Pronto pra rodar?",
          "Opa, tudo certo? O que manda?",
        ];
        const randomGreeting =
          greetings[Math.floor(Math.random() * greetings.length)];
        addMessage("bot", randomGreeting);
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO: Responder a "tudo bem?"**
      name: "how_are_you",
      regex: /tudo bem\??|como vai\??|tudo certo\??/i,
      action: async () => {
        addMessage(
          "bot",
          "Tudo ótimo por aqui, com os circuitos em dia! E com você, tudo certo?"
        );
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO: Responder a agradecimentos**
      name: "thanks",
      regex: /^(obrigado|vlw|valeu|show|top|massa|daora)$/i,
      action: async () => {
        addMessage(
          "bot",
          "Tamo junto! Se precisar de mais alguma coisa, é só chamar."
        );
        return true;
      },
    },
    {
      // **MELHORIA: Nova intenção para consultas financeiras detalhadas**
      // Ex: "quanto gastei com gasolina esta semana?"
      name: "query_detailed_finances",
      regex:
        /(?:quanto|qual foi) (?:eu )?(gastei|ganhei) (?:com|de|em|no|na) (.+?) (hoje|esta semana|neste mês|este mês)/i,
      action: async (matches) => {
        const action = matches[1]; // gastei, ganhei
        const subject = matches[2].trim(); // gasolina, ifood, etc.
        const periodWord = matches[3]; // hoje, esta semana, etc.

        const type = action === "gastei" ? "expense" : "earning";

        // Mapeia o assunto para uma categoria do sistema
        let category = null;
        if (type === "expense") {
          if (/gasolina|combust.vel|posto/i.test(subject))
            category = "combustivel";
          if (/manuten..o|troca|revis.o/i.test(subject))
            category = "manutencao";
          if (/comida|almo.o|janta|lanche/i.test(subject))
            category = "alimentacao";
        } else {
          if (/ifood|rappi/i.test(subject)) category = "app_entrega";
          if (/uber|99/i.test(subject)) category = "app_passageiro";
        }

        if (!category) {
          addMessage(
            "bot",
            `Desculpe, não consegui identificar a categoria "${subject}". Tente usar um termo mais específico.`
          );
          return true;
        }

        let period;
        if (periodWord === "hoje") period = "day";
        if (periodWord === "esta semana") period = "week";
        if (periodWord.includes("mês")) period = "month";

        showTypingIndicator();
        const summary = await getFinancialSummaryForPeriod(period, {
          category: category,
        });

        const total =
          type === "expense" ? summary.totalExpenses : summary.totalEarnings;

        const response = `Você ${action} <strong>R$ ${total.toFixed(
          2
        )}</strong> com ${subject} ${periodWord}.`;
        hideTypingIndicator();
        addMessage("bot", response);
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO: Consultar dados financeiros**
      name: "query_finances",
      regex:
        /(?:qual foi|me diga|mostre) meu (ganho|lucro|saldo|despesa) (total )?(hoje|esta semana|neste mês|este mês)/i,
      action: async (matches) => {
        const queryType = matches[1]; // ganho, lucro, saldo, despesa
        const periodWord = matches[3]; // hoje, esta semana, neste mês

        let period;
        if (periodWord === "hoje") period = "day";
        if (periodWord === "esta semana") period = "week";
        if (periodWord.includes("mês")) period = "month";

        if (!period) {
          addMessage(
            "bot",
            "Não entendi o período de tempo. Tente 'hoje', 'esta semana' ou 'neste mês'."
          );
          return true;
        }

        showTypingIndicator();
        addMessage("bot", `Calculando seu ${queryType} para ${periodWord}...`);

        const summary = await getFinancialSummaryForPeriod(period);
        const balance = summary.totalEarnings - summary.totalExpenses;

        let responseMessage = "";
        switch (queryType) {
          case "ganho":
            responseMessage = `Seus ganhos ${periodWord} somam <strong>R$ ${summary.totalEarnings.toFixed(
              2
            )}</strong>.`;
            break;
          case "despesa":
            responseMessage = `Suas despesas ${periodWord} somam <strong>R$ ${summary.totalExpenses.toFixed(
              2
            )}</strong>.`;
            break;
          case "lucro":
          case "saldo":
            const balanceColor =
              balance >= 0 ? "text-green-500" : "text-red-500";
            responseMessage = `Considerando seus ganhos de R$ ${summary.totalEarnings.toFixed(
              2
            )} e despesas de R$ ${summary.totalExpenses.toFixed(
              2
            )}, seu saldo ${periodWord} é de <strong class="${balanceColor}">R$ ${balance.toFixed(
              2
            )}</strong>.`;
            break;
        }
        hideTypingIndicator();
        addMessage("bot", responseMessage);
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO: Easter Egg para perguntas bobas**
      name: "easter_egg",
      regex:
        /(qual o sentido da vida|quem é você|você gosta de motos|conte uma piada)/i,
      action: async () => {
        const easterEggs = [
          "A resposta para isso é 42... ou talvez seja só manter a corrente lubrificada e o tanque cheio. 😉",
          "Eu sou a Graxa! Uma inteligência artificial nascida do cheiro de gasolina e do barulho de um motor bem regulado. Meu propósito é te ajudar a rodar mais e melhor.",
          "Gosto de motos? Eu SOU as motos! Meus circuitos vibram na mesma frequência de um motor V2.",
          "Por que a moto foi ao psicólogo? Porque ela estava com problemas de relacionamento!",
          "Detectei uma pergunta de nível filosófico. Infelizmente, sou especialista em graxa e parafusos, mas estou trabalhando nisso.",
        ];
        const randomAnswer =
          easterEggs[Math.floor(Math.random() * easterEggs.length)];
        addMessage("bot", randomAnswer);
        return true;
      },
    },
    {
      // **NOVA INTENÇÃO: Consultar dados do perfil do usuário**
      name: "query_profile",
      regex:
        /qual (?:é|e) (?:o|a) (meu|minha) (nome|email|placa|modelo da moto|ano da moto|cor da moto)/i,
      action: async (matches) => {
        const field = matches[2]; // nome, email, placa, etc.
        let answer = "Não encontrei essa informação no seu perfil.";
        const profile = userData.publicProfile || {};

        switch (field) {
          case "nome":
            if (profile.name)
              answer = `Seu nome é <strong>${profile.name}</strong>.`;
            break;
          case "email":
            if (userData.email)
              answer = `Seu email de cadastro é <strong>${userData.email}</strong>.`;
            break;
          case "placa":
            if (profile.motoPlate)
              answer = `A placa da sua moto é <strong>${profile.motoPlate}</strong>.`;
            break;
          case "modelo da moto":
            if (profile.fipeModelText)
              answer = `O modelo da sua moto é <strong>${profile.fipeModelText}</strong>.`;
            break;
          case "ano da moto":
            if (profile.motoYear)
              answer = `O ano da sua moto é <strong>${profile.motoYear}</strong>.`;
            break;
          case "cor da moto":
            if (profile.motoColor)
              answer = `A cor da sua moto é <strong>${profile.motoColor}</strong>.`;
            if (profile.motoColor)
              answer = `A cor da sua moto é <strong>${profile.motoColor}</strong>.`;
            break;
        }

        addMessage("bot", answer);
        return true;
      },
    },
  ];

  for (const intent of intents) {
    const match = question.match(intent.regex);
    if (match) {
      // Ações que não iniciam uma conversa mostram o "digitando"
      if (!intent.name.startsWith("start_")) {
        showTypingIndicator();
      }
      return await intent.action(match); // Retorna o resultado da ação
    }
  }

  return false; // Nenhuma ação encontrada
}

/**
 * Encontra a melhor resposta na base de conhecimento.
 * @param {string} question - A pergunta do usuário.
 */
function findAnswer(question) {
  // **MELHORIA: Lógica de busca e pontuação refeita para maior precisão.**
  const questionWords = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .split(/\s+/)
    .filter((word) => word.length > 2); // Ignora palavras muito curtas

  let bestMatch = { score: 0, item: null };

  knowledgeBase.forEach((item) => {
    let score = 0;
    const normalizedQuestion = item.question
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const keywords = (item.keywords || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/, ?/);

    questionWords.forEach((word) => {
      // Pontuação maior para palavras na pergunta, menor para keywords
      if (normalizedQuestion.includes(word)) {
        score += 2;
      }
      if (keywords.includes(word)) {
        score++;
      }
    });

    if (score > bestMatch.score) {
      bestMatch = { score, item: item };
    }
  });

  // **MELHORIA: Extração de contexto para a próxima pergunta**
  if (bestMatch.score > 1) {
    const questionText = (bestMatch.item.question || question).toLowerCase();
    const foundKeyword = CONTEXT_KEYWORDS.find((kw) =>
      questionText.includes(kw)
    );
    if (foundKeyword) {
      lastContext.subject = foundKeyword;
      lastContext.timestamp = new Date().getTime();
      console.log(`[Graxa] Contexto definido para: "${foundKeyword}"`);
    }
  }

  hideTypingIndicator();

  setTimeout(() => {
    // Considera uma resposta boa se a pontuação for maior que 1
    if (bestMatch.score > 1) {
      let finalAnswer = bestMatch.item.answer;
      // **MELHORIA**: Adiciona a fonte se a resposta veio de uma fonte específica
      if (bestMatch.item.source) {
        finalAnswer += `<p class="text-xs text-gray-400 mt-2">Fonte: ${bestMatch.item.source}</p>`;
      }

      // **NOVO**: Adiciona a mídia (imagem ou vídeo) se estiver definida no item.
      if (bestMatch.item.media) {
        if (bestMatch.item.media.type === "image") {
          finalAnswer += `<a href="${bestMatch.item.media.url}" target="_blank" rel="noopener noreferrer" title="Clique para ver a imagem completa"><img src="${bestMatch.item.media.url}" alt="Imagem ilustrativa" class="mt-2 rounded-lg w-full border dark:border-gray-700 cursor-pointer"></a>`;
        } else if (bestMatch.item.media.type === "video") {
          finalAnswer += `<video src="${bestMatch.item.media.url}" controls class="mt-2 rounded-lg w-full"></video>`;
        }
      }

      addMessage("bot", finalAnswer);
    } else {
      addMessage(
        "bot",
        "Desculpe, ainda não tenho a resposta para essa pergunta. Tente perguntar de outra forma ou sobre outro assunto."
      );
    }
  }, 1000); // Simula um tempo de "pensamento"
}

/**
 * **NOVA FUNÇÃO AUXILIAR**
 * Verifica se uma string contém alguma palavra-chave de contexto.
 * @param {string} text - O texto a ser verificado.
 * @returns {boolean}
 */
function hasContextKeyword(text) {
  return CONTEXT_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));
}

/**
 * **NOVA FUNÇÃO**
 * Gera uma dica de segurança com base nas condições climáticas.
 * @param {object} condition - O objeto `weather` da API OpenWeatherMap.
 * @param {object} main - O objeto `main` da API OpenWeatherMap.
 * @returns {string|null} - A dica de segurança em HTML ou null.
 */
function getSafetyTipForWeather(condition, main) {
  const conditionId = condition.id; // Usar o ID é mais preciso que o `main`
  const temperature = main.temp;
  let tip = null;

  if (conditionId >= 200 && conditionId < 600) {
    tip =
      "<strong>Pista molhada!</strong> Redobre o cuidado nas curvas e na frenagem. Mantenha distância do veículo da frente.";
  } else if (conditionId >= 701 && conditionId < 800) {
    tip =
      "<strong>Visibilidade reduzida!</strong> Use sempre o farol baixo (nunca o alto) e reduza a velocidade.";
  } else if (temperature > 28) {
    tip =
      "<strong>Dia quente!</strong> Lembre-se de se hidratar bem durante as pausas para evitar a desidratação.";
  } else if (temperature < 14) {
    tip =
      "<strong>Tempo frio!</strong> Use uma segunda pele e luvas adequadas para não perder a sensibilidade nas mãos.";
  }

  if (tip) {
    return `<div class="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-yellow-500 rounded-r-lg text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
              <i data-lucide="alert-triangle" class="w-8 h-8 shrink-0"></i>
              <span>${tip}</span>
            </div>`;
  }
  return null;
}

/**
 * **NOVO**: Define os fluxos de conversa para adicionar dados.
 */
const CONVERSATION_FLOWS = {
  add_maintenance_flow: {
    steps: [
      {
        question:
          "Legal! Qual o nome do item que você quer monitorar? (ex: Troca de óleo, Pneu dianteiro)",
        key: "name",
        type: "text",
      },
      {
        question:
          "A cada quantos quilômetros (Km) você faz a manutenção deste item?",
        key: "interval",
        type: "number",
      },
      {
        question: "Em qual categoria ele se encaixa melhor?",
        key: "category",
        type: "select",
        options: [
          { value: "engine", text: "⚙️ Motor" },
          { value: "brakes", text: "🛑 Freios" },
          { value: "tires", text: "🔘 Pneus" },
          { value: "transmission", text: "🔗 Relação" },
          { value: "electrical", text: "💡 Elétrica" },
          { value: "other", text: "🔩 Outros" },
        ],
      },
    ],
    finalize: async (data) => {
      await API.saveMaintenanceItem(null, data);
      addMessage(
        "bot",
        `Show! O item <strong>${data.name}</strong> foi adicionado à sua lista de manutenção.`
      );
    },
  },
  add_expense_flow: {
    steps: [
      {
        question: "Ok, vamos adicionar uma despesa. Qual a categoria?",
        key: "category",
        type: "select",
        options: [
          { value: "combustivel", text: "⛽ Combustível" },
          { value: "manutencao", text: "🔧 Manutenção" },
          { value: "alimentacao", text: "🍔 Alimentação" },
          { value: "pecas", text: "🔩 Peças" },
          { value: "documentacao", text: "📄 Documentação" },
          { value: "outros", text: "🛒 Outros" },
        ],
      },
      {
        question: "Entendido. Qual foi o valor total da despesa?",
        key: "totalValue",
        type: "number",
      },
      {
        question: "Certo. Quer adicionar alguma observação? (ou diga 'não')",
        key: "observation",
        type: "text",
      },
    ],
    finalize: async (data) => {
      const value = parseFloat(data.totalValue.replace(",", "."));
      const observation = /não|nao/i.test(data.observation)
        ? ""
        : data.observation;
      await API.submitExpense(null, {
        category: data.category,
        totalValue: value,
        observation: observation,
      });
      addMessage(
        "bot",
        `Pronto! Despesa de <strong>R$ ${value.toFixed(
          2
        )}</strong> registrada com sucesso.`
      );
    },
  },
  add_earning_flow: {
    steps: [
      {
        question: "Vamos lá! De onde veio esse ganho?",
        key: "category",
        type: "select",
        options: [
          { value: "app_entrega", text: "🛵 App de Entrega (iFood, etc)" },
          { value: "app_passageiro", text: "🙋 App de Passageiro (Uber, 99)" },
          { value: "loja_fixa", text: "🏬 Loja Fixa" },
        ],
      },
      {
        question: "Anotado. Qual foi o valor total do ganho?",
        key: "totalValue",
        type: "number",
      },
    ],
    finalize: async (data) => {
      // Simplificação: para adicionar mais detalhes (corridas, etc), precisaríamos de mais passos.
      const value = parseFloat(data.totalValue.replace(",", "."));
      await API.submitFinance(null, {
        category: data.category,
        totalValue: value,
        count: 1,
      });
      addMessage(
        "bot",
        `Show! Ganho de <strong>R$ ${value.toFixed(2)}</strong> registrado.`
      );
    },
  },
};

/**
 * **NOVA FUNÇÃO AUXILIAR**
 * Busca e calcula o resumo financeiro para um determinado período.
 * @param {'day'|'week'|'month'} period - O período a ser consultado.
 * @param {object} [options] - Opções adicionais, como { category: 'combustivel' }.
 * @returns {Promise<{totalEarnings: number, totalExpenses: number}>}
 */
async function getFinancialSummaryForPeriod(period, options = {}) {
  if (!currentUser) return { totalEarnings: 0, totalExpenses: 0, balance: 0 };

  const now = new Date();
  let startDate;

  switch (period) {
    case "day":
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "week":
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Dom, 1=Seg
      startDate = new Date(now.setDate(now.getDate() - diff));
      startDate.setHours(0, 0, 0, 0);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      return { totalEarnings: 0, totalExpenses: 0, balance: 0 };
  }

  const startDateString = startDate.toISOString().split("T")[0];

  // Constrói as queries base
  let earningsQuery = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .collection("earnings")
    .where("date", ">=", startDateString);

  let expensesQuery = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .collection("expenses")
    .where("date", ">=", startDateString);

  // **MELHORIA**: Adiciona filtro de categoria se fornecido
  if (options.category) {
    // Aplica o filtro em ambas as queries. Uma delas não encontrará nada, o que está correto.
    earningsQuery = earningsQuery.where("category", "==", options.category);
    expensesQuery = expensesQuery.where("category", "==", options.category);
  }

  const [earningsSnap, expensesSnap] = await Promise.all([
    earningsQuery.get(),
    expensesQuery.get(),
  ]);

  const totalEarnings = earningsSnap.docs.reduce(
    (sum, doc) => sum + doc.data().totalValue,
    0
  );

  const totalExpenses = expensesSnap.docs.reduce(
    (sum, doc) => sum + doc.data().totalValue,
    0
  );

  return { totalEarnings, totalExpenses };
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

  // **MELHORIA**: Adiciona avatares e animação de entrada
  messageDiv.className = `flex items-end gap-2 animate-slide-in-bottom ${
    isUser ? "justify-end" : "justify-start"
  }`;

  const avatarHtml = isUser
    ? `<div class="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center shrink-0 order-2">
         <i data-lucide="user" class="w-5 h-5 text-gray-600 dark:text-gray-300"></i>
       </div>`
    : `<div class="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shrink-0 order-1">
         <i data-lucide="bot" class="w-5 h-5 text-black"></i>
       </div>`;

  messageDiv.innerHTML = `
    ${!isUser ? avatarHtml : ""}
    <div class="max-w-[80%] p-3 px-4 rounded-2xl ${
      isUser
        ? "bg-yellow-500 text-black rounded-br-lg"
        : "bg-white dark:bg-gray-800 rounded-bl-lg"
    } order-1">
        <div class="prose prose-sm dark:prose-invert max-w-none">${text}</div>
      </div>
    ${isUser ? avatarHtml : ""}
  `;

  messagesContainer.appendChild(messageDiv);
  lucide.createIcons(); // Renderiza os novos ícones
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * **NOVA FUNÇÃO**
 * Mostra um indicador de "digitando..." na interface.
 */
function showTypingIndicator() {
  hideTypingIndicator(); // Remove qualquer indicador anterior
  const messagesContainer = document.getElementById("graxa-messages");
  const typingDiv = document.createElement("div");
  typingDiv.id = "typing-indicator";
  typingDiv.className = "flex items-end gap-2 justify-start";
  typingDiv.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shrink-0">
      <i data-lucide="bot" class="w-5 h-5 text-black"></i>
    </div>
    <div class="max-w-[80%] p-3 px-4 rounded-2xl bg-white dark:bg-gray-800 rounded-bl-lg">
      <div class="flex items-center justify-center gap-1 h-5">
        <span class="typing-dot"></span>
        <span class="typing-dot" style="animation-delay: 0.2s;"></span>
        <span class="typing-dot" style="animation-delay: 0.4s;"></span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(typingDiv);
  lucide.createIcons();
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * **NOVA FUNÇÃO**
 * Remove o indicador de "digitando..." da interface.
 */
function hideTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) {
    indicator.remove();
  }
}
