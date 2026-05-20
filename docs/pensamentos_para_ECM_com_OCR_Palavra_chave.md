# Briefing: ECM com OCR e Extração de Palavras-Chave

## Contexto do Projeto

Estamos desenvolvendo um **ECM (Enterprise Content Management)** para uma empresa brasileira. O sistema já possui OCR integrado e precisa de uma pipeline de **extração automática de palavras-chave** para:
- Facilitar a busca de documentos
- Classificar arquivos automaticamente por categoria/tipo

---

## Stack de Extração de Keywords (já decidida)

### Abordagem: Híbrida (local + LLM)

#### 1. YAKE — Keywords gerais (local, sem API)
```python
import yake

kw_extractor = yake.KeywordExtractor(lan="pt", n=2, top=10)
keywords = kw_extractor.extract_keywords(texto)
# Retorna: [("palavra chave", score), ...]
```
- Leve, rápido, sem custo de API
- Suporte nativo ao português
- Ideal para pré-filtrar candidatos

#### 2. spaCy (`pt_core_news_lg`) — Entidades Nomeadas
```python
import spacy

nlp = spacy.load("pt_core_news_lg")
doc = nlp(texto)
entidades = [(ent.text, ent.label_) for ent in doc.ents]
# Ex: [("AFR Soluções", "ORG"), ("01/01/2025", "DATE"), ...]
```
- Extrai: nomes, organizações, datas, locais, valores monetários
- Essencial para documentos empresariais (contratos, NFs, relatórios)

#### 3. KeyLLM + Groq — Refinamento semântico (via API)
```python
from groq import Groq

client = Groq()  # usa variável de ambiente GROQ_API_KEY

def extrair_keywords_llm(texto: str) -> list[str]:
    prompt = f"""Extraia as 10 palavras-chave mais relevantes do texto abaixo.
Retorne APENAS as palavras separadas por vírgula, sem explicações.

Texto:
{texto}

Palavras-chave:"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )
    return [kw.strip() for kw in response.choices[0].message.content.split(",")]
```
- Usado para documentos que precisam de maior precisão semântica
- Modelo recomendado: `llama-3.3-70b-versatile`
- Temperatura baixa (0.2) para resultados mais determinísticos

---

## Pipeline Completa Recomendada

```
[Arquivo] → [OCR] → [Texto bruto]
                         ↓
               [YAKE] → keywords gerais
               [spaCy] → entidades nomeadas
                         ↓
               [Score de confiança]
                    ↙         ↘
           Alta confiança    Baixa confiança
           (salva direto)    → [Groq LLM] → refinamento
                                               ↓
                                    [Keywords finais]
                                               ↓
                                    [Index / Classificação]
```

### Função de orquestração sugerida:
```python
def processar_documento(texto: str, usar_llm: bool = False) -> dict:
    # 1. Keywords gerais com YAKE
    kw = yake.KeywordExtractor(lan="pt", n=2, top=15)
    keywords_yake = [kw for kw, score in kw.extract_keywords(texto)]

    # 2. Entidades nomeadas com spaCy
    doc = nlp(texto)
    entidades = {ent.label_: ent.text for ent in doc.ents}

    resultado = {
        "keywords": keywords_yake,
        "entidades": entidades
    }

    # 3. Refinamento com Groq (opcional / quando necessário)
    if usar_llm:
        resultado["keywords_refinadas"] = extrair_keywords_llm(texto)

    return resultado
```

---

## Dependências Python

```txt
yake
spacy
keybert          # opcional, se quiser embeddings semânticos locais
groq             # cliente oficial da Groq API
python-dotenv    # para gerenciar GROQ_API_KEY
```

```bash
# Instalação
pip install yake spacy keybert groq python-dotenv
python -m spacy download pt_core_news_lg
```

---

## Variáveis de Ambiente Necessárias

```env
GROQ_API_KEY=sua_chave_aqui
```

---

## Contexto de Negócio

- Documentos majoritariamente em **português brasileiro**
- Tipos comuns: contratos, notas fiscais, relatórios técnicos, laudos
- A busca e classificação são os casos de uso principais das keywords
- Performance importa: o LLM (Groq) deve ser usado de forma seletiva, não em todo documento

---

## O que ainda precisa ser desenvolvido

- [ ] Integração do módulo de keywords com o pipeline de OCR existente
- [ ] Definir critério para acionar o Groq (ex: score de confiança do YAKE abaixo de threshold)
- [ ] Estrutura de armazenamento das keywords extraídas (banco de dados / índice de busca)
- [ ] Interface ou API para consulta/busca por keywords
- [ ] Classificação automática por categoria de documento (contrato, NF, laudo, etc.)