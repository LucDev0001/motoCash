// js/toast.js

/**
 * Exibe uma notificação toast na tela.
 * @param {string} message A mensagem a ser exibida.
 * @param {string} [type='info'] O tipo de toast ('info', 'success', 'error', 'warning').
 * @param {number} [duration=3000] A duração em milissegundos que o toast ficará visível.
 */
export function showToast(message, type = "info", duration = 3000) {
  // Procura o container de toasts, ou cria um se não existir.
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }

  // Cria o elemento do toast
  const toastElement = document.createElement("div");
  toastElement.className = `toast-message ${type}`;
  toastElement.textContent = message;

  // Adiciona o toast ao container
  toastContainer.appendChild(toastElement);

  // Força um reflow para garantir que a animação de entrada funcione
  // e então adiciona a classe 'show' para iniciar a transição.
  requestAnimationFrame(() => {
    toastElement.classList.add("show");
  });

  // Define um timer para remover o toast
  setTimeout(() => {
    // Remove a classe 'show' para iniciar a animação de saída
    toastElement.classList.remove("show");

    // Adiciona um listener para o final da transição para remover o elemento do DOM
    toastElement.addEventListener(
      "transitionend",
      () => {
        if (toastElement.parentElement) {
          toastElement.parentElement.removeChild(toastElement);
        }
      },
      { once: true }
    ); // Garante que o evento seja executado apenas uma vez
  }, duration);
}
