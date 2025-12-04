import { db, appId } from "../config.js";
import { currentUser } from "../auth.js";
import * as API from "../api.js";
import { openMaintenanceModal } from "../ui.js";
import { router } from "../router.js";

// --- State Management ---
let knowledgeBase = [];
let userUsage = { count: 0, lastQuestionDate: "" };
let isPro = false;
let userData = {};
let conversationState = {
  isConversing: false,
  intent: null,
  data: {},
  currentStep: 0,
};
let lastContext = {
  subject: null,
  timestamp: null,
};

// --- Constants ---
const DAILY_LIMIT = 3;
const CONTEXT_TIMEOUT_MS = 2 * 60 * 1000;
const CONTEXT_KEYWORDS = ["dk160", "cg 160", "fan 160", "titan 160"];

// --- Exported state for UI ---
export const state = {
  get conversationState() {
    return conversationState;
  },
  get userData() {
    return userData;
  },
};

// --- Callback functions for UI ---
let UIMessageCallback;
let UITypingIndicatorCallback;
let UISuggestionsCallback;

export function registerUICallbacks(
  addMessage,
  typingIndicator,
  renderSuggestions
) {
  UIMessageCallback = addMessage;
  UITypingIndicatorCallback = typingIndicator;
  UISuggestionsCallback = renderSuggestions;
}

// --- Knowledge Base ---
const defaultKnowledgeBase = [
    {
    question: "Como trocar o óleo?",
    answer:
      '<p>Trocar o óleo é vital para a saúde do motor. O processo básico é:</p><ol class="list-decimal list-inside space-y-1"><li>Aqueça o motor por alguns minutos.</li><li>Coloque um recipiente sob o bujão do cárter.</li><li>Remova o bujão e deixe o óleo velho escorrer completamente.</li><li>Troque o anel de vedação e recoloque o bujão sem apertar demais.</li><li>Remova o filtro de óleo antigo e instale um novo, lubrificando a borracha de vedação.</li><li>Adicione o óleo novo. Verifique a quantidade e especificação no manual (ex: 10W30 Semissintético).</li></ol>',
    keywords:
      "trocar, troca, oleo, óleo, motor, manutencao, manutenção, filtro",
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

// --- Core Logic ---

export async function loadInitialData() {
  const CACHE_KEY_KB = "graxa_kb_cache";
  const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
  const now = new Date().getTime();

  async function getCachedOrFetch(key, collectionName) {
    const cachedItem = localStorage.getItem(key);
    if (cachedItem) {
      const { timestamp, data } = JSON.parse(cachedItem);
      if (now - timestamp < CACHE_DURATION_MS) return data;
    }
    console.log(`[Graxa] Buscando dados frescos para ${collectionName}`);
    const snapshot = await db.collection(collectionName).get();
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    localStorage.setItem(key, JSON.stringify({ timestamp: now, data }));
    return data;
  }

  try {
    const firestoreKb = await getCachedOrFetch(CACHE_KEY_KB, "graxa_kb");
    const manualsKb = await getCachedOrFetch(
      "graxa_manuals_cache",
      "graxa_manuals_kb"
    );
    knowledgeBase = [...defaultKnowledgeBase, ...firestoreKb, ...manualsKb];

    const [transitLawData, helpCenterData] = await Promise.all([
      fetch(`src/data/leis_transito.json`).then((res) => res.json()),
      fetch(`src/data/ajuda.json`).then((res) => res.json()),
    ]);

    knowledgeBase.push(...transitLawData);
    const helpArticles = Object.values(helpCenterData).flatMap((cat) =>
      cat.articles.map((art) => ({ ...art, source: "Central de Ajuda" }))
    );
    knowledgeBase.push(...helpArticles);

    const userRef = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(currentUser.uid);
    const userDoc = await userRef.get();
    userData = userDoc.data() || {};
    isPro = userData.isPro === true;
    userUsage = userData.graxaUsage || { count: 0, lastQuestionDate: "" };

    const motoModel = userData.publicProfile?.fipeModelText;
    if (motoModel) {
      const fileName =
        motoModel.toLowerCase().replace(/ /g, "-").replace(/\//g, "-") + ".json";
      try {
        const response = await fetch(`src/data/manuals/${fileName}`);
        if (response.ok) {
          const manualData = await response.json();
          knowledgeBase.push(...manualData);
          console.log(`[Graxa] Manual '${fileName}' carregado!`);
        }
      } catch (error) {
        console.error("Erro ao carregar manual da moto:", error);
      }
    }
    return true; // Indica sucesso
  } catch (error) {
    console.error("Erro ao carregar base de conhecimento da Graxa:", error);
    UIMessageCallback?.(
      "bot",
      "Desculpe, estou com problemas para acessar minha memória. Tente novamente mais tarde."
    );
    return false; // Indica falha
  }
}

export function generateProactiveGreeting() {
  const maintenanceItems = userData.maintenanceItems || [];
  const odometer = userData.odometer || 0;
  let proactiveMessage = null;

  if (maintenanceItems.length > 0 && odometer > 0) {
    for (const item of maintenanceItems) {
      const kmSinceLastService = odometer - (item.lastServiceKm || 0);
      const progress = (kmSinceLastService / item.interval) * 100;
      if (progress >= 90) {
        proactiveMessage = `Notei que a manutenção de <strong>${
          item.name
        }</strong> está próxima (${Math.round(
          progress
        )}% atingido). Quer ver os detalhes?`;
        break;
      }
    }
  }

  if (!proactiveMessage) {
    getFinancialSummaryForPeriod("week").then((summary) => {
      let financialText = "";
      if (summary.totalEarnings > 0 || summary.totalExpenses > 0) {
        const balance = summary.totalEarnings - summary.totalExpenses;
        const balanceColor = balance >= 0 ? "text-green-500" : "text-red-500";
        financialText = `Seu resumo da semana é: <strong>Ganhos de R$ ${summary.totalEarnings.toFixed(
          2
        )}</strong> e Despesas de R$ ${summary.totalExpenses.toFixed(
          2
        )}. Saldo: <strong class="${balanceColor}">R$ ${balance.toFixed(
          2
        )}</strong>.`;
      }
      const greeting = `Olá, ${
        userData.publicProfile?.name?.split(" ")[0] || "piloto"
      }!`;
      const finalMessage = financialText
        ? `${greeting} ${financialText}`
        : `${greeting} Eu sou a Graxa, sua assistente virtual. Como posso te ajudar hoje?`;
      UIMessageCallback?.("bot", finalMessage);
    });
  } else {
    const greeting = `Olá, ${
      userData.publicProfile?.name?.split(" ")[0] || "piloto"
    }!`;
    UIMessageCallback?.("bot", `${greeting} ${proactiveMessage}`);
  }
}

export function isLimitReached() {
  if (isPro) return false;
  const today = new Date().toISOString().split("T")[0];
  if (userUsage.lastQuestionDate !== today) {
    userUsage.count = 0;
    userUsage.lastQuestionDate = today;
  }
  return userUsage.count >= DAILY_LIMIT;
}

export async function processUserQuestion(question) {
  UIMessageCallback?.("user", question);

  if (!isPro) {
    userUsage.count++;
    const userRef = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(currentUser.uid);
    await userRef.set({ graxaUsage: userUsage }, { merge: true });
  }

  // Lógica de contexto
  if (
    lastContext.timestamp &&
    new Date().getTime() - lastContext.timestamp > CONTEXT_TIMEOUT_MS
  ) {
    lastContext.subject = null;
  }
  let processedQuestion = question;
  if (
    lastContext.subject &&
    question.length < 20 &&
    !hasContextKeyword(question)
  ) {
    processedQuestion = `${question} ${lastContext.subject}`;
  } else {
    lastContext.subject = null;
  }

  if (conversationState.isConversing) {
    await handleConversationStep(processedQuestion);
  } else {
    const wasAction = await processIntent(processedQuestion);
    if (!wasAction) {
      UITypingIndicatorCallback?.(true);
      findAnswer(processedQuestion);
    }
  }
}

async function handleConversationStep(answer) {
  const flow = CONVERSATION_FLOWS[conversationState.intent];
  if (!flow) return resetConversation();

  const step = flow.steps[conversationState.currentStep];
  if (!step) return resetConversation();

  // Validação para sim/não
  if (step.type === "confirmation") {
    if (/^sim|s|confirmar|confirmo$/i.test(answer)) {
      answer = "yes";
    } else if (/^n(ã|a)o|cancelar|cancela$/i.test(answer)) {
      answer = "no";
    } else {
      UIMessageCallback?.(
        "bot",
        "Por favor, responda com 'sim' ou 'não'."
      );
      return; // Não avança o passo
    }
  }

  conversationState.data[step.key] = answer;
  conversationState.currentStep++;

  if (conversationState.currentStep < flow.steps.length) {
    askNextQuestion();
  } else {
    UITypingIndicatorCallback?.(true);
    await flow.finalize(conversationState.data, conversationState.originalQuestion);
    resetConversation();
  }
}

function askNextQuestion() {
  const flow = CONVERSATION_FLOWS[conversationState.intent];
  const step = flow.steps[conversationState.currentStep];
  UIMessageCallback?.("bot", step.question);

  if (step.type === "select" || step.type === "confirmation") {
    UISuggestionsCallback?.(step.options, (value, text) => {
      UIMessageCallback?.("user", text);
      handleConversationStep(value);
      UISuggestionsCallback?.([], null); // Limpa sugestões
    });
  } else {
    UISuggestionsCallback?.(null); // Restaura sugestões padrão
  }
}

function resetConversation() {
  conversationState = {
    isConversing: false,
    intent: null,
    data: {},
    currentStep: 0,
  };
  UISuggestionsCallback?.(null); // Restaura sugestões padrão
}

function startConversation(intentName, data = {}, originalQuestion = "") {
  if (!CONVERSATION_FLOWS[intentName]) return;
  conversationState = {
    isConversing: true,
    intent: intentName,
    data: data,
    currentStep: 0,
    originalQuestion: originalQuestion,
  };
  askNextQuestion();
}

function cancelConversation() {
  if (conversationState.isConversing) {
    resetConversation();
    UIMessageCallback?.("bot", "Ok, operação cancelada.");
    return true;
  }
  return false;
}

// INTENTS, CONVERSATIONS AND KNOWLEDGE BASE ARE DOWN BELOW
// ...
async function processIntent(question) {
    for (const intent of intents) {
        const match = question.match(intent.regex);
        if (match) {
            if (!intent.name.startsWith("start_")) {
                UITypingIndicatorCallback?.(true);
            }
            const executed = await intent.action(match, question);
            if (executed) return true;
        }
    }
    return false;
}

function findAnswer(question) {
  // ... (lógica do findAnswer)
  // ...
  const questionWords = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2);

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
      if (normalizedQuestion.includes(word)) score += 2;
      if (keywords.includes(word)) score++;
    });

    if (score > bestMatch.score) {
      bestMatch = { score, item };
    }
  });
  
  UITypingIndicatorCallback?.(false);

  if (bestMatch.score > 1) {
    // Context update
    const questionText = (bestMatch.item.question || question).toLowerCase();
    const foundKeyword = CONTEXT_KEYWORDS.find((kw) => questionText.includes(kw));
    if (foundKeyword) {
        lastContext.subject = foundKeyword;
        lastContext.timestamp = new Date().getTime();
    }
    
    let finalAnswer = bestMatch.item.answer;
    if (bestMatch.item.source) {
      finalAnswer += `<p class="text-xs text-gray-400 mt-2">Fonte: ${bestMatch.item.source}</p>`;
    }
    if (bestMatch.item.media) {
      if (bestMatch.item.media.type === "image") {
        finalAnswer += `<a href="${bestMatch.item.media.url}" target="_blank" rel="noopener noreferrer"><img src="${bestMatch.item.media.url}" alt="Imagem ilustrativa" class="mt-2 rounded-lg"></a>`;
      }
    }
    UIMessageCallback?.("bot", finalAnswer);
  } else {
    // **NOVA LÓGICA DE FALLBACK**
    startConversation("log_unanswered_question", {}, question);
  }
}

function hasContextKeyword(text) {
  return CONTEXT_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));
}

function giveRandomTip() {
    // Only give a tip occasionally (e.g., 40% chance) to avoid being annoying.
    if (Math.random() < 0.4) {
        const tips = defaultKnowledgeBase.filter(item => 
            !item.question.toLowerCase().includes('leis') && 
            !item.question.toLowerCase().includes('baú')
        ); // Filter out law-specific questions for more general tips
        
        if (tips.length > 0) {
            const randomTip = tips[Math.floor(Math.random() * tips.length)];
            setTimeout(() => {
                UIMessageCallback?.("bot", `A propósito, uma dica rápida: quer saber mais sobre "${randomTip.question}"?`);
            }, 1500); // Delay the tip slightly
        }
    }
}

async function getFinancialSummaryForPeriod(period, options = {}) {
  // ... (código existente)
  if (!currentUser) return { totalEarnings: 0, totalExpenses: 0 };

  const now = new Date();
  let startDate;

  switch (period) {
    case "day":
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "week":
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(new Date().setDate(now.getDate() - diff));
      startDate.setHours(0, 0, 0, 0);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      return { totalEarnings: 0, totalExpenses: 0 };
  }

  const startDateString = startDate.toISOString().split("T")[0];
  let earningsQuery = db.collection("artifacts").doc(appId).collection("users").doc(currentUser.uid).collection("earnings").where("date", ">=", startDateString);
  let expensesQuery = db.collection("artifacts").doc(appId).collection("users").doc(currentUser.uid).collection("expenses").where("date", ">=", startDateString);

  if (options.category) {
    earningsQuery = earningsQuery.where("category", "==", options.category);
    expensesQuery = expensesQuery.where("category", "==", options.category);
  }

  const [earningsSnap, expensesSnap] = await Promise.all([
    earningsQuery.get(),
    expensesQuery.get(),
  ]);

  const totalEarnings = earningsSnap.docs.reduce((sum, doc) => sum + doc.data().totalValue, 0);
  const totalExpenses = expensesSnap.docs.reduce((sum, doc) => sum + doc.data().totalValue, 0);

  return { totalEarnings, totalExpenses };
}


const intents = [
    {
        name: "cancel",
        regex: /^(cancelar|deixa pra lá|esquece|não)$/i,
        action: async () => cancelConversation(),
    },
    { // **NOVA** - Navegação
        name: "navigate",
        regex: /(?:me leve para|ir para|abrir|mostrar) a? tela de (.*?)$/i,
        action: async (matches) => {
            const destination = matches[1].toLowerCase().trim();
            const routes = {
                'início': 'dashboard',
                'garagem': 'garage',
                'financeiro': 'finance',
                'mercado': 'market',
                'perfil': 'profile',
            };
            if (routes[destination]) {
                UIMessageCallback?.("bot", `Ok, te levando para a tela de ${destination}.`);
                router(routes[destination]);
                return true;
            }
            UIMessageCallback?.("bot", `Desculpe, não encontrei uma tela chamada "${destination}".`);
            return true;
        }
    },
    { // **NOVA** - Consulta de Manutenção
        name: 'query_maintenance',
        regex: /(?:quanto falta para|como est(á|a)) a manuten(ç|c)(ã|a)o d(o|a) (.*?)\??$/i,
        action: async (matches) => {
            const itemName = matches[4].trim().toLowerCase();
            const item = userData.maintenanceItems?.find(i => i.name.toLowerCase().includes(itemName));
            
            if (item) {
                const odometer = userData.odometer || 0;
                const kmSinceService = odometer - (item.lastServiceKm || 0);
                const remainingKm = item.interval - kmSinceService;
                
                if (remainingKm > 0) {
                    UIMessageCallback?.("bot", `Faltam aproximadamente <strong>${Math.round(remainingKm)} km</strong> para a próxima manutenção de <strong>${item.name}</strong>.`);
                } else {
                    UIMessageCallback?.("bot", `A manutenção de <strong>${item.name}</strong> está <strong>atrasada</strong> em ${Math.abs(Math.round(remainingKm))} km. É recomendado fazer o quanto antes.`);
                }
            } else {
                UIMessageCallback?.("bot", `Não encontrei o item de manutenção "${itemName}". Verifique o nome na sua garagem.`);
            }
            return true;
        }
    },
    {
        name: "add_expense",
        regex: /(?:adicione|registre|lance) (?:uma )?despesa de R?\$?\s?(\d+[\.,]?\d*)\s?(?:com|de|para)\s?(.+)/i,
        action: async (matches) => {
            const value = parseFloat(matches[1].replace(",", "."));
            const description = matches[2].trim();
            let category = "outros";
            if (/gasolina|combust[ií]vel/i.test(description)) category = "combustivel";
            if (/manuten[cç][aã]o|pe(ç|c)a/i.test(description)) category = "manutencao";
            if (/almo[cç]o|comida/i.test(description)) category = "alimentacao";

            const data = { category, totalValue: value, observation: description };
            startConversation("confirm_expense", { expenseData: data });
            return true;
        },
    },
    {
        name: "add_earning",
        regex: /(?:adicione|registre|lance) (?:um )?ganho de R?\$?\s?(\d+[\.,]?\d*)\s?(?:no|na|em)\s?(.+)/i,
        action: async (matches) => {
            const value = parseFloat(matches[1].replace(",", "."));
            const source = matches[2].trim();
            let category = "app_entrega";
            if (/ifood|rappi/i.test(source)) category = "app_entrega";
            if (/uber|99/i.test(source)) category = "app_passageiro";
            if (/loja/i.test(source)) category = "loja_fixa";

            const data = { category, totalValue: value, count: 1 };
            startConversation("confirm_earning", { earningData: data });
            return true;
        },
    },
    {
        name: 'what_can_you_do',
        regex: /o que (voc(ê|e))? (sabe|pode|consegue) fazer\??/i,
        action: async () => {
            UIMessageCallback?.("bot", `Eu posso te ajudar de várias formas! Você pode me pedir para:
            <ul class="list-disc list-inside mt-2 space-y-1">
                <li>Registrar <strong>ganhos e despesas</strong> (ex: "adicione R$50 de gasolina").</li>
                <li>Consultar seu <strong>saldo financeiro</strong> (ex: "qual meu saldo esta semana?").</li>
                <li>Te levar para as <strong>telas do app</strong> (ex: "me leve para a garagem").</li>
                <li>Tirar dúvidas sobre <strong>manutenção, leis e peças</strong> (ex: "como trocar o óleo?").</li>
                <li>E muito mais! Tente me perguntar algo.</li>
            </ul>`);
            return true;
        }
    },
    {
        name: 'who_made_you',
        regex: /quem te (criou|desenvolveu|programou|fez)\??/i,
        action: async () => {
            UIMessageCallback?.("bot", "Eu fui desenvolvida com carinho pela equipe do AppMotoCash, com o objetivo de ser a melhor copiloto para os motociclistas do Brasil! 🏍️💻");
            return true;
        }
    },
     {
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
        UIMessageCallback?.("bot", randomGreeting);
        return true;
      },
    },
    {
      name: "how_are_you",
      regex: /tudo bem\??|como vai\??|tudo certo\??/i,
      action: async () => {
        UIMessageCallback?.(
          "bot",
          "Tudo ótimo por aqui, com os circuitos em dia! E com você, tudo certo?"
        );
        return true;
      },
    },
    {
      name: "thanks",
      regex: /^(obrigado|vlw|valeu|show|top|massa|daora)$/i,
      action: async () => {
        const responses = [
          "Tamo junto! Se precisar de mais alguma coisa, é só chamar.",
          "De nada! Precisando, tô por aqui.",
          "É pra isso que eu tô aqui! 😉"
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        UIMessageCallback?.("bot", randomResponse);
        
        giveRandomTip(); // Oferece uma dica proativa

        return true;
      },
    },
    {
      name: "easter_egg",
      regex:
        /(qual o sentido da vida|você gosta de motos|conte uma piada)/i,
      action: async (matches) => {
        let answer = "";
        const command = matches[1].toLowerCase();
        if(command.includes("sentido da vida")) {
            answer = "A resposta para isso é 42... ou talvez seja só manter a corrente lubrificada e o tanque cheio. 😉";
        } else if (command.includes("gosta de motos")) {
            answer = "Gosto de motos? Eu SOU as motos! Meus circuitos vibram na mesma frequência de um motor V2.";
        } else if (command.includes("conte uma piada")) {
            answer = "Por que a moto foi ao psicólogo? Porque ela estava com problemas de relacionamento!";
        }
        UIMessageCallback?.("bot", answer);
        return true;
      },
    },
    // ... (restante das intenções, adaptadas para usar os callbacks e o startConversation)
];


const CONVERSATION_FLOWS = {
  // **NOVO**: Fluxo de confirmação de despesa
  confirm_expense: {
    steps: [{
      question: (data) => `Você confirma o registro de uma despesa de <strong>R$ ${data.expenseData.totalValue.toFixed(2)}</strong> com <strong>${data.expenseData.observation}</strong>?`,
      key: "confirmation",
      type: "confirmation",
      options: [
        { value: "yes", text: "Sim" },
        { value: "no", text: "Não" },
      ],
    }],
    finalize: async (data) => {
      if (data.confirmation === "yes") {
        await API.submitExpense(null, data.expenseData);
        UIMessageCallback?.("bot", "Ok, despesa registrada!");
      } else {
        UIMessageCallback?.("bot", "Entendido, cancelei o registro.");
      }
    },
  },
  // **NOVO**: Fluxo de confirmação de ganho
  confirm_earning: {
    steps: [{
      question: (data) => `Você confirma o registro de um ganho de <strong>R$ ${data.earningData.totalValue.toFixed(2)}</strong>?`,
      key: "confirmation",
      type: "confirmation",
      options: [
        { value: "yes", text: "Sim" },
        { value: "no", text: "Não" },
      ],
    }],
    finalize: async (data) => {
      if (data.confirmation === "yes") {
        await API.submitFinance(null, data.earningData);
        UIMessageCallback?.("bot", "Beleza! Ganho registrado com sucesso.");
      } else {
        UIMessageCallback?.("bot", "Ok, o registro foi cancelado.");
      }
    },
  },
  // **NOVO**: Fluxo para logar pergunta não respondida
  log_unanswered_question: {
    steps: [{
      question: "Desculpe, não encontrei uma resposta para isso. Gostaria de registrar sua pergunta para que eu possa aprender sobre o assunto?",
      key: "confirmation",
      type: "confirmation",
      options: [
        { value: "yes", text: "Sim, por favor" },
        { value: "no", text: "Não, obrigado" },
      ],
    }],
    finalize: async (data, originalQuestion) => {
      if (data.confirmation === "yes") {
        try {
          await db.collection("artifacts").doc(appId).collection("graxa_unanswered_questions").add({
            question: originalQuestion,
            userId: currentUser.uid,
            timestamp: new Date(),
          });
          UIMessageCallback?.("bot", "Obrigado! Sua pergunta foi enviada para minha equipe. Eles vão me ensinar sobre isso em breve.");
        } catch (error) {
          console.error("Erro ao registrar pergunta não respondida:", error);
          UIMessageCallback?.("bot", "Tive um problema para registrar sua pergunta, mas agradeço a ajuda!");
        }
      } else {
        UIMessageCallback?.("bot", "Tudo bem. Se precisar de outra coisa, é só chamar.");
      }
    },
  },
  // ... (fluxos de conversas existentes)
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
      UIMessageCallback?.(
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
      UIMessageCallback?.(
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
      const value = parseFloat(data.totalValue.replace(",", "."));
      await API.submitFinance(null, {
        category: data.category,
        totalValue: value,
        count: 1,
      });
      UIMessageCallback?.(
        "bot",
        `Show! Ganho de <strong>R$ ${value.toFixed(2)}</strong> registrado.`
      );
    },
  },
};
