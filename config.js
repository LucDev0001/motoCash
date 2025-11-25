// ======================================================
// ⚠️ SUAS CHAVES FIREBASE AQUI ⚠️
// ======================================================
const firebaseConfig = {
  apiKey: "AIzaSyDv_ZbrWZGmsdHSQ6oqfxNvJFKdPQRI8II",
  authDomain: "app-da-web-7d419.firebaseapp.com",
  projectId: "app-da-web-7d419",
  storageBucket: "app-da-web-7d419.firebasestorage.app",
  messagingSenderId: "398968396582",
  appId: "1:398968396582:web:a40503a0a03304e27b7fe7",
  measurementId: "G-GE1VWW7VY4",
};
// ======================================================

firebase.initializeApp(firebaseConfig);

// Inicializa os serviços do Firebase
const db = firebase.firestore();
const auth = firebase.auth();

// Tenta habilitar a persistência offline com a sintaxe mais moderna para o SDK compatível.
// Isso resolve o aviso "enableMultiTabIndexedDbPersistence() will be deprecated".
try {
  db.settings({
    cache: new firebase.firestore.PersistentCacheSettings({
      synchronizeTabs: true,
    }),
  });
  console.log("Persistência offline multi-tab configurada com sucesso.");
} catch (err) {
  if (err.code == "failed-precondition") {
    console.warn(
      "Persistência offline falhou: múltiplas abas abertas. Feche outras abas e recarregue."
    );
  } else if (err.code == "unimplemented") {
    console.warn(
      "Persistência offline não suportada neste navegador. Os dados não serão salvos offline."
    );
  }
}

export { db };
export { auth };
export const appId = "moto-manager-v1";
