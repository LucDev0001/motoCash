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

let db;
try {
  // Nova forma de inicializar o Firestore com persistência offline
  db = firebase.firestore();
  firebase.firestore().settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    experimentalForceLongPolling: true, // Ajuda a evitar alguns avisos no console
  });
  db.enablePersistence({ synchronizeTabs: true });
} catch (err) {
  console.error("Erro ao habilitar a persistência do Firestore:", err.code);
  db = firebase.firestore(); // Fallback para inicialização sem persistência
}

let auth;
// Inicializa o auth apenas se a função existir, evitando erros em páginas que não o carregam.
if (typeof firebase.auth === "function") {
  auth = firebase.auth();
}

export { db };
export { auth };
export const appId = "moto-manager-v1";
