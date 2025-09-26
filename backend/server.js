// 1. Importar o framework Express
const express = require("express");

// 2. Inicializar o Express
const app = express();

// 3. Definir a porta em que o servidor vai rodar
// A porta 3000 é comumente usada para desenvolvimento local
const PORT = 3000;

// 4. Criar uma rota de teste (rota raiz)
// Quando alguém acessar o endereço principal da nossa API (http://localhost:3000/)
// esta função será executada.
app.get("/", (req, res) => {
  // req = requisição (dados que vêm do cliente)
  // res = resposta (o que o servidor vai enviar de volta)

  // Estamos enviando uma resposta no formato JSON
  res.json({ message: "API do MotoCash está no ar! Bem-vindo!" });
});

// 5. Iniciar o servidor para que ele comece a "ouvir" por requisições na porta definida
app.listen(PORT, () => {
  console.log(`Servidor rodando com sucesso na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT} no seu navegador para testar.`);
});
