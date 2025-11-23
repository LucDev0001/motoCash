import { db, appId, auth } from "./config.js";
import { currentUser } from "./auth.js";
import {
  router,
  customRange,
  currentShiftFilter,
  showNotification,
  showConfirmation,
  closeEditModal,
} from "./ui.js";

export let allLoadedItems = [];
export let currentStats = {};

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
      showNotification("Meta mensal salva com sucesso!", "Sucesso");
    })
    .catch((e) =>
      showNotification(`Erro ao salvar meta: ${e.message}`, "Erro")
    );
}

// --- DASHBOARD API ---
export function loadDashboardData(p, updateCallback) {
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
      if (p === "week")
        return (now - d) / (1000 * 60 * 60 * 24) < 7 && now - d >= 0;
      if (p === "month")
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
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
      if (currentShiftFilter === "all") {
        return true; // Mostra todos os itens (ganhos e despesas)
      }
      // Se o item for uma despesa, sempre o inclua, pois despesas não têm turno.
      if (item.type === "expense") {
        return true;
      }
      // Para ganhos, filtre pelo turno. Ganhos antigos sem 'shift' serão mostrados em 'todos'.
      // Se quiser que eles apareçam no filtro 'dia', pode usar: return item.shift === currentShiftFilter || !item.shift;
      return item.shift === currentShiftFilter;
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
    dataToUpdate.description = document.getElementById("edit-exp-desc").value;
  }

  db.collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(currentUser.uid)
    .collection(collectionName)
    .doc(id)
    .update(dataToUpdate)
    .then(() => {
      closeEditModal();
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
      totalValue: tot,
      count: cnt,
      details: det,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
      router("dashboard");
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
  const description = document.getElementById("exp-desc").value;

  if (isNaN(totalValue) || totalValue <= 0) {
    showNotification(
      "Por favor, insira um valor de despesa válido e maior que zero.",
      "Valor Inválido"
    );
    btn.innerText = "Salvar Despesa";
    btn.disabled = false;
    return;
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
      description,
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
  const btn = e.target.querySelector("button");
  btn.disabled = true;

  let p = document.getElementById("ad-zap").value.replace(/\D/g, "");

  if (p.startsWith("55") && p.length > 11) {
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

  db.collection("artifacts")
    .doc(appId)
    .collection("public")
    .doc("data")
    .collection("marketplace")
    .add({
      title: document.getElementById("ad-title").value,
      price: parseFloat(document.getElementById("ad-price").value),
      category: document.getElementById("ad-cat").value,
      description: document.getElementById("ad-desc").value,
      image: document.getElementById("ad-img").value,
      whatsapp: p,
      userId: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => router("market"))
    .catch((err) => {
      showNotification(err.message, "Erro ao Publicar");
      btn.disabled = false;
    });
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
