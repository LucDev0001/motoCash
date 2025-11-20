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
    console.log("Marketplace: Iniciando...");
    this.navegarPara = dependencies.navegarPara;

    // Tenta buscar produtos imediatamente
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
    if (!productListEl) {
      console.error("Elemento 'product-list' não encontrado no HTML.");
      return;
    }

    productListEl.innerHTML = "<p>Carregando produtos...</p>";

    try {
      // CORREÇÃO 1: Removi temporariamente o orderBy para evitar erros se o campo 'createdAt' não existir.
      // Quando todos os seus produtos tiverem data, você pode descomentar a linha abaixo:
      // const q = query(collection(db, "produtos"), orderBy("createdAt", "desc"));

      const q = query(collection(db, "produtos"));

      // Usa o cache se disponível, a menos que a busca seja forçada
      if (this.allProductsCache.length === 0 || force) {
        console.log("Buscando produtos do Firestore...");
        const querySnapshot = await getDocs(q);
        console.log(`Firestore retornou ${querySnapshot.size} produtos.`); // DIAGNÓSTICO

        if (querySnapshot.empty) {
          productListEl.innerHTML =
            "<p>Nenhum produto encontrado no Banco de Dados.</p>";
          return;
        }

        // Converte os dados e o Timestamp do Firebase para um objeto Date do JS
        this.allProductsCache = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          // Adiciona o ID do documento aos dados para referência futura
          data.id = doc.id;

          // Verifica se o campo createdAt existe e é um Timestamp antes de converter
          if (data.createdAt && typeof data.createdAt.toDate === "function") {
            data.createdAt = data.createdAt.toDate();
          } else {
            // Fallback se não tiver data (para não quebrar a ordenação no futuro)
            data.createdAt = new Date();
          }
          return data;
        });
      }

      console.log("Produtos processados:", this.allProductsCache); // DIAGNÓSTICO
      this.filterAndDisplayProducts();
    } catch (error) {
      console.error("Erro CRÍTICO ao buscar produtos:", error);
      // Verifica se é erro de permissão
      if (error.code === "permission-denied") {
        productListEl.innerHTML =
          "<p>Erro de permissão. Verifique as regras do Firebase.</p>";
      } else {
        productListEl.innerHTML =
          "<p>Ocorreu um erro ao carregar os produtos.</p>";
      }
    }
  },

  filterAndDisplayProducts: function () {
    const productListEl = $("product-list");
    const searchInput = $("search-input");

    // Previne erro se o input não existir
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

    const activeCategoryEl = document.querySelector(".category-btn.active");
    const activeCategory = activeCategoryEl
      ? activeCategoryEl.dataset.category
      : "todos";

    let filteredProducts = this.allProductsCache;

    // Filtra por categoria
    if (activeCategory !== "todos") {
      filteredProducts = filteredProducts.filter(
        (p) => p.categoria === activeCategory
      );
    }

    // Filtra por busca
    if (searchTerm) {
      filteredProducts = filteredProducts.filter(
        (p) => p.nome && p.nome.toLowerCase().includes(searchTerm)
      );
    }

    // Log para debug se a lista estiver vazia
    if (filteredProducts.length === 0) {
      console.log(
        "Filtro retornou 0 produtos. Categoria:",
        activeCategory,
        "Busca:",
        searchTerm
      );
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
    // Fallback se não tiver imagem
    const imagemSegura =
      product.imagemURL || "https://via.placeholder.com/150?text=Sem+Imagem";

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
        <div class="product-image-container">
          <img src="${imagemSegura}" alt="${
      product.nome || "Produto"
    }" class="product-image">
        </div>
        <div class="product-info">
          <h4 class="product-name">${product.nome || "Sem Nome"}</h4>
          <p class="product-price">${formatarMoeda(product.preco || 0)}</p>
          <p class="product-owner">Vendido por: <strong>${
            product.ownerName || "Anônimo"
          }</strong></p>
        </div>
      </div>
    `;
  },

  initAddProductForm: function (dependencies) {
    const formAffiliateLink = document.getElementById(
      "form-group-affiliate-link"
    );
    const userProfile = perfil.localProfileCache;

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
    const nomeInput = $("product-name");
    const precoInput = $("product-price");
    const imgInput = $("product-image-url");
    const catInput = $("product-category");
    const descInput = $("product-description");
    const linkAfiliadoInput = $("product-affiliate-link");

    const nome = nomeInput ? nomeInput.value.trim() : "";
    const preco = precoInput ? parseFloat(precoInput.value) : 0;
    const imagemURL = imgInput ? imgInput.value.trim() : "";
    const categoria = catInput ? catInput.value : "";

    let link;
    let tipo;

    if (isAdmin) {
      link = linkAfiliadoInput ? linkAfiliadoInput.value.trim() : "";
      tipo = "afiliado";
      if (!link) return alert("Admin, por favor, insira o link de afiliado.");
    } else {
      if (!userProfile.telefone) {
        return alert(
          "Você precisa adicionar um número de telefone em seu perfil para poder anunciar! Vá em Perfil > Editar."
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
      // Não defina o ID manualmente se quiser que o Firebase gere.
      // Mas se quiser usar Date.now() como ID (não recomendado para produção, mas ok para teste):
      id: String(Date.now()),
      nome,
      descricao: descInput ? descInput.value.trim() : "",
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
      alert("Ocorreu um erro ao salvar o produto: " + error.message);
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
        // Pega o ID corretamente
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
