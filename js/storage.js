// js/storage.js
// Módulo para interagir com o localStorage de forma centralizada.

export const storage = {
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
