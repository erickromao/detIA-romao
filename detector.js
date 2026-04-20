import { translate } from './translations.js';

const resultDiv = document.getElementById('result');

// Pesos extraídos do ai_detector.onnx (regressão logística, 15 features)
const LR_W = [3.5, 4.2, 1.8, 1.5, 1.5, 0.7, 0.5, 1.8, 1.0, 0.4, 1.8, 0.5, 2.2, 0.5, 1.5];
const LR_B = -5.8;

// ── Status de carregamento ────────────────────────────────────────────────────

function showModelLoadingStatus(name, msg) {
  const el = document.getElementById('modelStatus');
  if (!el) return;
  if (!name && !msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent = name ? `${name}: ${msg}` : msg;
  el.style.display = 'block';
}

// ── Ponto de entrada ──────────────────────────────────────────────────────────

export async function analyze(text) {
  const container = document.getElementById('scannerContainer');
  if (container) container.classList.add('scanning');
  
  resultDiv.style.display = 'none';
  showModelLoadingStatus('', '');
  try {
    await runAll(text);
  } catch (e) {
    console.error(e);
    renderError(translate(e.message) || e.message);
  } finally {
    if (container) container.classList.remove('scanning');
  }
}

// ── Constantes para Análise (Bilingue PT/EN) ────────────────────────────────

const AI_CONNECTIVES = [
  // PT
  'além disso', 'ademais', 'outrossim', 'por outro lado', 'em contrapartida',
  'portanto', 'consequentemente', 'por conseguinte', 'assim sendo',
  'entretanto', 'contudo', 'todavia', 'no entanto', 'em suma', 'em síntese',
  'de fato', 'com efeito', 'nesse sentido', 'nesse contexto',
  'é válido ressaltar', 'é válido destacar',
  // EN
  'furthermore', 'moreover', 'in addition', 'consequently', 'therefore',
  'nevertheless', 'nonetheless', 'however', 'conversely', 'accordingly',
  'in summary', 'in conclusion', 'to sum up', 'notably', 'it is important to note'
];
const AI_CONNECTIVES_RE = new RegExp('\\b(' + AI_CONNECTIVES.join('|') + ')\\b', 'gi');

const AI_HEDGE_RES = [
  /\bé (importante|essencial|fundamental|crucial) (ressaltar|destacar|notar|mencionar|salientar)\b/gi,
  /\bvale (ressaltar|destacar|mencionar|notar|salientar|lembrar)\b/gi,
  /\b(pode-se|podemos) (dizer|afirmar|concluir|observar|notar)\b/gi,
  /\b(percebe-se|verifica-se|constata-se|nota-se|observa-se)\b/gi,
  /\b(it is|it\'s) (important|essential|crucial|vital) to (note|highlight|remember|mention)\b/gi,
  /\b(one can|we can) (observe|conclude|note|assume|argue)\b/gi,
  /\b(it appears that|it seems that|it is worth noting)\b/gi
];

const ACAD_RE = /\b(utilize[sd]?|implementation|framework|paradigm|methodology|leverag|optimal|robust|facilitat|demonstrat|illustrat|indicates?|suggests?|reveals?|emphasizes?|encompasses?)\b/gi;
const PASSIVE_RE = /\b(is|are|was|were|been|é|são|foi|foram)\s+(used|considered|found|shown|noted|usado|considerado|encontrado|produced|created)\b/gi;

// ── Fluxo Principal ───────────────────────────────────────────────────────────

async function runAll(text) {
  const humanSignals = computeHumanSignals(text);
  const burstiness   = calculateBurstiness(text);

  const methodDefs = [
    {
      name: 'Modelo ML', weight: 1.0,
      fn: () => analyzeML(text),
    }
  ];

  const successful = [];
  const errors     = [];

  for (const m of methodDefs) {
    try {
      const result = await m.fn();
      successful.push({ name: m.name, weight: m.weight, result });
    } catch (e) {
      console.error(e);
      errors.push(`${m.name}: ${translate(e.message) || e.message}`);
    }
  }

  showModelLoadingStatus('', '');

  if (successful.length === 0) {
    renderError(errors.join(' | ') || 'Nenhum método produziu resultado.');
    return;
  }

  renderEnsemble(text, successful, humanSignals, burstiness);
}

// ── Métrica de Burstiness (Variação de Ritmo) ────────────────────────────────

function calculateBurstiness(text) {
  const sentences = splitSentences(text);
  if (sentences.length < 3) return 0.5; // Neutro para textos curtos

  const lens = sentences.map(s => s.split(/\s+/).filter(w => w).length);
  const avg  = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length;
  const stdDev = Math.sqrt(variance);
  
  // Coeficiente de Variação (CV). CV alto = Burstiness alta (Humano). CV baixo = Monotonia (IA).
  const cv = avg > 0 ? stdDev / avg : 0;
  
  // Mapeia CV (0.0 a 1.0+) para um score de "monotonia" (1.0 = muito monótono/IA)
  return Math.max(0, 1 - cv);
}

function computeEnsemble(successful, humanSignals, burstiness) {
  const totalWeight = successful.reduce((acc, r) => acc + r.weight, 0);
  let conf = successful.reduce((acc, r) => acc + r.result.confidence * r.weight, 0) / totalWeight;

  // Ajuste fino baseado em Burstiness (Ritmo)
  if (burstiness > 0.7) conf += (burstiness - 0.7) * 0.2; // Aumenta score se for muito monótono
  
  // Punição por sinais humanos
  if (humanSignals > 0.3) conf = Math.max(0, conf - humanSignals * 0.4);

  return Math.min(1, Math.max(0, conf));
}

function renderEnsemble(text, successful, humanSignals, burstiness) {
  const conf     = computeEnsemble(successful, humanSignals, burstiness);
  const segments = buildSegments(text, humanSignals, burstiness, conf);
  
  const mlResult = successful.find(s => s.name === 'Modelo ML')?.result;
  const reasons  = mlResult ? [...mlResult.reasons] : [];
  
  if (burstiness > 0.75) reasons.push('Escrita com ritmo monótono (baixa variação no tamanho das frases)');
  if (humanSignals > 0.3) reasons.push('Sinais de escrita humana/informal detectados');

  renderResult({ confidence: conf, score: +conf.toFixed(2), reasons }, successful, segments);
}

// ── Análise por trecho (Destaque Inteligente) ─────────────────────────────────

function buildSegments(text, humanSignals, globalBurst, globalConf) {
  const sentences = splitSentences(text);
  const lens = sentences.map(s => s.split(/\s+/).filter(w => w).length);
  const avgLen = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);

  return sentences.map((s, i) => {
    const wordCount = lens[i];
    // Uma frase é "suspeita" se ela for próxima da média global e o texto for monótono
    const isMonotonous = Math.abs(wordCount - avgLen) < 4 && globalBurst > 0.6;
    
    return {
      text: s,
      score: wordCount >= 5 ? scoreSentence(s, humanSignals, isMonotonous, globalConf) : null,
    };
  });
}

function splitSentences(text) {
  return text
    .replace(/([.!?])\s+([A-ZÁÉÍÓÚÀÂÃÊÎÔÕÛÇ"«(])/g, '$1\x00$2')
    .split('\x00')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function scoreSentence(sentence, humanSignals, isMonotonous, globalConf) {
  const lower = sentence.toLowerCase();
  let score = globalConf * 0.25; 

  if (AI_CONNECTIVES_RE.test(lower)) score += 0.25;
  AI_CONNECTIVES_RE.lastIndex = 0;

  for (const re of AI_HEDGE_RES) { if (re.test(lower)) score += 0.20; re.lastIndex = 0; }
  if (ACAD_RE.test(lower)) score += 0.20;
  ACAD_RE.lastIndex = 0;
  if (PASSIVE_RE.test(lower)) score += 0.15;
  PASSIVE_RE.lastIndex = 0;

  // Bônus de score se a frase contribuir para a monotonia do parágrafo
  if (isMonotonous) score += 0.15;

  const words = sentence.split(/\s+/).filter(w => w);
  score += Math.min(0.20, Math.max(0, (words.length - 15) / 30));

  score = score * (1 - humanSignals * 0.7);
  return Math.min(1, Math.max(0, score));
}

// ── Modelo ML (ONNX) ──────────────────────────────────────────────────────────

function extractFeaturesForONNX(text) {
  const lower     = text.toLowerCase();
  const sentences = splitSentences(text);
  const words     = text.split(/\s+/).filter(w => w);
  const n         = Math.max(sentences.length, 1);
  const nw        = Math.max(words.length, 1);

  const connCount = (text.match(AI_CONNECTIVES_RE) || []).length;
  const f0 = Math.min(1, connCount / n);

  let hedgeCount = 0;
  for (const re of AI_HEDGE_RES) { hedgeCount += (text.match(re) || []).length; re.lastIndex = 0; }
  const f1 = Math.min(1, hedgeCount / n * 2);

  const sentLens  = sentences.map(s => s.split(/\s+/).filter(w => w).length);
  const avgLen    = sentLens.reduce((a, b) => a + b, 0) / n;
  const stdLen    = Math.sqrt(sentLens.reduce((a, l) => a + (l - avgLen) ** 2, 0) / n);
  const cv        = avgLen > 0 ? stdLen / avgLen : 1;
  const f2 = Math.max(0, 1 - cv * 2);

  const f3 = Math.min(1, Math.max(0, (avgLen - 12) / 20));

  const clean = words.map(w => w.replace(/[^a-záéíóúãõâêîôûàç]/gi, '')).filter(w => w);
  const avgWL = clean.reduce((a, w) => a + w.length, 0) / (clean.length || 1);
  const f4 = Math.min(1, Math.max(0, (avgWL - 4.5) / 4));

  const f5 = Math.min(1, (text.match(/,/g) || []).length / n / 3);
  const f6 = sentences.filter(s => /^[A-ZÁÉÍÓÚ]/.test(s)).length / n;

  const infoRe = /\b(vc|vcs|tb|hj|blz|kkk+|rs+|tô|tá|né|daí|lol|omg|gonna|wanna|gotta|dunno|kinda|tbh|idk)\b/gi;
  const f7 = Math.max(0, 1 - (text.match(infoRe) || []).length * 0.5);

  const passiveCount = (text.match(PASSIVE_RE) || []).length;
  const f8 = Math.min(1, passiveCount / n * 2);

  const uniqueRatio = new Set(clean.map(w => w.toLowerCase())).size / nw;
  const f9 = nw > 50 ? Math.max(0, 1 - uniqueRatio) : 0.5;

  const contrRe = /\b(don't|doesn't|didn't|isn't|aren't|wasn't|I'm|I've|you're|they're|he's|she's|it's|we're|can't|won't|couldn't|wouldn't|shouldn't)\b/gi;
  const f10 = Math.max(0, 1 - (text.match(contrRe) || []).length / n * 0.5);

  const listRe  = /^\s*(\d+[\.\)]|\-|\*|•)\s/gm;
  const lineN   = text.split('\n').length;
  const f11 = Math.min(1, (text.match(listRe) || []).length / lineN * 3);

  const acadCount = (text.match(ACAD_RE) || []).length;
  const f12 = Math.min(1, acadCount / nw * 10);

  const missingRe = /\b(voce|nao|sao|esta|tambem|porem|alem|atencao)\b/gi;
  const f13 = Math.max(0, 1 - (text.match(missingRe) || []).length * 0.3);

  const f14 = f2 * f3;

  return { 
    array: new Float32Array([f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14]),
    metrics: { f0, f1, f2, f8, f9, f12 } 
  };
}

async function analyzeML(text) {
  const sentences = splitSentences(text);
  if (sentences.length < 2)
    throw new Error('Texto muito curto: forneça ao menos 2 frases para análise ML.');

  const { array, metrics } = extractFeaturesForONNX(text);
  let logit = LR_B;
  for (let i = 0; i < LR_W.length; i++) logit += LR_W[i] * array[i];
  const confidence = 1 / (1 + Math.exp(-logit));

  const reasons = [];
  if (confidence >= 0.5) {
    if (metrics.f0 > 0.2)  reasons.push('Uso frequente de conectivos discursivos típicos de IA');
    if (metrics.f1 > 0.2)  reasons.push('Presença de frases de ênfase/Hedge comuns em LLMs');
    if (metrics.f2 > 0.6)  reasons.push('Uniformidade excessiva no comprimento das frases');
    if (metrics.f8 > 0.2)  reasons.push('Uso elevado de voz passiva');
    if (metrics.f12 > 0.1) reasons.push('Vocabulário acadêmico/formal persistente');
    if (metrics.f9 > 0.6)  reasons.push('Baixa diversidade lexical (repetitividade estrutural)');
  } else {
    reasons.push('Estrutura textual variada compatível com escrita humana');
  }

  return { confidence, score: +confidence.toFixed(2), reasons };
}

// ── Sinais humanos ────────────────────────────────────────────────────────────

function computeHumanSignals(text) {
  let score = 0;
  const lower = text.toLowerCase();
  const missingAccents = [[/\be\b(?!\s*[=<>!])/g, ''], [/\bsao\b/g, ''], [/\balem\b/g, ''], [/\bnao\b/g, ''], [/\besta\b/g, '']];
  let accentMisses = 0;
  for (const [re] of missingAccents) { if (re.test(lower)) accentMisses++; re.lastIndex = 0; }
  if (accentMisses >= 1) score += 0.25;

  if (/\b(tô|tá|tava|tamo|tão|num|pra|pro|né|daí|aí|uai|opa|cara|mano|véi)\b/i.test(text)) score += 0.35;
  if (/\b(vc|vcs|tb|tbm|mt|td|msm|hj|blz|flw|vlw|mto|pfv|obg|kkk+|rs+|haha+)\b/i.test(text)) score += 0.35;
  if (/\b(gonna|wanna|gotta|dunno|kinda|sorta|idk|tbh|omg|lol|btw|y'all)\b/i.test(text)) score += 0.35;

  return Math.min(0.9, score);
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Renderização ──────────────────────────────────────────────────────────────

function renderResult({ confidence, score, reasons }, breakdown, segments) {
  const pct = Math.round(confidence * 100);
  let cls, icon, label, sub;
  if (pct >= 70) { cls = 'ai'; icon = '🤖'; label = 'Provavelmente IA'; sub = `Alta probabilidade (${pct}%)`; }
  else if (pct <= 35) { cls = 'human'; icon = '✍️'; label = 'Provavelmente Humano'; sub = `Baixa probabilidade de IA (${pct}%)`; }
  else { cls = 'unsure'; icon = '🔍'; label = 'Inconclusivo'; sub = `Confiança intermediária (${pct}%)`; }

  // ── Badges Dinâmicos ──
  const badges = [];
  const burstiness = calculateBurstiness(document.getElementById('inputText').value || "");
  
  if (burstiness > 0.6) badges.push({ text: 'Ritmo Monótono', active: true });
  else badges.push({ text: 'Ritmo Variado', active: false });
  
  if (confidence > 0.5) badges.push({ text: 'Padrão Sintético', active: true });
  else badges.push({ text: 'Padrão Orgânico', active: false });

  const badgesHTML = `<div class="metric-badges">${badges.map(b => `<span class="badge ${b.active ? 'active' : ''}">${b.text}</span>`).join('')}</div>`;

  const fillColor = cls === 'ai' ? '#ef4444' : cls === 'human' ? '#10b981' : '#f59e0b';
  const reasonsHTML = reasons?.length ? `<div class="reasons-title">Por que foi classificado assim?</div><ul class="reasons-list">${reasons.map(r => `<li>${translate(r)}</li>`).join('')}</ul>` : '';

  const highlightHTML = segments?.length ? `
    <div class="text-highlight-section">
      <div class="reasons-title">Onde foi identificado? (Análise por trecho)</div>
      <div class="highlight-legend">
        <span class="legend-item"><span class="seg-swatch seg-human"></span>Humano</span>
        <span class="legend-item"><span class="seg-swatch seg-unsure"></span>Suspeito</span>
        <span class="legend-item"><span class="seg-swatch seg-ai"></span>IA</span>
      </div>
      <div class="highlighted-text">${segments.map(({ text: t, score: s }) => {
        const safe = escapeHtml(t);
        if (s === null) return safe;
        const cls2 = s >= 0.52 ? 'seg-ai' : s <= 0.28 ? 'seg-human' : 'seg-unsure';
        return `<span class="${cls2}">${safe}</span>`;
      }).join(' ')}</div>
    </div>` : '';

  resultDiv.innerHTML = `
    ${badgesHTML}
    <div class="verdict ${cls}"><span class="verdict-icon">${icon}</span><div><div class="verdict-label">${label}</div><div class="verdict-sub">${sub} &middot; Score: ${score ?? '–'}</div></div></div>
    <div class="meter-wrap"><div class="meter-header"><span>Humano</span><span>IA</span></div><div class="meter-track"><div class="meter-fill" id="meterFill" style="width:0%;background:${fillColor}"></div></div></div>
    ${reasonsHTML}${highlightHTML}
  `;
  resultDiv.style.display = 'block';
  requestAnimationFrame(() => requestAnimationFrame(() => { const el = document.getElementById('meterFill'); if (el) el.style.width = pct + '%'; }));
}

export function renderError(msg) {
  resultDiv.innerHTML = `<div class="error-box">⚠️ ${msg}</div>`;
  resultDiv.style.display = 'block';
}
