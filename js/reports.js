// js/reports.js
// Responsável por criar os gráficos e as funcionalidades de exportar/compartilhar.

import { $ } from "./utils.js";
import { storage } from "./storage.js";
import { getDateRange } from "./date.utils.js";
import { formatarMoeda } from "./utils.js";
import { navegacao } from "./ui.js"; // CORREÇÃO: Módulo de navegação importado

let ganhosModule;

export const relatorios = {
  chartDiario: null,
  chartSemanal: null,
  chartMensal: null,

  init: function (dependencies) {
    ganhosModule = dependencies.ganhos;
    this.setupFerramentas();
  },

  atualizarGraficos: function (ganhosUsuario) {
    const usuario = storage.getUsuarioLogado(); // Usado apenas para a meta por enquanto
    if (!usuario) return;

    // Se nenhum ganho for passado, não faz nada.
    if (!ganhosUsuario) return;

    const metaSemanal = usuario.metaSemanal || 1000;
    const hoje = new Date().toISOString().slice(0, 10);
    const ganhosDia = ganhosUsuario
      .filter((g) => g.data === hoje)
      .reduce((s, g) => s + g.valor, 0);

    const semanaRange = getDateRange("esta-semana");
    const ganhosSemana = ganhosUsuario
      .filter(
        (g) =>
          new Date(g.data + "T00:00:00") >= semanaRange.start &&
          new Date(g.data + "T00:00:00") <= semanaRange.end
      )
      .reduce((s, g) => s + g.valor, 0);

    const mesRange = getDateRange("este-mes");
    const ganhosMes = ganhosUsuario
      .filter(
        (g) =>
          new Date(g.data + "T00:00:00") >= mesRange.start &&
          new Date(g.data + "T00:00:00") <= mesRange.end
      )
      .reduce((s, g) => s + g.valor, 0);

    this.setElementText("valorGraficoDiario", formatarMoeda(ganhosDia));
    this.setElementText("valorGraficoSemanal", formatarMoeda(ganhosSemana));
    this.setElementText("valorGraficoMensal", formatarMoeda(ganhosMes));

    this.criarGrafico(
      "graficoDiario",
      ganhosDia,
      metaSemanal / 7,
      "Ganhos do Dia",
      "#1ee66c"
    );
    this.criarGrafico(
      "graficoSemanal",
      ganhosSemana,
      metaSemanal,
      "Ganhos da Semana",
      "#13b15a"
    );
    this.criarGrafico(
      "graficoMensal",
      ganhosMes,
      metaSemanal * 4,
      "Ganhos do Mês",
      "#000"
    );
  },

  criarGrafico: function (id, valor, meta, label, cor) {
    const ctx = $(id);
    if (!ctx) return;

    const chartVarName = `chart${id.charAt(0).toUpperCase() + id.slice(1)}`;
    if (this[chartVarName]) this[chartVarName].destroy();

    const restante = Math.max(0, meta - valor);
    this[chartVarName] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: [label, "Falta"],
        datasets: [{ data: [valor, restante], backgroundColor: [cor, "#eee"] }],
      },
      options: {
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => `${c.label}: ${formatarMoeda(c.parsed)}`,
            },
          },
        },
      },
    });
  },

  setupFerramentas: function () {
    // CORREÇÃO: Botão Adicionar Ganho da tela inicial
    if ($("atalhoAdicionarGanho")) {
      $("atalhoAdicionarGanho").onclick = () => {
        navegacao.mostrarTelaProtegida("tela-ganhos");
      };
    }

    if ($("atalhoExportar"))
      $("atalhoExportar").onclick = this.exportarRelatorioCSV.bind(this);

    // CORREÇÃO: Botão Compartilhar WhatsApp da tela inicial
    if ($("atalhoCompartilhar")) {
      $("atalhoCompartilhar").onclick = this.compartilharWhatsApp.bind(this);
    }

    // CORREÇÃO: Botão Compartilhar da tela de Ganhos
    if ($("btnCompartilhar")) {
      $("btnCompartilhar").addEventListener("click", () =>
        this.compartilharGanhosFiltrados()
      );
    }
  },

  exportarRelatorioCSV: function () {
    const ganhosFiltrados = ganhosModule.getGanhosFiltrados();
    if (ganhosFiltrados.length === 0)
      return alert("Nenhum ganho para exportar.");

    let csv = "Data,Valor,Diária,Taxa Entrega,Qtde Entregas\n";
    ganhosFiltrados.forEach((g) => {
      csv += `${g.data},${g.valor},${g.valorDiaria},${g.taxaEntrega},${g.qtdEntregas}\n`;
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "relatorio_ganhos.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  },

  compartilharWhatsApp: function () {
    const usuarioLogado = storage.getUsuarioLogado();
    if (!usuarioLogado) return;

    const ganhosUsuario = storage
      .getGanhos()
      .filter((g) => g.usuario === usuarioLogado.usuario);
    if (ganhosUsuario.length === 0)
      return alert("Nenhum ganho para compartilhar.");

    const mesRange = getDateRange("este-mes");

    // CORREÇÃO: Filtra os ganhos apenas para o mês atual
    const ganhosDoMes = ganhosUsuario.filter((g) => {
      const d = new Date(g.data + "T00:00:00");
      return d >= mesRange.start && d <= mesRange.end;
    });

    const totalGanhosMes = ganhosDoMes.reduce((s, g) => s + g.valor, 0);
    const totalEntregasMes = ganhosDoMes.reduce((s, g) => s + g.qtdEntregas, 0);

    let msg =
      `Meu resumo do mês no MotoCash:\n\n` +
      `*Ganhos Totais:* ${formatarMoeda(totalGanhosMes)}\n` +
      `*Total de Entregas:* ${totalEntregasMes}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  },

  compartilharGanhosFiltrados: function () {
    const ganhosFiltrados = ganhosModule.getGanhosFiltrados();
    if (ganhosFiltrados.length === 0) {
      return alert(
        "Nenhum ganho encontrado no período selecionado para compartilhar."
      );
    }

    const totais = ganhosFiltrados.reduce(
      (acc, g) => ({
        entregas: acc.entregas + g.qtdEntregas,
        diarias: acc.diarias + g.valorDiaria,
        total: acc.total + g.valor,
      }),
      { entregas: 0, diarias: 0, total: 0 }
    );

    const select = $("filtro-periodo");
    const periodoTexto = select.options[select.selectedIndex].text;
    let titulo = `*Resumo do Período: ${periodoTexto}*`;

    if (select.value === "personalizado") {
      const inicio = new Date(
        $("filtro-data-inicio").value + "T03:00:00"
      ).toLocaleDateString("pt-BR");
      const fim = new Date(
        $("filtro-data-fim").value + "T03:00:00"
      ).toLocaleDateString("pt-BR");
      titulo = `*Resumo do Período de ${inicio} a ${fim}*`;
    }

    let msg = `${titulo}:\n`;
    let infoAdicionada = false;

    if ($("compQtdEntregas")?.checked) {
      msg += `\n- Quantidade de Entregas: *${totais.entregas}*`;
      infoAdicionada = true;
    }
    if ($("compValorDiaria")?.checked) {
      msg += `\n- Soma das Diárias: *${formatarMoeda(totais.diarias)}*`;
      infoAdicionada = true;
    }
    if ($("compValorTotal")?.checked) {
      msg += `\n- *Total Geral: ${formatarMoeda(totais.total)}*`;
      infoAdicionada = true;
    }

    if (!infoAdicionada) {
      return alert("Selecione pelo menos uma informação para compartilhar.");
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  },

  setElementText: (id, text) => {
    if ($(id)) $(id).textContent = text;
  },
};
