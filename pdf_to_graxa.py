import pdfplumber
import json
import os
import re
import google.generativeai as genai

import argparse # NOVO: Para lidar com argumentos de linha de comando
# --- CONFIGURAÇÃO DA API ---
# 1. Obtenha sua chave de API em: https://aistudio.google.com/app/apikey
# 2. Cole a chave abaixo.
GOOGLE_API_KEY = "AIzaSyBvkdwSuskY2Mg4sFntKTNF0XglcYnxMBQ"

if GOOGLE_API_KEY == "SUA_API_KEY_AQUI":
    print("🚨 ATENÇÃO: Configure sua GOOGLE_API_KEY no script para continuar.")
    exit()

genai.configure(api_key=GOOGLE_API_KEY)


def clean_text(text):
    """Limpa espaços extras e quebras de linha desnecessárias."""
    if not text:
        return ""
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # Junta palavras quebradas
    text = re.sub(r"\s+", " ", text)  # Remove espaços e quebras de linha extras
    return text


def generate_qa_from_text(text, moto_name):
    """Usa a IA para gerar perguntas e respostas a partir do texto do manual."""
    print("\n🤖 Enviando texto para a IA gerar as perguntas e respostas...")
    print("   (Isso pode levar alguns minutos, dependendo do tamanho do manual)")

    # Usa um modelo mais recente e estável.
    model = genai.GenerativeModel("gemini-2.5-flash-latest")

    prompt = f"""
    Analise o seguinte texto extraído de um manual da motocicleta '{moto_name}'.
    Sua tarefa é criar um conjunto de perguntas e respostas úteis para um motociclista,
    baseado estritamente nas informações do texto.

    REGRAS:
    1.  Crie perguntas claras e diretas que um usuário faria.
    2.  As respostas devem ser concisas, em HTML (usando tags <p>, <ul>, <li>, <strong>), e baseadas APENAS no texto fornecido.
    3.  Para cada item, gere uma lista de 'keywords' (palavras-chave) em minúsculas, separadas por vírgula, relacionadas à pergunta e ao nome da moto.
    4.  O resultado final deve ser um JSON válido, contendo uma lista de objetos, sem formatação Markdown ao redor.
    5.  Não invente informações que não estão no texto.

    EXEMPLO DE SAÍDA:
    [
      {{
        "question": "Qual o óleo recomendado para a {moto_name}?",
        "answer": "<p>O óleo recomendado é o <strong>SAE 10W-40</strong>.</p>",
        "keywords": "oleo, óleo, motor, troca, recomendado, 10w40, {moto_name}"
      }},
      {{
        "question": "Qual a calibragem do pneu da {moto_name}?",
        "answer": "<p>A pressão correta é:</p><ul><li><strong>Pneu Dianteiro:</strong> 29 psi.</li><li><strong>Pneu Traseiro:</strong> 33 psi.</li></ul>",
        "keywords": "pneu, calibragem, libras, pressao, psi, {moto_name}"
      }}
    ]

    TEXTO DO MANUAL PARA ANÁLISE:
    ---
    {text}
    ---
    """

    try:
        response = model.generate_content(prompt)
        # Limpa a resposta da IA para garantir que seja um JSON válido
        json_text = response.text.strip().replace("```json", "").replace("```", "")
        return json.loads(json_text)
    except json.JSONDecodeError as e:
        print(f"❌ Erro ao decodificar a resposta JSON da IA: {e}")
        print("   Resposta recebida (pode ajudar a depurar):", response.text)
        return None
    except Exception as e:
        print(f"❌ Erro ao comunicar com a API do Gemini: {e}")
        return None


def process_pdf_and_generate_json(pdf_path, moto_name, output_filename):
    print(f"🔄 Processando manual: {moto_name}...")

    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = ""
            print("   📄 Extraindo texto de todas as páginas...")
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    full_text += clean_text(page_text) + "\n"

        if not full_text:
            print("❌ Não foi possível extrair texto do PDF.")
            return

        # Gera o JSON usando a IA
        qa_data = generate_qa_from_text(full_text, moto_name)

        if qa_data:
            with open(output_filename, "w", encoding="utf-8") as f:
                json.dump(qa_data, f, ensure_ascii=False, indent=2)
            print(f"\n✨ Sucesso! Arquivo gerado: {output_filename}")
            print(f"📂 Mova este arquivo para: src/data/manuals/")

    except Exception as e:
        print(f"❌ Erro ao processar o PDF: {e}")


if __name__ == "__main__":
    if GOOGLE_API_KEY == "SUA_API_KEY_AQUI":
        # A verificação já acontece no início do script, mas é bom reforçar.
        print("🚨 A chave da API do Google ainda não foi configurada no script.")
        exit()

    # **MELHORIA**: Usa argparse para receber argumentos da linha de comando
    parser = argparse.ArgumentParser(description="Converte um manual de moto em PDF para um JSON para a assistente Graxa.")
    parser.add_argument("--pdf", required=True, help="Caminho para o arquivo PDF do manual.")
    parser.add_argument("--moto", required=True, help="Nome do modelo da moto.")
    parser.add_argument("--output", required=True, help="Caminho do arquivo JSON de saída.")
    
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"❌ Erro: Arquivo PDF '{args.pdf}' não encontrado.")
        exit()

    # Cria o diretório de saída se ele não existir
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    process_pdf_and_generate_json(args.pdf, args.moto, args.output)