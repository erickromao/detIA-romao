# Detector de Texto IA

Ferramenta web que analisa se um texto foi gerado por inteligência artificial. Roda 100% no navegador — nenhum dado é enviado a servidores externos.

Também oferece a opção de **humanizar** o texto detectado como IA, reescrevendo-o com a API Gemini para soar mais natural.

---

## Funcionalidades

- Cole texto diretamente ou envie um arquivo **PDF, DOCX ou DOC**
- Detecção local via modelo de regressão logística (sem servidor)
- Humanização do texto via **Google Gemini** (requer chave de API)
- Suporte a português e inglês
- Download do texto humanizado em PDF

---

## Como usar

Basta abrir o `index.html` no navegador. A detecção funciona imediatamente, sem nenhuma configuração.

A função **Humanizar** requer uma chave da API Gemini — veja a seção abaixo.

---

## Configurando a chave Gemini (para humanização)

### Localmente

1. Copie o arquivo de exemplo:
   ```
   cp config.example.js config.js
   ```
2. Abra `config.js` e substitua o valor vazio pela sua chave:
   ```js
   export const GEMINI_API_KEY = 'sua-chave-aqui';
   ```
3. Abra `index.html` normalmente.

> `config.js` está no `.gitignore` — sua chave nunca será commitada acidentalmente.

### No GitHub Pages (deploy via Actions)

1. Vá em **Settings → Secrets and variables → Actions** no seu repositório
2. Clique em **New repository secret**
3. Nome: `GEMINI_API_KEY` · Valor: sua chave Gemini
4. No workflow de deploy, adicione um passo que gere o `config.js` antes de publicar:
   ```yaml
   - name: Gerar config.js
     run: echo "export const GEMINI_API_KEY = '${{ secrets.GEMINI_API_KEY }}';" > config.js
   ```

---

## Regenerando o modelo

O modelo de detecção já está com os pesos embutidos em `detector.js`. Se quiser regenerar o `ai_detector.onnx` (por exemplo, para ajustar os pesos), instale as dependências Python e execute o script:

```bash
pip install numpy onnx onnxruntime
python criar_modelo.py
```

O script cria o `ai_detector.onnx` e executa um teste básico mostrando as probabilidades para um texto de IA e um humano.

> Os pesos do modelo são calibrados por conhecimento de domínio — não requerem dataset de treinamento.

---

## Tecnologias

- Modelo ML: regressão logística com 15 features linguísticas
- Humanização: [Google Gemini API](https://ai.google.dev/)
- Leitura de PDF: [pdf.js](https://mozilla.github.io/pdf.js/)
- Leitura de DOCX: [mammoth.js](https://github.com/mwilliamson/mammoth.js)
- Export PDF: [jsPDF](https://github.com/parallax/jsPDF)
