// js/marketplace.js
// Lógica para a página do marketplace.

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { $ } from "./utils.js";
import { formatarMoeda } from "./utils.js";

export const marketplace = {
  init: function () {
    this.fetchAndDisplayProducts();
  },

  fetchAndDisplayProducts: async function () {
    const productListEl = $("product-list");
    if (!productListEl) return;

    productListEl.innerHTML = "<p>Carregando produtos...</p>";

    try {
      const q = query(collection(db, "produtos"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        productListEl.innerHTML =
          "<p>Nenhum produto encontrado no momento.</p>";
        return;
      }

      productListEl.innerHTML = ""; // Limpa o "Carregando..."

      querySnapshot.forEach((doc) => {
        const product = doc.data();
        productListEl.innerHTML += this.createProductCardHTML(product);
      });
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      productListEl.innerHTML =
        "<p>Ocorreu um erro ao carregar os produtos.</p>";
    }
  },

  createProductCardHTML: function (product) {
    const isAffiliate = product.tipo === "afiliado";
    const buttonText = isAffiliate ? "Ver Oferta" : "Chamar no Zap";
    const buttonIcon = isAffiliate ? "shopping_cart" : "whatsapp";

    return `
      <div class="product-card">
        <img src="${product.imagemURL}" alt="${
      product.nome
    }" class="product-image">
        <div class="product-info">
          <h4 class="product-name">${product.nome}</h4>
          <p class="product-price">${formatarMoeda(product.preco)}</p>
          <div class="product-owner">
            <img src="${product.ownerAvatar}" alt="${
      product.ownerName
    }" class="owner-avatar">
            <span>${product.ownerName}</span>
          </div>
          <a href="${product.link}" target="_blank" class="btn-product-action">
            <span class="material-icons">${buttonIcon}</span> ${buttonText}
          </a>
        </div>
      </div>
    `;
  },
};
