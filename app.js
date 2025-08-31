// app.js - Controle de Ganhos para Motoboys (Versão Corrigida com Previsão do Tempo)

// =============================================
// ============ CONFIGURAÇÃO INICIAL ===========
// =============================================

document.addEventListener("DOMContentLoaded", function () {
  // Inicializa a data atual no formulário de ganhos
  if ($("data")) {
    const today = new Date();
    $("data").value = today.toISOString().substr(0, 10);
  }

  // Inicializa a aplicação
  initApp();
});

// =============================================
// ============== UTILITÁRIOS ==================
// =============================================

// Seletores de elementos (com verificação de existência)
function $(id) {
  const element = document.getElementById(id);
  if (!element) console.warn(`Elemento #${id} não encontrado`);
  return element;
}

// Formata valores monetários
function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// =============================================
// ========== GERENCIAMENTO DE DADOS ===========
// =============================================

// Armazenamento local (localStorage)
const storage = {
  getUsuarios: () => JSON.parse(localStorage.getItem("usuarios")) || [],
  setUsuarios: (usuarios) =>
    localStorage.setItem("usuarios", JSON.stringify(usuarios)),

  getUsuarioLogado: () =>
    JSON.parse(localStorage.getItem("usuarioLogado")) || null,
  setUsuarioLogado: (usuario) =>
    localStorage.setItem("usuarioLogado", JSON.stringify(usuario)),

  getGanhos: () => JSON.parse(localStorage.getItem("ganhos")) || [],
  setGanhos: (ganhos) => localStorage.setItem("ganhos", JSON.stringify(ganhos)),

  limparSessao: () => localStorage.removeItem("usuarioLogado"),
};

// =============================================
// ============== NAVEGAÇÃO ====================
// =============================================

const navegacao = {
  mostrarTela: (telaId) => {
    document
      .querySelectorAll(".pagina")
      .forEach((sec) => (sec.style.display = "none"));
    const tela = $(telaId);
    if (tela) {
      tela.style.display = "block";
      navegacao.ajustarBarraInferior(telaId);
    }
  },

  mostrarTelaProtegida: (telaId) => {
    if (!storage.getUsuarioLogado()) {
      navegacao.mostrarTela("tela-login");
    } else {
      navegacao.mostrarTela(telaId);
    }
  },

  ajustarBarraInferior: (telaId) => {
    const barra = $("bottomBar");
    if (barra) {
      barra.style.display = telaId === "tela-login" ? "none" : "flex";
    }
  },
};

// =============================================
// ============ AUTENTICAÇÃO ===================
// =============================================

const auth = {
  init: function () {
    this.setupLoginCadastro();
  },

  setupLoginCadastro: function () {
    // Alternar entre login e cadastro
    if ($("linkCadastro")) {
      $("linkCadastro").addEventListener("click", (e) => {
        e.preventDefault();
        $("formLogin").parentElement.style.display = "none";
        $("cadastroBox").style.display = "block";
      });
    }

    if ($("linkLogin")) {
      $("linkLogin").addEventListener("click", (e) => {
        e.preventDefault();
        $("cadastroBox").style.display = "none";
        $("formLogin").parentElement.style.display = "block";
      });
    }

    // Seleção de avatar
    document.querySelectorAll(".avatar-opcao").forEach((img) => {
      img.addEventListener("click", () => {
        document.querySelectorAll(".avatar-opcao").forEach((i) => {
          i.classList.remove("avatar-selecionado");
        });
        img.classList.add("avatar-selecionado");
        $("avatarSelecionado").value = img.dataset.avatar;
      });
    });

    // Formulário de Login
    if ($("formLogin")) {
      $("formLogin").addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Formulário de Cadastro
    if ($("formCadastro")) {
      $("formCadastro").addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleCadastro();
      });
    }
  },

  handleLogin: function () {
    const usuario = $("loginUsuario").value.trim();
    const senha = $("loginSenha").value;
    const usuarios = storage.getUsuarios();
    const user = usuarios.find(
      (u) => u.usuario === usuario && u.senha === senha
    );

    if (user) {
      storage.setUsuarioLogado(user);
      $("loginErro").textContent = "";
      this.afterLogin();
    } else {
      $("loginErro").textContent = "Usuário ou senha inválidos!";
    }
  },

  handleCadastro: function () {
    const usuario = $("cadastroUsuario").value.trim();
    const senha = $("cadastroSenha").value;
    const nome = $("cadastroNome").value.trim();
    const telefone = $("cadastroTelefone").value.trim();
    const moto = $("cadastroMoto").value;
    const avatar = $("avatarSelecionado").value;
    const metaSemanal = parseFloat($("cadastroMetaSemanal").value) || 1000;
    const usuarios = storage.getUsuarios();

    // Validações
    if (!usuario) return this.showError("cadastroErro", "Usuário inválido!");
    if (usuarios.find((u) => u.usuario === usuario))
      return this.showError("cadastroErro", "Usuário já existe!");
    if (!avatar) return this.showError("cadastroErro", "Selecione um avatar!");

    const novoUsuario = {
      usuario,
      senha,
      nome,
      telefone,
      moto,
      avatar,
      metaSemanal,
    };

    usuarios.push(novoUsuario);
    storage.setUsuarios(usuarios);
    storage.setUsuarioLogado(novoUsuario);
    $("cadastroErro").textContent = "";

    this.afterLogin();
    $("formCadastro").reset();
    $("cadastroBox").style.display = "none";
    $("formLogin").parentElement.style.display = "block";
  },

  showError: (elementId, message) => {
    const element = $(elementId);
    if (element) element.textContent = message;
  },

  afterLogin: function () {
    navegacao.mostrarTelaProtegida("tela-inicio");
    perfil.atualizarUI();
    ganhos.atualizarUI();
    relatorios.atualizarGraficos();
    ganhos.atualizarTelaInicio();
    weather.getAndDisplayDetailedWeather(); // CHAMA A FUNÇÃO DE TEMPO AO FAZER LOGIN
    $("formLogin").reset();
  },
};

// =============================================
// ================ PERFIL =====================
// =============================================

const perfil = {
  init: function () {
    this.setupAlterarDados();
  },

  atualizarUI: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    // Atualiza informações exibidas
    this.setElementText("perfilNome", usuario.nome || usuario.usuario);
    this.setElementText("perfilUsuario", usuario.usuario);
    this.setElementText("perfilTelefone", usuario.telefone || "");
    this.setElementText("perfilMoto", usuario.moto || "");
    this.setElementText(
      "perfilMeta",
      `R$ ${(usuario.metaSemanal || 1000).toFixed(2)}`
    );
    this.setElementText(
      "msgOlaInicio",
      `Olá, ${usuario.nome || usuario.usuario}`
    );

    // Atualiza foto do perfil
    if ($("fotoPerfil") && usuario.avatar) {
      $("fotoPerfil").src = usuario.avatar;
    }

    // Pré-preencher formulário de edição
    this.preencherFormularioEdicao(usuario);
  },

  setElementText: (id, text) => {
    const element = $(id);
    if (element) element.textContent = text;
  },

  preencherFormularioEdicao: function (usuario) {
    if ($("novoNome")) $("novoNome").value = usuario.nome || "";
    if ($("novaMetaSemanal"))
      $("novaMetaSemanal").value = usuario.metaSemanal || "";
    if ($("novoTelefone")) $("novoTelefone").value = usuario.telefone || "";
    if ($("novaSenha")) $("novaSenha").value = "";

    if ($("novaMoto")) {
      const selectMoto = $("novaMoto");
      for (let i = 0; i < selectMoto.options.length; i++) {
        if (selectMoto.options[i].value === usuario.moto) {
          selectMoto.selectedIndex = i;
          break;
        }
      }
    }
  },

  setupAlterarDados: function () {
    if ($("formAlterarCadastro")) {
      $("formAlterarCadastro").addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleAlterarDados();
      });
    }
  },

  handleAlterarDados: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    const usuarios = storage.getUsuarios();
    const idx = usuarios.findIndex((u) => u.usuario === usuario.usuario);
    if (idx === -1) return;

    // Obter valores do formulário
    const novoNome = $("novoNome").value.trim();
    const novaSenha = $("novaSenha").value.trim();
    const novaMeta = $("novaMetaSemanal").value.trim();
    const novoTelefone = $("novoTelefone").value.trim();
    const novaMoto = $("novaMoto").value;

    // Validações
    if (novaMeta && isNaN(parseFloat(novaMeta))) {
      alert("A meta semanal deve ser um valor numérico");
      return;
    }

    if (novoTelefone && !/^\d{10,13}$/.test(novoTelefone)) {
      alert("Telefone deve conter entre 10 e 13 dígitos");
      return;
    }

    // Atualizar dados
    if (novoNome) usuarios[idx].nome = novoNome;
    if (novaSenha) usuarios[idx].senha = novaSenha;
    if (novaMeta) usuarios[idx].metaSemanal = parseFloat(novaMeta);
    if (novoTelefone) usuarios[idx].telefone = novoTelefone;
    if (novaMoto) usuarios[idx].moto = novaMoto;

    storage.setUsuarios(usuarios);
    storage.setUsuarioLogado(usuarios[idx]);

    this.atualizarUI();
    ganhos.atualizarTelaInicio();

    alert("Dados alterados com sucesso!");
    $("formAlterarCadastro").reset();
    this.preencherFormularioEdicao(usuarios[idx]);
  },
};

// =============================================
// ============== GANHOS ======================
// =============================================

const ganhos = {
  ganhoEditandoId: null,

  init: function () {
    this.setupGanhos();
    this.setupFiltros(); // Adicionamos a inicialização dos filtros
  },

  setupGanhos: function () {
    if ($("formGanho"))
      $("formGanho").addEventListener("submit", (e) => {
        e.preventDefault();
        this.ganhoEditandoId ? this.atualizarGanho() : this.adicionarGanho();
      });
  },

  // NOVO: Função para configurar os eventos dos filtros
  setupFiltros: function () {
    if ($("filtro-periodo")) {
      $("filtro-periodo").addEventListener("change", () => {
        if ($("filtro-periodo").value === "personalizado") {
          $("filtro-datas-personalizadas").style.display = "flex";
        } else {
          $("filtro-datas-personalizadas").style.display = "none";
          this.atualizarUI();
        }
      });
    }
    if ($("filtro-data-inicio"))
      $("filtro-data-inicio").addEventListener("change", () =>
        this.atualizarUI()
      );
    if ($("filtro-data-fim"))
      $("filtro-data-fim").addEventListener("change", () => this.atualizarUI());
    if ($("filtro-ordenar"))
      $("filtro-ordenar").addEventListener("change", () => this.atualizarUI());
    if ($("btn-limpar-filtros"))
      $("btn-limpar-filtros").addEventListener("click", () =>
        this.limparFiltros()
      );
  },

  // NOVO: Função para limpar os filtros e re-renderizar a lista
  limparFiltros: function () {
    if ($("filtro-periodo")) $("filtro-periodo").value = "todos";
    if ($("filtro-data-inicio")) $("filtro-data-inicio").value = "";
    if ($("filtro-data-fim")) $("filtro-data-fim").value = "";
    if ($("filtro-ordenar")) $("filtro-ordenar").value = "recentes";
    if ($("filtro-datas-personalizadas"))
      $("filtro-datas-personalizadas").style.display = "none";
    this.atualizarUI();
  },

  adicionarGanho: function () {
    const data = $("data").value;
    const valorDiaria = parseFloat($("valorDiaria").value) || 0;
    const taxaEntrega = parseFloat($("taxaEntrega").value) || 0;
    const qtdEntregas = parseInt($("qtdEntregas").value) || 0;
    if (!data) return alert("Preencha a data.");
    const novoGanho = {
      id: Date.now(),
      usuario: storage.getUsuarioLogado().usuario,
      data,
      valorDiaria,
      taxaEntrega,
      qtdEntregas,
      valor: valorDiaria + taxaEntrega * qtdEntregas,
    };
    const ganhos = storage.getGanhos();
    ganhos.push(novoGanho);
    storage.setGanhos(ganhos);
    this.finalizarAcaoDeGanho();
  },

  atualizarGanho: function () {
    const ganhos = storage.getGanhos();
    const index = ganhos.findIndex((g) => g.id === this.ganhoEditandoId);
    if (index === -1) return alert("Erro: Ganho não encontrado.");
    const valorDiaria = parseFloat($("valorDiaria").value) || 0;
    const taxaEntrega = parseFloat($("taxaEntrega").value) || 0;
    const qtdEntregas = parseInt($("qtdEntregas").value) || 0;
    ganhos[index] = {
      ...ganhos[index],
      data: $("data").value,
      valorDiaria,
      taxaEntrega,
      qtdEntregas,
      valor: valorDiaria + taxaEntrega * qtdEntregas,
    };
    storage.setGanhos(ganhos);
    this.ganhoEditandoId = null;
    $("btnSalvarGanho").textContent = "Adicionar Ganho";
    this.finalizarAcaoDeGanho();
  },

  finalizarAcaoDeGanho: function () {
    this.atualizarUI();
    this.atualizarTelaInicio();
    relatorios.atualizarGraficos();
    $("formGanho").reset();
    $("data").value = new Date().toISOString().substr(0, 10);
    navegacao.mostrarTelaProtegida("tela-ganhos");
  },

  excluirGanho: function (ganhoId) {
    if (confirm("Tem certeza que deseja excluir este ganho?")) {
      storage.setGanhos(storage.getGanhos().filter((g) => g.id !== ganhoId));
      this.atualizarUI();
      this.atualizarTelaInicio();
      relatorios.atualizarGraficos();
    }
  },

  editarGanho: function (ganhoId) {
    const ganho = storage.getGanhos().find((g) => g.id === ganhoId);
    if (!ganho) return;
    $("data").value = ganho.data;
    $("valorDiaria").value = ganho.valorDiaria;
    $("taxaEntrega").value = ganho.taxaEntrega;
    $("qtdEntregas").value = ganho.qtdEntregas;
    this.ganhoEditandoId = ganhoId;
    $("btnSalvarGanho").textContent = "Atualizar Ganho";
    navegacao.mostrarTelaProtegida("tela-ganhos");
    window.scrollTo(0, 0);
  },

  // ATUALIZADO: Função principal com toda a lógica de filtros
  atualizarUI: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario || !$("listaGanhos")) return;

    let ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuario.usuario);

    // --- LÓGICA DE FILTRAGEM ---
    const periodo = $("filtro-periodo").value;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let dataInicio, dataFim;

    switch (periodo) {
      case "hoje":
        dataInicio = hoje;
        dataFim = new Date(hoje);
        dataFim.setHours(23, 59, 59, 999);
        break;
      case "esta-semana":
        const semana = getWeekRange(hoje);
        dataInicio = semana.start;
        dataFim = semana.end;
        break;
      case "este-mes":
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = new Date(
          hoje.getFullYear(),
          hoje.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        break;
      case "semana-passada":
        const diaSemanaPassada = new Date(hoje);
        diaSemanaPassada.setDate(hoje.getDate() - 7);
        const semanaPassada = getWeekRange(diaSemanaPassada);
        dataInicio = semanaPassada.start;
        dataFim = semanaPassada.end;
        break;
      case "mes-passado":
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        dataFim = new Date(
          hoje.getFullYear(),
          hoje.getMonth(),
          0,
          23,
          59,
          59,
          999
        );
        break;
      case "personalizado":
        const inicioStr = $("filtro-data-inicio").value;
        const fimStr = $("filtro-data-fim").value;
        if (inicioStr) dataInicio = new Date(inicioStr + "T00:00:00");
        if (fimStr) dataFim = new Date(fimStr + "T23:59:59");
        break;
    }

    if (dataInicio && dataFim) {
      ganhosUsuario = ganhosUsuario.filter((g) => {
        const dataGanho = new Date(g.data + "T03:00:00");
        return dataGanho >= dataInicio && dataGanho <= dataFim;
      });
    } else if (dataInicio) {
      ganhosUsuario = ganhosUsuario.filter(
        (g) => new Date(g.data + "T03:00:00") >= dataInicio
      );
    } else if (dataFim) {
      ganhosUsuario = ganhosUsuario.filter(
        (g) => new Date(g.data + "T03:00:00") <= dataFim
      );
    }

    // --- LÓGICA DE ORDENAÇÃO ---
    const ordenarPor = $("filtro-ordenar").value;
    switch (ordenarPor) {
      case "recentes":
        ganhosUsuario.sort((a, b) => new Date(b.data) - new Date(a.data));
        break;
      case "antigos":
        ganhosUsuario.sort((a, b) => new Date(a.data) - new Date(b.data));
        break;
      case "maior-valor":
        ganhosUsuario.sort((a, b) => b.valor - a.valor);
        break;
      case "menor-valor":
        ganhosUsuario.sort((a, b) => a.valor - b.valor);
        break;
    }

    // --- RENDERIZAÇÃO ---
    const total = ganhosUsuario.reduce((s, g) => s + g.valor, 0);
    this.setElementText(
      "totalGanhos",
      `Ganhos (filtrados): ${formatarMoeda(total)}`
    );

    const hojeParaMes = new Date();
    const ganhosMes = storage
      .getGanhos()
      .filter(
        (g) =>
          g.usuario === usuario.usuario &&
          new Date(g.data).getMonth() === hojeParaMes.getMonth() &&
          new Date(g.data).getFullYear() === hojeParaMes.getFullYear()
      )
      .reduce((s, g) => s + g.valor, 0);
    this.setElementText(
      "ganhoMes",
      `Ganho do mês: ${formatarMoeda(ganhosMes)}`
    );

    $("listaGanhos").innerHTML = "";
    document.body.addEventListener("click", () =>
      document
        .querySelectorAll(".menu-ganho-opcoes")
        .forEach((m) => (m.style.display = "none"))
    );

    if (ganhosUsuario.length === 0) {
      $("listaGanhos").innerHTML =
        '<li class="ganho-item-vazio">Nenhum ganho encontrado para os filtros selecionados.</li>';
    }

    ganhosUsuario.forEach((item) => {
      const dataDoGanho = new Date(item.data + "T03:00:00");
      let diaDaSemana = dataDoGanho.toLocaleDateString("pt-BR", {
        weekday: "long",
      });
      diaDaSemana = diaDaSemana.charAt(0).toUpperCase() + diaDaSemana.slice(1);
      const li = document.createElement("li");
      li.classList.add("ganho-item");
      li.innerHTML = `
          <div class="ganho-info">
              <div class="info-principal">
                  <p class="ganho-data">${diaDaSemana}, ${dataDoGanho.toLocaleDateString(
        "pt-BR"
      )}</p>
                  <p class="ganho-valor">${formatarMoeda(item.valor)}</p>
              </div>
              <p class="info-secundaria">Entregas feitas: ${
                item.qtdEntregas
              }</p>
          </div>
          <div class="ganho-acoes">
              <button class="btn-menu-ganho">...</button>
              <div class="menu-ganho-opcoes" style="display: none;">
                  <a href="#" class="btn-editar">Editar</a>
                  <a href="#" class="btn-excluir">Excluir</a>
              </div>
          </div>`;
      li.querySelector(".btn-menu-ganho").addEventListener("click", (e) => {
        e.stopPropagation();
        document
          .querySelectorAll(".menu-ganho-opcoes")
          .forEach((m) => (m.style.display = "none"));
        e.currentTarget.nextElementSibling.style.display = "block";
      });
      li.querySelector(".btn-editar").addEventListener("click", (e) => {
        e.preventDefault();
        this.editarGanho(item.id);
      });
      li.querySelector(".btn-excluir").addEventListener("click", (e) => {
        e.preventDefault();
        this.excluirGanho(item.id);
      });
      $("listaGanhos").appendChild(li);
    });
  },

  // As outras funções permanecem as mesmas
  atualizarTelaInicio: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;
    const ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuario.usuario);
    const hoje = new Date();
    const hojeStr = hoje.toISOString().slice(0, 10);
    const ganhosHoje = ganhosUsuario
      .filter((g) => g.data === hojeStr)
      .reduce((s, g) => s + g.valor, 0);
    const semana = getWeekRange(hoje);
    const ganhosSemana = ganhosUsuario
      .filter((g) => {
        const d = new Date(g.data + "T03:00:00");
        return d >= semana.start && d <= semana.end;
      })
      .reduce((s, g) => s + g.valor, 0);
    const ganhosMes = ganhosUsuario
      .filter(
        (g) =>
          new Date(g.data).getMonth() === hoje.getMonth() &&
          new Date(g.data).getFullYear() === hoje.getFullYear()
      )
      .reduce((s, g) => s + g.valor, 0);
    let ultimaEntrega = "-";
    if (ganhosUsuario.length > 0) {
      const ult = ganhosUsuario[ganhosUsuario.length - 1];
      ultimaEntrega = `${new Date(ult.data + "T03:00:00").toLocaleDateString(
        "pt-BR"
      )} (${formatarMoeda(ult.valor)})`;
    }
    const entregasPorDia = {};
    ganhosUsuario.forEach((g) => {
      entregasPorDia[g.data] = (entregasPorDia[g.data] || 0) + g.qtdEntregas;
    });
    const diasComEntregas = Object.keys(entregasPorDia).length;
    const totalEntregas = Object.values(entregasPorDia).reduce(
      (s, v) => s + v,
      0
    );
    const mediaEntregas = diasComEntregas ? totalEntregas / diasComEntregas : 0;
    let melhorDia = "-";
    if (ganhosUsuario.length > 0) {
      const ganhosPorDia = {};
      ganhosUsuario.forEach((g) => {
        ganhosPorDia[g.data] = (ganhosPorDia[g.data] || 0) + g.valor;
      });
      const melhor = Object.entries(ganhosPorDia).sort(
        (a, b) => b[1] - a[1]
      )[0];
      if (melhor)
        melhorDia = `${new Date(melhor[0] + "T03:00:00").toLocaleDateString(
          "pt-BR"
        )} (${formatarMoeda(melhor[1])})`;
    }
    const metaSemanal = usuario.metaSemanal || 1000;
    const faltaMeta = Math.max(0, metaSemanal - ganhosSemana);
    if ($("metaMensagem")) {
      $("metaMensagem").innerHTML =
        faltaMeta > 0
          ? `Faltam ${formatarMoeda(
              faltaMeta
            )} para bater sua meta de ${formatarMoeda(metaSemanal)}!`
          : `Parabéns! Você bateu sua meta de ${formatarMoeda(metaSemanal)}!`;
      this.atualizarBarraProgresso(metaSemanal, ganhosSemana);
    }
    this.setElementText("resumoHoje", formatarMoeda(ganhosHoje));
    this.setElementText("resumoSemana", formatarMoeda(ganhosSemana));
    this.setElementText("resumoMes", formatarMoeda(ganhosMes));
    this.setElementText("mediaEntregas", mediaEntregas.toFixed(1));
    this.setElementText("melhorDia", melhorDia);
    this.setElementText("ultimaEntrega", ultimaEntrega);
  },
  atualizarBarraProgresso: function (meta, ganhos) {
    if ($("progresso-meta-container")) $("progresso-meta-container").remove();
    const progressoContainer = document.createElement("div");
    progressoContainer.id = "progresso-meta-container";
    progressoContainer.style.marginTop = "10px";
    const progresso = meta > 0 ? Math.min(100, (ganhos / meta) * 100) : 0;
    progressoContainer.innerHTML = `<div class="progresso-meta"><div class="progresso-barra" style="width: ${progresso}%"></div></div><div class="progresso-texto">${progresso.toFixed(
      0
    )}% da meta alcançada</div>`;
    if (progresso >= 100)
      progressoContainer
        .querySelector(".progresso-barra")
        .classList.add("meta-completa");
    if ($("metaMensagem"))
      $("metaMensagem").insertAdjacentElement("afterend", progressoContainer);
  },
  setElementText: (id, text) => {
    if ($(id)) $(id).textContent = text;
  },
};
// =============================================
// ============== PREVISÃO DO TEMPO ============
// =============================================

const weather = {
  API_KEY: "b39ef98f3edca5d6de39c4fcd9b78c7c",

  init: function () {
    // Não há mais botão para inicializar
  },

  getAndDisplayDetailedWeather: async function () {
    const statusDiv = $("weather-status");
    const hourlyContainer = $("hourly-forecast-container")?.querySelector(
      ".previsao-lista"
    );

    if (!statusDiv || !hourlyContainer) return;

    statusDiv.textContent = "Buscando sua localização...";

    if (!navigator.geolocation) {
      statusDiv.textContent =
        "Geolocalização não é suportada pelo seu navegador.";
      return;
    }

    function success(position) {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      // Usamos a API de previsão de 5 dias / 3 horas
      const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${weather.API_KEY}&units=metric&lang=pt`;

      statusDiv.textContent = "Carregando previsão...";

      fetch(apiUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              "Erro ao buscar dados da API. Verifique a chave ou a URL."
            );
          }
          return response.json();
        })
        .then((data) => {
          statusDiv.textContent = "";

          // --- PREVISÃO DE 8 HORAS (HOJE) ---
          hourlyContainer.innerHTML = "";
          const hourlyForecast = data.list.slice(0, 3);
          hourlyForecast.forEach((item) => {
            const date = new Date(item.dt * 1000);
            const time = date.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            hourlyContainer.innerHTML += weather.createForecastItem(
              time,
              item.main.temp,
              item.weather[0].icon
            );
          });
        })
        .catch((error) => {
          console.error("Erro ao obter previsão do tempo:", error);
          statusDiv.textContent = "Erro ao carregar a previsão.";
        });
    }

    function error() {
      statusDiv.textContent =
        "Não foi possível obter sua localização. Verifique as permissões.";
    }

    navigator.geolocation.getCurrentPosition(success, error);
  },

  // Função auxiliar para criar o HTML de um item da previsão
  createForecastItem: function (label, temp, iconCode) {
    return `
            <div class="previsao-item">
                <p>${label}</p>
                <img src="http://openweathermap.org/img/wn/${iconCode}.png" alt="Tempo">
                <p>${Math.round(temp)}°C</p>
            </div>
        `;
  },
};

// =============================================
// ============== RELATÓRIOS ==================
// =============================================

const relatorios = {
  chartDiario: null,
  chartSemanal: null,
  chartMensal: null,

  init: function () {
    this.setupFerramentas();
  },

  atualizarGraficos: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    const ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuario.usuario);
    const hoje = new Date();

    // Ganhos do dia
    const ganhosDia = ganhosUsuario
      .filter((g) => g.data === hoje.toISOString().slice(0, 10))
      .reduce((soma, g) => soma + Number(g.valor), 0);

    // Ganhos da semana
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);

    const ganhosSemana = ganhosUsuario
      .filter((g) => {
        const d = new Date(g.data);
        return d >= inicioSemana && d <= fimSemana;
      })
      .reduce((soma, g) => soma + Number(g.valor), 0);

    // Ganhos do mês
    const ganhosMes = ganhosUsuario
      .filter((g) => {
        const d = new Date(g.data);
        return (
          d.getMonth() === hoje.getMonth() &&
          d.getFullYear() === hoje.getFullYear()
        );
      })
      .reduce((soma, g) => soma + Number(g.valor), 0);

    // Atualiza valores dos gráficos
    this.setElementText("valorGraficoDiario", formatarMoeda(ganhosDia));
    this.setElementText("valorGraficoSemanal", formatarMoeda(ganhosSemana));
    this.setElementText("valorGraficoMensal", formatarMoeda(ganhosMes));

    // Cria/atualiza gráficos
    this.criarGrafico("graficoDiario", ganhosDia, "#1ee66c");
    this.criarGrafico("graficoSemanal", ganhosSemana, "#13b15a");
    this.criarGrafico("graficoMensal", ganhosMes, "#000");
  },

  criarGrafico: function (elementId, valor, cor) {
    if (!$(elementId)) return;

    // Destrói gráfico existente
    if (
      this[`chart${elementId.charAt(0).toUpperCase() + elementId.slice(1)}`]
    ) {
      this[
        `chart${elementId.charAt(0).toUpperCase() + elementId.slice(1)}`
      ].destroy();
    }

    // Cria novo gráfico
    this[`chart${elementId.charAt(0).toUpperCase() + elementId.slice(1)}`] =
      new Chart($(elementId), {
        type: "doughnut",
        data: {
          labels: ["Ganhos"],
          datasets: [{ data: [valor, 1], backgroundColor: [cor, "#eee"] }],
        },
        options: {
          cutout: "70%",
          plugins: { legend: { display: false } },
          animation: { animateScale: true },
        },
      });
  },

  setupFerramentas: function () {
    // Atalho para adicionar ganho
    if ($("atalhoAdicionarGanho")) {
      $("atalhoAdicionarGanho").onclick = () => {
        navegacao.mostrarTelaProtegida("tela-ganhos");
        if ($("formGanho"))
          $("formGanho").scrollIntoView({ behavior: "smooth" });
      };
    }

    // Exportar relatório CSV
    if ($("atalhoExportar")) {
      $("atalhoExportar").onclick = this.exportarRelatorioCSV;
    }

    // Compartilhar via WhatsApp
    if ($("atalhoCompartilhar")) {
      $("atalhoCompartilhar").onclick = this.compartilharWhatsApp;
    }

    // Botão de compartilhar na tela de ganhos
    if ($("btnCompartilhar")) {
      $("btnCompartilhar").addEventListener(
        "click",
        this.compartilharUltimoGanho
      );
    }
  },

  exportarRelatorioCSV: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    const ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuario.usuario);
    if (ganhosUsuario.length === 0) {
      alert("Nenhum ganho para exportar.");
      return;
    }

    let csv = "Data,Valor,Diária,Taxa Entrega,Qtde Entregas\n";
    ganhosUsuario.forEach((g) => {
      csv += `${g.data},${g.valor},${g.valorDiaria},${g.taxaEntrega},${g.qtdEntregas}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_ganhos.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  compartilharWhatsApp: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    const ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuario.usuario);
    if (ganhosUsuario.length === 0) {
      alert("Nenhum ganho para compartilhar.");
      return;
    }

    const hoje = new Date();
    const ganhosMes = ganhosUsuario
      .filter((g) => {
        const d = new Date(g.data);
        return (
          d.getMonth() === hoje.getMonth() &&
          d.getFullYear() === hoje.getFullYear()
        );
      })
      .reduce((s, g) => s + Number(g.valor), 0);

    let msg = `Resumo do mês: ${formatarMoeda(ganhosMes)}\n`;
    msg += `Total de entregas: ${ganhosUsuario.reduce(
      (s, g) => s + Number(g.qtdEntregas || 0),
      0
    )}`;

    let tel = usuario.telefone ? usuario.telefone.replace(/\D/g, "") : "";
    let url =
      tel.length >= 10
        ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank");
  },

  compartilharUltimoGanho: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    const ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuario.usuario);
    if (ganhosUsuario.length === 0) {
      alert("Nenhum ganho para compartilhar.");
      return;
    }

    const ultimo = ganhosUsuario[ganhosUsuario.length - 1];
    let msg = `Ganhos do dia ${ultimo.data}: `;

    if ($("compQtdEntregas") && $("compQtdEntregas").checked)
      msg += `Entregas: ${ultimo.qtdEntregas} `;
    if ($("compValorDiaria") && $("compValorDiaria").checked)
      msg += `| Diária: ${formatarMoeda(ultimo.valorDiaria)} `;
    if ($("compValorTotal") && $("compValorTotal").checked)
      msg += `| Total: ${formatarMoeda(ultimo.valor)}`;

    let tel = usuario.telefone ? usuario.telefone.replace(/\D/g, "") : "";
    let url =
      tel.length >= 10
        ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank");
  },

  setElementText: (id, text) => {
    const element = $(id);
    if (element) element.textContent = text;
  },
};

// =============================================
// ============ NAVEGAÇÃO INFERIOR =============
// =============================================

const bottomNav = {
  init: function () {
    this.setupEventos();
  },

  setupEventos: function () {
    // Botão de início
    if ($("btnNavInicio")) {
      $("btnNavInicio").onclick = () => {
        navegacao.mostrarTelaProtegida("tela-inicio");
        ganhos.atualizarTelaInicio();
        relatorios.atualizarGraficos();
        weather.getAndDisplayDetailedWeather(); // <<< CHAMADA PARA ATUALIZAR O TEMPO
      };
    }

    // Botão de ganhos
    if ($("btnNavGanhos")) {
      $("btnNavGanhos").onclick = () => {
        navegacao.mostrarTelaProtegida("tela-ganhos");
        ganhos.atualizarUI();
      };
    }

    // Botão de perfil
    if ($("btnNavPerfil")) {
      $("btnNavPerfil").onclick = () => {
        navegacao.mostrarTelaProtegida("tela-perfil");
        perfil.atualizarUI();
      };
    }

    // Botão de sair
    if ($("btnSair")) {
      $("btnSair").addEventListener("click", () => {
        storage.limparSessao();
        navegacao.mostrarTela("tela-login");
      });
    }
  },
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => {
        console.log("Service Worker registrado com sucesso:", reg.scope);
      })
      .catch((err) => {
        console.log("Erro ao registrar o Service Worker:", err);
      });
  });
}

// =============================================
// ============ INICIALIZAÇÃO ==================
// =============================================

function initApp() {
  auth.init();
  perfil.init();
  ganhos.init();
  relatorios.init();
  bottomNav.init();
  weather.init(); // <<< INICIALIZAÇÃO DO MÓDULO DE TEMPO

  // Verifica se há usuário logado
  if (!storage.getUsuarioLogado()) {
    navegacao.mostrarTela("tela-login");
  } else {
    navegacao.mostrarTela("tela-inicio");
    perfil.atualizarUI();
    ganhos.atualizarUI();
    relatorios.atualizarGraficos();
    ganhos.atualizarTelaInicio();
    weather.getAndDisplayDetailedWeather(); // <<< CHAMADA INICIAL PARA ATUALIZAR O TEMPO
  }
}
