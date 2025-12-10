import { db, appId } from "../config.js";
import { currentUser } from "../auth.js";
import { closeModal } from "../ui.js";

/**
 * Busca e exibe um anúncio em formato de modal com contagem regressiva.
 */
export async function showAdModal() {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  try {
    // **NOVO: Verifica se o usuário é Apoiador antes de exibir o anúncio**
    if (currentUser) {
      const userDoc = await db.collection("artifacts").doc(appId).collection("users").doc(currentUser.uid).get();
      if (userDoc.exists && userDoc.data().isPro === true) {
        console.log("Usuário Apoiador. Anúncio não será exibido.");
        return; // Não exibe anúncio para Apoiadores
      }
    }

    // 1. Busca um anúncio aleatório e ativo
    const key = db.collection("advertisements").doc().id;
    let adSnap = await db.collection("advertisements")
      .where('isActive', '==', true)
      .where(window.firebase.firestore.FieldPath.documentId(), '>=', key)
      .limit(1)
      .get();

    if (adSnap.empty) {
      adSnap = await db.collection("advertisements")
        .where('isActive', '==', true)
        .limit(1)
        .get();
    }
    
    if (adSnap.empty) {
      console.log("Nenhum anúncio ativo encontrado.");
      return;
    }

    const adDoc = adSnap.docs[0];
    const adData = adDoc.data();
    const adId = adDoc.id;

    // 2. Incrementa a contagem de visualizações
    adDoc.ref.update({ views: window.firebase.firestore.FieldValue.increment(1) });

    // 3. Renderiza o modal
    modalContainer.innerHTML = await fetch("src/templates/modals/adModal.html").then(res => res.text());

    // 4. Popula o modal com os dados do anúncio
    document.getElementById("ad-modal-title").textContent = adData.title;
    document.getElementById("ad-modal-content-text").textContent = adData.content;
    const imgElement = document.getElementById("ad-modal-image");
    if (adData.imageUrl) {
        imgElement.src = adData.imageUrl;
    } else {
        imgElement.style.display = 'none'; // Esconde a imagem se não houver URL
    }
    
    // 5. Lógica do Modal e Contagem Regressiva
    let countdown = 5;
    const countdownEl = document.getElementById('ad-countdown');
    const adModalContent = document.getElementById('ad-modal-content');
    const closeBtn = document.getElementById('close-ad-modal-btn');

    const interval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(interval);
            closeModal();
        }
    }, 1000);

    const closeAndClear = () => {
        clearInterval(interval);
        closeModal();
    };

    closeBtn.addEventListener('click', closeAndClear);
    
    adModalContent.addEventListener('click', () => {
        // Incrementa cliques, abre o link e fecha o modal
        adDoc.ref.update({ clicks: window.firebase.firestore.FieldValue.increment(1) });
        window.open(adData.targetLink, '_blank');
        closeAndClear();
    });

    lucide.createIcons();

  } catch (error) {
    console.error("Erro ao exibir modal de anúncio:", error);
  }
}
