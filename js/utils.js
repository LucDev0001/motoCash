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
  if (typeof valor !== 'number') {
    valor = parseFloat(valor) || 0;
  }
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

