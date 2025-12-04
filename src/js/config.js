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

const firestore = firebase.firestore();

// Nova forma de habilitar a persistência, evitando o warning de depreciação.
// Nova forma de habilitar a persistência, evitando o warning de depreciação.
firestore
  .enablePersistence({ synchronizeTabs: true })
  .then(() => {
    console.log("Persistência do Firestore habilitada com sucesso.");
  })
  .catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn(
        "Múltiplas abas abertas, a persistência pode não funcionar como esperado."
      );
    } else if (err.code === "unimplemented") {
      console.warn("O navegador atual não suporta persistência offline.");
    }
  });

let auth;
// Inicializa o auth apenas se a função existir, evitando erros em páginas que não o carregam.
if (typeof firebase.auth === "function") {
  auth = firebase.auth();
}

export { firestore as db }; // Exporta como 'db' para manter a compatibilidade com o resto do código.
export { auth };
export const appId = "moto-manager-v1";
