// js/main.js
// Ponto de entrada do aplicativo. Gerencia a navegação e a inicialização.

import { auth } from './auth.js';
import { ganhos } from './ganhos.js';
import { perfil } from './perfil.js';
import { relatorios } from './reports.js';
import { weather } from './weather.js';
import { storage } from './storage.js';
import { $ } from './utils.js';

const appContent = $('app-content');
const bottomBar = $('bottomBar');

// Mapeia o nome da página para seu arquivo de template e função de inicialização
const pages = {
    'login': {
        file: 'templates/login.html',
        init: () => auth.init({ navegarPara }) // Passa a função de navegação para o módulo
    },
    'inicio': {
        file: 'templates/inicio.html',
        init: () => {
            // Inicializa os módulos necessários APENAS para a tela de início
            perfil.atualizarUI(); // Para a mensagem de "Olá"
            ganhos.atualizarTelaInicio();
            relatorios.init({ ganhos }); // Passa o módulo de ganhos para relatórios
            relatorios.atualizarGraficos();
            weather.getAndDisplayDetailedWeather();
        }
    },
    'ganhos': {
        file: 'templates/ganhos.html',
        init: () => {
            ganhos.init({ relatorios }); // Passa o módulo de relatórios
            ganhos.atualizarUI();
            relatorios.init({ ganhos }); // Garante que os botões de compartilhar funcionem
        }
    },
    'perfil': {
        file: 'templates/perfil.html',
        init: () => {
            perfil.init({ navegarPara }); // Adiciona eventos aos formulários de perfil
            perfil.atualizarUI();
        }
    }
};

// Função principal que carrega o HTML de uma página e executa seus scripts
async function navegarPara(pageName) {
    const page = pages[pageName];
    if (!page) return console.error(`Página "${pageName}" não encontrada.`);

    try {
        const response = await fetch(page.file);
        if (!response.ok) throw new Error(`Falha ao buscar ${page.file}`);
        
        appContent.innerHTML = await response.text();
        page.init(); // Roda a inicialização específica da página DEPOIS que o HTML foi inserido
    } catch (err) {
        console.error(`Erro ao carregar a página ${pageName}:`, err);
        appContent.innerHTML = '<p style="text-align: center; color: red;">Erro ao carregar conteúdo. Tente recarregar a página.</p>';
    }
}

// Carrega e exibe o modal do Telegram
async function checarEExibirModalTelegram() {
    if (localStorage.getItem("avisoTelegramVisto")) return;

    try {
        const response = await fetch('templates/modal.html');
        document.body.insertAdjacentHTML('beforeend', await response.text());
        
        const modal = $('modal-telegram');
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("ativo"), 10);

        const fecharModal = () => {
            modal.classList.remove("ativo");
            setTimeout(() => modal.remove(), 300);
            localStorage.setItem("avisoTelegramVisto", "true");
        };

        $('modal-fechar').onclick = fecharModal;
        $('btn-agora-nao').onclick = fecharModal;
        $('btn-entrar-telegram').onclick = fecharModal;
        modal.addEventListener("click", (e) => {
            if (e.target === modal) fecharModal();
        });
    } catch(err) {
        console.error("Erro ao carregar o modal:", err);
    }
}


// Configura os elementos que existem sempre, como a barra de navegação
function setupPermanentUI() {
    $('btnNavInicio').onclick = () => navegarPara('inicio');
    $('btnNavGanhos').onclick = () => navegarPara('ganhos');
    $('btnNavPerfil').onclick = () => navegarPara('perfil');

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/service-worker.js")
              .then(reg => console.log('Service worker registrado.'))
              .catch(err => console.error('Erro ao registrar service worker:', err));
        });
    }
}

// Função de inicialização principal do aplicativo
function initApp() {
    setupPermanentUI();
    
    if (storage.getUsuarioLogado()) {
        bottomBar.style.display = 'flex';
        navegarPara('inicio');
        checarEExibirModalTelegram();
    } else {
        bottomBar.style.display = 'none';
        navegarPara('login');
    }
}

document.addEventListener("DOMContentLoaded", initApp);

