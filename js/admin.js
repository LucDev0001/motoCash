// js/admin.js
// Lógica para o painel de administração.

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { $ } from "./utils.js";

export const admin = {
  init: function () {
    this.fetchAndDisplayUsers();
  },

  fetchAndDisplayUsers: async function () {
    const listaEl = $("lista-usuarios");
    const totalEl = $("total-usuarios");
    if (!listaEl || !totalEl) return;

    try {
      const querySnapshot = await getDocs(collection(db, "usuarios"));
      const usuarios = [];
      querySnapshot.forEach((doc) => {
        usuarios.push(doc.data());
      });

      totalEl.textContent = usuarios.length;
      listaEl.innerHTML = ""; // Limpa a lista

      usuarios
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .forEach((user) => {
          const li = document.createElement("li");
          li.className = "item-admin";
          li.innerHTML = `
          <img src="${user.avatar}" alt="Avatar de ${
            user.nome
          }" class="avatar-admin">
          <div class="info-admin">
            <strong>${user.nome}</strong>
            <span>${user.email}</span>
          </div>
          ${user.role === "admin" ? '<span class="tag-admin">Admin</span>' : ""}
        `;
          listaEl.appendChild(li);
        });
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      listaEl.innerHTML =
        "<li class='item-admin-erro'>Falha ao carregar usuários. Verifique as regras de segurança do Firestore.</li>";
    }
  },
};
