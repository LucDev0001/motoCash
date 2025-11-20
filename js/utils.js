// js/utils.js
// Funções úteis e reutilizáveis.

/**
 * Atalho para document.getElementById.
 * Retorna o elemento ou null se não for encontrado, sem gerar avisos no console.
 * @param {string} id O ID do elemento.
 * @returns {HTMLElement | null} O elemento encontrado ou null.
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Formata um número para o padrão de moeda brasileiro (BRL).
 * @param {number} valor O valor a ser formatado.
 * @returns {string} O valor formatado como moeda.
 */
export function formatarMoeda(valor) {
  // Garante que o valor é um número antes de formatar
  if (typeof valor !== "number") {
    valor = parseFloat(valor) || 0;
  }
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function getDateRange(periodo, customStart, customEnd) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let start, end;

  switch (periodo) {
    case "hoje":
      start = new Date(hoje);
      end = new Date(hoje);
      end.setHours(23, 59, 59, 999);
      break;

    case "esta-semana": {
      const diaSemana = hoje.getDay();
      const diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1); // Ajuste para semana começar na segunda

      start = new Date(hoje);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "este-mes":
      start = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      end = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case "semana-passada": {
      const hoje = new Date();
      const diaSemana = hoje.getDay();
      const segundaDestaSemana = new Date(hoje);
      const diff =
        segundaDestaSemana.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
      segundaDestaSemana.setDate(diff);

      start = new Date(segundaDestaSemana);
      start.setDate(segundaDestaSemana.getDate() - 7);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "mes-passado":
      start = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      end = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "personalizado":
      if (customStart && customEnd) {
        start = new Date(customStart + "T00:00:00");
        end = new Date(customEnd + "T23:59:59");
      }
      break;
    default:
      start = null;
      end = null;
      break;
  }
  return { start, end };
}
