import { db, appId, auth } from "./config.js";
import { currentUser } from "./auth.js";
import { router } from "./router.js";
import {
  showNotification,
  showConfirmation,
  showCompleteProfileModal,
  closeModal,
} from "./ui.js";

export let allLoadedItems = [];
export let currentStats = {};

/**
 * **NOVO**: Busca os ganhos de um usuário para um período específico.
 * @param {string} period - O período ('week', 'last-week', etc.).
 * @returns {Promise<Array>} - Uma promessa que resolve com a lista de ganhos.
 */
export async function getEarningsForPeriod(period) {
  if (!currentUser) return [];

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let startDate, endDate;

  if (period === "week") {
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate = new Date(now);
    startDate.setDate(now.getDate() - diff);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  } else if (period === "last-week") {
    const dayOfWeek = now.getDay();
    const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek - 1 + 7;
    startDate = new Date(now);
    startDate.setDate(now.getDate() - daysToLastMonday);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  } else {
    return []; // Outros períodos podem ser implementados aqui
  }

  const startDateString = startDate.toISOString().split("T")[0];
  const endDateString = endDate.toISOString().split("T")[0];

  try {
    const earningsSnap = await db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(currentUser.uid)
      .collection("earnings")
      .where("date", ">=", startDateString)
      .where("date", "<=", endDateString)
      .get();

    return earningsSnap.docs.map((doc) => doc.data());
  } catch (error) {
    console.error(`Erro ao buscar ganhos para o período ${period}:`, error);
    return [];
  }
}

// --- AUTH API ---
export function handleEmailLogin(mode) {
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-pass").value;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !pass) {
    return showLoginError("Por favor, preencha e-mail e senha.");
  }
  if (!emailRegex.test(email)) {
    return showLoginError("O formato do e-mail parece inválido.");
  }
  if (pass.length < 6) {
    return showLoginError("A senha deve ter no mínimo 6 caracteres.");
  }

  // Validação do aceite de termos apenas no cadastro
  if (mode === "register") {
    const termsCheckbox = document.getElementById("terms-checkbox");
    if (!termsCheckbox.checked) {
      return showLoginError(
        "Você deve aceitar os termos e a política de privacidade para se cadastrar."
      );
    }
  }

  const btn = document.getElementById(
    mode === "login" ? "btn-signin" : "btn-signup"
  );
  const orig = btn.innerText;
  btn.innerText = "...";
  (mode === "login"
    ? auth.signInWithEmailAndPassword(email, pass)
    : auth
        .createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
          // Envia e-mail de verificação para novos usuários
          userCredential.user.sendEmailVerification();
          showNotification(
            "Cadastro realizado! Um e-mail de verificação foi enviado para você.",
            "Sucesso!"
          );
        })
  ).catch((err) => {
    btn.innerText = orig;
    showLoginError(err.code);
  });
}

export function handleAnonLogin() {
  auth.signInAnonymously().catch((e) => showLoginError(e.message));
}

export function logout() {
  auth.signOut();
}

function showLoginError(msg) {
  document.getElementById("login-error-msg").innerText = msg;
  document.getElementById("login-error-box").classList.remove("hidden");
}

export function handlePasswordReset() {
  const email = document.getElementById("login-email").value;
  if (!email) {
    return showNotification(
      "Por favor, digite seu e-mail no campo acima para redefinir a senha.",
      "E-mail necessário"
    );
  }

  auth
    .sendPasswordResetEmail(email)
    .then(() => {
      showNotification(
        "Um e-mail de redefinição de senha foi enviado para você. Verifique sua caixa de entrada (e a pasta de spam).",
        "E-mail Enviado!"
      );
    })
    .catch((error) => {
      if (error.code === "auth/user-not-found") {
        showLoginError("Nenhum usuário encontrado com este e-mail.");
      } else {
        showLoginError(`Erro: ${error.message}`);
      }
    });
}

export function resendVerificationEmail() {
  if (!currentUser) return;
  currentUser
    .sendEmailVerification()
    .then(() => {
      showNotification(
        "Um novo e-mail de verificação foi enviado. Verifique sua caixa de entrada.",
        "E-mail Reenviado"
      );
    })
    .catch((error) => {
      showNotification(`Erro ao reenviar e-mail: ${error.message}`, "Erro");
    });
}

export function saveProfile() {
  currentUser
    .updateProfile({
      displayName: document.getElementById("prof-name").value,
    })
    .then(() => showNotification("Perfil salvo com sucesso!", "Sucesso"));
}

export function saveMonthlyGoal() {
  const goalInput = document.getElementById("monthly-goal-input");
  const goalValue = parseFloat(goalInput.value);

  if (isNaN(goalValue) || goalValue < 0) {
    return showNotification(
      "Por favor, insira um valor de meta válido.",
      "Valor Inválido"
    );
  }

  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .set({ monthlyGoal: goalValue }, { merge: true }) // Usar set com merge para criar ou atualizar
    .then(() => {
      showNotification("Meta Semanal salva com sucesso!", "Sucesso");
    })
    .catch((e) =>
      showNotification(`Erro ao salvar meta: ${e.message}`, "Erro")
    );
}

export async function setUserOnlineStatus(isOnline) {
  if (!currentUser) return;

  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);

  // Se o usuário quer ficar online, primeiro checamos se o perfil público está completo
  if (isOnline) {
    const userDoc = await userRef.get();
    const userData = userDoc.data() || {};
    if (
      !userData.publicProfile?.name ||
      !userData.publicProfile?.fipeModelText || // Verifica o novo campo de texto do modelo
      !userData.publicProfile?.motoPlate ||
      !userData.publicProfile?.whatsapp
    ) {
      // Perfil incompleto, mostrar modal para preenchimento
      showCompleteProfileModal();
      return Promise.reject("Perfil incompleto"); // Interrompe a função e retorna uma promessa rejeitada
    }
  }

  // Se for para ficar online, pega a localização
  if (isOnline) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          userRef
            .set(
              {
                status: {
                  isOnline: true,
                  lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                  location,
                },
              },
              { merge: true }
            )
            .then(resolve)
            .catch(reject);
        },
        (error) => {
          showNotification(
            "Não foi possível obter sua localização. Ative a permissão no seu navegador.",
            "Erro de Localização"
          );
          reject(error);
        },
        { enableHighAccuracy: true } // Solicita a localização mais precisa possível
      );
    });
  } else {
    // **REGRA DE NEGÓCIO: VERIFICA SE HÁ VAGA EM ABERTO ANTES DE FICAR OFFLINE**
    const negotiatingJobs = await db
      .collection("jobs")
      .where("motoboyId", "==", currentUser.uid)
      .where("status", "==", "negociando")
      .get();

    if (!negotiatingJobs.empty) {
      showNotification(
        "Você não pode ficar offline enquanto estiver em uma negociação. Conclua ou cancele a vaga primeiro.",
        "Ação Bloqueada"
      );
      // Rejeita a promessa para que o toggle na UI não mude de estado
      return Promise.reject("Vaga em negociação");
    }

    // Se for para ficar offline, apenas atualiza o status
    return userRef.set(
      {
        status: {
          isOnline: isOnline,
          lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
  }
}

export function savePublicProfile(event) {
  event.preventDefault();
  if (!currentUser) return;

  const name = document.getElementById("public-name").value;
  const motoPlate = document.getElementById("public-moto-plate").value;
  const motoColor = document.getElementById("public-moto-color").value;
  const motoYear = document.getElementById("public-moto-year").value;
  const motoRenavam = document.getElementById("public-moto-renavam").value;
  const motoState = document.getElementById("public-moto-state").value;
  const motoImageUrl = document.getElementById("public-moto-image-url").value;
  const whatsapp = document.getElementById("public-whatsapp").value;
  const terms = document.getElementById("public-terms-checkbox").checked;

  // **NOVO: Captura a meta de ganhos do modal**
  const monthlyGoalInput = document.getElementById("public-monthly-goal");
  const monthlyGoal = monthlyGoalInput
    ? parseFloat(monthlyGoalInput.value)
    : null;

  // Novos campos da FIPE
  const brandSelect = document.getElementById("fipe-brand");
  const modelSelect = document.getElementById("fipe-model");
  if (!terms) {
    return showNotification("Você deve aceitar os termos para continuar.");
  }

  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);

  const profilePromise = userRef.set(
    {
      email: currentUser.email, // <-- ADICIONADO: Salva o e-mail do usuário
      publicProfile: {
        name,
        motoPlate,
        motoColor,
        motoYear,
        motoRenavam,
        motoState,
        motoImageUrl,
        fipeBrandCode: brandSelect.value,
        fipeModelCode: modelSelect.value,
        fipeBrandText: brandSelect.options[brandSelect.selectedIndex].text,
        fipeModelText: modelSelect.options[modelSelect.selectedIndex].text,
        whatsapp: whatsapp.replace(/\D/g, ""), // Salva apenas os números do telefone
      },
    },
    { merge: true }
  );

  const goalPromise =
    monthlyGoal !== null && !isNaN(monthlyGoal)
      ? userRef.set({ monthlyGoal: monthlyGoal }, { merge: true })
      : Promise.resolve();

  Promise.all([profilePromise, goalPromise])
    .then(() => {
      currentUser.updateProfile({ displayName: name }); // Atualiza o nome no Auth também
      closeModal();
      // Tenta colocar online apenas se o perfil estiver completo
      if (name && modelSelect.value && motoPlate && whatsapp) {
        setUserOnlineStatus(true);
        showNotification("Perfil salvo! Você agora está online.", "Sucesso");
      } else {
        showNotification(
          "Perfil salvo! Complete os campos obrigatórios para ficar online.",
          "Sucesso"
        );
      }
    })
    .catch((e) => {
      showNotification(`Erro ao salvar perfil: ${e.message}`, "Erro");
    });
}

export function deleteMotoProfile() {
  showConfirmation(
    "Isso apagará os dados da sua moto (modelo, ano, cor, placa). Você precisará cadastrá-los novamente. Deseja continuar?",
    "Apagar Dados da Moto?",
    async () => {
      const userRef = db
        .collection("artifacts")
        .doc(appId)
        .collection("users")
        .doc(currentUser.uid);

      try {
        await userRef.update({
          "publicProfile.motoModel": firebase.firestore.FieldValue.delete(),
          "publicProfile.motoYear": firebase.firestore.FieldValue.delete(),
          "publicProfile.motoColor": firebase.firestore.FieldValue.delete(),
          "publicProfile.motoPlate": firebase.firestore.FieldValue.delete(),
          "publicProfile.motoRenavam": firebase.firestore.FieldValue.delete(),
          "publicProfile.motoState": firebase.firestore.FieldValue.delete(),
          "publicProfile.motoImageUrl": firebase.firestore.FieldValue.delete(),
          "publicProfile.fipeBrandCode": firebase.firestore.FieldValue.delete(),
          "publicProfile.fipeModelCode": firebase.firestore.FieldValue.delete(),
          "publicProfile.fipeBrandText": firebase.firestore.FieldValue.delete(),
          "publicProfile.fipeModelText": firebase.firestore.FieldValue.delete(),
        });
        showNotification(
          "Dados da moto apagados! Agora cadastre novamente.",
          "Sucesso"
        );
        router("garage"); // Recarrega a garagem, que vai abrir o modal de cadastro
      } catch (error) {
        console.error("Erro ao apagar dados da moto:", error);
        showNotification(`Erro ao apagar dados: ${error.message}`, "Erro");
      }
    }
  );
}

export async function consultDebits() {
  const userDoc = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get();
  const profile = userDoc.data()?.publicProfile;

  if (!profile || !profile.motoState) {
    showNotification(
      "Você precisa cadastrar o estado da sua moto no perfil primeiro.",
      "Dados Incompletos"
    );
    openPublicProfileEditor(); // Abre o modal para o usuário preencher
    return; // Interrompe a função aqui
  }

  const state = profile.motoState.toUpperCase();

  // Mapeamento de URLs dos DETRANs.
  const detranUrls = {
    SP: "https://www.detran.sp.gov.br/wps/portal/portaldetran/cidadao/veiculos/servicos/pesquisaDebitosRestricoesVeiculos",
    RJ: "https://www.detran.rj.gov.br/_monta_aplicacoes.asp?cod=11&tipo=consulta_multa",
    MG: "https://www.detran.mg.gov.br/veiculos/situacao-do-veiculo/consultar-situacao-do-veiculo",
    PR: "https://www.detran.pr.gov.br/servicos/consultar-debitos-do-veiculo-gdey-LgZl",
    RS: "https://www.detran.rs.gov.br/consulta-veiculos",
    BA: "http://www.detran.ba.gov.br/servicos/veiculos/situacao-do-veiculo-licenciamento-e-multas",
  };

  const url = detranUrls[state];

  if (url) {
    window.open(url, "_blank");
  } else {
    showNotification(
      `Ainda não temos o atalho para o DETRAN de ${state}. Você pode buscar por "DETRAN ${state} consulta débitos" no Google.`,
      "Atalho não encontrado"
    );
  }
}

export function saveDocumentDates() {
  const cnhExpiry = document.getElementById("doc-cnh-expiry").value;
  const cnhNumber = document.getElementById("doc-cnh-number").value;
  const licensingExpiry = document.getElementById("doc-licensing-expiry").value;
  const plate = document.getElementById("doc-plate").value;
  const renavam = document.getElementById("doc-renavam").value;

  if (!cnhExpiry && !licensingExpiry && !cnhNumber && !plate && !renavam) {
    return showNotification(
      "Preencha pelo menos uma data para salvar.",
      "Atenção"
    );
  }

  const dataToSave = {
    documentData: {
      cnhNumber,
      plate,
      renavam,
    },
    documentDates: {
      cnh: cnhExpiry,
      licensing: licensingExpiry,
    },
  };

  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .set(dataToSave, { merge: true })
    .then(() => {
      showNotification("Datas de vencimento salvas com sucesso!", "Sucesso");
      closeModal(); // A função closeModal já está sendo importada corretamente de ui.js
      router("garage"); // Recarrega a garagem para atualizar os alertas
    })
    .catch((e) =>
      showNotification(`Erro ao salvar datas: ${e.message}`, "Erro")
    );
}

// --- DASHBOARD API ---
export function loadDashboardData(p, shiftFilter, updateCallback) {
  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);

  const processData = async (earningsDocs, expensesDocs) => {
    const userDoc = await userRef.get();
    const monthlyGoal = userDoc.data()?.monthlyGoal || 0;
    const goalReachedFlags = {
      ...userDoc.data(),
    };

    const earnings = earningsDocs.map((d) => ({
      id: d.id,
      ...d.data(),
      type: "earning",
    }));
    const expenses = expensesDocs.map((d) => ({
      id: d.id,
      ...d.data(),
      type: "expense",
    }));

    const allItems = [...earnings, ...expenses].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    allLoadedItems = allItems;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let filteredByDate = allItems.filter((i) => {
      const d = new Date(i.date + "T00:00:00");
      if (p === "day") return d.getTime() === now.getTime();
      if (p === "week") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayOfWeek = today.getDay(); // 0=Domingo, 1=Segunda, ...

        // Calcula a diferença para chegar na última segunda-feira.
        // Se hoje for domingo (0), voltamos 6 dias. Se for segunda (1), 0 dias. Se for terça (2), 1 dia.
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const monday = new Date(today);
        monday.setDate(today.getDate() - diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return d >= monday && d <= sunday;
      }
      if (p === "month")
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      if (p === "last-week") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Dia da semana (0=Domingo, 1=Segunda, ..., 6=Sábado)
        const dayOfWeek = today.getDay();

        // Calcula o deslocamento para a segunda-feira da semana passada.
        // Se hoje for domingo (0), voltamos 6 + 7 = 13 dias para a segunda anterior.
        // Se hoje for segunda (1), voltamos 7 dias.
        const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek - 1 + 7;

        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - daysToLastMonday);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        return d >= lastMonday && d <= lastSunday;
      }
      if (p === "last-month") {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lme = new Date(now.getFullYear(), now.getMonth(), 0);
        return d >= lm && d <= lme;
      }
      if (p === "custom") return d >= customRange.start && d <= customRange.end;
      return true; // Fallback for periods not implemented yet
    });

    // Aplica o filtro de turno APÓS o filtro de data
    const filtered = filteredByDate.filter((item) => {
      if (shiftFilter === "all") {
        return true; // Mostra todos os itens (ganhos e despesas)
      }
      // Se o item for uma despesa, sempre o inclua, pois despesas não têm turno.
      if (item.type === "expense") {
        return true;
      }
      // Para ganhos, filtre pelo turno. Ganhos antigos sem 'shift' serão mostrados em 'todos'.
      // Se quiser que eles apareçam no filtro 'dia', pode usar: return item.shift === currentShiftFilter || !item.shift;
      return item.shift === shiftFilter;
    });

    let stats = {
      earnings: {
        total: 0,
        count: 0,
        loja: { val: 0, dailySum: 0, deliveries: 0 },
        pass: { val: 0, runs: 0 },
        deliv: { val: 0, deliveries: 0 },
      },
      expenses: {
        total: 0,
        count: 0,
        categories: {
          combustivel: 0,
          manutencao: 0,
          pecas: 0,
          documentacao: 0,
          alimentacao: 0,
          outros: 0,
        },
      },
    };

    filtered.forEach((curr) => {
      const val = parseFloat(curr.totalValue) || 0;
      if (curr.type === "earning") {
        const cnt = parseInt(curr.count) || 0;
        stats.earnings.total += val;
        stats.earnings.count += cnt;
        if (curr.category === "loja_fixa") {
          stats.earnings.loja.val += val;
          stats.earnings.loja.dailySum += parseFloat(curr.details?.daily) || 0;
          stats.earnings.loja.deliveries +=
            parseInt(curr.details?.count) || cnt;
        } else if (curr.category === "app_passageiro") {
          stats.earnings.pass.val += val;
          stats.earnings.pass.runs += cnt;
        } else if (curr.category === "app_entrega") {
          stats.earnings.deliv.val += val;
          stats.earnings.deliv.deliveries += cnt;
        }
      } else if (curr.type === "expense") {
        stats.expenses.total += val;
        stats.expenses.count++;
        if (stats.expenses.categories[curr.category] !== undefined) {
          stats.expenses.categories[curr.category] += val;
        }
      }
    });

    // Preparar dados para o gráfico de linhas (Evolução do Saldo)
    const lineChartData = {
      labels: [],
      data: [],
    };

    if (filtered.length > 0) {
      const dailyTotals = new Map();
      filtered.forEach((item) => {
        const day = item.date;
        if (!dailyTotals.has(day)) {
          dailyTotals.set(day, { earnings: 0, expenses: 0 });
        }
        const entry = dailyTotals.get(day);
        if (item.type === "earning") {
          entry.earnings += item.totalValue;
        } else {
          entry.expenses += item.totalValue;
        }
      });

      const sortedDays = Array.from(dailyTotals.keys()).sort();
      let cumulativeBalance = 0;

      sortedDays.forEach((day) => {
        const totals = dailyTotals.get(day);
        cumulativeBalance += totals.earnings - totals.expenses;
        lineChartData.labels.push(
          new Date(day + "T00:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })
        );
        lineChartData.data.push(cumulativeBalance);
      });
    }

    currentStats = stats;
    updateCallback(stats, filtered, lineChartData, monthlyGoal);

    // Lógica para notificar meta atingida
    if (
      p === "month" &&
      monthlyGoal > 0 &&
      stats.earnings.total >= monthlyGoal
    ) {
      const now = new Date();
      const currentMonthFlag = `goalReachedNotified_${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}`;

      if (!goalReachedFlags[currentMonthFlag]) {
        // A meta foi atingida este mês e ainda não notificamos
        showNotification(
          `Você alcançou sua meta de R$ ${monthlyGoal.toFixed(
            2
          )} para este mês! Continue assim!`,
          "🏆 Meta Atingida! Parabéns!"
        );

        // Marcar que já notificamos para este mês para não repetir
        userRef
          .update({
            [currentMonthFlag]: true,
          })
          .catch((e) => console.error("Erro ao salvar flag da meta:", e));
      }
    }
  };

  const earningsUnsub = userRef
    .collection("earnings")
    .onSnapshot(async (earningsSnap) => {
      const expensesSnap = await userRef.collection("expenses").get();
      processData(earningsSnap.docs, expensesSnap.docs);
    });

  const expensesUnsub = userRef
    .collection("expenses")
    .onSnapshot(async (expensesSnap) => {
      const earningsSnap = await userRef.collection("earnings").get();
      processData(earningsSnap.docs, expensesSnap.docs);
    });

  // Retornamos uma função que cancela ambas as inscrições
  return () => {
    earningsUnsub();
    expensesUnsub();
  };
}

// --- CRUD API ---
export function deleteItem(id, type) {
  const collectionName = type === "expense" ? "expenses" : "earnings";
  showConfirmation(
    "Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.",
    "Excluir Lançamento",
    () => {
      db.collection("artifacts")
        .doc(appId)
        .collection("users")
        .doc(currentUser.uid)
        .collection(collectionName)
        .doc(id)
        .delete()
        .then(() => {
          showNotification("Lançamento excluído com sucesso.", "Sucesso");
        })
        .catch((e) => {
          showNotification(`Erro ao excluir: ${e.message}`, "Erro");
        });
    }
  );
}

export function deleteUserAccount() {
  showConfirmation(
    "Esta ação é IRREVERSÍVEL. Todos os seus dados (lançamentos, metas, etc.) e sua conta serão apagados permanentemente. Não será possível recuperar sua conta.",
    "Apagar Conta Permanentemente?",
    async () => {
      showNotification("Apagando sua conta e dados...", "Aguarde");

      const user = currentUser;
      if (!user) {
        return showNotification("Nenhum usuário logado.", "Erro");
      }

      const userRef = db
        .collection("artifacts")
        .doc(appId)
        .collection("users")
        .doc(user.uid);

      try {
        // 1. Apagar subcoleções (earnings e expenses)
        const earningsPromise = userRef.collection("earnings").get();
        const expensesPromise = userRef.collection("expenses").get();

        const [earningsSnap, expensesSnap] = await Promise.all([
          earningsPromise,
          expensesPromise,
        ]);

        const batch = db.batch();

        earningsSnap.docs.forEach((doc) => batch.delete(doc.ref));
        expensesSnap.docs.forEach((doc) => batch.delete(doc.ref));

        // 2. Apagar o documento principal do usuário
        batch.delete(userRef);

        // 3. Executar o batch para apagar todos os dados do Firestore
        await batch.commit();

        // 4. Apagar o usuário do Firebase Auth
        await user.delete();

        showNotification(
          "Sua conta e todos os seus dados foram apagados com sucesso.",
          "Conta Apagada"
        );
        // O onAuthStateChanged cuidará do redirecionamento para a tela de login
      } catch (error) {
        console.error("Erro ao apagar conta:", error);
        showNotification(
          `Ocorreu um erro ao apagar sua conta: ${error.message}. Se o erro persistir, tente fazer login novamente antes de apagar.`,
          "Erro Crítico"
        );
      }
    },
    "APAGAR" // Palavra de confirmação
  );
}

export function saveEdit(e) {
  e.preventDefault();
  const id = document.getElementById("edit-id").value;
  const type = document.getElementById("edit-type").value;
  const category = document.getElementById("edit-category").value;
  const dateValue = document.getElementById("edit-date").value;

  // Corrige o problema de fuso horário, tratando a data como local ao meio-dia.
  const date = new Date(dateValue + "T12:00:00");

  let dataToUpdate = {
    // Armazenamos a data como string "YYYY-MM-DD" para consistência com o resto do app.
    date: date.toISOString().split("T")[0],
  };

  const safeFloat = (id) => {
    const val = document.getElementById(id)?.value;
    return val ? parseFloat(val.replace(",", ".")) : 0;
  };
  const safeInt = (id) => {
    const val = document.getElementById(id)?.value;
    return val ? parseInt(val) : 0;
  };

  let collectionName = "";
  let successMessage = "";

  if (type === "earning") {
    collectionName = "earnings";
    successMessage = "Ganho atualizado com sucesso!";

    // Adiciona o turno aos dados a serem salvos
    dataToUpdate.shift = document.getElementById("edit-shift").value;
    dataToUpdate.observation =
      document.getElementById("edit-observation").value;

    if (category === "loja_fixa") {
      const d = safeFloat("edit-daily");
      const f = safeFloat("edit-fee");
      const ex = safeFloat("edit-extra");
      const cnt = safeInt("edit-loja-count");
      const tot = d + cnt * f + ex;
      dataToUpdate.totalValue = tot;
      dataToUpdate.count = cnt;
      dataToUpdate.details = { daily: d, fee: f, extra: ex, count: cnt };
    } else {
      dataToUpdate.totalValue = safeFloat("edit-total");
      dataToUpdate.count = safeInt("edit-count");
    }
  } else {
    collectionName = "expenses";
    successMessage = "Despesa atualizada com sucesso!";
    dataToUpdate.category = document.getElementById("edit-exp-category").value;
    dataToUpdate.totalValue = safeFloat("edit-exp-total");
    dataToUpdate.observation = document.getElementById("edit-exp-desc").value;
  }

  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .collection(collectionName)
    .doc(id)
    .update(dataToUpdate)
    .then(() => {
      closeModal();
      showNotification(successMessage, "Sucesso");
    });
}

export function submitFinance(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-save-fin");
  btn.innerText = "Salvando...";
  btn.disabled = true;

  // Validation logic here...

  const cat = document.getElementById("fin-category").value;
  const shift = document.getElementById("fin-shift").value;
  const observation = document.getElementById("fin-observation").value;
  const dateValue = document.getElementById("fin-date-earning").value;
  // Corrige o problema de fuso horário, tratando a data como local ao meio-dia.
  const correctedDate = new Date(dateValue + "T12:00:00");
  const date = correctedDate.toISOString().split("T")[0];
  let tot = 0,
    cnt = 0,
    det = {};

  const safeFloat = (id) => {
    const val = document.getElementById(id)?.value;
    return val ? parseFloat(val.replace(",", ".")) : 0;
  };
  const safeInt = (id) => {
    const val = document.getElementById(id)?.value;
    return val ? parseInt(val) : 0;
  };

  if (cat === "loja_fixa") {
    const d = safeFloat("fin-daily");
    const f = safeFloat("fin-fee");
    const ex = safeFloat("fin-extra");
    cnt = safeInt("fin-loja-count");
    tot = d + cnt * f + ex;
    det = { daily: d, fee: f, extra: ex, count: cnt };
  } else {
    tot = safeFloat("fin-total");
    cnt = safeInt("fin-count");
  }

  // More validation logic here...

  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .collection("earnings")
    .add({
      category: cat,
      date,
      shift,
      observation,
      totalValue: tot,
      count: cnt,
      details: det,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
      router("dashboard");
      // **NOVO: Checa por conquistas após salvar um ganho**
      checkAchievements({
        type: "earning",
        category: cat,
        date: correctedDate,
        totalValue: tot,
      });
    })
    .catch((e) => {
      showNotification(`Erro ao salvar: ${e.message}`, "Erro");
      btn.innerText = "Salvar Lançamento";
      btn.disabled = false;
    });
}

export function submitExpense(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-save-exp");
  btn.innerText = "Salvando...";
  btn.disabled = true;

  const date = document.getElementById("fin-date-expense").value;
  const category = document.getElementById("exp-category").value;
  const totalValue = parseFloat(document.getElementById("exp-total").value);
  const observation = document.getElementById("exp-desc").value;

  if (isNaN(totalValue) || totalValue <= 0) {
    showNotification(
      "Por favor, insira um valor de despesa válido e maior que zero.",
      "Valor Inválido"
    );
    btn.innerText = "Salvar Despesa";
    btn.disabled = false;
    return;
  }

  // **NOVO: Lógica para resetar contador de manutenção**
  if (category === "manutencao") {
    promptToResetMaintenance(totalValue, observation);
    // O fluxo normal continua, salvando a despesa independentemente do reset.
  }

  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .collection("expenses")
    .add({
      date,
      category,
      totalValue,
      observation,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
      router("dashboard");
    })
    .catch((e) => {
      showNotification(`Erro ao salvar despesa: ${e.message}`, "Erro");
      btn.innerText = "Salvar Despesa";
      btn.disabled = false;
    });
}

// --- MARKETPLACE API ---
export function listenForMarketplaceItems(callback) {
  const unsub = db
    .collection("artifacts")
    .doc(appId)
    .collection("public")
    .doc("data")
    .collection("marketplace")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(items);
    });
  return unsub;
}

export function deleteMarketItem(id) {
  showConfirmation(
    "Tem certeza que deseja apagar este anúncio?",
    "Apagar Anúncio",
    () => {
      db.collection("artifacts")
        .doc(appId)
        .collection("public")
        .doc("data")
        .collection("marketplace")
        .doc(id)
        .delete();
    }
  );
}

export function submitAd(e) {
  e.preventDefault();
  const btn = document.getElementById("ad-submit-btn");
  btn.disabled = true;

  let p = document.getElementById("ad-zap").value.replace(/\D/g, "");

  if (p.startsWith("55") && p.length > 13) {
    p = p.substring(2);
  }

  if (p.length < 10) {
    showNotification(
      "WhatsApp inválido. Use DDD + Número.",
      "Erro de Validação"
    );
    btn.disabled = false;
    return;
  }

  const adData = {
    title: document.getElementById("ad-title").value,
    price: parseFloat(document.getElementById("ad-price").value),
    category: document.getElementById("ad-cat").value,
    description: document.getElementById("ad-desc").value,
    image: document.getElementById("ad-img").value,
    whatsapp: p,
    userId: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const adId = document.getElementById("ad-id").value;
  const marketplaceRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("public")
    .doc("data")
    .collection("marketplace");

  let promise;
  if (adId) {
    // Modo de Edição: atualiza o documento existente
    promise = marketplaceRef.doc(adId).update(adData);
  } else {
    // Modo de Criação: adiciona um novo documento
    promise = marketplaceRef.add(adData);
  }

  promise
    .then(() => router("market"))
    .catch((err) => {
      showNotification(err.message, "Erro ao Publicar");
      btn.disabled = false;
    });
}

export function submitJob(e) {
  e.preventDefault();
  db.collection("artifacts")
    .doc(appId)
    .collection("public")
    .doc("data")
    .collection("jobs")
    .add({
      title: document.getElementById("job-title").value,
      payment: document.getElementById("job-payment").value,
      description: document.getElementById("job-desc").value,
      contact: document.getElementById("job-contact").value,
      userId: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => router("hub"))
    .catch((err) => showNotification(err.message, "Erro ao Publicar"));
}

// --- FreelancerMoto API ---
export function getOnlineMotoboys(callback) {
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
        callback(onlineUsers);
      },
      (error) => {
        console.error("Erro ao buscar motoboys online:", error);
        showNotification(
          "Não foi possível carregar os dados do FreelancerMoto.",
          "Erro"
        );
      }
    );
}

export async function backupData() {
  showNotification("Preparando seu backup...", "Aguarde");

  try {
    const earningsPromise = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(currentUser.uid)
      .collection("earnings")
      .get();
    const expensesPromise = db
      .collection("artifacts")
      .doc(appId)
      .collection("users")
      .doc(currentUser.uid)
      .collection("expenses")
      .get();

    const [earningsSnap, expensesSnap] = await Promise.all([
      earningsPromise,
      expensesPromise,
    ]);

    const earnings = earningsSnap.docs.map((doc) => doc.data());
    const expenses = expensesSnap.docs.map((doc) => doc.data());

    const backupData = {
      backupDate: new Date().toISOString(),
      earnings,
      expenses,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `motomanager_backup_${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification("Backup gerado e download iniciado!", "Sucesso");
  } catch (error) {
    showNotification(`Erro ao gerar backup: ${error.message}`, "Erro");
  }
}

export async function restoreData(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const backupData = JSON.parse(e.target.result);

      // Validação básica do arquivo de backup
      if (
        !backupData.backupDate ||
        !Array.isArray(backupData.earnings) ||
        !Array.isArray(backupData.expenses)
      ) {
        return showNotification(
          "O arquivo selecionado não parece ser um backup válido do MotoManager.",
          "Arquivo Inválido"
        );
      }

      showConfirmation(
        "Isso substituirá TODOS os seus dados atuais pelos dados do backup. Esta ação não pode ser desfeita. Deseja continuar?",
        "Atenção Máxima!",
        async () => {
          showNotification(
            "Restaurando dados... Isso pode levar um momento.",
            "Aguarde"
          );

          const userRef = db
            .collection("artifacts")
            .doc(appId)
            .collection("users")
            .doc(currentUser.uid);

          try {
            // 1. Buscar todos os documentos existentes para apagar
            const existingEarnings = await userRef.collection("earnings").get();
            const existingExpenses = await userRef.collection("expenses").get();

            // Usaremos lotes para garantir a performance e a integridade
            const batch = db.batch();

            // 2. Adicionar operações de exclusão ao lote
            existingEarnings.docs.forEach((doc) => batch.delete(doc.ref));
            existingExpenses.docs.forEach((doc) => batch.delete(doc.ref));

            // 3. Adicionar operações de criação a partir do backup ao lote
            backupData.earnings.forEach((earning) => {
              const newEarningRef = userRef.collection("earnings").doc();
              batch.set(newEarningRef, earning);
            });
            backupData.expenses.forEach((expense) => {
              const newExpenseRef = userRef.collection("expenses").doc();
              batch.set(newExpenseRef, expense);
            });

            // 4. Executar todas as operações do lote
            await batch.commit();

            showNotification(
              "Seus dados foram restaurados com sucesso!",
              "Restauração Concluída"
            );
            // Forçar um recarregamento da view para mostrar os novos dados
            router("dashboard");
          } catch (error) {
            showNotification(
              `Ocorreu um erro na restauração: ${error.message}`,
              "Erro Crítico"
            );
          }
        }
      );
    } catch (error) {
      showNotification(
        "Erro ao ler o arquivo de backup. Verifique se o arquivo está corrompido.",
        "Erro de Leitura"
      );
    }
  };
  reader.readAsText(file);
}

// --- MAINTENANCE API ---
export function getMaintenanceData(callback) {
  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);

  return userRef.onSnapshot((doc) => {
    const data = doc.data() || {};
    callback({
      items: data.maintenanceItems || [],
      odometer: data.odometer || 0,
    });
  });
}

export async function saveOdometer() {
  const odometer = document.getElementById("current-odometer").value;
  await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .set({ odometer: parseInt(odometer) }, { merge: true });
  showNotification("Quilometragem salva!", "Sucesso");
}

export async function saveMaintenanceItem(e) {
  e.preventDefault();
  const id = document.getElementById("maintenance-item-id").value;
  const name = document.getElementById("maintenance-item-name").value;
  const interval = parseInt(
    document.getElementById("maintenance-item-interval").value
  );
  const category = document.getElementById("maintenance-item-category").value;

  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);
  const doc = await userRef.get();
  const items = doc.data()?.maintenanceItems || [];

  if (id) {
    // Edit
    const index = items.findIndex((i) => i.id === id);
    if (index > -1) {
      items[index].name = name;
      items[index].interval = interval;
      items[index].category = category;
    }
  } else {
    // Add
    items.push({
      id: `item_${Date.now()}`,
      name,
      interval,
      category,
      lastServiceKm: doc.data()?.odometer || 0, // Define a Km atual como a da última troca
    });
  }

  await userRef.set({ maintenanceItems: items }, { merge: true });
  closeModal();
  showNotification("Item de manutenção salvo!", "Sucesso");
}

export async function deleteMaintenanceItem(itemId) {
  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);
  const doc = await userRef.get();
  const items = doc.data()?.maintenanceItems || [];
  const updatedItems = items.filter((item) => item.id !== itemId);
  await userRef.update({ maintenanceItems: updatedItems });
  showNotification("Item de manutenção apagado com sucesso!", "Sucesso");
  router("garage"); // <-- ADICIONADO: Força a atualização da UI
}

export async function saveServiceRecord(e) {
  e.preventDefault();

  const itemId = document.getElementById("service-item-id").value;
  const date = document.getElementById("service-date").value;
  const km = parseInt(document.getElementById("service-km").value);
  const cost = parseFloat(document.getElementById("service-cost").value);
  const location = document.getElementById("service-location").value;
  const notes = document.getElementById("service-notes").value;

  if (isNaN(km) || isNaN(cost)) {
    return showNotification("Quilometragem e Custo devem ser números.", "Erro");
  }

  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);
  const doc = await userRef.get();
  const items = doc.data()?.maintenanceItems || [];

  const itemIndex = items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) {
    return showNotification("Item de manutenção não encontrado.", "Erro");
  }

  // Cria o novo registro de histórico
  const serviceRecord = {
    id: `service_${Date.now()}`,
    date,
    km,
    cost,
    location,
    notes,
  };

  // Adiciona o registro ao histórico do item
  if (!items[itemIndex].history) {
    items[itemIndex].history = [];
  }
  items[itemIndex].history.push(serviceRecord);

  // **IMPORTANTE: Atualiza a quilometragem da última troca para a Km do serviço**
  items[itemIndex].lastServiceKm = km;

  // Salva o array de itens atualizado no Firestore
  await userRef.set({ maintenanceItems: items }, { merge: true });
  showNotification("Serviço registrado com sucesso!", "Sucesso");

  // **INTEGRAÇÃO COM FINANCEIRO**
  showConfirmation(
    `Deseja registrar uma despesa de R$ ${cost.toFixed(
      2
    )} na categoria 'Manutenção'?`,
    "Registrar Despesa?",
    () => {
      // Passa os dados para a tela de finanças via localStorage
      localStorage.setItem(
        "prefillExpense",
        JSON.stringify({
          category: "manutencao",
          totalValue: cost,
          observation: `Serviço: ${items[itemIndex].name}`,
        })
      );
      closeModal();
      router("finance");
    },
    () => {
      // onCancel
      closeModal();
      router("garage");
    }
  );
}

/**
 * Apaga um registro de serviço específico do histórico de um item de manutenção.
 * @param {string} itemId O ID do item de manutenção pai.
 * @param {string} recordId O ID do registro de serviço a ser apagado.
 */
export async function deleteServiceRecord(itemId, recordId) {
  showConfirmation(
    "Tem certeza que deseja apagar este registro de serviço? Esta ação não pode ser desfeita.",
    "Apagar Registro?",
    async () => {
      if (!currentUser) return;

      const userRef = db
        .collection("artifacts")
        .doc(appId)
        .collection("users")
        .doc(currentUser.uid);

      try {
        const doc = await userRef.get();
        const items = doc.data()?.maintenanceItems || [];
        const itemIndex = items.findIndex((i) => i.id === itemId);

        if (itemIndex > -1 && items[itemIndex].history) {
          // Filtra o histórico, removendo o registro com o ID correspondente.
          items[itemIndex].history = items[itemIndex].history.filter(
            (record) => record.id !== recordId
          );

          await userRef.update({ maintenanceItems: items });
          showNotification("Registro de serviço apagado.", "Sucesso");
          closeModal(); // Fecha o modal de histórico para refletir a mudança
        }
      } catch (error) {
        showNotification(`Erro ao apagar registro: ${error.message}`, "Erro");
      }
    }
  );
}

export async function requestNotificationPermission() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return showNotification(
      "Seu navegador não suporta notificações.",
      "Incompatível"
    );
  }

  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    showNotification(
      "Lembretes ativados! Você será notificado sobre manutenções e documentos.",
      "Sucesso!"
    );
    // Envia uma mensagem para o Service Worker para ele começar a verificar
    navigator.serviceWorker.ready.then((registration) => {
      registration.active.postMessage({
        type: "START_MONITORING",
        userId: currentUser.uid,
      });
    });
  } else if (permission === "denied") {
    showNotification(
      "Você bloqueou as notificações. Para ativá-las, mude as permissões do site nas configurações do seu navegador.",
      "Aviso"
    );
  } else {
    showNotification(
      "Você não concedeu permissão. Os lembretes não serão enviados.",
      "Aviso"
    );
  }
}

export async function calculateAndRenderCostPerKm(userId) {
  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);
  const doc = await userRef.get();
  const items = doc.data()?.maintenanceItems || [];
  const costValueEl = document.getElementById("cost-per-km-value");
  const costExplanationEl = document.getElementById("cost-per-km-explanation");

  if (!costValueEl || !costExplanationEl) return;

  try {
    // 1. Buscar todas as despesas relevantes
    const expensesSnap = await userRef.collection("expenses").get();
    let totalCost = 0;
    expensesSnap.docs.forEach((doc) => {
      const expense = doc.data();
      // Consideramos apenas despesas operacionais da moto
      if (
        ["combustivel", "manutencao", "pecas", "documentacao"].includes(
          expense.category
        )
      ) {
        totalCost += expense.totalValue;
      }
    });

    const initialOdometer = doc.data()?.initialOdometer || 0;
    const currentOdometer = doc.data()?.odometer || 0;

    if (currentOdometer > 0 && initialOdometer === 0) {
      await userRef.set({ initialOdometer: currentOdometer }, { merge: true });
    }

    const totalKm = currentOdometer - initialOdometer;

    if (totalKm <= 0) {
      costValueEl.textContent = "N/A";
      costExplanationEl.textContent =
        "Rode mais com o app para calcularmos seu custo.";
      costValueEl.classList.remove("animate-pulse");
      return;
    }

    const costPerKm = totalCost / totalKm;

    if (isNaN(costPerKm) || !isFinite(costPerKm)) {
      costValueEl.textContent = "R$ 0,00";
      costExplanationEl.textContent =
        "Adicione despesas de combustível ou manutenção para começar.";
    } else {
      costValueEl.textContent = `R$ ${costPerKm.toFixed(2)}`;
      costExplanationEl.textContent = `Custo médio para cada quilômetro rodado.`;
    }
  } catch (error) {
    console.error("Erro ao calcular custo por Km:", error);
    costValueEl.textContent = "Erro";
    costExplanationEl.textContent = "Não foi possível calcular o custo.";
  } finally {
    costValueEl.classList.remove("animate-pulse");
  }
}

async function promptToResetMaintenance(expenseValue, expenseDesc) {
  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);
  const doc = await userRef.get();
  const items = doc.data()?.maintenanceItems || [];
  const odometer = doc.data()?.odometer || 0;

  if (items.length === 0) return;

  let optionsHTML = items
    .map((item) => `<option value="${item.id}">${item.name}</option>`)
    .join("");

  showConfirmation(
    `Você registrou uma despesa de manutenção. Deseja zerar o contador de algum item, definindo a quilometragem da última troca para ${odometer} Km?`,
    "Resetar Manutenção?",
    async () => {
      const selectedItemId = document.getElementById(
        "maintenance-reset-select"
      ).value;
      const index = items.findIndex((i) => i.id === selectedItemId);
      if (index > -1) {
        items[index].lastServiceKm = odometer;
        await userRef.set({ maintenanceItems: items }, { merge: true });
        showNotification(
          `Contador para "${items[index].name}" foi zerado.`,
          "Sucesso"
        );
      }
    },
    null, // onCancel,
    null, // requireTextInput (não queremos que peça para digitar nada)
    `<div class="mt-4"><label class="text-sm">Qual item você trocou?</label><select id="maintenance-reset-select" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mt-1">${optionsHTML}</select></div>`
  );
}

// --- GAMIFICATION API ---
const ALL_ACHIEVEMENTS = [
  {
    id: "beginner",
    title: "Iniciante",
    description: "Primeiro ganho registrado",
    icon: "rocket",
  },
  {
    id: "ifood_10",
    title: "Rei do iFood",
    description: "10 ganhos no iFood",
    icon: "package",
  },
  {
    id: "uber_10",
    title: "Piloto de App",
    description: "10 ganhos na Uber/99",
    icon: "bike",
  },
  {
    id: "loja_10",
    title: "Fixo na Pista",
    description: "10 ganhos em Loja Fixa",
    icon: "store",
  },
  {
    id: "madrugador",
    title: "Madrugador",
    description: "Um ganho antes das 7h",
    icon: "sunrise",
  },
  {
    id: "corujao",
    title: "Corujão",
    description: "Um ganho depois da meia-noite",
    icon: "moon",
  },
  {
    id: "saver",
    title: "Poupador",
    description: "Primeira meta mensal definida",
    icon: "piggy-bank",
  },
  {
    id: "goal_met",
    title: "Meta Batida",
    description: "Atingiu a meta mensal",
    icon: "target",
  },
];

export function getAchievements(callback) {
  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);

  return userRef.onSnapshot((doc) => {
    const data = doc.data() || {};
    callback({
      unlocked: data.achievements || [],
      allAchievements: ALL_ACHIEVEMENTS,
    });
  });
}

export async function checkAchievements(eventData) {
  const userRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid);
  const doc = await userRef.get();
  const userData = doc.data() || {};
  const unlocked = userData.achievements || [];
  let newAchievements = [];

  const earningsSnap = await userRef.collection("earnings").get();
  const earningsCount = earningsSnap.size;

  // 1. "Iniciante"
  if (!unlocked.includes("beginner") && earningsCount >= 1)
    newAchievements.push("beginner");

  // Contadores por categoria
  const ifoodCount = earningsSnap.docs.filter(
    (d) => d.data().category === "app_entrega"
  ).length;
  const uberCount = earningsSnap.docs.filter(
    (d) => d.data().category === "app_passageiro"
  ).length;
  const lojaCount = earningsSnap.docs.filter(
    (d) => d.data().category === "loja_fixa"
  ).length;

  // 2. "Rei do iFood"
  if (!unlocked.includes("ifood_10") && ifoodCount >= 10)
    newAchievements.push("ifood_10");
  // 3. "Piloto de App"
  if (!unlocked.includes("uber_10") && uberCount >= 10)
    newAchievements.push("uber_10");
  // 4. "Fixo na Pista"
  if (!unlocked.includes("loja_10") && lojaCount >= 10)
    newAchievements.push("loja_10");

  // Checagens baseadas no evento atual
  if (eventData.type === "earning") {
    const hour = eventData.date.getHours();
    // 5. "Madrugador"
    if (!unlocked.includes("madrugador") && hour < 7)
      newAchievements.push("madrugador");
    // 6. "Corujão"
    if (!unlocked.includes("corujao") && hour < 5)
      newAchievements.push("corujao"); // 0-4h
  }

  // 7. "Poupador" (verificado ao salvar a meta)
  if (!unlocked.includes("saver") && userData.monthlyGoal > 0)
    newAchievements.push("saver");

  // 8. "Meta Batida" (verificado no loadDashboardData)
  if (
    !unlocked.includes("goal_met") &&
    userData.monthlyGoal > 0 &&
    userData.earnings?.total >= userData.monthlyGoal
  ) {
    // A lógica de notificação já existe em loadDashboardData, aqui apenas garantimos a medalha.
    newAchievements.push("goal_met");
  }

  if (newAchievements.length > 0) {
    const finalAchievements = [...new Set([...unlocked, ...newAchievements])];
    await userRef.set({ achievements: finalAchievements }, { merge: true });

    // Notifica sobre a primeira nova conquista encontrada
    const firstNew = ALL_ACHIEVEMENTS.find((a) => a.id === newAchievements[0]);
    if (firstNew) {
      showNotification(
        `Você desbloqueou a conquista: "${firstNew.title}"!`,
        "🏆 Conquista Nova!"
      );
    }
  }
}

// --- JOBS API (Motoboy side) ---

export async function acceptJob(jobId) {
  if (!currentUser) {
    return showNotification(
      "Você precisa estar logado para aceitar uma vaga.",
      "Erro"
    );
  }

  const userDoc = await db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .get();
  const motoboyProfile = userDoc.data()?.publicProfile;

  if (!motoboyProfile || !motoboyProfile.name || !motoboyProfile.whatsapp) {
    showNotification(
      "Por favor, complete seu perfil público antes de aceitar uma vaga.",
      "Perfil Incompleto"
    );
    return openPublicProfileEditor();
  }

  const jobRef = db.collection("jobs").doc(jobId);

  try {
    await jobRef.update({
      status: "negociando",
      motoboyId: currentUser.uid,
      motoboyName: motoboyProfile.name,
      motoboyContact: motoboyProfile.whatsapp,
    });
    showNotification(
      "Vaga aceita! Você pode iniciar a negociação em 'Vagas Aceitas'.",
      "Sucesso!"
    );
    router("accepted-jobs");
  } catch (error) {
    console.error("Erro ao aceitar vaga:", error);
    showNotification(
      "Não foi possível aceitar a vaga. Ela pode já ter sido pega por outro entregador.",
      "Erro"
    );
  }
}

/**
 * Inicia o fluxo de checkout de assinatura com o Abacate Pay
 * chamando uma Firebase Cloud Function.
 */
export async function createAbacatePayCheckout() {
  if (!currentUser) return;

  const checkoutButton = document.getElementById("subscribe-btn");
  checkoutButton.disabled = true;
  checkoutButton.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> Redirecionando...`;

  try {
    // Inicializa as funções do Firebase (se ainda não tiver feito)
    const functions = firebase.functions();

    // Chama a Cloud Function que você irá criar
    const createCheckout = functions.httpsCallable("createAbacatePayCheckout");

    const result = await createCheckout({
      // Você pode passar dados para a função se precisar
      userId: currentUser.uid,
      email: currentUser.email,
    });

    const { checkout_url } = result.data;

    if (checkout_url) {
      // Redireciona o usuário para a página de pagamento segura
      window.location.assign(checkout_url);
    } else {
      throw new Error("URL de checkout não recebida.");
    }
  } catch (error) {
    console.error("Erro ao criar checkout:", error);
    showNotification(`Erro ao iniciar pagamento: ${error.message}`, "Erro");
    checkoutButton.disabled = false;
    checkoutButton.innerHTML = `<i data-lucide="gem"></i> Quero ser Apoiador`;
    lucide.createIcons();
  }
}

/**
 * Escuta por vagas com status "disponível" em tempo real.
 * @param {function} callback - Função a ser chamada com a lista de vagas.
 * @returns {function} - Função para cancelar o listener.
 */
export function listenForAvailableJobs(callback) {
  const jobsQuery = db
    .collection("jobs")
    .where("status", "==", "disponivel")
    .orderBy("createdAt", "desc");

  const unsubscribe = jobsQuery.onSnapshot((snapshot) => {
    const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    callback(jobs);
  });

  return unsubscribe;
}

let unsubscribeJobChat = null;
export async function renderJobChat(jobId) {
  // Carrega o template da view de chat (se já não estiver carregado)
  await router("job-chat");

  const user = currentUser;
  if (!user) return;

  const chatHeaderEl = document.getElementById("chat-header-details-motoboy");
  const messagesContainer = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const notificationAudio = new Audio("./assets/notification.mp3");

  // 1. MARCAR MENSAGENS COMO LIDAS
  const jobRef = db.collection("jobs").doc(jobId);
  await jobRef.set({ readBy: { [user.uid]: true } }, { merge: true });

  // 2. Busca detalhes da vaga e da empresa
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) return;
  const jobData = jobSnap.data();

  chatHeaderEl.innerHTML = `
    <h3 class="font-bold">${jobData.title}</h3>
    <p class="text-sm text-gray-500">Empresa: <span class="font-semibold">${jobData.empresaName}</span></p>
  `;

  // Lógica dos botões de segurança
  document.getElementById("view-company-profile-btn").onclick = () =>
    showNotification(
      `Função "Ver Perfil de ${jobData.empresaName}" a ser implementada.`
    );
  document.getElementById("report-company-btn").onclick = () =>
    showNotification(
      `Função "Denunciar ${jobData.empresaName}" a ser implementada.`
    );
  document.getElementById("block-company-btn").onclick = () =>
    showNotification(
      `Função "Bloquear ${jobData.empresaName}" a ser implementada.`
    );

  // 3. Ouve por novas mensagens
  const messagesQuery = db
    .collection("jobs")
    .doc(jobId)
    .collection("messages")
    .orderBy("createdAt", "asc");

  if (unsubscribeJobChat) unsubscribeJobChat();
  unsubscribeJobChat = messagesQuery.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added" && change.doc.data().senderId !== user.uid) {
        notificationAudio.play();
      }
    });

    if (snapshot.empty) {
      messagesContainer.innerHTML = `<p class="text-center text-gray-400 p-4">Inicie a conversa!</p>`;
      return;
    }

    messagesContainer.innerHTML = snapshot.docs
      .map((msgDoc) => {
        const msg = msgDoc.data();
        const isMe = msg.senderId === user.uid;

        const timestamp = msg.createdAt
          ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";

        const isRead = jobData.readBy && jobData.readBy[jobData.empresaId];
        const readIcon = isRead ? "check-check" : "check";

        return `
        <div class="flex ${isMe ? "justify-end" : "justify-start"}">
          <div class="max-w-[75%] p-2 px-3 rounded-xl ${
            isMe ? "bg-yellow-500 text-black" : "bg-white dark:bg-gray-700"
          }">
            <p class="text-sm">${msg.text}</p>
            <div class="text-xs ${
              isMe ? "text-gray-800/70" : "text-gray-400"
            } text-right mt-1 flex items-center justify-end gap-1">
              <span>${timestamp}</span>
              ${
                isMe
                  ? `<i data-lucide="${readIcon}" class="w-4 h-4 ${
                      isRead ? "text-blue-600" : ""
                    }"></i>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    lucide.createIcons();
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  chatForm.onsubmit = async (e) => {
    await sendChatMessage(e, jobId, motoboyProfile.name);
    // 4. RESETAR STATUS DE LEITURA DA EMPRESA
    if (jobData.empresaId) {
      await jobRef.set(
        { readBy: { [jobData.empresaId]: false } },
        { merge: true }
      );
    }
  };
}

export function sendChatMessage(event, jobId, senderName) {
  event.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  db.collection("jobs")
    .doc(jobId)
    .collection("messages")
    .add({
      text: text,
      senderId: currentUser.uid,
      senderName: senderName || currentUser.displayName, // Usa o nome do perfil público
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

  input.value = "";
}

export function closeJobDeal(jobId) {
  db.collection("jobs").doc(jobId).update({ status: "concluida" });
  router("dashboard"); // Volta para o painel principal
}

export function cancelJobDeal(jobId) {
  db.collection("jobs").doc(jobId).update({
    status: "disponivel",
    motoboyId: firebase.firestore.FieldValue.delete(),
    motoboyName: firebase.firestore.FieldValue.delete(),
    motoboyContact: firebase.firestore.FieldValue.delete(),
  });
  router("hub"); // Volta para a lista de vagas
}

/**
 * Registra a avaliação de um motoboy para uma empresa.
 * @param {string} jobId - O ID da vaga.
 * @param {string} empresaId - O ID da empresa a ser avaliada.
 * @param {number} rating - A nota (1 a 5).
 */
export async function rateCompany(jobId, empresaId, rating) {
  if (!rating || rating < 1 || rating > 5) {
    return showNotification(
      "Avaliação inválida. Use de 1 a 5 estrelas.",
      "Erro"
    );
  }

  const jobRef = db.collection("jobs").doc(jobId);
  const companyRef = db.collection("companies").doc(empresaId);

  try {
    await db.runTransaction(async (transaction) => {
      const jobDoc = await transaction.get(jobRef);
      if (!jobDoc.exists) throw "Vaga não encontrada.";
      if (jobDoc.data().companyRatingGiven) {
        throw "Você já avaliou esta empresa para esta vaga.";
      }

      const companyDoc = await transaction.get(companyRef);
      if (!companyDoc.exists) throw "Empresa não encontrada.";

      const companyData = companyDoc.data();
      const currentRating = companyData.rating || 0;
      const ratingCount = companyData.ratingCount || 0;

      const newRatingCount = ratingCount + 1;
      const newTotalRating = currentRating * ratingCount + rating;
      const newAverageRating = newTotalRating / newRatingCount;

      transaction.update(companyRef, {
        rating: newAverageRating,
        ratingCount: newRatingCount,
      });
      transaction.update(jobRef, { companyRatingGiven: true });
    });

    showNotification("Obrigado pela sua avaliação!", "Sucesso!");
    closeModal();
    router("dashboard"); // Volta para o painel principal
  } catch (error) {
    showNotification(`Erro ao avaliar: ${error}`, "Erro");
    closeModal();
  }
}
