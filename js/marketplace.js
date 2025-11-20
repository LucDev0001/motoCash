// js/marketplace.js
// Lógica para a página do marketplace.

import { perfil } from "./perfil.js";
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { $ } from "./utils.js";
import { formatarMoeda } from "./utils.js";

export const marketplace = {
  navegarPara: null,

  init: function (dependencies) {
    this.navegarPara = dependencies.navegarPara;
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

  initAddProductForm: function (dependencies) {
    this.navegarPara = dependencies.navegarPara;
    $("btn-voltar-marketplace").onclick = () => this.navegarPara("marketplace");

    $("form-add-product").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleAddProduct();
    });
  },

  handleAddProduct: async function () {
    const userProfile = await perfil.fetchUserProfile();
    if (!userProfile || userProfile.role !== "admin") {
      return alert("Apenas administradores podem adicionar produtos.");
    }

    const nome = $("product-name").value.trim();
    const preco = parseFloat($("product-price").value);
    const imagemURL = $("product-image-url").value.trim();
    const link = $("product-affiliate-link").value.trim();

    if (!nome || !preco || !imagemURL || !link) {
      return alert("Por favor, preencha todos os campos obrigatórios.");
    }

    const btn = $("btn-salvar-produto");
    btn.disabled = true;
    btn.textContent = "Salvando...";

    const newProduct = {
      id: String(Date.now()),
      nome,
      descricao: $("product-description").value.trim(),
      preco,
      imagemURL,
      link,
      ownerId: userProfile.uid,
      ownerName: userProfile.nome,
      ownerAvatar: userProfile.avatar,
      tipo: "afiliado", // Como só o admin pode adicionar, o tipo é sempre afiliado
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "produtos", newProduct.id), newProduct);
      alert("Produto adicionado com sucesso!");
      this.navegarPara("marketplace");
    } catch (error) {
      console.error("Erro ao adicionar produto:", error);
      alert("Ocorreu um erro ao salvar o produto.");
      btn.disabled = false;
      btn.textContent = "Salvar Produto";
    }
  },
};
