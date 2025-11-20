// js/firebase-config.js
// Este arquivo inicializa o Firebase e exporta os serviços para serem usados no app.

// Importa as funções necessárias do SDK do Firebase usando as URLs completas do CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDv_ZbrWZGmsdHSQ6oqfxNvJFKdPQRI8II",
  authDomain: "app-da-web-7d419.firebaseapp.com",
  projectId: "app-da-web-7d419",
  storageBucket: "app-da-web-7d419.firebasestorage.app",
  messagingSenderId: "398968396582",
  appId: "1:398968396582:web:a40503a0a03304e27b7fe7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias dos serviços do Firebase para serem usadas em outros arquivos
export const auth = getAuth(app); // Serviço de Autenticação
export const db = getFirestore(app); // Serviço do Banco de Dados (Firestore)
