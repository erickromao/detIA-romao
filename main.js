import { analyze } from './detector.js';
import { initUploader } from './uploader.js';
import { humanize } from './humanizer.js';

const textarea     = document.getElementById('inputText');
const btn          = document.getElementById('analyzeBtn');
const charCount    = document.getElementById('charCount');
const humanizeBtn  = document.getElementById('humanizeBtn');

let currentTab = 'text';
let fileText   = '';

// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    document.getElementById(`panel-${currentTab}`).classList.add('active');

    humanizeBtn.style.display = 'none';
    syncButton();
  });
});

// ── Textarea ──────────────────────────────────────────
textarea.addEventListener('input', () => {
  const len = textarea.value.length;
  charCount.textContent = `${len} caractere${len !== 1 ? 's' : ''}`;
  syncButton();
});

// ── File uploader ─────────────────────────────────────
initUploader((text, fileName) => {
  fileText = text;
  lastOriginalName = fileName ? fileName.replace(/\.[^.]+$/, '') : 'texto-humanizado';
  humanizedResultWrap.style.display = 'none';
  humanizedResult.value = '';
  humanizedActionsWrap.style.display = 'none';
  syncButton();
});

// ── Analyze ───────────────────────────────────────────
btn.addEventListener('click', async () => {
  const text = currentTab === 'text' ? textarea.value.trim() : fileText;
  if (text.length < 50) return;

  btn.disabled = true;
  btn.textContent = 'Analisando…';
  await analyze(text);
  btn.textContent = 'Analisar texto';
  humanizeBtn.style.display = 'block';
  syncButton();
});

function syncButton() {
  const text = currentTab === 'text' ? textarea.value.trim() : fileText;
  btn.disabled = text.length < 50;
}

// ── Humanize ──────────────────────────────────────────
const humanizedActionsWrap   = document.getElementById('humanizedActionsWrap');
const copyTextBtn            = document.getElementById('copyTextBtn');
const downloadPdfBtn         = document.getElementById('downloadPdfBtn');
const scannerContainer       = document.getElementById('scannerContainer');
const humanizedResultWrap    = document.getElementById('humanizedResultWrap');
const humanizedResult        = document.getElementById('humanizedResult');
const humanizeProgressWrap  = document.getElementById('humanizeProgressWrap');
const humanizeProgressFill  = document.getElementById('humanizeProgressFill');
const humanizeProgressLabel = document.getElementById('humanizeProgressLabel');
const cancelBtn             = document.getElementById('cancelBtn');

let lastHumanizedText    = '';
let lastOriginalName     = 'texto-humanizado';
let humanizeController   = null;
let rateLimitCountdown   = false;
let progressInterval   = null;
let progressVal        = 0;

function lockUI(locked) {
  btn.disabled = locked || (!locked && textarea.value.trim().length < 50 && !fileText);
  document.querySelectorAll('.tab').forEach(t => { t.disabled = locked; });
}

function startProgress() {
  progressVal = 0;
  humanizeProgressFill.style.transition = 'none';
  humanizeProgressFill.style.width = '0%';
  humanizeProgressLabel.textContent = '0%';
  humanizeProgressWrap.style.display = 'block';
  cancelBtn.style.display = 'block';
  clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    progressVal += (90 - progressVal) * 0.07;
    humanizeProgressFill.style.transition = 'width 0.35s ease';
    humanizeProgressFill.style.width = progressVal + '%';
    humanizeProgressLabel.textContent = Math.round(progressVal) + '%';
  }, 200);
}

function finishProgress() {
  clearInterval(progressInterval);
  humanizeProgressFill.style.transition = 'width 0.3s ease';
  humanizeProgressFill.style.width = '100%';
  humanizeProgressLabel.textContent = '100%';
}

function resetProgress() {
  clearInterval(progressInterval);
  humanizeProgressWrap.style.display = 'none';
  cancelBtn.style.display = 'none';
  humanizeProgressFill.style.transition = 'none';
  humanizeProgressFill.style.width = '0%';
  humanizeProgressLabel.textContent = '0%';
}

cancelBtn.addEventListener('click', () => {
  if (humanizeController) humanizeController.abort();
});

humanizeBtn.addEventListener('click', async () => {
  const text = currentTab === 'text' ? textarea.value.trim() : fileText;
  if (text.length < 50) return;

  humanizeController = new AbortController();
  humanizeBtn.disabled = true;
  humanizeBtn.textContent = '📝 Humanizando…';
  scannerContainer.classList.add('humanizing');
  lockUI(true);
  startProgress();

  try {
    const humanized = await humanize(text, humanizeController.signal);

    finishProgress();
    await new Promise(r => setTimeout(r, 350));

    lastHumanizedText = humanized;

    if (currentTab === 'text') {
      textarea.value = humanized;
      const len = humanized.length;
      charCount.textContent = `${len} caractere${len !== 1 ? 's' : ''}`;
    } else {
      fileText = humanized;
      humanizedResult.value = humanized;
      humanizedResultWrap.style.display = 'block';
    }

    humanizedActionsWrap.style.display = 'flex';

    btn.textContent = 'Analisando…';
    await analyze(humanized);
    btn.textContent = 'Analisar texto';
    syncButton();
  } catch (e) {
    if (e.name === 'AbortError') return;
    const { renderError } = await import('./detector.js');
    if (e.retryDeadline) {
      rateLimitCountdown = true;
      const humanizeError = document.getElementById('humanizeError');
      humanizeError.style.display = 'block';
      const countdown = setInterval(() => {
        const secs = Math.ceil((e.retryDeadline - Date.now()) / 1000);
        if (secs <= 0) {
          clearInterval(countdown);
          rateLimitCountdown = false;
          humanizeError.style.display = 'none';
          humanizeBtn.disabled = false;
          humanizeBtn.textContent = '📝 Humanizar texto';
        } else {
          humanizeError.textContent = `⏳ Cota esgotada. Você poderá tentar novamente em ${secs}s (pode haver nova espera).`;
          humanizeBtn.disabled = true;
          humanizeBtn.textContent = `⏳ Aguarde ${secs}s…`;
        }
      }, 500);
    } else {
      renderError(e.message);
    }
  } finally {
    if (!rateLimitCountdown) {
      humanizeBtn.disabled = false;
      humanizeBtn.textContent = '📝 Humanizar texto';
    }
    scannerContainer.classList.remove('humanizing');
    btn.disabled = textarea.value.trim().length < 50 && !fileText;
    resetProgress();
    humanizeController = null;
  }
});

// ── Copy text ─────────────────────────────────────────
copyTextBtn.addEventListener('click', async () => {
  if (!lastHumanizedText) return;
  await navigator.clipboard.writeText(lastHumanizedText);
  copyTextBtn.textContent = '✓ Copiado!';
  copyTextBtn.classList.add('copied');
  setTimeout(() => {
    copyTextBtn.textContent = '📋 Copiar texto';
    copyTextBtn.classList.remove('copied');
  }, 2000);
});

// ── Download PDF ──────────────────────────────────────
downloadPdfBtn.addEventListener('click', () => {
  if (!lastHumanizedText) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);

  const lines = doc.splitTextToSize(lastHumanizedText, maxWidth);
  const lineHeight = 7;
  let y = margin;

  for (const line of lines) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  doc.save(`${lastOriginalName}-humanizado.pdf`);
});
