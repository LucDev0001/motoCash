// js/marketplace.js
// Lógica para a página do marketplace - VERSÃO FINAL CORRIGIDA

import { perfil } from "./perfil.js";
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  // orderBy, // Mantive comentado para evitar erros de índice por enquanto
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
      '<p style="text-align:center; padding: 20px;">Carregando produtos...</p>';

    try {
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

          // Tratamento de Data
          if (data.createdAt && typeof data.createdAt.toDate === "function") {
            data.createdAt = data.createdAt.toDate();
          } else {
            data.createdAt = new Date();
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
    const searchInput = $("search-input");

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const activeCategoryEl = document.querySelector(".category-btn.active");
    const activeCategory = activeCategoryEl
      ? activeCategoryEl.dataset.category
      : "todos";

    console.log(">>> FILTRO: Iniciando...");
    console.log("--- Categoria Ativa:", activeCategory);
    console.log("--- Termo de Busca:", searchTerm);

    let filteredProducts = this.allProductsCache;

    // 1. Filtra por Categoria
    if (activeCategory !== "todos") {
      filteredProducts = filteredProducts.filter(
        (p) => p.categoria === activeCategory
      );
    }

    // 2. Filtra por Busca
    if (searchTerm) {
      filteredProducts = filteredProducts.filter((p) => {
        const nome = p.nome ? p.nome.toLowerCase() : "";
        return nome.includes(searchTerm);
      });
    }

    console.log("--- Produtos Restantes após filtro:", filteredProducts.length);

    if (filteredProducts.length === 0) {
      productListEl.innerHTML =
        "<p>Nenhum produto encontrado com esses filtros.</p>";
      return;
    }

    // --- CORREÇÃO CRÍTICA AQUI ---
    // Usamos insertAdjacentHTML para evitar o problema do appendChild(firstChild) pegando espaço vazio
    productListEl.innerHTML = ""; // Limpa a lista
    filteredProducts.forEach((product) => {
      console.log("Renderizando produto:", product.nome);
      const htmlDoCard = this.createProductCardHTML(product);
      productListEl.insertAdjacentHTML("beforeend", htmlDoCard);
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
    const nomeSeguro = product.nome || "Produto sem Nome";
    const precoSeguro = product.preco
      ? formatarMoeda(product.preco)
      : "R$ 0,00";
    const imagemSegura =
      product.imagemURL || "https://via.placeholder.com/150?text=Sem+Foto";
    const vendedorSeguro = product.ownerName || "Desconhecido";

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

  // --- FUNÇÕES RESTAURADAS COMPLETAS ---

  initAddProductForm: function (dependencies) {
    const formAffiliateLink = document.getElementById(
      "form-group-affiliate-link"
    );
    const userProfile = perfil.localProfileCache;

    // Se o usuário não for admin, esconde o campo de link de afiliado
    if (userProfile && userProfile.role !== "admin") {
      if (formAffiliateLink) formAffiliateLink.style.display = "none";
    }

    this.navegarPara = dependencies.navegarPara;
    const btnVoltar = $("btn-voltar-marketplace");
    if (btnVoltar) btnVoltar.onclick = () => this.navegarPara("marketplace");

    const form = $("form-add-product");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleAddProduct();
      });
    }
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
    const descricao = $("product-description").value.trim();

    let link;
    let tipo;

    if (isAdmin) {
      link = $("product-affiliate-link").value.trim();
      tipo = "afiliado";
      if (!link) return alert("Admin, por favor, insira o link de afiliado.");
    } else {
      if (!userProfile.telefone) {
        return alert(
          "Você precisa adicionar um número de telefone em seu perfil para poder anunciar!"
        );
      }
      const phone = userProfile.telefone.replace(/\D/g, "");
      link = `https://wa.me/55${phone}`;
      tipo = "contato_direto";
    }

    if (!nome || !preco || !imagemURL || !categoria) {
      return alert("Por favor, preencha todos os campos obrigatórios.");
    }

    const btn = $("btn-salvar-produto");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Salvando...";
    }

    const newProduct = {
      id: String(Date.now()),
      nome,
      descricao,
      preco,
      categoria,
      imagemURL,
      link,
      ownerId: userProfile.uid,
      ownerName: userProfile.nome,
      ownerAvatar: userProfile.avatar || "",
      tipo: tipo,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "produtos", newProduct.id), newProduct);
      alert("Produto adicionado com sucesso!");
      this.navegarPara("marketplace");
    } catch (error) {
      console.error("Erro ao adicionar produto:", error);
      alert("Ocorreu um erro ao salvar o produto.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Salvar Produto";
      }
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
        if (productId) this.handleDeleteProduct(productId);
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
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      await deleteDoc(doc(db, "produtos", productId));
      alert("Produto excluído com sucesso!");
      this.fetchAndDisplayProducts(true);
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
    const imagemSegura = product.imagemURL || "https://via.placeholder.com/300";

    const modalHTML = `
      <div class="modal-overlay" id="product-detail-modal">
        <div class="modal-conteudo product-modal">
          <span class="modal-fechar" id="product-modal-fechar">&times;</span>
          <img src="${imagemSegura}" alt="${
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
