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

// Habilita a persistência offline do Firestore
firebase
  .firestore()
  .enablePersistence()
  .catch((err) => {
    if (err.code == "failed-precondition") {
      // Múltiplas abas abertas podem causar isso.
    } else if (err.code == "unimplemented") {
      // O navegador não suporta a persistência.
    }
  });

export const auth = firebase.auth();
export const db = firebase.firestore();
export const appId = "moto-manager-v1";
