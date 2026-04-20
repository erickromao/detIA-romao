# Detector de Texto IA

Ferramenta web que analisa se um texto foi gerado por inteligência artificial. Projetada para ser hospedada **gratuitamente no GitHub Pages** como um site estático — sem servidor, sem backend, sem nenhum custo de infraestrutura.

Toda a detecção roda localmente no navegador do usuário. Também oferece a opção de **humanizar** o texto detectado como IA, reescrevendo-o com a API Gemini para burlar deteções de IA.

---

## Funcionalidades

- Cole texto diretamente ou envie um arquivo **PDF, DOCX ou DOC**
- Detecção local via modelo de regressão logística (sem servidor)
- Humanização do texto via **Google Gemini** (requer chave de API)
- Download do texto humanizado em PDF

## Suporte a idiomas

O detector foi projetado e calibrado principalmente para **inglês**, onde a precisão é maior.

Para **português (PT-BR)** há suporte parcial: conectivos discursivos (*além disso, portanto, entretanto...*), frases de ênfase (*vale ressaltar, é importante destacar...*), voz passiva e sinais informais (*vc, tô, kkk*) são detectados normalmente. Porém, duas das features de maior peso no modelo — vocabulário acadêmico (*framework, methodology, leveraging...*) e contrações (*don't, I'm...*) — são exclusivamente inglesas e não contribuem para textos em português. O resultado ainda é útil, mas a sensibilidade é menor do que em inglês.

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
