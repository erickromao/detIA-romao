const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export function initUploader(onTextReady) {
  const dropZone   = document.getElementById('dropZone');
  const fileInput  = document.getElementById('fileInput');
  const fileStatus = document.getElementById('fileStatus');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file, fileStatus, onTextReady);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) processFile(file, fileStatus, onTextReady);
    fileInput.value = '';
  });
}

async function processFile(file, statusEl, onTextReady) {
  const ext = file.name.split('.').pop().toLowerCase();

  setStatus(statusEl, 'loading', `Lendo "${file.name}"…`);

  try {
    let text;
    if (ext === 'pdf') {
      text = await parsePDF(file);
    } else if (ext === 'docx' || ext === 'doc') {
      text = await parseDOCX(file);
    } else {
      setStatus(statusEl, 'error', 'Formato não suportado. Use PDF, DOCX ou DOC.');
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setStatus(statusEl, 'error', 'Nenhum texto encontrado no arquivo.');
      return;
    }

    setStatus(statusEl, 'ok', `✓ "${file.name}" — ${trimmed.length} caracteres extraídos`);
    onTextReady(trimmed, file.name);
  } catch (err) {
    setStatus(statusEl, 'error', `Erro ao ler arquivo: ${err.message}`);
  }
}

async function parsePDF(file) {
  const pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    let pageText = '';
    let lastY = null;

    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const y = Math.round(item.transform[5]);

      if (lastY !== null) {
        if (Math.abs(y - lastY) > 2) {
          pageText += '\n';
        } else if (!pageText.endsWith(' ') && !item.str.startsWith(' ')) {
          pageText += ' ';
        }
      }

      pageText += item.str;
      lastY = y;
    }

    pages.push(pageText.trim());
  }

  return pages.filter(Boolean).join('\n\n');
}

async function parseDOCX(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function setStatus(el, type, msg) {
  el.className = `file-status file-status--${type}`;
  el.textContent = msg;
}
