import { listenForMarketplaceItems } from "../api.js";
import { unsubscribeListeners } from "../ui.js";
import { currentUser } from "../auth.js";
import { router } from "../router.js";
import * as API from "../api.js";

export async function renderMarketplace(c) {
  c.innerHTML = await fetch("src/templates/views/market.html").then((res) =>
    res.text()
  );
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

function updateMarketplaceUI(items) {
  const listEl = document.getElementById("market-list");
  if (!listEl) return;

  listEl.innerHTML =
    items
      .map(
        (x) => ` 
        <div class="market-item bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700" data-title="${x.title.toLowerCase()}">
            ${
              x.image
                ? `<div class="h-48 bg-gray-200"><img src="${x.image}" class="w-full h-full object-cover"></div>`
                : ""
            }
            <div class="p-4">
                <h3 class="font-bold text-lg dark:text-gray-200">${x.title}</h3>
                <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-2">${
                  x.description
                }</p>
                <div class="mt-3 flex justify-between items-center">
                    <span class="text-xl font-bold text-green-600">R$ ${parseFloat(
                      x.price
                    ).toFixed(2)}</span>
                    ${
                      x.userId === currentUser.uid
                        ? `<button data-id="${x.id}" class="delete-market-item-btn text-red-500"><i data-lucide="trash-2"></i></button>`
                        : `<a href="https://wa.me/55${
                            x.whatsapp
                          }?text=${encodeURIComponent(
                            "Olá, vi seu anúncio " + x.title
                          )}" target="_blank" class="bg-green-500 text-white px-3 py-2 rounded font-bold text-sm flex gap-1"><i data-lucide="message-circle" class="w-4"></i> Zap</a>`
                    }
                </div>
            </div>
        </div>`
      )
      .join("") || '<p class="text-center text-gray-400">Sem anúncios.</p>';

  document.querySelectorAll(".delete-market-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => API.deleteMarketItem(btn.dataset.id));
  });
  lucide.createIcons();
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
  const term = document.getElementById("market-search").value.toLowerCase();
  document.querySelectorAll(".market-item").forEach((el) => {
    const title = el.getAttribute("data-title");
    el.style.display = title.includes(term) ? "flex" : "none";
  });
}
