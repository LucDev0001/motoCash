// Este arquivo será importado no admin.js para gerenciar a view de anúncios.

let db; // Instância do Firestore será injetada aqui

/**
 * Inicializa o módulo de anúncios com a instância do Firestore.
 * @param {firebase.firestore.Firestore} database - A instância do Firestore.
 */
export function initAds(database) {
  db = database;
}

/**
 * Ponto de entrada para renderizar a view de anúncios.
 * @param {HTMLElement} container - O elemento onde a view será renderizada.
 */
export async function renderAds(container) {
  const response = await fetch('ads.html');
  container.innerHTML = await response.text();
  
  // Inicia os listeners e a renderização da tabela
  listenForAds();
  
  // Configura os event listeners para os botões principais
  document.getElementById('add-new-ad-btn').addEventListener('click', () => openAdFormModal());
  document.getElementById('close-ad-form-btn').addEventListener('click', closeAdFormModal);
  document.getElementById('cancel-ad-form-btn').addEventListener('click', closeAdFormModal);
  document.getElementById('ad-form').addEventListener('submit', handleAdFormSubmit);

  lucide.createIcons();
}

/**
 * Configura o listener em tempo real para a coleção de anúncios.
 */
function listenForAds() {
  db.collection("advertisements").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
    const ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderAdsTable(ads);
  }, (error) => {
    console.error("Erro ao buscar anúncios:", error);
    document.getElementById('ads-table-body').innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Erro ao carregar dados.</td></tr>`;
  });
}

/**
 * Renderiza a tabela de anúncios com os dados do Firestore.
 * @param {Array} ads - A lista de documentos de anúncios.
 */
function renderAdsTable(ads) {
  const tableBody = document.getElementById('ads-table-body');
  if (!tableBody) return;

  if (ads.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-400">Nenhum anúncio criado ainda.</td></tr>`;
    return;
  }

  tableBody.innerHTML = ads.map(ad => {
    const isActive = ad.isActive === true;
    return `
      <tr class="text-sm text-gray-700 border-b">
        <td class="p-3 font-medium">${ad.title}</td>
        <td class="p-3">
          <span class="px-2 py-1 text-xs font-bold rounded-full ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
            ${isActive ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td class="p-3">${ad.views || 0}</td>
        <td class="p-3">${ad.clicks || 0}</td>
        <td class="p-3 flex items-center space-x-2">
          <button onclick="window.toggleAdStatus('${ad.id}', ${!isActive})" class="p-2 rounded-md hover:bg-gray-100" title="${isActive ? 'Desativar' : 'Ativar'}">
            <i data-lucide="${isActive ? 'toggle-right' : 'toggle-left'}" class="w-5 h-5 ${isActive ? 'text-green-500' : 'text-gray-400'}"></i>
          </button>
          <button onclick="window.openAdFormModal('${ad.id}')" class="p-2 rounded-md hover:bg-gray-100" title="Editar">
            <i data-lucide="edit" class="w-5 h-5 text-blue-500"></i>
          </button>
          <button onclick="window.deleteAd('${ad.id}')" class="p-2 rounded-md hover:bg-gray-100" title="Apagar">
            <i data-lucide="trash-2" class="w-5 h-5 text-red-500"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

/**
 * Abre o modal de formulário, opcionalmente preenchendo-o com dados de um anúncio existente.
 * @param {string|null} adId - O ID do anúncio para editar, ou null para criar um novo.
 */
async function openAdFormModal(adId = null) {
  const modal = document.getElementById('ad-form-modal');
  const form = document.getElementById('ad-form');
  const titleEl = document.getElementById('ad-form-title');
  form.reset();
  document.getElementById('ad-id').value = '';

  if (adId) {
    titleEl.textContent = 'Editar Anúncio';
    const doc = await db.collection("advertisements").doc(adId).get();
    if (doc.exists) {
        const data = doc.data();
        document.getElementById('ad-id').value = doc.id;
        document.getElementById('ad-title').value = data.title;
        document.getElementById('ad-content').value = data.content;
        document.getElementById('ad-image-url').value = data.imageUrl || '';
        document.getElementById('ad-target-link').value = data.targetLink;
    }
  } else {
    titleEl.textContent = 'Criar Novo Anúncio';
  }

  modal.classList.remove('hidden');
}

/**
 * Fecha o modal do formulário de anúncio.
 */
function closeAdFormModal() {
  const modal = document.getElementById('ad-form-modal');
  modal.classList.add('hidden');
}

/**
 * Lida com a submissão do formulário de anúncio.
 * @param {Event} event 
 */
async function handleAdFormSubmit(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const adData = {
    title: document.getElementById('ad-title').value,
    content: document.getElementById('ad-content').value,
    imageUrl: document.getElementById('ad-image-url').value,
    targetLink: document.getElementById('ad-target-link').value,
  };

  const adId = document.getElementById('ad-id').value;

  try {
    if (adId) {
      // Atualiza um anúncio existente
      adData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("advertisements").doc(adId).update(adData);
      alert('Anúncio atualizado com sucesso!');
    } else {
      // Cria um novo anúncio
      adData.isActive = false; // Começa como inativo por padrão
      adData.views = 0;
      adData.clicks = 0;
      adData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("advertisements").add(adData);
      alert('Anúncio criado com sucesso!');
    }
    closeAdFormModal();
  } catch (error) {
    console.error("Erro ao salvar anúncio:", error);
    alert('Erro ao salvar anúncio: ' + error.message);
  } finally {
    submitBtn.disabled = false;
  }
}

/**
 * Deleta um anúncio do Firestore.
 * @param {string} adId 
 */
async function deleteAd(adId) {
  if (confirm('Tem certeza que deseja apagar este anúncio? Esta ação não pode ser desfeita.')) {
    try {
      await db.collection("advertisements").doc(adId).delete();
      alert('Anúncio apagado com sucesso.');
    } catch (error) {
      console.error("Erro ao apagar anúncio:", error);
      alert('Erro ao apagar anúncio: ' + error.message);
    }
  }
}

/**
 * Ativa ou desativa um anúncio.
 * @param {string} adId 
 * @param {boolean} newStatus 
 */
async function toggleAdStatus(adId, newStatus) {
  try {
    await db.collection("advertisements").doc(adId).update({ isActive: newStatus });
  } catch (error) {
    console.error("Erro ao alterar status do anúncio:", error);
    alert('Erro ao alterar status: ' + error.message);
  }
}

// Expondo as funções que serão chamadas pelo HTML para o escopo da window
window.openAdFormModal = openAdFormModal;
window.deleteAd = deleteAd;
window.toggleAdStatus = toggleAdStatus;
