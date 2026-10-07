// Resume text extraction for PDF, DOCX, TXT and MD files (browser ES module).
// pdf.js is imported lazily as an ES module; mammoth (UMD) is injected once via <script>.

const PDFJS_VERSION = '4.10.38';
const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
const MAMMOTH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.13.0/mammoth.browser.min.js';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MIN_TEXT_CHARS = 50;

let pdfjsPromise = null;
let mammothPromise = null;

function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_URL)
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return lib;
      })
      .catch((err) => {
        pdfjsPromise = null;
        throw new Error('Could not load the PDF reader. Check your internet connection and try again.', { cause: err });
      });
  }
  return pdfjsPromise;
}

function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!mammothPromise) {
    mammothPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = MAMMOTH_URL;
      script.async = true;
      script.onload = () =>
        window.mammoth ? resolve(window.mammoth) : reject(new Error('Word reader failed to initialise.'));
      script.onerror = () => {
        script.remove();
        reject(new Error('Could not load the Word document reader. Check your internet connection and try again.'));
      };
      document.head.appendChild(script);
    }).catch((err) => {
      mammothPromise = null;
      throw err;
    });
  }
  return mammothPromise;
}

function getExtension(name = '') {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}

function detectType(file) {
  const ext = getExtension(file.name);
  const mime = (file.type || '').toLowerCase();
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (ext === 'doc' || mime === 'application/msword') return 'doc';
  if (['txt', 'md', 'markdown', 'text'].includes(ext) || mime === 'text/plain' || mime === 'text/markdown') return 'text';
  return 'unknown';
}

/** Collapse runs of spaces/tabs, trim lines, cap blank lines at one, strip odd control chars. */
export function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[  -​  　]/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F﻿]/g, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdf(file) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  } catch (err) {
    if (err && err.name === 'PasswordException') {
      throw new Error('This PDF is password-protected. Please remove the password and upload it again.');
    }
    throw new Error('This PDF could not be opened. It may be corrupted — try re-exporting it.', { cause: err });
  }

  const pages = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let pageText = '';
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue;
        pageText += item.str;
        pageText += item.hasEOL ? '\n' : (item.str && !item.str.endsWith(' ') ? ' ' : '');
      }
      pages.push(pageText);
      page.cleanup();
    }
  } finally {
    pdf.destroy();
  }

  const text = normalizeWhitespace(pages.join('\n\n'));
  if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
    throw new Error(
      'No readable text found in this PDF. It looks like a scanned image — ATS systems can\'t read these either. ' +
        'Export your resume as a text-based PDF or DOCX and try again.'
    );
  }
  return text;
}

async function extractDocx(file) {
  const mammoth = await loadMammoth();
  let result;
  try {
    result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  } catch (err) {
    throw new Error('This Word document could not be read. Try saving it again as .docx or exporting to PDF.', { cause: err });
  }
  return normalizeWhitespace(result.value);
}

/**
 * Extract plain text from a resume file.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractText(file) {
  if (!file) throw new Error('No file selected.');
  if (file.size === 0) throw new Error('This file is empty.');
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`This file is ${mb} MB — the limit is 5 MB. Please upload a smaller file.`);
  }

  const type = detectType(file);
  let text;
  switch (type) {
    case 'pdf':
      text = await extractPdf(file);
      break;
    case 'docx':
      text = await extractDocx(file);
      break;
    case 'text':
      text = normalizeWhitespace(await file.text());
      break;
    case 'doc':
      throw new Error('Old .doc files aren\'t supported. Please save your resume as .docx or PDF and try again.');
    default:
      throw new Error('Unsupported file type. Please upload a PDF, DOCX, TXT or MD file.');
  }

  if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
    throw new Error('We couldn\'t find enough text in this file to analyse. Please check the file and try again.');
  }
  return text;
}
