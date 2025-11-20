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
      <div class="product-card" data-product-id="${product.id}">
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
          <button class="btn-product-action-dummy">
            <span class="material-icons">${buttonIcon}</span> ${buttonText}
          </button>
        </div>
      </div>
    `;
  },

  initAddProductForm: function (dependencies) {
    const formAffiliateLink = document.getElementById(
      "form-group-affiliate-link"
    );
    const userProfile = perfil.localProfileCache; // Usa o cache do perfil que já deve estar carregado

    // Se o usuário não for admin, esconde o campo de link de afiliado
    if (userProfile && userProfile.role !== "admin") {
      if (formAffiliateLink) formAffiliateLink.style.display = "none";
    }

    this.navegarPara = dependencies.navegarPara;
    $("btn-voltar-marketplace").onclick = () => this.navegarPara("marketplace");

    $("form-add-product").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleAddProduct();
    });
  },

  handleAddProduct: async function () {
    const userProfile = await perfil.fetchUserProfile();
    if (!userProfile) {
      return alert("Você precisa estar logado para adicionar um produto.");
    }

    const isAdmin = userProfile.role === "admin";
    const nome = $("product-name").value.trim();
    const preco = parseFloat($("product-price").value);
    const imagemURL = $("product-image-url").value.trim();
    const categoria = $("product-category").value;
    let link;
    let tipo;

    if (isAdmin) {
      link = $("product-affiliate-link").value.trim();
      tipo = "afiliado";
      if (!link) return alert("Admin, por favor, insira o link de afiliado.");
    } else {
      if (!userProfile.telefone) {
        return alert(
          "Você precisa adicionar um número de telefone em seu perfil para poder anunciar! Vá em Perfil > Editar."
        );
      }
      // Remove caracteres não numéricos e formata o link do WhatsApp
      const phone = userProfile.telefone.replace(/\D/g, "");
      link = `https://wa.me/55${phone}`; // Adiciona o código do Brasil por padrão
      tipo = "contato_direto";
    }

    if (!nome || !preco || !imagemURL || !categoria) {
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
      categoria,
      imagemURL, // URL vinda do campo de texto
      link,
      ownerId: userProfile.uid,
      ownerName: userProfile.nome,
      ownerAvatar: userProfile.avatar,
      tipo: tipo,
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

    // Adiciona o evento para abrir o modal de detalhes
    document.querySelectorAll(".product-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (!e.target.closest(".product-owner-actions")) {
          // Não abre o modal se clicar no menu '...'
          this.openProductModal(card.dataset.productId);
        }
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

  openProductModal: function (productId) {
    const product = this.allProductsCache.find((p) => p.id === productId);
    if (!product) return;

    // Remove qualquer modal antigo
    const oldModal = document.getElementById("product-detail-modal");
    if (oldModal) oldModal.remove();

    const isAffiliate = product.tipo === "afiliado";
    const buttonText = isAffiliate
      ? "Ver Oferta na Loja"
      : "Chamar Vendedor no Zap";
    const buttonIcon = isAffiliate ? "shopping_cart" : "whatsapp";

    const modalHTML = `
      <div class="modal-overlay" id="product-detail-modal">
        <div class="modal-conteudo product-modal">
          <span class="modal-fechar" id="product-modal-fechar">&times;</span>
          <img src="${product.imagemURL}" alt="${
      product.nome
    }" class="product-modal-image">
          <h3 class="product-modal-title">${product.nome}</h3>
          <p class="product-modal-price">${formatarMoeda(product.preco)}</p>
          <div class="product-modal-owner">
            Vendido por: <strong>${product.ownerName}</strong>
          </div>
          <p class="product-modal-description">${
            product.descricao || "Nenhuma descrição fornecida."
          }</p>
          <a href="${product.link}" target="_blank" class="btn-product-action">
            <span class="material-icons">${buttonIcon}</span> ${buttonText}
          </a>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const modal = $("product-detail-modal");
    const closeModal = () => {
      modal.classList.remove("ativo");
      setTimeout(() => modal.remove(), 300);
    };

    // Adiciona a classe 'ativo' para a animação de entrada
    setTimeout(() => modal.classList.add("ativo"), 10);

    $("product-modal-fechar").onclick = closeModal;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  },

  showImageGuideModal: function () {
    return new Promise((resolve) => {
      // Remove qualquer modal antigo para evitar duplicatas
      const oldModal = document.getElementById("modal-guia-imagem");
      if (oldModal) oldModal.remove();

      const modalHTML = `
        <div class="modal-overlay" id="modal-guia-imagem">
          <div class="modal-conteudo">
            <span class="modal-fechar">&times;</span>
            <h2>Como Adicionar uma Imagem</h2>
            <p>Para anunciar seu produto, você precisa de um link (URL) da imagem. É fácil de conseguir!</p>
            <ol class="lista-guia">
              <li>Acesse um site gratuito para hospedar imagens, como o <a href="https://imgur.com/upload" target="_blank">imgur.com</a>.</li>
              <li>Faça o upload da foto do seu produto.</li>
              <li>Após o upload, clique com o botão direito na imagem e selecione <strong>"Copiar endereço da imagem"</strong>.</li>
              <li>Cole esse link no campo "URL da Imagem" em nosso formulário.</li>
            </ol>
            <div class="modal-botoes">
              <button id="btn-guia-continuar" class="btn-primario">Entendi, continuar</button>
              <button id="btn-guia-cancelar" class="btn-secundario">Cancelar</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", modalHTML);

      const modal = $("modal-guia-imagem");
      const btnContinuar = $("btn-guia-continuar");
      const btnCancelar = $("btn-guia-cancelar");
      const btnFechar = modal.querySelector(".modal-fechar");

      const closeModal = (shouldContinue) => {
        modal.classList.remove("ativo");
        setTimeout(() => modal.remove(), 300);
        resolve(shouldContinue);
      };

      // Adiciona a classe 'ativo' para a animação de entrada
      setTimeout(() => modal.classList.add("ativo"), 10);

      btnContinuar.onclick = () => closeModal(true);
      btnCancelar.onclick = () => closeModal(false);
      btnFechar.onclick = () => closeModal(false);
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal(false);
      });
    });
  },
};
