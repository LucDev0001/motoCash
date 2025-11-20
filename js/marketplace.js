// js/marketplace.js
// Lógica para a página do marketplace - VERSÃO CORRIGIDA E SEGURA

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
  allProductsCache: [],
  navegarPara: null,

  init: function (dependencies) {
    console.log(">>> MARKETPLACE: Iniciando sistema...");
    this.navegarPara = dependencies.navegarPara;

    this.fetchAndDisplayProducts();
    this.setupFilters();

    if ($("btn-user-add-product")) {
      $("btn-user-add-product").onclick = async () => {
        const querContinuar = await this.showImageGuideModal();
        if (querContinuar) {
          this.navegarPara("add-product");
        }
      };
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
    if (!productListEl)
      return console.error("Erro: Elemento 'product-list' não achado no HTML.");

    productListEl.innerHTML =
      '<p style="text-align:center; padding: 20px;">Carregando produtos do banco de dados...</p>';

    try {
      // NOTA: Removi o 'orderBy' temporariamente para garantir que nada seja ocultado.
      // Se funcionar, depois podemos colocar: query(collection(db, "produtos"), orderBy("createdAt", "desc"));
      const q = query(collection(db, "produtos"));

      if (this.allProductsCache.length === 0 || force) {
        console.log(">>> MARKETPLACE: Buscando no Firebase...");
        const querySnapshot = await getDocs(q);

        console.log(
          `>>> MARKETPLACE: Encontrados ${querySnapshot.size} documentos.`
        );

        if (querySnapshot.empty) {
          productListEl.innerHTML =
            "<p>Nenhum produto cadastrado no banco de dados ainda.</p>";
          return;
        }

        this.allProductsCache = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          data.id = doc.id; // Garante que o ID venha junto

          // Debug: Mostra no console se faltar o nome
          if (!data.nome)
            console.warn(
              `AVISO: Produto ID ${doc.id} está sem o campo 'nome'.`
            );

          // Tratamento de Data
          if (data.createdAt && typeof data.createdAt.toDate === "function") {
            data.createdAt = data.createdAt.toDate();
          } else {
            data.createdAt = new Date(); // Data fictícia para não quebrar
          }
          return data;
        });
      }

      this.filterAndDisplayProducts();
    } catch (error) {
      console.error(">>> ERRO CRÍTICO AO BUSCAR PRODUTOS:", error);
      productListEl.innerHTML = `<p style="color:red">Erro ao carregar: ${error.message}</p>`;
    }
  },

  filterAndDisplayProducts: function () {
    const productListEl = $("product-list");
    // Proteção: Se o input não existir, usa string vazia
    const searchInput = $("search-input");
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

    const activeCategoryEl = document.querySelector(".category-btn.active");
    const activeCategory = activeCategoryEl
      ? activeCategoryEl.dataset.category
      : "todos";

    let filteredProducts = this.allProductsCache;

    // 1. Filtra por Categoria
    if (activeCategory !== "todos") {
      filteredProducts = filteredProducts.filter(
        (p) => p.categoria === activeCategory
      );
    }

    // 2. Filtra por Busca (COM PROTEÇÃO CONTRA NOME VAZIO)
    if (searchTerm) {
      filteredProducts = filteredProducts.filter((p) => {
        // Se o produto não tiver nome, ignora ele na busca ou trata como string vazia
        const nomeProduto = p.nome ? p.nome.toLowerCase() : "";
        return nomeProduto.includes(searchTerm);
      });
    }

    if (filteredProducts.length === 0) {
      productListEl.innerHTML =
        "<p>Nenhum produto encontrado com esses filtros.</p>";
      return;
    }

    productListEl.innerHTML = "";
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
    // VALORES PADRÃO PARA NÃO QUEBRAR O LAYOUT SE FALTAR DADOS NO BANCO
    const nomeSeguro = product.nome || "Produto sem Nome";
    const precoSeguro = product.preco
      ? formatarMoeda(product.preco)
      : "R$ 0,00";
    const imagemSegura =
      product.imagemURL || "https://via.placeholder.com/150?text=Sem+Foto";
    const vendedorSeguro = product.ownerName || "Desconhecido";

    const isAffiliate = product.tipo === "afiliado";
    const userProfile = perfil.localProfileCache;
    const isOwner = userProfile && userProfile.uid === product.ownerId;

    return `
      <div class="product-card" data-product-id="${product.id}">
        ${
          isOwner
            ? `
          <div class="product-owner-actions">
            <button class="btn-menu-product" data-product-id="${product.id}">...</button>
            <div class="menu-product-opcoes" style="display: none;">
              <a href="#" class="btn-delete-product" data-product-id="${product.id}">Excluir</a>
            </div>
          </div>`
            : ""
        }
        
        <div class="product-image-container">
          <img src="${imagemSegura}" alt="${nomeSeguro}" class="product-image">
        </div>
        <div class="product-info">
          <h4 class="product-name">${nomeSeguro}</h4>
          <p class="product-price">${precoSeguro}</p>
          <p class="product-owner">Vendido por: <strong>${vendedorSeguro}</strong></p>
        </div>
      </div>
    `;
  },

  // ... Mantenha o restante do código (initAddProductForm, handleAddProduct, etc) igual ...
  // ... Para economizar espaço, vou resumir as funções auxiliares,
  // mas você deve manter as funções initAddProductForm, handleAddProduct,
  // setupProductActionButtons, handleDeleteProduct, openProductModal e showImageGuideModal aqui.

  initAddProductForm: function (dependencies) {
    // ... (Seu código original do initAddProductForm)
    this.navegarPara = dependencies.navegarPara;
    $("btn-voltar-marketplace").onclick = () => this.navegarPara("marketplace");
    $("form-add-product").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleAddProduct();
    });
  },

  handleAddProduct: async function () {
    // Use a mesma lógica que você já tinha, está correta.
    // DICA: Certifique-se de que o objeto 'newProduct' tenha o campo 'nome' preenchido!
    const userProfile = await perfil.fetchUserProfile();
    if (!userProfile) return alert("Logue para anunciar.");

    const nome = $("product-name").value.trim(); // <--- ESSE CAMPO É CRUCIAL
    const preco = parseFloat($("product-price").value);
    const imagemURL = $("product-image-url").value.trim();
    const categoria = $("product-category").value;
    // ... resto da lógica de salvar

    const newProduct = {
      id: String(Date.now()),
      nome: nome, // GARANTA QUE ISSO NÃO SEJA VAZIO
      preco: preco,
      categoria: categoria,
      imagemURL: imagemURL,
      ownerId: userProfile.uid,
      ownerName: userProfile.nome,
      createdAt: serverTimestamp(),
      // ... outros campos
    };

    await setDoc(doc(db, "produtos", newProduct.id), newProduct);
    alert("Sucesso!");
    this.navegarPara("marketplace");
  },

  setupProductActionButtons: function () {
    // ... (Seu código original)
    document.querySelectorAll(".btn-menu-product").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        e.currentTarget.nextElementSibling.style.display = "block";
      });
    });
    document.querySelectorAll(".btn-delete-product").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleDeleteProduct(e.currentTarget.dataset.productId);
      });
    });
    document.querySelectorAll(".product-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (!e.target.closest(".product-owner-actions")) {
          this.openProductModal(card.dataset.productId);
        }
      });
    });
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
    if (!confirm("Excluir?")) return;
    await deleteDoc(doc(db, "produtos", productId));
    this.fetchAndDisplayProducts(true);
  },

  openProductModal: function (productId) {
    // ... (Seu código original, mas use as variáveis seguras)
    const product = this.allProductsCache.find((p) => p.id === productId);
    if (!product) return;
    // ... renderiza o modal ...
    // DICA: use product.nome || "Sem nome" aqui também
  },

  showImageGuideModal: function () {
    return new Promise((resolve) => {
      // ... (Seu código original do modal de guia)
      resolve(true); // simplificado para o exemplo, mantenha seu original
    });
  },
};
