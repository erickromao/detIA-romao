// Mapa de tradução das strings retornadas pela biblioteca ai-text-detector
const map = [
  // Erros
  ['Text cannot be empty',
   'O texto não pode estar vazio.'],
  ['Text too short for reliable analysis (minimum 50 characters)',
   'Texto muito curto para análise confiável (mínimo 50 caracteres).'],

  // Indicadores de IA
  ['Low perplexity suggests predictable word patterns typical of AI',
   'Baixa perplexidade — padrões de palavras muito previsíveis, típicos de IA'],
  ['Low burstiness indicates consistent sentence structure characteristic of AI',
   'Baixa variação de ritmo — estrutura de frases uniforme, característica de IA'],
  ['Low human-likeness indicators suggest absence of typical human writing patterns',
   'Poucos indicadores de escrita humana detectados'],
  ['Low entropy score indicates predictable word choice patterns typical of AI',
   'Baixa entropia — escolha de palavras previsível, típica de IA'],
  ['Low informality score suggests formal, AI-like writing style',
   'Estilo excessivamente formal, característico de texto gerado por IA'],
  ['Lexical diversity falls within AI-typical range',
   'Diversidade de vocabulário dentro do padrão típico de IA'],
  ['High transition word density characteristic of AI writing',
   'Alta densidade de palavras de transição, típica de IA'],
  ['Elevated discourse marker usage typical of AI text structure',
   'Uso elevado de marcadores discursivos, comum em textos de IA'],
  ['Limited vocabulary richness may indicate AI limitations',
   'Riqueza de vocabulário limitada — pode indicar geração automática'],

  // Indicadores humanos
  ['Natural linguistic variation suggests human authorship',
   'Variação linguística natural — sugere autoria humana'],
  ['Irregular patterns inconsistent with AI generation',
   'Padrões irregulares, incompatíveis com geração por IA'],
  ['Strong human-like writing patterns detected',
   'Fortes padrões de escrita humana detectados'],
  ['Informal language patterns suggest human authorship',
   'Linguagem informal — sugere autoria humana'],
  ['Varied emotional expression typical of human writing',
   'Expressão emocional variada, típica de texto humano'],
  ['High entropy indicates natural human unpredictability in word choice',
   'Alta entropia — imprevisibilidade natural na escolha de palavras, típica de humanos'],
];

export function translate(reason) {
  if (!reason) return reason;
  for (const [en, pt] of map) {
    if (reason.toLowerCase().includes(en.toLowerCase())) return pt;
  }
  return reason; // fallback: retorna o original se não houver tradução
}
