<?php

// ========== 1. LISTA DE MOTOS ==========
$motos = [
    'Honda CG 160 Start',
    'Honda CG 160 Fan',
    'Honda CG 160 Titan',
    'Honda Bros 160',
    'Honda XRE 300',
    'Honda XRE 190',
    'Honda Biz 125',
    'Honda Biz 110i',
    'Honda PCX 150',
    'Honda CB Twister 250',
    'Yamaha Factor 125',
    'Yamaha Factor 150',
    'Yamaha Fazer 150',
    'Yamaha Fazer 250',
    'Yamaha Crosser 150',
    'Yamaha NMAX 160',
    'Yamaha Neo 125',
    'Haojue DK 150',
    'Haojue Chopper Road'
];

// ========== 2. Templates ==========
$templates = [
    [
        'id' => 'oleo',
        'category' => 'manutencao',
        'q' => 'Qual o óleo recomendado para a {moto}?',
        'a' => '<p>Para a <b>{moto}</b>, recomenda-se verificar o manual do proprietário.</p><p>Honda usa geralmente <b>10W30</b>; Yamaha <b>10W40</b> (Yamalube).</p>',
        'k' => 'oleo, motor, lubrificante'
    ],
    [
        'id' => 'pneu_calibragem',
        'category' => 'pneus',
        'q' => 'Qual a calibragem do pneu da {moto}?',
        'a' => '<p><b>Dianteiro:</b> 25–28 PSI<br><b>Traseiro:</b> 29–33 PSI.</p>',
        'k' => 'pneu, calibragem, libras'
    ],
    [
        'id' => 'nao_liga',
        'category' => 'eletrica',
        'q' => 'A {moto} não está ligando, o que fazer?',
        'a' => '<p>Verifique corta-corrente, descanso lateral e carga da bateria.</p>',
        'k' => 'partida, eletrica, bateria'
    ],
    [
        'id' => 'corrente',
        'category' => 'manutencao',
        'q' => 'De quanto em quanto tempo estico a corrente da {moto}?',
        'a' => '<p>Folga ideal: 2–3 cm. Verifique semanalmente.</p>',
        'k' => 'corrente, relacao, folga'
    ],
    [
        'id' => 'vela',
        'category' => 'manutencao',
        'q' => 'Qual a vela de ignição da {moto}?',
        'a' => '<p>Troque a vela a cada 10.000–12.000 km.</p>',
        'k' => 'vela, ignicao'
    ],
    [
        'id' => 'consumo',
        'category' => 'consumo',
        'q' => 'Quanto consome uma {moto} por litro?',
        'a' => '<p>Média: 30–40 km/l em trabalho. Menos de 25 km/l indica revisão.</p>',
        'k' => 'consumo, gasolina, km/l'
    ],
    [
        'id' => 'kit_relacao',
        'category' => 'pecas',
        'q' => 'Qual o valor do kit relação da {moto}?',
        'a' => '<p>Prefira marcas DID, KMC ou Riffel com retentor.</p>',
        'k' => 'relacao, peca, preco'
    ],
    [
        'id' => 'suspensao',
        'category' => 'suspensao',
        'q' => 'Barulho na suspensão dianteira da {moto}',
        'a' => '<p>Veja nível do óleo das bengalas e folga da caixa de direção.</p>',
        'k' => 'suspensao, barulho, bengala'
    ]
];

// ========== 3. Tópicos Gerais ==========
$general = [
    [
        'id' => 'andar_corredor',
        'category' => 'transito',
        'question' => 'Posso andar no corredor?',
        'answer' => '<p>Sim, mas com velocidade reduzida e segurança.</p>',
        'keywords' => 'corredor, transito, lei'
    ],
    [
        'id' => 'multa_viseira',
        'category' => 'transito',
        'question' => 'Multa de viseira aberta valores',
        'answer' => '<p>Infração média: R$ 130,16 e 4 pontos.</p>',
        'keywords' => 'viseira, multa'
    ]
];

// ========== 4. Montar estrutura final ==========
$saida = [
    'general' => $general,
    'motos' => []
];

foreach ($motos as $moto) {

    $dadosMoto = [
        'model' => $moto,
        'slug' => strtolower(str_replace(' ', '_', $moto)),
        'data' => []
    ];

    foreach ($templates as $tpl) {

        // Monta lista de keywords incluindo nome da moto
        $keywordsMoto = strtolower($moto . ', ' . $tpl['k']);

        $dadosMoto['data'][] = [
            'id' => $tpl['id'] . '_' . $dadosMoto['slug'],
            'category' => $tpl['category'],
            'question' => str_replace('{moto}', $moto, $tpl['q']),
            'answer' => str_replace('{moto}', $moto, $tpl['a']),
            'keywords' => $keywordsMoto
        ];
    }

    $saida['motos'][] = $dadosMoto;
}

// ========== 5. Preparar o Output ==========
$jsonOutput = json_encode($saida, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

?>

<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gerador de Conhecimento - Graxa</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>

<body class="bg-gray-100 p-8">
    <div class="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <div class="flex justify-between items-center mb-4">
            <h1 class="text-2xl font-bold text-gray-800">Gerador de Conhecimento da Assistente Graxa</h1>
            <button id="save-btn" class="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Salvar JSON
            </button>
        </div>
        <p class="text-gray-600 mb-4">O JSON abaixo foi gerado com sucesso. Clique no botão para fazer o download do arquivo e importá-lo no painel de admin.</p>
        <textarea readonly class="w-full h-96 p-4 border rounded-md bg-gray-50 font-mono text-xs"><?php echo htmlspecialchars($jsonOutput); ?></textarea>
    </div>

    <script>
        document.getElementById('save-btn').addEventListener('click', () => {
            // Pega o conteúdo JSON diretamente do PHP embutido no script
            const jsonData = <?php echo json_encode($saida, JSON_UNESCAPED_UNICODE); ?>;

            // Converte o objeto JavaScript para uma string JSON formatada
            const jsonString = JSON.stringify(jsonData, null, 2);

            // Cria um "Blob", que é um objeto semelhante a um arquivo
            const blob = new Blob([jsonString], {
                type: 'application/json'
            });

            // Cria uma URL temporária para o Blob
            const url = URL.createObjectURL(blob);

            // Cria um link de download invisível
            const a = document.createElement('a');
            a.href = url;
            a.download = 'conhecimento_graxa.json'; // Nome do arquivo

            // Adiciona o link ao corpo do documento e simula um clique
            document.body.appendChild(a);
            a.click();

            // Limpa, removendo o link e a URL temporária
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    </script>

</body>

</html>