document.addEventListener("DOMContentLoaded", () => {
  // Elementos da UI da tela de Ganhos
  const fabMainButton = document.getElementById("fab-main-button");
  const fabOptions = document.querySelector(".fab-options");

  const filtroPeriodo = document.getElementById("filtro-periodo");
  const filtroDatasPersonalizadas = document.getElementById(
    "filtro-datas-personalizadas"
  );
  const filtroCategoriasChips = document.getElementById("filtro-categorias");
  const btnAplicarFiltros = document.getElementById("btn-aplicar-filtros");
  const btnLimparFiltros = document.getElementById("btn-limpar-filtros");

  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");
  const listaGanhosGeral = document.getElementById("listaGanhos");

  // --- Lógica do Botão de Ação Flutuante (FAB) ---
  if (fabMainButton) {
    fabMainButton.addEventListener("click", () => {
      fabOptions.classList.toggle("active");
      fabMainButton.classList.toggle("active");
    });

    // Fecha o menu se clicar fora
    document.addEventListener("click", (e) => {
      if (!fabMainButton.contains(e.target) && !fabOptions.contains(e.target)) {
        fabOptions.classList.remove("active");
        fabMainButton.classList.remove("active");
      }
    });
  }

  // --- Lógica dos Filtros Avançados ---

  // Mostrar/ocultar datas personalizadas
  if (filtroPeriodo) {
    filtroPeriodo.addEventListener("change", () => {
      if (filtroPeriodo.value === "personalizado") {
        filtroDatasPersonalizadas.style.display = "flex";
      } else {
        filtroDatasPersonalizadas.style.display = "none";
      }
    });
  }

  // Lógica de seleção das categorias (chips)
  if (filtroCategoriasChips) {
    filtroCategoriasChips.addEventListener("click", (e) => {
      const target = e.target.closest(".chip-categoria");
      if (!target) return;

      const categoria = target.dataset.categoria;
      const todosChip = filtroCategoriasChips.querySelector(
        '[data-categoria="todos"]'
      );

      if (categoria === "todos") {
        // Se clicar em "Todos", ativa ele e desativa os outros
        filtroCategoriasChips
          .querySelectorAll(".chip-categoria")
          .forEach((chip) => chip.classList.remove("active"));
        target.classList.add("active");
      } else {
        // Se clicar em outra categoria, desativa "Todos"
        todosChip.classList.remove("active");
        target.classList.toggle("active");

        // Se nenhuma outra categoria estiver ativa, reativa "Todos"
        const algumaAtiva = filtroCategoriasChips.querySelector(
          ".chip-categoria.active:not([data-categoria='todos'])"
        );
        if (!algumaAtiva) {
          todosChip.classList.add("active");
        }
      }
    });
  }

  // Ação de aplicar filtros
  if (btnAplicarFiltros) {
    btnAplicarFiltros.addEventListener("click", () => {
      // Aqui você chamaria a função principal que busca e renderiza os ganhos
      // passando os valores dos filtros como parâmetros.
      // Ex: carregarEExibirGanhos(obterFiltros());
      console.log("Aplicando filtros:", obterFiltros());
      alert("Lógica de aplicação de filtros a ser implementada!");
      // Após filtrar, você deve atualizar o resumo e as listas nas abas.
    });
  }

  // Ação de limpar filtros
  if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener("click", () => {
      filtroPeriodo.value = "esta-semana";
      filtroDatasPersonalizadas.style.display = "none";
      document.getElementById("filtro-data-inicio").value = "";
      document.getElementById("filtro-data-fim").value = "";

      // Reseta as categorias para "Todos"
      filtroCategoriasChips
        .querySelectorAll(".chip-categoria")
        .forEach((chip) => chip.classList.remove("active"));
      filtroCategoriasChips
        .querySelector('[data-categoria="todos"]')
        .classList.add("active");

      // Dispara a aplicação dos filtros padrão
      btnAplicarFiltros.click();
      console.log("Filtros limpos e redefinidos para o padrão.");
    });
  }

  /**
   * Função auxiliar para obter os valores atuais dos filtros.
   * @returns {object} Objeto com os filtros selecionados.
   */
  function obterFiltros() {
    const categoriasAtivas = [
      ...filtroCategoriasChips.querySelectorAll(".chip-categoria.active"),
    ].map((chip) => chip.dataset.categoria);

    return {
      periodo: filtroPeriodo.value,
      dataInicio: document.getElementById("filtro-data-inicio").value,
      dataFim: document.getElementById("filtro-data-fim").value,
      categorias: categoriasAtivas.includes("todos") ? [] : categoriasAtivas, // Se "todos" está ativo, retorna array vazio para não filtrar por categoria
    };
  }

  // --- Lógica da Navegação por Abas ---
  if (tabLinks.length > 0) {
    // Move a lista principal para dentro da primeira aba
    const tabTodosContent = document.getElementById("tab-todos");
    if (tabTodosContent && listaGanhosGeral) {
      tabTodosContent.appendChild(listaGanhosGeral);
    }

    tabLinks.forEach((tab) => {
      tab.addEventListener("click", () => {
        // Remove a classe 'active' de todas as abas e conteúdos
        tabLinks.forEach((link) => link.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));

        // Adiciona 'active' à aba clicada e ao conteúdo correspondente
        tab.classList.add("active");
        const tabId = tab.dataset.tab;
        const activeTabContent = document.getElementById(tabId);
        if (activeTabContent) {
          activeTabContent.classList.add("active");
        }

        // Aqui você chamaria uma função para renderizar o conteúdo da aba
        // com base nos dados já filtrados.
        // Ex: renderizarConteudoAba(tabId, dadosFiltrados);
        console.log(`Aba ${tabId} ativada.`);
      });
    });
  }

  /**
   * Exemplo de como você poderia distribuir os ganhos nas abas após o filtro.
   * Esta função deve ser chamada após a aplicação dos filtros.
   * @param {Array} ganhosFiltrados - A lista de ganhos já filtrada.
   */
  function distribuirGanhosNasAbas(ganhosFiltrados) {
    // Limpa todas as listas antes de preencher
    listaGanhosGeral.innerHTML = ""; // Aba "Todos"
    document.getElementById("tab-loja").innerHTML =
      '<ul class="lista-ganhos-moderna"></ul>';
    document.getElementById("tab-passageiros").innerHTML =
      '<ul class="lista-ganhos-moderna"></ul>';
    document.getElementById("tab-entregas").innerHTML =
      '<ul class="lista-ganhos-moderna"></ul>';

    const listaLoja = document.querySelector("#tab-loja .lista-ganhos-moderna");
    const listaPassageiros = document.querySelector(
      "#tab-passageiros .lista-ganhos-moderna"
    );
    const listaEntregas = document.querySelector(
      "#tab-entregas .lista-ganhos-moderna"
    );

    ganhosFiltrados.forEach((ganho) => {
      // Supondo que você tenha uma função `criarElementoGanhoHTML(ganho)`
      const elementoGanhoHTML = criarElementoGanhoHTML(ganho);

      // Adiciona a todas as listas relevantes
      listaGanhosGeral.insertAdjacentHTML("beforeend", elementoGanhoHTML);

      switch (ganho.categoria) {
        case "loja_fixa":
          listaLoja.insertAdjacentHTML("beforeend", elementoGanhoHTML);
          break;
        case "passageiros":
          listaPassageiros.insertAdjacentHTML("beforeend", elementoGanhoHTML);
          break;
        case "entregas":
          listaEntregas.insertAdjacentHTML("beforeend", elementoGanhoHTML);
          break;
      }
    });

    // Exibe mensagem se uma lista estiver vazia
    [listaGanhosGeral, listaLoja, listaPassageiros, listaEntregas].forEach(
      (lista) => {
        if (!lista.hasChildNodes()) {
          lista.innerHTML =
            '<li class="item-vazio">Nenhum ganho encontrado para esta categoria no período selecionado.</li>';
        }
      }
    );
  }
});
