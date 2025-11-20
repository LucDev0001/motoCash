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
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { $ } from "./utils.js";
import { formatarMoeda } from "./utils.js";

export const marketplace = {
  allProductsCache: [], // Cache para todos os produtos
  navegarPara: null,

  init: function (dependencies) {
    this.navegarPara = dependencies.navegarPara;
    this.fetchAndDisplayProducts();
    this.setupFilters();

    if ($("btn-user-add-product")) {
      $("btn-user-add-product").onclick = () => this.navegarPara("add-product");
    }
  },

  setupFilters: function () {
    const searchInput = $("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", () =>
        this.filterAndDisplayProducts()
      );
    }

    document.querySelectorAll(".category-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.handleCategoryClick(btn));
    });
  },

  fetchAndDisplayProducts: async function (force = false) {
    const productListEl = $("product-list");
    if (!productListEl) return;

    productListEl.innerHTML = "<p>Carregando produtos...</p>";

    try {
      const q = query(collection(db, "produtos"), orderBy("createdAt", "desc"));

      // Usa o cache se disponível, a menos que a busca seja forçada
      if (this.allProductsCache.length === 0 || force) {
        const querySnapshot = await getDocs(q);
        this.allProductsCache = querySnapshot.docs.map((doc) => doc.data());
      }

      this.filterAndDisplayProducts();
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      productListEl.innerHTML =
        "<p>Ocorreu um erro ao carregar os produtos.</p>";
    }
  },

  filterAndDisplayProducts: function () {
    const productListEl = $("product-list");
    const searchTerm = $("search-input").value.toLowerCase();
    const activeCategory = document.querySelector(".category-btn.active")
      .dataset.category;

    let filteredProducts = this.allProductsCache;

    // Filtra por categoria
    if (activeCategory !== "todos") {
      filteredProducts = filteredProducts.filter(
        (p) => p.categoria === activeCategory
      );
    }

    // Filtra por busca
    if (searchTerm) {
      filteredProducts = filteredProducts.filter((p) =>
        p.nome.toLowerCase().includes(searchTerm)
      );
    }

    if (filteredProducts.length === 0) {
      productListEl.innerHTML =
        "<p>Nenhum produto encontrado com esses filtros.</p>";
      return;
    }

    productListEl.innerHTML = ""; // Limpa a lista
    filteredProducts.forEach((product) => {
      const card = document.createElement("div");
      card.innerHTML = this.createProductCardHTML(product);
      productListEl.appendChild(card.firstChild);
    });

    this.setupProductActionButtons();
  },

  handleCategoryClick: function (clickedBtn) {
    document
      .querySelectorAll(".category-btn")
      .forEach((btn) => btn.classList.remove("active"));
    clickedBtn.classList.add("active");
    this.filterAndDisplayProducts();
  },

  createProductCardHTML: function (product) {
    const isAffiliate = product.tipo === "afiliado";
    const buttonText = isAffiliate ? "Ver Oferta" : "Chamar no Zap";
    const buttonIcon = isAffiliate ? "shopping_cart" : "whatsapp";
    const userProfile = perfil.localProfileCache;
    const isOwner = userProfile && userProfile.uid === product.ownerId;

    return `
      <div class="product-card">
        ${
          isOwner
            ? `
          <div class="product-owner-actions">
            <button class="btn-menu-product" data-product-id="${product.id}">...</button>
            <div class="menu-product-opcoes" style="display: none;">
              <a href="#" class="btn-edit-product" data-product-id="${product.id}">Editar</a>
              <a href="#" class="btn-delete-product" data-product-id="${product.id}">Excluir</a>
            </div>
          </div>
        `
            : ""
        }
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
      this.navegarPara("marketplace"); // Navega de volta
    } catch (error) {
      console.error("Erro ao adicionar produto:", error);
      alert("Ocorreu um erro ao salvar o produto.");
      btn.disabled = false;
      btn.textContent = "Salvar Produto";
    }
  },

  setupProductActionButtons: function () {
    document.querySelectorAll(".btn-menu-product").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        document
          .querySelectorAll(".menu-product-opcoes")
          .forEach((m) => (m.style.display = "none"));
        e.currentTarget.nextElementSibling.style.display = "block";
      });
    });

    document.querySelectorAll(".btn-delete-product").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const productId = e.currentTarget.dataset.productId;
        this.handleDeleteProduct(productId);
      });
    });

    // A lógica de edição pode ser adicionada aqui no futuro
    // document.querySelectorAll('.btn-edit-product').forEach...

    document.body.addEventListener(
      "click",
      () =>
        document
          .querySelectorAll(".menu-product-opcoes")
          .forEach((m) => (m.style.display = "none")),
      { once: true }
    );
  },

  handleDeleteProduct: async function (productId) {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      await deleteDoc(doc(db, "produtos", productId));
      alert("Produto excluído com sucesso!");
      this.fetchAndDisplayProducts(true); // Força a recarga do cache
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      alert("Ocorreu um erro ao excluir o produto.");
    }
  },
};
