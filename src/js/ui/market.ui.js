import { listenForMarketplaceItems } from "../api.js";
import { unsubscribeListeners, openModal, closeModal } from "../ui.js";
import { currentUser } from "../auth.js";
import { router } from "../router.js";
import * as API from "../api.js";

export async function renderMarketplace(c) {
  c.innerHTML = await fetch("src/templates/views/market.html").then((res) =>
    res.text()
  );

  // Adiciona o listener para abrir o modal de detalhes
  document
    .getElementById("market-list")
    .addEventListener("click", handleMarketItemClick);

  // Adiciona o listener para os filtros de categoria
  document
    .getElementById("market-category-filters")
    .addEventListener("click", handleCategoryFilterClick);

  const unsub = listenForMarketplaceItems(updateMarketplaceUI);
  unsubscribeListeners.push(unsub);
  setTimeout(() => lucide.createIcons(), 100);

  document
    .getElementById("market-search")
    .addEventListener("keyup", searchMarket);
  document
    .getElementById("market-add-btn")
    .addEventListener("click", () => router("market-add"));
}

let allMarketItems = []; // Armazena todos os itens para busca
let currentMarketCategory = "all"; // Estado do filtro atual

function updateMarketplaceUI(items) {
  const listEl = document.getElementById("market-list");
  if (!listEl) return;

  allMarketItems = items; // Atualiza a lista global

  // Filtra os itens pela categoria selecionada
  const filteredByCategory =
    currentMarketCategory === "all"
      ? allMarketItems
      : allMarketItems.filter(
          (item) => item.category === currentMarketCategory
        );

  // Filtra os itens pelo termo de busca
  const searchTerm = document
    .getElementById("market-search")
    .value.toLowerCase();
  const finalFilteredItems = searchTerm
    ? filteredByCategory.filter((item) =>
        item.title.toLowerCase().includes(searchTerm)
      )
    : filteredByCategory;

  if (finalFilteredItems.length === 0) {
    listEl.innerHTML =
      '<p class="text-center text-gray-400 col-span-2">Sem anúncios no momento.</p>';
    return;
  }

  listEl.innerHTML = finalFilteredItems
    .map((item) => renderMarketItemCard(item))
    .join("");
  lucide.createIcons();
}

function renderMarketItemCard(item) {
  const categoryMap = {
    peca: "Peça",
    acessorio: "Acessório",
    moto: "Moto",
    outro: "Outro",
  };

  return `
    <div data-id="${
      item.id
    }" class="market-item-card bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col cursor-pointer transform hover:scale-105 transition-transform duration-200">
      <div class="h-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
        ${
          item.image
            ? `<img src="${item.image}" class="h-full w-full object-cover" alt="${item.title}">`
            : `<i data-lucide="image-off" class="w-10 h-10 text-gray-400"></i>`
        }
      </div>
      <div class="p-3 flex flex-col flex-grow">
        <span class="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded-full self-start mb-2">${
          categoryMap[item.category] || "Indefinido"
        }</span>
        <h4 class="font-bold text-sm text-gray-800 dark:text-gray-100 flex-grow leading-tight">${
          item.title
        }</h4>
        <p class="text-lg font-extrabold text-green-600 dark:text-green-400 mt-2">R$ ${parseFloat(
          item.price
        ).toFixed(2)}</p>
      </div>
    </div>
  `;
}

function handleMarketItemClick(event) {
  const card = event.target.closest(".market-item-card");
  if (!card) return;

  const itemId = card.dataset.id;
  const item = allMarketItems.find((i) => i.id === itemId);

  if (item) {
    openMarketDetailModal(item);
  }
}

async function openMarketDetailModal(item) {
  const modal = await openModal("marketDetailModal");

  const categoryMap = {
    peca: "Peça",
    acessorio: "Acessório",
    moto: "Moto",
    outro: "Outro",
  };

  // Preenche os dados do modal
  modal.querySelector("#modal-market-image").innerHTML = item.image
    ? `<img src="${item.image}" class="h-full w-full object-cover" alt="${item.title}">`
    : `<i data-lucide="image-off" class="w-16 h-16 text-gray-400"></i>`;

  modal.querySelector("#modal-market-category").textContent =
    categoryMap[item.category] || "Indefinido";
  modal.querySelector("#modal-market-title").textContent = item.title;
  modal.querySelector("#modal-market-price").textContent = `R$ ${parseFloat(
    item.price
  ).toFixed(2)}`;
  modal.querySelector("#modal-market-description").textContent =
    item.description;
  // Mostra os botões corretos (contato ou edição/exclusão)
  const contactBtn = modal.querySelector("#modal-market-contact-btn");
  const ownerActions = modal.querySelector("#modal-market-owner-actions");

  if (item.userId === currentUser.uid) {
    // É o dono do anúncio
    contactBtn.classList.add("hidden");
    ownerActions.classList.remove("hidden");

    modal.querySelector("#modal-market-edit-btn").onclick = () => {
      openMarketEditModal(item);
    };
    modal.querySelector("#modal-market-delete-btn").onclick = () => {
      API.deleteMarketItem(item.id);
      closeModal();
    };
  } else {
    // Não é o dono
    contactBtn.classList.remove("hidden");
    ownerActions.classList.add("hidden");
    const whatsappLink = `https://wa.me/55${
      item.whatsapp
    }?text=${encodeURIComponent(
      `Olá, vi seu anúncio "${item.title}" no AppMotoCash e tenho interesse.`
    )}`;
    contactBtn.href = whatsappLink;
  }

  lucide.createIcons();
}

async function openMarketEditModal(item) {
  await router("market-add"); // Reutiliza a tela de adicionar

  // Preenche o formulário com os dados do item
  document.getElementById("ad-form-title").textContent = "Editar Anúncio";
  document.getElementById("ad-submit-btn").textContent = "Salvar Alterações";
  document.getElementById("ad-id").value = item.id;
  document.getElementById("ad-title").value = item.title;
  document.getElementById("ad-price").value = item.price;
  document.getElementById("ad-cat").value = item.category;
  document.getElementById("ad-desc").value = item.description;
  document.getElementById("ad-img").value = item.image || "";
  document.getElementById("ad-zap").value = item.whatsapp;
}

function handleCategoryFilterClick(event) {
  const button = event.target.closest(".market-filter-btn");
  if (!button) return;

  // Atualiza o estado do filtro
  currentMarketCategory = button.dataset.category;

  // Atualiza a aparência dos botões
  document.querySelectorAll(".market-filter-btn").forEach((btn) => {
    btn.classList.remove("bg-yellow-500", "text-black");
    btn.classList.add(
      "bg-white",
      "dark:bg-gray-700",
      "text-gray-600",
      "dark:text-gray-300"
    );
  });
  button.classList.add("bg-yellow-500", "text-black");
  button.classList.remove("bg-white", "dark:bg-gray-700");

  // Re-renderiza a lista com o filtro aplicado
  updateMarketplaceUI(allMarketItems);
}

export async function renderAddMarketItem(c) {
  c.innerHTML = await fetch("src/templates/views/market-add.html").then((res) =>
    res.text()
  );
  document.getElementById("ad-form").addEventListener("submit", API.submitAd);
  document
    .getElementById("ad-cancel-btn")
    .addEventListener("click", () => router("market"));
}

export function searchMarket() {
  // Em vez de manipular o DOM, apenas chamamos a função de atualização.
  // Ela já lê o valor da busca e aplica o filtro.
  updateMarketplaceUI(allMarketItems);
}
