/**
 * @file graxa.service.js
 * @description Lógica central da assistente virtual Graxa.
 * Este serviço contém a máquina de estados, processamento de linguagem natural (NLU),
 * base de conhecimento, e a inteligência para interações proativas e contextuais.
 *
 * Refatoração completa visando:
 * - Fuzzy Search para tolerância a erros.
 * - Contexto dinâmico baseado no perfil do usuário.
 * - Integração profunda com APIs e roteamento do app.
 * - Proatividade e personalidade aprimoradas.
 */

import { db, appId } from "../config.js";
import { currentUser } from "../auth.js";
import * as API from "../api.js";


// --- STATE MANAGEMENT ---
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
// Contexto aprimorado para lembrar não apenas do assunto, mas do tipo de informação
let lastContext = {
  subject: null, // ex: 'dk160', 'finance'
  entity: null, // ex: 'óleo', 'saldo'
  timestamp: null,
};

// --- CONSTANTS ---
const DAILY_LIMIT = 5; // Aumentando um pouco o limite na refatoração
const CONTEXT_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos
const FUZZY_SEARCH_THRESHOLD = 0.7; // Limiar de similaridade (70%)

// --- UI CALLBACKS ---
// Funções injetadas pelo graxa.ui.js para interagir com o DOM
let UIMessageCallback;
let UITypingIndicatorCallback;
let UISuggestionsCallback;

/**
 * Registra as funções de callback da UI para que o serviço possa interagir com o DOM.
 * @param {Function} addMessage - Função para adicionar uma mensagem ao chat.
 * @param {Function} typingIndicator - Função para mostrar/esconder o indicador de digitação.
 * @param {Function} renderSuggestions - Função para renderizar botões de sugestão.
 */
export function registerUICallbacks(addMessage, typingIndicator, renderSuggestions) {
  UIMessageCallback = addMessage;
  UITypingIndicatorCallback = typingIndicator;
  UISuggestionsCallback = renderSuggestions;
}


// ==================================================================
// ==                    CORE PUBLIC FUNCTIONS                     ==
// ==================================================================

/**
 * Carrega todos os dados iniciais necessários para a assistente funcionar.
 * Inclui bases de conhecimento (cache/Firestore) e dados do usuário.
 */
export async function loadInitialData() {
  const CACHE_KEY_PREFIX = "graxa_cache_";
  const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

  // Função auxiliar para buscar dados do cache ou do Firestore
  async function getCachedOrFetch(key, fetcher) {
    const cachedItem = localStorage.getItem(CACHE_KEY_PREFIX + key);
    if (cachedItem) {
      const { timestamp, data } = JSON.parse(cachedItem);
      if (Date.now() - timestamp < CACHE_DURATION_MS) {
        return data;
      }
    }
    const data = await fetcher();
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({ timestamp: Date.now(), data }));
    return data;
  }

  try {
    // Carrega todas as bases de conhecimento em paralelo
    const [firestoreKb, manualsKb, transitLawData, helpCenterData, userDoc] = await Promise.all([
      getCachedOrFetch("kb", () => db.collection("graxa_kb").get().then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
      getCachedOrFetch("manuals_kb", () => db.collection("graxa_manuals_kb").get().then(snap => snap.docs.map(doc => doc.data()))),
      fetch(`src/data/leis_transito.json`).then(res => res.json()),
      fetch(`src/data/ajuda.json`).then(res => res.json()),
      db.collection("artifacts").doc(appId).collection("users").doc(currentUser.uid).get()
    ]);
    
    // Constrói a base de conhecimento principal
    const helpArticles = Object.values(helpCenterData).flatMap(cat => cat.articles.map(art => ({ ...art, source: "Central de Ajuda" })));
    knowledgeBase = [...firestoreKb, ...manualsKb, ...transitLawData, ...helpArticles];

    // Processa os dados do usuário
    userData = userDoc.data() || {};
    isPro = userData.isPro === true;
    userUsage = userData.graxaUsage || { count: 0, lastQuestionDate: "" };

    // **REQUISITO 2: CONTEXTO DINÂMICO DE MOTO**
    // Carrega o manual específico da moto do usuário, se existir.
    const motoModel = userData.publicProfile?.fipeModelText;
    if (motoModel) {
      const fileName = motoModel.toLowerCase().replace(/[\/ ]/g, "-") + ".json";
      try {
        const manualData = await fetch(`src/data/manuals/${fileName}`).then(res => res.json());
        // Adiciona um identificador de contexto para dar prioridade na busca
        const contextualizedManualData = manualData.map(item => ({...item, context: 'user_moto'}));
        knowledgeBase.push(...contextualizedManualData);
        console.log(`[Graxa] Manual específico '${fileName}' carregado com sucesso!`);
      } catch (error) {
        console.log(`[Graxa] Manual para '${motoModel}' não encontrado. Usando base genérica.`);
      }
    }
    
    return true; // Sucesso
  } catch (error) {
    console.error("[Graxa] Erro crítico ao carregar dados iniciais:", error);
    UIMessageCallback?.("bot", "Desculpe, estou com um problema para inicializar. Tente recarregar a página.");
    return false; // Falha
  }
}

/**
 * Processa a pergunta enviada pelo usuário, orquestrando todo o fluxo de resposta.
 * @param {string} question - A pergunta crua do usuário.
 */
export async function processUserQuestion(question) {
  UIMessageCallback?.("user", question);

  // Atualiza a contagem de uso para não-apoiadores
  if (!isPro) {
    userUsage.count++;
    db.collection("artifacts").doc(appId).collection("users").doc(currentUser.uid)
      .set({ graxaUsage: userUsage }, { merge: true });
  }

  // Lida com o estado da conversa (se estiver em um fluxo de múltiplos passos)
  if (conversationState.isConversing) {
    await handleConversationStep(question);
    return; // A conversa está ativa, não faz mais nada.
  }
  
  UITypingIndicatorCallback?.(true);

  // Tenta processar a pergunta como uma "intenção" de alta prioridade (ação, consulta, etc.)
  const intentResult = await processIntent(question);
  
  // Se a intenção retornou um comando de ação, repassa para a UI
  if (intentResult && (intentResult.type === 'ui_action' || intentResult.type === 'navigate')) {
      UITypingIndicatorCallback?.(false);
      return intentResult;
  }
  
  // Se a intenção foi processada mas não era um comando (ex: uma resposta de texto), para aqui.
  if (intentResult) {
      UITypingIndicatorCallback?.(false);
      return;
  }
  
  // Se não for uma intenção específica, busca a resposta na base de conhecimento
  await findAnswer(question);
  UITypingIndicatorCallback?.(false);
}

/**
 * Verifica se o limite de uso diário para não-apoiadores foi atingido.
 */
export function isLimitReached() {
  if (isPro) return false;
  const today = new Date().toISOString().split("T")[0];
  if (userUsage.lastQuestionDate !== today) {
    userUsage.count = 0;
    userUsage.lastQuestionDate = today;
  }
  return userUsage.count >= DAILY_LIMIT;
}


// ==================================================================
// ==                PROACTIVITY & PERSONALITY                     ==
// ==================================================================

/**
 * **REQUISITO 6: PERSONALIDADE E PROATIVIDADE**
 * Gera uma saudação proativa baseada na hora do dia e nos dados do usuário.
 */
export async function generateProactiveGreeting() {
  const greeting = getTimeBasedGreeting();
  const userName = userData.publicProfile?.name?.split(" ")[0] || "piloto";
  let proactiveMessage = "";

  // Verifica o balanço financeiro da semana
  const summary = await getFinancialSummaryForPeriod("week");
  const balance = summary.totalEarnings - summary.totalExpenses;

  if (summary.totalExpenses > 0 && balance < 0) {
    // Se o saldo for negativo, dá uma dica de economia
    proactiveMessage = `Notei que seus gastos superaram os ganhos nesta semana. Que tal uma dica para economizar combustível? Só pedir!`;
  } else {
    // Se não, verifica se há manutenções próximas
    const maintenanceItems = userData.maintenanceItems || [];
    const odometer = userData.odometer || 0;
    if (maintenanceItems.length > 0 && odometer > 0) {
      for (const item of maintenanceItems) {
        const kmSinceLastService = odometer - (item.lastServiceKm || 0);
        const progress = (kmSinceLastService / item.interval) * 100;
        if (progress >= 90) {
          proactiveMessage = `A manutenção de <strong>${item.name}</strong> está próxima (${Math.round(progress)}% atingido). Quer ver os detalhes na sua garagem?`;
          break;
        }
      }
    }
  }

  const finalMessage = proactiveMessage 
    ? `${greeting}, ${userName}! ${proactiveMessage}`
    : `${greeting}, ${userName}! Eu sou a Graxa, sua assistente. Como posso ajudar?`;
    
  UIMessageCallback?.("bot", finalMessage);
}

/**
 * Retorna uma saudação apropriada para a hora do dia.
 * @returns {string} - "Bom dia", "Boa tarde" ou "Boa noite".
 */
function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}


// ==================================================================
// ==               INTENT PROCESSING & NLU                        ==
// ==================================================================

/**
 * Orquestra o processamento de intenções. Itera sobre as intenções definidas
 * e executa a ação da primeira que corresponder à pergunta do usuário.
 * @param {string} question - A pergunta do usuário.
 * @returns {Promise<boolean>} - True se uma intenção foi processada, false caso contrário.
 */
async function processIntent(question) {
  for (const intent of intents) {
    const match = question.match(intent.regex);
    if (match) {
      const executed = await intent.action(match, question);
      if (executed) return true;
    }
  }
  return false;
}

/**
 * **REQUISITO 1: FUZZY SEARCH**
 * Busca a melhor resposta na base de conhecimento usando um algoritmo de busca aproximada.
 * @param {string} question - A pergunta do usuário.
 */
async function findAnswer(question) {
  const userMotoContext = userData.publicProfile?.fipeModelText?.toLowerCase() || '';

  const results = knowledgeBase.map(item => {
    // Normaliza tanto a pergunta do item quanto a do usuário
    const normalizedItemQuestion = item.question.toLowerCase();
    const normalizedUserQuestion = question.toLowerCase();
    
    // Calcula a similaridade
    const score = calculateStringSimilarity(normalizedItemQuestion, normalizedUserQuestion);
    
    // **REQUISITO 2: CONTEXTO DINÂMICO DE MOTO**
    // Aumenta a pontuação se o contexto da resposta for a moto do usuário
    let contextualScore = score;
    if (item.context === 'user_moto' || (userMotoContext && normalizedItemQuestion.includes(userMotoContext))) {
      contextualScore *= 1.5; // Bônus de 50% por relevância de contexto
    }
    
    return { score: contextualScore, item };
  }).sort((a, b) => b.score - a.score); // Ordena da maior para a menor pontuação

  const bestMatch = results[0];

  if (bestMatch && bestMatch.score >= FUZZY_SEARCH_THRESHOLD) {
    UIMessageCallback?.("bot", bestMatch.item.answer);
  } else {
    // Se não encontrar uma resposta boa, inicia o fluxo de aprendizado.
    startConversation("log_unanswered_question", {}, question);
  }
}


// ==================================================================
// ==                         UTILITIES                            ==
// ==================================================================

/**
 * **REQUISITO 1: FUZZY SEARCH (Implementação Nativa)**
 * Calcula a similaridade entre duas strings usando a distância de Levenshtein.
 * Retorna um valor entre 0 (totalmente diferente) e 1 (igual).
 * @param {string} a
 * @param {string} b
 * @returns {number} - Pontuação de similaridade.
 */
function calculateStringSimilarity(a, b) {
  if (!a || !b) return 0;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) { matrix[0][i] = i; }
  for (let j = 0; j <= b.length; j++) { matrix[j][0] = j; }

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,      // Deletion
        matrix[j - 1][i] + 1,      // Insertion
        matrix[j - 1][i - 1] + cost // Substitution
      );
    }
  }

  const distance = matrix[b.length][a.length];
  const longerLength = Math.max(a.length, b.length);
  return longerLength === 0 ? 1 : (longerLength - distance) / longerLength;
}

/**
 * **REQUISITO 5: TRATAMENTO ROBUSTO DE VALORES**
 * Extrai um valor numérico de uma string que pode conter R$, vírgulas, etc.
 * @param {string} text - Ex: "50 reais", "R$ 25,50", "30.00"
 * @returns {number|null} - O valor numérico ou null.
 */
function parseCurrency(text) {
  const sanitized = text
    .replace(/\./g, '')       // Remove pontos de milhar
    .replace(/,/g, '.')       // Troca vírgula por ponto decimal
    .replace(/R\$|reais|real|conto|pila/gi, '') // Remove símbolos e gírias
    .trim();
  
  const value = parseFloat(sanitized);
  return isNaN(value) ? null : value;
}

/**
 * **REQUISITO 4: INTELIGÊNCIA FINANCEIRA**
 * Busca e calcula o resumo financeiro para um período.
 * @param {'day'|'week'|'month'} period
 * @returns {Promise<{totalEarnings: number, totalExpenses: number}>}
 */
async function getFinancialSummaryForPeriod(period) {
    if (!currentUser) return { totalEarnings: 0, totalExpenses: 0 };
    const [earnings, expenses] = await Promise.all([
        API.getEarningsForPeriod(period),
        // Supondo que exista uma função análoga para despesas
        API.getExpensesForPeriod(period) 
    ]);

    const totalEarnings = earnings.reduce((sum, item) => sum + item.totalValue, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.totalValue, 0);

    return { totalEarnings, totalExpenses };
}

/**
 * Oferece uma dica aleatória de forma proativa.
 */
function giveRandomTip() {
    if (Math.random() < 0.4) { // 40% de chance
        const tips = knowledgeBase.filter(item => item.keywords && item.keywords.includes('dica'));
        if (tips.length > 0) {
            const randomTip = tips[Math.floor(Math.random() * tips.length)];
            setTimeout(() => {
                UIMessageCallback?.("bot", `💡 A propósito, uma dica rápida: ${randomTip.answer}`);
            }, 1500);
        }
    }
}


// ==================================================================
// ==             CONVERSATION FLOWS & INTENT LIST                 ==
// ==================================================================

// --- INTENTOS DE ALTA PRIORIDADE ---
// Estes são checados antes da busca na base de conhecimento.

const intents = [
  // --- Intenções de Conversa Social e Personalidade ---
  {
    name: 'greeting',
    regex: /^(oi|olá|e aí|salve|bom dia|boa tarde|boa noite)$/i,
    action: async () => {
      UIMessageCallback?.("bot", `${getTimeBasedGreeting()}! Em que posso ajudar?`);
      return true;
    }
  },
  {
    name: "thanks",
    regex: /^(obrigado|vlw|valeu|show|top)$/i,
    action: async () => {
      UIMessageCallback?.("bot", "De nada! Se precisar, é só chamar. 👍");
      giveRandomTip();
      return true;
    }
  },
  {
    name: 'what_can_you_do',
    regex: /o que voc(ê|e) (sabe|pode|consegue) fazer\??/i,
    action: async () => {
        UIMessageCallback?.("bot", `Eu posso te ajudar de várias formas! Você pode me pedir para:
        <ul class="list-disc list-inside mt-2 space-y-1">
            <li>Registrar <strong>ganhos e despesas</strong>.</li>
            <li>Consultar seu <strong>saldo financeiro</strong>.</li>
            <li>Navegar pelo <strong>app</strong> (ex: "ir para garagem").</li>
            <li>Tirar dúvidas sobre <strong>manutenção e leis</strong>.</li>
        </ul>`);
        return true;
    }
  },
  // --- Intenções de Ação e Navegação (Requisito 3) ---
  {
    name: 'navigate',
    regex: /(?:me leve para|ir para|abrir|mostrar|quero ver) (?:a tela de|minha|meus|o)? ?(.*?)$/i,
    action: async (matches) => {
        const destination = matches[1].toLowerCase().trim().replace(/s$/, ''); // Remove 's' plural
        const routes = {
            'início': 'dashboard', 'painel': 'dashboard',
            'garagem': 'garage',
            'finanças': 'finance', 'ganhos': 'finance', 'despesas': 'finance',
            'classificados': 'market', 'mercado': 'market',
            'perfil': 'profile'
        };
        if (routes[destination]) {
            UIMessageCallback?.("bot", `Ok, te levando para a tela de ${destination}.`);
            return { type: 'navigate', route: routes[destination] }; // Retorna o comando
        }
        return false;
    }
  },
  {
    name: 'open_maintenance_modal',
    regex: /adicionar (item de )?manuten(ç|c)(ã|a)o/i,
    action: async () => {
      UIMessageCallback?.("bot", "Claro. Abrindo a tela para adicionar um novo item de manutenção.");
      return { type: 'ui_action', function: 'openMaintenanceModal', params: [null, 'add'] }; // Retorna o comando
    }
  },
  // --- Inteligência Financeira e de Manutenção (Requisito 4) ---
  {
    name: "query_finances",
    regex: /(?:quanto|qual foi) (?:eu )?(ganhei|gastei|meu saldo) (hoje|esta semana|neste m(ê|e)s)/i,
    action: async (matches) => {
      const queryType = matches[1]; // ganhei, gastei, meu saldo
      const periodWord = matches[2]; // hoje, esta semana, neste mês

      let period;
      if (periodWord === "hoje") period = "day";
      if (periodWord.includes("semana")) period = "week";
      if (periodWord.includes("mês")) period = "month";
      
      UIMessageCallback?.("bot", `Calculando seu ${queryType.replace('meu ','')} para ${periodWord}...`);
      const summary = await getFinancialSummaryForPeriod(period);
      const balance = summary.totalEarnings - summary.totalExpenses;
      
      let response = "";
      if (queryType === 'ganhei') response = `Seus ganhos ${periodWord} somam <strong>R$ ${summary.totalEarnings.toFixed(2)}</strong>.`;
      if (queryType === 'gastei') response = `Suas despesas ${periodWord} somam <strong>R$ ${summary.totalExpenses.toFixed(2)}</strong>.`;
      if (queryType === 'meu saldo') response = `Seu saldo ${periodWord} é de <strong class="${balance >= 0 ? 'text-green-500' : 'text-red-500'}">R$ ${balance.toFixed(2)}</strong>.`;
      
      UIMessageCallback?.("bot", response);
      return true;
    }
  },
  {
    name: "query_maintenance_due",
    regex: /(?:quando vence|falta quanto para|como est(á|a)) (?:o|a)? (.*?)\??$/i,
    action: async (matches) => {
        const itemNameQuery = matches[2].toLowerCase().trim().replace(/a |o |da |do /g, '');
        const item = userData.maintenanceItems?.find(i => i.name.toLowerCase().includes(itemNameQuery));
        
        if (item) {
            const odometer = userData.odometer || 0;
            if (odometer === 0) {
              UIMessageCallback?.("bot", `Para calcular, primeiro preciso que você atualize sua quilometragem atual na Garagem.`);
              return true;
            }
            const kmSinceService = odometer - (item.lastServiceKm || 0);
            const remainingKm = item.interval - kmSinceService;
            
            if (remainingKm > 0) {
                UIMessageCallback?.("bot", `Faltam aproximadamente <strong>${Math.round(remainingKm)} km</strong> para a próxima manutenção de <strong>${item.name}</strong>.`);
            } else {
                UIMessageCallback?.("bot", `A manutenção de <strong>${item.name}</strong> está <strong>atrasada</strong> em ${Math.abs(Math.round(remainingKm))} km! É bom fazer o quanto antes.`);
            }
        } else {
            return false; // Deixa o findAnswer tentar achar algo se não for um item de manutenção
        }
        return true;
    }
  },
  // --- Tratamento Robusto de Valores (Requisito 5) ---
  {
      name: "add_financial_entry",
      regex: /(?:adicione|registre|lance|gastei|ganhei) (.*?)$/i,
      action: async (matches) => {
          const text = matches[1];
          const value = parseCurrency(text);
          if (!value) return false;

          const isExpense = /(despesa|gastei|com)/i.test(matches[0]);
          let description = text.replace(/R\$ ?|reais|real|contos?/gi, '').replace(/[0-9,\.]/g, '').trim();
          
          if (isExpense) {
              let category = 'outros';
              if (/gasolina|combust.vel/i.test(description)) category = "combustivel";
              if (/manuten..o|pe.a/i.test(description)) category = "manutencao";
              if (/almo.o|comida|lanche/i.test(description)) category = "alimentacao";
              startConversation('confirm_expense', { value, description, category });
          } else {
              let category = "app_entrega";
              if (/ifood|rappi/i.test(description)) category = "app_entrega";
              if (/uber|99/i.test(description)) category = "app_passageiro";
              startConversation('confirm_earning', { value, description, category });
          }
          return true;
      }
  },
];


// --- FLUXOS DE CONVERSA ---

const CONVERSATION_FLOWS = {
  confirm_expense: {
    steps: [{
      question: (data) => `Ok. Registrar uma despesa de <strong>R$ ${data.value.toFixed(2)}</strong> (${data.description}) na categoria <strong>${data.category}</strong>. Confirma?`,
      key: "confirmation",
      type: "confirmation",
      options: [{ value: "yes", text: "Sim" }, { value: "no", text: "Não" }],
    }],
    finalize: async (data) => {
      if (data.confirmation === "yes") {
        await API.submitExpense(null, { category: data.category, totalValue: data.value, observation: data.description });
        UIMessageCallback?.("bot", "Ok, despesa registrada!");
      } else {
        UIMessageCallback?.("bot", "Entendido, operação cancelada.");
      }
    },
  },
  confirm_earning: {
    steps: [{
      question: (data) => `Beleza. Registrar um ganho de <strong>R$ ${data.value.toFixed(2)}</strong> (${data.description}). Certo?`,
      key: "confirmation",
      type: "confirmation",
      options: [{ value: "yes", text: "Sim" }, { value: "no", text: "Não" }],
    }],
    finalize: async (data) => {
      if (data.confirmation === "yes") {
        await API.submitFinance(null, { category: data.category, totalValue: data.value, count: 1 });
        UIMessageCallback?.("bot", "Show! Ganho registrado com sucesso.");
      } else {
        UIMessageCallback?.("bot", "Ok, operação cancelada.");
      }
    },
  },
  log_unanswered_question: {
    steps: [{
      question: "Desculpe, não encontrei uma resposta para isso. Quer que eu registre sua pergunta para que eu possa aprender sobre o assunto no futuro?",
      key: "confirmation",
      type: "confirmation",
      options: [{ value: "yes", text: "Sim, por favor" }, { value: "no", text: "Não, obrigado" }],
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
        }
      } else {
        UIMessageCallback?.("bot", "Tudo bem. Se precisar de outra coisa, é só chamar.");
      }
    },
  },
};

// Funções de gerenciamento de conversas omitidas para brevidade, mas são as mesmas da versão anterior.
// (startConversation, handleConversationStep, resetConversation)

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

async function handleConversationStep(answer) {
  const flow = CONVERSATION_FLOWS[conversationState.intent];
  if (!flow) return resetConversation();
  const step = flow.steps[conversationState.currentStep];
  if (!step) return resetConversation();

  let processedAnswer = answer;
  if (step.type === "confirmation") {
    if (/^sim|s|confirmo?$/i.test(answer)) processedAnswer = "yes";
    else if (/^n(ã|a)o|cancela(r)?$/i.test(answer)) processedAnswer = "no";
    else {
      UIMessageCallback?.("bot", "Por favor, responda com 'sim' ou 'não'.");
      return;
    }
  }

  conversationState.data[step.key] = processedAnswer;
  conversationState.currentStep++;

  if (conversationState.currentStep < flow.steps.length) {
    askNextQuestion();
  } else {
    UITypingIndicatorCallback?.(true);
    await flow.finalize(conversationState.data, conversationState.originalQuestion);
    UITypingIndicatorCallback?.(false);
    resetConversation();
  }
}

function askNextQuestion() {
  const flow = CONVERSATION_FLOWS[conversationState.intent];
  if(!flow) return resetConversation();
  const step = flow.steps[conversationState.currentStep];
  
  // A pergunta pode ser uma função que usa os dados já coletados
  const questionText = typeof step.question === 'function' ? step.question(conversationState.data) : step.question;
  
  UIMessageCallback?.("bot", questionText);

  if (step.type === "select" || step.type === "confirmation") {
    UISuggestionsCallback?.(step.options, (value, text) => {
      UIMessageCallback?.("user", text);
      handleConversationStep(value);
    });
  } else {
    UISuggestionsCallback?.(null); // Restaura sugestões padrão
  }
}

function resetConversation() {
  conversationState = { isConversing: false, intent: null, data: {}, currentStep: 0 };
  UISuggestionsCallback?.(null);
}