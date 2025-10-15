// js/date.utils.js
// Funções para manipulação de datas.

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
      const diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);

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
