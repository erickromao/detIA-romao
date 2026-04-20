const PROMPT = `Você é um especialista em reescrita de textos. Reescreva o texto abaixo
para que pareça escrito por um humano, seguindo estas regras obrigatórias:

1. Varie o comprimento das frases: alterne entre frases curtas (< 10 palavras)
   e longas. Nunca coloque 3 frases consecutivas com tamanho similar.
2. Substitua conectivos formais ("além disso", "portanto", "entretanto",
   "furthermore", "moreover") por equivalentes casuais ("e", "então", "mas").
3. Remova completamente frases introdutórias como "é válido ressaltar que",
   "vale destacar que", "it is important to note" — mantenha apenas o
   conteúdo que vem depois.
4. Substitua vocabulário acadêmico: "utilize/utilizar" → "use/usar",
   "demonstrar" → "mostrar", "facilitar" → "ajudar".
5. Use voz ativa sempre que possível.
6. Varie o início das frases — não inicie 3+ frases com a mesma palavra.
7. Mantenha o significado original integralmente.
8. Mantenha OBRIGATORIAMENTE o idioma original do texto — nunca traduza.
9. Retorne APENAS o texto reescrito, sem explicações ou comentários.

Texto:
{TEXT}`;

const MODEL = 'gemini-flash-latest';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 4000;

export async function humanize(text, signal) {
  let GEMINI_API_KEY = '';
  try {
    const cfg = await import('./config.js');
    GEMINI_API_KEY = cfg.GEMINI_API_KEY || '';
  } catch {
    // config.js ausente (GitHub Pages antes do workflow rodar)
  }

  if (!GEMINI_API_KEY) {
    throw new Error('Chave Gemini não encontrada. Configure o secret GEMINI_API_KEY no GitHub e faça um novo push.');
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new DOMException('Abortado', 'AbortError');

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT.replace('{TEXT}', text) }] }],
          generationConfig: { temperature: 0.9, topP: 0.95 },
        }),
        signal,
      }
    );

    if (res.status === 503) {
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
        continue;
      }
      throw new Error('Serviço Gemini sobrecarregado. Aguarde alguns instantes e tente novamente.');
    }

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const msg = data?.error?.message || '';
      const match = msg.match(/retry in ([\d.]+)s/i);
      const retrySeconds = match ? parseFloat(match[1]) : null;
      const err = new Error('Limite de requisições atingido.');
      // deadline absoluto: agora + tempo da API + 2s de buffer de rede
      err.retryDeadline = retrySeconds ? Date.now() + retrySeconds * 1000 + 2000 : null;
      throw err;
    }
    if (!res.ok) throw new Error('Erro na API Gemini: ' + res.status);

    const data = await res.json();
    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!result) throw new Error('Gemini não retornou texto.');

    return result;
  }
}
