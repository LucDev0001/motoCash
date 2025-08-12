// app.js - Controle de Ganhos para Motoboys (Versão Corrigida)

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
  init: function () {
    this.setupGanhos();
  },

  setupGanhos: function () {
    if ($("formGanho")) {
      $("formGanho").addEventListener("submit", (e) => {
        e.preventDefault();
        this.adicionarGanho();
      });
    }
  },

  adicionarGanho: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    const data = $("data").value;
    const valorDiaria = parseFloat($("valorDiaria").value);
    const taxaEntrega = parseFloat($("taxaEntrega").value);
    const qtdEntregas = parseInt($("qtdEntregas").value);

    if (
      !data ||
      isNaN(valorDiaria) ||
      isNaN(taxaEntrega) ||
      isNaN(qtdEntregas)
    ) {
      alert("Preencha todos os campos corretamente.");
      return;
    }

    const valor = valorDiaria + taxaEntrega * qtdEntregas;
    const ganhos = storage.getGanhos();

    ganhos.push({
      usuario: usuario.usuario,
      data,
      valor,
      valorDiaria,
      taxaEntrega,
      qtdEntregas,
    });

    storage.setGanhos(ganhos);
    this.atualizarUI();
    this.atualizarTelaInicio();
    relatorios.atualizarGraficos();
    $("formGanho").reset();

    navegacao.mostrarTelaProtegida("tela-inicio");
  },

  atualizarUI: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    const ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuario.usuario);

    // Calcula totais
    const total = ganhosUsuario.reduce((s, g) => s + Number(g.valor), 0);
    this.setElementText(
      "totalGanhos",
      `Ganhos atuais: ${formatarMoeda(total)}`
    );

    // Ganhos do mês
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

    this.setElementText(
      "ganhoMes",
      `Ganho do mês: ${formatarMoeda(ganhosMes)}`
    );

    // Histórico de ganhos
    if ($("listaGanhos")) {
      $("listaGanhos").innerHTML = "";
      ganhosUsuario
        .slice()
        .reverse()
        .forEach((item) => {
          const detalhes = `Diária: ${formatarMoeda(
            item.valorDiaria
          )}, Taxa: ${formatarMoeda(item.taxaEntrega)}, Qtde: ${
            item.qtdEntregas
          }`;
          const li = document.createElement("li");
          li.textContent = `${item.data}: ${formatarMoeda(
            item.valor
          )} (${detalhes})`;
          $("listaGanhos").appendChild(li);
        });
    }
  },

  atualizarTelaInicio: function () {
    const usuario = storage.getUsuarioLogado();
    if (!usuario) return;

    const ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuario.usuario);
    const hoje = new Date();
    const hojeStr = hoje.toISOString().slice(0, 10);

    // Ganhos do dia
    const ganhosHoje = ganhosUsuario
      .filter((g) => g.data === hojeStr)
      .reduce((s, g) => s + Number(g.valor), 0);

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
      .reduce((s, g) => s + Number(g.valor), 0);

    // Ganhos do mês
    const ganhosMes = ganhosUsuario
      .filter((g) => {
        const d = new Date(g.data);
        return (
          d.getMonth() === hoje.getMonth() &&
          d.getFullYear() === hoje.getFullYear()
        );
      })
      .reduce((s, g) => s + Number(g.valor), 0);

    // Última entrega
    let ultimaEntrega = "-";
    if (ganhosUsuario.length > 0) {
      const ult = ganhosUsuario[ganhosUsuario.length - 1];
      ultimaEntrega = `${ult.data} (${formatarMoeda(ult.valor)})`;
    }

    // Média de entregas por dia
    const entregasPorDia = {};
    ganhosUsuario.forEach((g) => {
      entregasPorDia[g.data] =
        (entregasPorDia[g.data] || 0) + Number(g.qtdEntregas || 0);
    });

    const diasComEntregas = Object.keys(entregasPorDia).length;
    const totalEntregas = Object.values(entregasPorDia).reduce(
      (s, v) => s + v,
      0
    );
    const mediaEntregas = diasComEntregas ? totalEntregas / diasComEntregas : 0;

    // Melhor dia (maior ganho)
    let melhorDia = "-";
    if (ganhosUsuario.length > 0) {
      const ganhosPorDia = {};
      ganhosUsuario.forEach((g) => {
        ganhosPorDia[g.data] = (ganhosPorDia[g.data] || 0) + Number(g.valor);
      });

      const melhor = Object.entries(ganhosPorDia).sort(
        (a, b) => b[1] - a[1]
      )[0];
      if (melhor) melhorDia = `${melhor[0]} (${formatarMoeda(melhor[1])})`;
    }

    // Meta semanal
    const metaSemanal = usuario.metaSemanal || 1000;
    const faltaMeta = Math.max(0, metaSemanal - ganhosSemana);

    if ($("metaMensagem")) {
      $("metaMensagem").innerHTML =
        faltaMeta > 0
          ? `Faltam ${formatarMoeda(
              faltaMeta
            )} para bater sua meta semanal de ${formatarMoeda(metaSemanal)}!`
          : `Parabéns! Você bateu sua meta semanal de ${formatarMoeda(
              metaSemanal
            )}!`;

      // Barra de progresso
      this.atualizarBarraProgresso(metaSemanal, ganhosSemana);
    }

    // Atualiza resumos rápidos
    this.setElementText("resumoHoje", formatarMoeda(ganhosHoje));
    this.setElementText("resumoSemana", formatarMoeda(ganhosSemana));
    this.setElementText("resumoMes", formatarMoeda(ganhosMes));

    // Atualiza indicadores
    this.setElementText("mediaEntregas", mediaEntregas.toFixed(1));
    this.setElementText("melhorDia", melhorDia);
    this.setElementText("ultimaEntrega", ultimaEntrega);
  },

  atualizarBarraProgresso: function (meta, ganhos) {
    // Remove a barra anterior se existir
    const progressoAnterior = $("progresso-meta-container");
    if (progressoAnterior) progressoAnterior.remove();

    // Cria novo container
    const progressoContainer = document.createElement("div");
    progressoContainer.id = "progresso-meta-container";
    progressoContainer.style.marginTop = "10px";

    // Calcula progresso
    const progresso = Math.min(100, (ganhos / meta) * 100);
    progressoContainer.innerHTML = `
      <div class="progresso-meta">
        <div class="progresso-barra" style="width: ${progresso}%"></div>
      </div>
      <div class="progresso-texto">
        ${progresso.toFixed(0)}% da meta alcançada
      </div>
    `;

    // Adiciona estilos condicionais
    if (progresso >= 100) {
      progressoContainer
        .querySelector(".progresso-barra")
        .classList.add("meta-completa");
    }

    // Adiciona ao DOM
    $("metaMensagem").insertAdjacentElement("afterend", progressoContainer);
  },

  setElementText: (id, text) => {
    const element = $(id);
    if (element) element.textContent = text;
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

  // Verifica se há usuário logado
  if (!storage.getUsuarioLogado()) {
    navegacao.mostrarTela("tela-login");
  } else {
    navegacao.mostrarTela("tela-inicio");
    perfil.atualizarUI();
    ganhos.atualizarUI();
    relatorios.atualizarGraficos();
    ganhos.atualizarTelaInicio();
  }
}
