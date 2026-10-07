// Resume Analyser — UI controller.
// Depends on parser.js (text extraction), gemini.js (analysis) and sample.js (demo resume).

import { extractText } from './parser.js';
import { analyzeResume, validateKey, MODELS, DEFAULT_MODEL } from './gemini.js';
import { SAMPLE_RESUME } from './sample.js';

/* ==========================================================================
   Constants
   ========================================================================== */

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXT = ['pdf', 'docx', 'txt', 'md'];
const MIN_TEXT_CHARS = 50;
const JD_MAX = 15000;
const STEP_MS = 700;
const TIP_MS = 3800;
const FIXES_VISIBLE = 5;
const STORAGE = { key: 'ra.apiKey', model: 'ra.model', theme: 'ra.theme' };

const TIPS = [
  'Start bullets with strong action verbs like “Led”, “Shipped” or “Reduced”.',
  'Quantify impact: numbers, percentages and timeframes make results concrete.',
  'Mirror the exact keywords from the job post — many ATS match literally.',
  'Keep it to one page for under 10 years of experience.',
  'Avoid tables, text boxes and images — they often confuse ATS parsers.',
  'Use standard section headings: Experience, Education, Skills.',
  'Tailor your summary to the role instead of listing generic traits.',
  'Put your most relevant achievements in the top third of the page.',
];

const BANDS = {
  primary: { label: 'Exceptional', icon: 'star' },
  success: { label: 'Strong', icon: 'check' },
  warning: { label: 'Room to grow', icon: 'trend' },
  danger: { label: 'Needs work', icon: 'alert' },
};

const PRIORITY = {
  high: { label: 'Critical', cls: 'pill-high', icon: 'alert', rank: 0 },
  medium: { label: 'Improve', cls: 'pill-medium', icon: 'trend', rank: 1 },
  low: { label: 'Tip', cls: 'pill-low', icon: 'info', rank: 2 },
};

const ICONS = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 16.5h.01"/><circle cx="12" cy="12" r="9"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 16.5h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  trend: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  chevron: '<svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-5 3.6L16.8 20 12 16.5 7.2 20 9 13.6 4 10l6.1-1.2z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  pen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z"/></svg>',
  thumb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10z"/><path d="M7 10l4-8a3 3 0 0 1 3 3v4h6a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.6 21H7"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.9 17.9A10.8 10.8 0 0 1 12 20c-7 0-11-8-11-8a19.8 19.8 0 0 1 5.1-5.9M9.9 4.2A10 10 0 0 1 12 4c7 0 11 8 11 8a19.9 19.9 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M1 1l22 22"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};

/* ==========================================================================
   Small utilities
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);

/** Escape any string before it is interpolated into HTML. */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function bandFor(score) {
  if (score >= 90) return 'primary';
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}

/** localStorage wrapper with an in-memory fallback (private mode, blocked storage). */
const memoryStore = new Map();
const store = {
  get(k) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) return v;
    } catch { /* storage unavailable */ }
    return memoryStore.has(k) ? memoryStore.get(k) : null;
  },
  set(k, v) {
    memoryStore.set(k, v);
    try { localStorage.setItem(k, v); } catch { /* storage unavailable */ }
  },
  remove(k) {
    memoryStore.delete(k);
    try { localStorage.removeItem(k); } catch { /* storage unavailable */ }
  },
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/* ==========================================================================
   DOM references + state
   ========================================================================== */

const els = {
  themeToggle: $('#theme-toggle'),
  settingsOpen: $('#settings-open'),
  keyDot: $('#key-dot'),
  brandLink: $('#brand-link'),

  viewHome: $('#view-home'),
  viewResults: $('#view-results'),
  uploadCard: $('#upload-card'),
  panelForm: $('#panel-form'),
  panelAnalyzing: $('#panel-analyzing'),
  panelError: $('#panel-error'),

  dropzone: $('#dropzone'),
  fileInput: $('#file-input'),
  filePill: $('#file-pill'),
  filePillName: $('#file-pill-name'),
  filePillMeta: $('#file-pill-meta'),
  fileRemove: $('#file-remove'),
  uploadError: $('#upload-error'),
  sampleBtn: $('#sample-btn'),
  pasteToggle: $('#paste-toggle'),
  pasteArea: $('#paste-area'),
  pasteInput: $('#paste-input'),
  pasteHint: $('#paste-hint'),
  jdToggle: $('#jd-toggle'),
  jdPanel: $('#jd-panel'),
  jdInput: $('#jd-input'),
  jdCounter: $('#jd-counter'),
  analyzeBtn: $('#analyze-btn'),
  keyStatusText: $('#key-status-text'),
  keySetupBtn: $('#key-setup-btn'),

  progressBar: $('#progress-bar'),
  stepList: $('#step-list'),
  stepStatus: $('#step-status'),
  tipText: $('#tip-text'),
  cancelBtn: $('#cancel-btn'),

  errorTitle: $('#error-title'),
  errorMessage: $('#error-message'),
  errorHint: $('#error-hint'),
  retryBtn: $('#retry-btn'),
  errorSettingsBtn: $('#error-settings-btn'),
  errorBackBtn: $('#error-back-btn'),

  resultsTitle: $('#results-title'),
  sidebar: $('#results-sidebar'),
  main: $('#results-main'),

  dialog: $('#settings-dialog'),
  settingsForm: $('#settings-form'),
  settingsClose: $('#settings-close'),
  settingsCancel: $('#settings-cancel'),
  keyRequiredNote: $('#key-required-note'),
  keyInput: $('#api-key-input'),
  keyVisibility: $('#key-visibility'),
  keyTestStatus: $('#key-test-status'),
  modelSelect: $('#model-select'),
  testKeyBtn: $('#test-key-btn'),

  helpOpen: $('#help-open'),
  helpDialog: $('#help-dialog'),
  helpClose: $('#help-close'),
  heroTilt: $('#hero-tilt'),

  toastRegion: $('#toast-region'),
};

const state = {
  /** @type {null | {type:'file', file: File} | {type:'sample'}} */
  source: null,
  pasteMode: false,
  lastJob: null,
  runId: 0,
  abort: null,
  result: null,
  hadJD: false,
  analyzeAfterSave: false,
  /** Indices of improvements the user plans to apply (what-if simulator). */
  whatIf: new Set(),
};

/* ==========================================================================
   Toasts
   ========================================================================== */

function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = type === 'error' ? ICONS.alert : ICONS.check;
  el.append(document.createTextNode(message));
  els.toastRegion.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

/* ==========================================================================
   Theme
   ========================================================================== */

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function effectiveTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'light' || t === 'dark') return t;
  return systemDark.matches ? 'dark' : 'light';
}

function renderThemeButton() {
  const dark = effectiveTheme() === 'dark';
  els.themeToggle.innerHTML = dark ? ICONS.sun : ICONS.moon;
  els.themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
}

function initTheme() {
  const saved = store.get(STORAGE.theme);
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  renderThemeButton();
  systemDark.addEventListener?.('change', renderThemeButton);
  els.themeToggle.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    store.set(STORAGE.theme, next);
    renderThemeButton();
  });
}

/* ==========================================================================
   Settings (API key + model)
   ========================================================================== */

function getSettings() {
  const apiKey = (store.get(STORAGE.key) || '').trim();
  let model = store.get(STORAGE.model) || DEFAULT_MODEL;
  if (!MODELS.some((m) => m.id === model)) model = DEFAULT_MODEL;
  return { apiKey, model };
}

function renderKeyStatus() {
  const { apiKey } = getSettings();
  els.keyDot.hidden = Boolean(apiKey);
  els.keyStatusText.textContent = apiKey
    ? 'Gemini key saved in this browser.'
    : 'Uses your free Gemini API key.';
  els.keySetupBtn.textContent = apiKey ? 'Change' : 'Set up key';
}

function setKeyTestStatus(text, tone = '', busy = false) {
  els.keyTestStatus.className = `key-test-status${tone ? ` is-${tone}` : ''}`;
  els.keyTestStatus.innerHTML = busy ? '<span class="spinner" aria-hidden="true"></span>' : '';
  if (!busy && tone === 'success') els.keyTestStatus.innerHTML = ICONS.check;
  els.keyTestStatus.append(document.createTextNode(text));
}

function setKeyVisibility(visible) {
  els.keyInput.type = visible ? 'text' : 'password';
  els.keyVisibility.innerHTML = visible ? ICONS.eyeOff : ICONS.eye;
  els.keyVisibility.setAttribute('aria-label', visible ? 'Hide API key' : 'Show API key');
  els.keyVisibility.setAttribute('aria-pressed', String(visible));
}

function openSettings({ needKey = false } = {}) {
  const { apiKey, model } = getSettings();
  els.keyInput.value = apiKey;
  els.modelSelect.value = model;
  els.keyRequiredNote.hidden = !needKey;
  state.analyzeAfterSave = needKey;
  setKeyVisibility(false);
  setKeyTestStatus('');
  if (typeof els.dialog.showModal === 'function') els.dialog.showModal();
  else els.dialog.setAttribute('open', '');
  els.keyInput.focus();
}

function closeSettings() {
  if (typeof els.dialog.close === 'function') els.dialog.close();
  else els.dialog.removeAttribute('open');
}

async function testKey() {
  const key = els.keyInput.value.trim();
  if (!key) {
    setKeyTestStatus('Paste a key first.', 'danger');
    els.keyInput.focus();
    return;
  }
  els.testKeyBtn.disabled = true;
  setKeyTestStatus('Checking your key with Google…', 'muted', true);
  try {
    const ok = await validateKey(key);
    if (ok) setKeyTestStatus('Key works — you’re good to go.', 'success');
    else setKeyTestStatus('Google rejected this key. Double-check it in AI Studio.', 'danger');
  } catch (err) {
    setKeyTestStatus(err?.message || 'Could not verify the key. Check your connection.', 'danger');
  } finally {
    els.testKeyBtn.disabled = false;
  }
}

function saveSettings() {
  const key = els.keyInput.value.trim();
  if (key) store.set(STORAGE.key, key);
  else store.remove(STORAGE.key);
  store.set(STORAGE.model, els.modelSelect.value || DEFAULT_MODEL);
  const shouldAnalyze = state.analyzeAfterSave && key;
  state.analyzeAfterSave = false;
  closeSettings();
  renderKeyStatus();
  toast(key ? 'Settings saved' : 'API key removed');
  if (shouldAnalyze) startAnalysis();
  else if (key && state.lastJob && !els.viewHome.hidden && !els.panelError.hidden) runJob(state.lastJob);
}

function initSettings() {
  els.modelSelect.replaceChildren(...MODELS.map((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    return opt;
  }));
  setKeyVisibility(false);
  renderKeyStatus();

  els.settingsOpen.addEventListener('click', () => openSettings());
  els.keySetupBtn.addEventListener('click', () => openSettings());
  els.settingsClose.addEventListener('click', closeSettings);
  els.settingsCancel.addEventListener('click', closeSettings);
  els.testKeyBtn.addEventListener('click', testKey);
  els.keyVisibility.addEventListener('click', () => setKeyVisibility(els.keyInput.type === 'password'));
  els.keyInput.addEventListener('input', () => setKeyTestStatus(''));
  els.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });
  els.dialog.addEventListener('close', () => { state.analyzeAfterSave = false; });
  // Click on backdrop closes the dialog.
  els.dialog.addEventListener('click', (e) => {
    if (e.target === els.dialog) closeSettings();
  });
}

/* ==========================================================================
   Upload form
   ========================================================================== */

function validateFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'doc') return 'Older .doc files aren’t supported. Save it as .docx or PDF and try again.';
  if (!ACCEPTED_EXT.includes(ext)) return 'Unsupported file type. Please upload a PDF, DOCX or TXT file.';
  if (file.size === 0) return 'That file looks empty. Please choose another one.';
  if (file.size > MAX_FILE_BYTES) return `That file is ${formatBytes(file.size)} — the limit is 5 MB.`;
  return null;
}

function showUploadError(message) {
  els.uploadError.textContent = message;
  els.uploadError.hidden = false;
}

function clearUploadError() {
  els.uploadError.hidden = true;
  els.uploadError.textContent = '';
}

function hasInput() {
  if (state.pasteMode) return els.pasteInput.value.trim().length >= MIN_TEXT_CHARS;
  return Boolean(state.source);
}

function renderUploadState() {
  const { source, pasteMode } = state;
  els.pasteArea.hidden = !pasteMode;
  els.dropzone.hidden = pasteMode || Boolean(source);
  els.filePill.hidden = pasteMode || !source;
  els.pasteToggle.textContent = pasteMode ? 'Upload a file instead' : 'Paste text instead';
  els.pasteToggle.setAttribute('aria-expanded', String(pasteMode));

  if (source && !pasteMode) {
    if (source.type === 'file') {
      const ext = source.file.name.split('.').pop().toUpperCase();
      els.filePillName.textContent = source.file.name;
      els.filePillMeta.textContent = `${ext} · ${formatBytes(source.file.size)} · Ready to analyze`;
      els.fileRemove.setAttribute('aria-label', `Remove ${source.file.name}`);
    } else {
      els.filePillName.textContent = 'Sample resume';
      els.filePillMeta.textContent = `Demo text · ${formatBytes(new Blob([SAMPLE_RESUME]).size)} · Ready to analyze`;
      els.fileRemove.setAttribute('aria-label', 'Remove sample resume');
    }
  }

  const len = els.pasteInput.value.trim().length;
  els.pasteHint.textContent = len >= MIN_TEXT_CHARS
    ? `${len.toLocaleString()} characters`
    : `At least ${MIN_TEXT_CHARS} characters (${len} so far).`;

  els.analyzeBtn.disabled = !hasInput();
}

function setSource(source) {
  state.source = source;
  if (source) state.pasteMode = false;
  clearUploadError();
  renderUploadState();
}

function handleFile(file) {
  if (!file) return;
  const error = validateFile(file);
  if (error) {
    showUploadError(error);
    return;
  }
  setSource({ type: 'file', file });
  playPillScan();
  els.fileRemove.focus();
}

/** Doc flies into the pill and gets "scanned" once. */
function playPillScan() {
  els.filePill.classList.remove('is-scanning');
  void els.filePill.offsetWidth; // restart animation
  els.filePill.classList.add('is-scanning');
  clearTimeout(playPillScan.timer);
  playPillScan.timer = setTimeout(() => els.filePill.classList.remove('is-scanning'), 1800);
}

function setJdOpen(open) {
  els.jdPanel.hidden = !open;
  els.jdToggle.setAttribute('aria-expanded', String(open));
}

function renderJdCounter() {
  const n = els.jdInput.value.length;
  els.jdCounter.textContent = `${n.toLocaleString()} / ${JD_MAX.toLocaleString()}`;
}

function initUpload() {
  const openPicker = () => els.fileInput.click();

  els.dropzone.addEventListener('click', openPicker);
  els.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  });
  els.fileInput.addEventListener('change', () => {
    handleFile(els.fileInput.files?.[0]);
    els.fileInput.value = '';
  });

  // Drag & drop
  let dragDepth = 0;
  els.dropzone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth += 1;
    els.dropzone.classList.add('is-dragover');
  });
  els.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  els.dropzone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) els.dropzone.classList.remove('is-dragover');
  });
  els.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    els.dropzone.classList.remove('is-dragover');
    handleFile(e.dataTransfer?.files?.[0]);
  });
  // Stop the browser from opening files dropped outside the zone.
  const isFileDrag = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
  window.addEventListener('dragover', (e) => { if (isFileDrag(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => { if (isFileDrag(e)) e.preventDefault(); });

  els.fileRemove.addEventListener('click', () => {
    setSource(null);
    els.dropzone.focus();
  });

  els.sampleBtn.addEventListener('click', () => {
    setSource({ type: 'sample' });
    playPillScan();
    toast('Sample resume loaded');
  });

  els.pasteToggle.addEventListener('click', () => {
    state.pasteMode = !state.pasteMode;
    clearUploadError();
    renderUploadState();
    if (state.pasteMode) els.pasteInput.focus();
    else (state.source ? els.fileRemove : els.dropzone).focus();
  });
  els.pasteInput.addEventListener('input', renderUploadState);

  els.jdToggle.addEventListener('click', () => {
    const open = els.jdPanel.hidden;
    setJdOpen(open);
    if (open) els.jdInput.focus();
  });
  els.jdInput.addEventListener('input', renderJdCounter);

  els.panelForm.addEventListener('submit', (e) => {
    e.preventDefault();
    startAnalysis();
  });

  renderJdCounter();
  renderUploadState();
}

/* ==========================================================================
   Views & panels
   ========================================================================== */

function showView(name) {
  els.viewHome.hidden = name !== 'home';
  els.viewResults.hidden = name !== 'results';
}

function showPanel(name) {
  els.panelForm.hidden = name !== 'form';
  els.panelAnalyzing.hidden = name !== 'analyzing';
  els.panelError.hidden = name !== 'error';
}

function scrollToCard() {
  const rect = els.uploadCard.getBoundingClientRect();
  if (rect.top < 64 || rect.bottom > window.innerHeight) {
    els.uploadCard.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }
}

/* ==========================================================================
   Analysis flow
   ========================================================================== */

let tipTimer = null;

function startTips() {
  stopTips();
  let i = Math.floor(Math.random() * TIPS.length);
  els.tipText.textContent = TIPS[i];
  tipTimer = setInterval(() => {
    i = (i + 1) % TIPS.length;
    els.tipText.classList.add('is-fading');
    setTimeout(() => {
      els.tipText.textContent = TIPS[i];
      els.tipText.classList.remove('is-fading');
    }, 300);
  }, TIP_MS);
}

function stopTips() {
  clearInterval(tipTimer);
  tipTimer = null;
}

/**
 * Animated step list. Steps advance every STEP_MS; the final step keeps
 * spinning until finish() is called (when the API returns).
 */
function createStepRunner(labels) {
  const total = labels.length;
  let index = -1;
  let timer = null;
  let stopped = false;

  els.stepList.replaceChildren();
  const setProgress = (p) => { els.progressBar.style.transform = `scaleX(${p})`; };
  setProgress(0);

  const items = labels.map((label) => {
    const li = document.createElement('li');
    li.className = 'step';
    li.innerHTML = `<span class="step-icon" aria-hidden="true"><span class="spinner"></span>${ICONS.check}</span><span class="step-label"></span>`;
    li.querySelector('.step-label').textContent = label;
    return li;
  });

  function activate(i) {
    index = i;
    items[i].classList.add('is-active');
    els.stepList.append(items[i]);
    els.stepStatus.textContent = labels[i];
    setProgress(Math.min(0.92, (i + 0.5) / total));
  }

  function complete(i) {
    items[i].classList.remove('is-active');
    items[i].classList.add('is-done');
    setProgress((i + 1) / total);
  }

  function tick() {
    if (stopped || index >= total - 1) return;
    complete(index);
    activate(index + 1);
    if (index < total - 1) timer = setTimeout(tick, STEP_MS);
  }

  activate(0);
  timer = setTimeout(tick, STEP_MS);

  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
    /** Quickly complete remaining steps, then resolve. */
    async finish() {
      stopped = true;
      clearTimeout(timer);
      const fast = reducedMotion() ? 0 : 140;
      complete(index);
      while (index < total - 1) {
        await sleep(fast);
        activate(index + 1);
        await sleep(fast);
        complete(index);
      }
      els.stepStatus.textContent = 'Analysis complete';
      await sleep(reducedMotion() ? 0 : 450);
    },
  };
}

function stepLabels(hasJD) {
  return [
    'Parsing resume…',
    'Extracting sections…',
    'Checking ATS compatibility…',
    ...(hasJD ? ['Matching keywords to job…'] : []),
    'Scoring impact & wording…',
    'Generating suggestions…',
  ];
}

function snapshotInput() {
  if (state.pasteMode) return { type: 'paste', text: els.pasteInput.value };
  if (state.source?.type === 'sample') return { type: 'sample' };
  return { type: 'file', file: state.source.file };
}

async function readResumeText(input) {
  if (input.type === 'sample') return SAMPLE_RESUME;
  if (input.type === 'paste') return input.text;
  return extractText(input.file);
}

function startAnalysis() {
  if (!hasInput()) {
    if (state.pasteMode) showUploadError(`Please paste at least ${MIN_TEXT_CHARS} characters of resume text.`);
    return;
  }
  if (!getSettings().apiKey) {
    openSettings({ needKey: true });
    return;
  }
  state.lastJob = {
    input: snapshotInput(),
    jobDescription: els.jdInput.value.trim(),
  };
  runJob(state.lastJob);
}

async function runJob(job) {
  const { apiKey, model } = getSettings();
  if (!apiKey) {
    openSettings({ needKey: true });
    return;
  }

  state.abort?.abort();
  const controller = new AbortController();
  state.abort = controller;
  const runId = ++state.runId;
  const isCurrent = () => runId === state.runId;

  showView('home');
  showPanel('analyzing');
  scrollToCard();
  const steps = createStepRunner(stepLabels(Boolean(job.jobDescription)));
  startTips();

  try {
    const resumeText = await readResumeText(job.input);
    if (!isCurrent()) return;
    if (!resumeText || resumeText.trim().length < MIN_TEXT_CHARS) {
      throw new Error('We couldn’t find enough text in that resume. If it’s a scanned PDF, try “Paste text instead”.');
    }
    const raw = await analyzeResume({
      apiKey,
      model,
      resumeText,
      jobDescription: job.jobDescription,
      signal: controller.signal,
    });
    if (!isCurrent()) return;
    await steps.finish();
    if (!isCurrent()) return;

    state.result = normalizeResult(raw);
    state.hadJD = Boolean(job.jobDescription);
    stopTips();
    renderResults(state.result);
  } catch (err) {
    if (!isCurrent()) return;
    steps.stop();
    stopTips();
    if (err?.name === 'AbortError') {
      showPanel('form');
      return;
    }
    console.error(err);
    showError(err);
  }
}

const ERROR_INFO = {
  NO_KEY: { title: 'A Gemini API key is required', settings: true },
  INVALID_KEY: { title: 'Your API key was rejected', settings: true, hint: 'Copy the key again from Google AI Studio — it usually starts with “AIza”.' },
  FORBIDDEN: { title: 'Gemini denied access', settings: true },
  MODEL_NOT_FOUND: { title: 'That model isn’t available', settings: true, hint: 'Open settings and pick a different model.' },
  RATE_LIMIT: { title: 'Free-tier limit reached', hint: 'Free keys have per-minute limits. Wait about a minute and retry, or switch to a Flash-Lite model in settings for higher limits.' },
  NETWORK: { title: 'Couldn’t reach Gemini', hint: 'Check your internet connection, then retry.' },
  REGION: { title: 'Gemini isn’t available in your region' },
  BLOCKED: { title: 'Gemini declined this content' },
  TOO_LONG: { title: 'That’s a lot of text' },
  SERVER: { title: 'Gemini is busy right now', hint: 'This is usually temporary — retry in a few seconds.' },
};

function showError(err) {
  const info = ERROR_INFO[err?.code] || {};
  els.errorTitle.textContent = info.title || 'We couldn’t analyze your resume';
  els.errorMessage.textContent = err?.message || 'Something went wrong. Please try again.';
  els.errorHint.textContent = info.hint || '';
  els.errorHint.hidden = !info.hint;
  // Settings-related errors make "Change settings" the primary action.
  els.retryBtn.className = `btn ${info.settings ? 'btn-secondary' : 'btn-primary'}`;
  els.errorSettingsBtn.className = `btn ${info.settings ? 'btn-primary' : 'btn-secondary'}`;
  showPanel('error');
  (info.settings ? els.errorSettingsBtn : els.retryBtn).focus();
}

function cancelAnalysis() {
  state.runId += 1;
  state.abort?.abort();
  stopTips();
  showPanel('form');
  els.analyzeBtn.focus();
}

function initAnalysis() {
  els.cancelBtn.addEventListener('click', cancelAnalysis);
  els.retryBtn.addEventListener('click', () => {
    if (state.lastJob) runJob(state.lastJob);
    else showPanel('form');
  });
  els.errorSettingsBtn.addEventListener('click', () => openSettings());
  els.errorBackBtn.addEventListener('click', () => {
    showPanel('form');
    els.analyzeBtn.focus();
  });
}

/* ==========================================================================
   Result normalization (defensive against partial model output)
   ========================================================================== */

function normalizeResult(r) {
  const src = r && typeof r === 'object' ? r : {};
  const score = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : null;
  };
  const str = (v) => (v == null ? '' : String(v)).trim();
  const list = (v) => (Array.isArray(v) ? v : []);
  const strings = (v) => list(v).map((x) => str(x)).filter(Boolean);

  return {
    overallScore: score(src.overallScore) ?? 0,
    atsScore: score(src.atsScore),
    jobMatchScore: src.jobMatchScore == null ? null : score(src.jobMatchScore),
    verdict: str(src.verdict),
    summary: str(src.summary),
    candidate: {
      name: /^unknown$/i.test(str(src.candidate?.name)) ? '' : str(src.candidate?.name),
      title: str(src.candidate?.title),
      yearsExperience: src.candidate?.yearsExperience ?? null,
    },
    categories: list(src.categories).map((c) => ({
      key: str(c?.key),
      name: str(c?.name) || str(c?.key) || 'Category',
      score: score(c?.score) ?? 0,
      feedback: str(c?.feedback),
    })),
    strengths: strings(src.strengths),
    improvements: list(src.improvements)
      .map((i) => ({
        priority: Object.hasOwn(PRIORITY, i?.priority ?? '') ? i.priority : 'medium',
        category: str(i?.category),
        title: str(i?.title),
        detail: str(i?.detail),
        example: str(i?.example),
      }))
      .filter((i) => i.title || i.detail)
      .sort((a, b) => PRIORITY[a.priority].rank - PRIORITY[b.priority].rank),
    atsChecks: list(src.atsChecks)
      .map((c) => ({ label: str(c?.label), passed: Boolean(c?.passed), note: str(c?.note) }))
      .filter((c) => c.label),
    keywords: {
      matched: strings(src.keywords?.matched),
      missing: strings(src.keywords?.missing),
    },
    bulletRewrites: list(src.bulletRewrites)
      .map((b) => ({ original: str(b?.original), improved: str(b?.improved), reason: str(b?.reason) }))
      .filter((b) => b.improved),
    skills: {
      hard: strings(src.skills?.hard),
      soft: strings(src.skills?.soft),
    },
  };
}

/* ==========================================================================
   Results rendering
   ========================================================================== */


/** Points each planned fix adds to the projected score in the what-if simulator. */
const WHATIF_POINTS = { high: 6, medium: 3, low: 1 };

function ringHTML({ score, size, label, large = false }) {
  const band = bandFor(score);
  const aria = `${label}: ${score} out of 100, ${BANDS[band].label}`;
  const circle = (cls) => `<circle class="${cls}" cx="50" cy="50" r="43" pathLength="100"
                stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 50 50)" />`;
  return `
    <div class="ring${large ? ' ring-lg' : ''}" data-band="${band}" data-score="${score}"
         role="img" aria-label="${esc(aria)}"${size ? ` style="--ring-size:${size}px"` : ''}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ring-track" cx="50" cy="50" r="43" />
        ${large ? circle('ring-proj') : ''}
        ${circle('ring-fill')}
      </svg>
      <div class="ring-center" aria-hidden="true">
        <span class="ring-value">0</span>${large ? '<span class="ring-max">/100</span><span class="ring-caption">Overall</span>' : ''}
      </div>
    </div>`;
}

function bandLabelHTML(score) {
  const band = bandFor(score);
  const { label, icon } = BANDS[band];
  return `<p class="band-label band-${band}">${ICONS[icon]}${esc(label)}</p>`;
}

/** Map an improvement's category (key or name) to its category index. */
function categoryIndex(r, category) {
  const c = String(category || '').toLowerCase();
  if (!c) return -1;
  return r.categories.findIndex((cat) => cat.key.toLowerCase() === c || cat.name.toLowerCase() === c);
}

function renderSidebar(r) {
  const c = r.candidate;
  const who = [c.name && `<strong>${esc(c.name)}</strong>`, c.title && esc(c.title)].filter(Boolean).join(' · ');

  const minis = [];
  if (r.jobMatchScore != null) minis.push({ label: 'Job match', score: r.jobMatchScore });
  if (r.atsScore != null) minis.push({ label: 'ATS score', score: r.atsScore });

  const miniHTML = minis.length ? `
    <div class="mini-scores">
      ${minis.map((m) => `
        <div class="card mini-score band-${bandFor(m.score)}">
          ${ringHTML({ score: m.score, label: m.label })}
          <span class="mini-label">${esc(m.label)}</span>
          <span class="mini-band">${esc(BANDS[bandFor(m.score)].label)}</span>
        </div>`).join('')}
    </div>` : '';

  const subscoresHTML = r.categories.length ? `
    <nav class="card subscores" aria-label="Score breakdown">
      <h2 class="subscores-title">Score breakdown</h2>
      <div class="subscore-list">
        ${r.categories.map((cat, i) => {
          const band = bandFor(cat.score);
          return `
          <button type="button" class="subscore band-${band}" data-scroll-to="cat-${i}" data-cat="${i}" style="--i:${i};--w:${cat.score}%"
                  aria-label="${esc(`${cat.name}: ${cat.score} out of 100, ${BANDS[band].label}. Show details`)}">
            <span class="subscore-top">
              <span class="subscore-name">${esc(cat.name)}</span>
              <span class="subscore-val">${cat.score}</span>
            </span>
            <span class="bar"><span class="bar-fill" data-band="${band}"></span></span>
          </button>`;
        }).join('')}
      </div>
    </nav>` : '';

  const projectionHTML = r.improvements.length ? `
    <div class="projection" id="projection" aria-live="polite">
      <span class="projection-label">Projected score</span>
      <span><span class="projection-value" id="projection-value">${r.overallScore}</span><span class="projection-delta" id="projection-delta" hidden></span></span>
      <span class="projection-hint" id="projection-hint">Tick the fixes you plan to make to see your projected score.</span>
    </div>` : '';

  els.sidebar.innerHTML = `
    <div class="card score-card">
      ${ringHTML({ score: r.overallScore, label: 'Overall resume score', large: true })}
      ${bandLabelHTML(r.overallScore)}
      ${r.verdict ? `<p class="verdict">${esc(r.verdict)}</p>` : ''}
      ${who ? `<p class="candidate">${who}</p>` : ''}
      ${projectionHTML}
    </div>
    ${miniHTML}
    ${subscoresHTML}`;
}

function sectionHead(icon, title, meta = '') {
  return `
    <div class="section-head">
      <h2><span class="section-icon" aria-hidden="true">${ICONS[icon]}</span>${esc(title)}</h2>
      ${meta ? `<span class="section-meta">${meta}</span>` : ''}
    </div>`;
}

function summarySection(r) {
  if (!r.summary) return '';
  const facts = [];
  if (r.candidate.title) facts.push(r.candidate.title);
  const years = Number(r.candidate.yearsExperience);
  if (Number.isFinite(years) && years > 0) facts.push(`${years} ${years === 1 ? 'year' : 'years'} experience`);
  return `
    <section class="section" aria-labelledby="sec-summary">
      <div class="card summary-card">
        <p class="eyebrow" id="sec-summary">Summary</p>
        <p class="summary-text">${esc(r.summary)}</p>
        ${facts.length ? `<div class="summary-facts">${facts.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div>` : ''}
      </div>
    </section>`;
}

function fixesSection(r) {
  if (!r.improvements.length) return '';
  const extra = r.improvements.length - FIXES_VISIBLE;
  const cards = r.improvements.map((fix, i) => {
    const p = PRIORITY[fix.priority];
    const pts = WHATIF_POINTS[fix.priority];
    const ci = categoryIndex(r, fix.category);
    const catHTML = ci >= 0
      ? `<button type="button" class="fix-cat" data-scroll-to="cat-${ci}" aria-label="${esc(`See ${r.categories[ci].name} details`)}">${esc(r.categories[ci].name)}${ICONS.arrow}</button>`
      : (fix.category ? `<span class="fix-cat">${esc(fix.category)}</span>` : '');
    return `
      <article class="card fix hover-lift"${i >= FIXES_VISIBLE ? ' hidden data-extra' : ''}>
        <div class="fix-top">
          <span class="pill ${p.cls}">${ICONS[p.icon]}${p.label}</span>
          ${catHTML}
          <label class="whatif">
            <input type="checkbox" data-whatif="${i}" />
            <span>I’ll fix this</span>
            <span class="whatif-pts" aria-label="adds about ${pts} points">+${pts}</span>
          </label>
        </div>
        ${fix.title ? `<h3>${esc(fix.title)}</h3>` : ''}
        ${fix.detail ? `<p class="fix-detail">${esc(fix.detail)}</p>` : ''}
        ${fix.example ? `<div class="example"><span class="example-label">Example</span>${esc(fix.example)}</div>` : ''}
      </article>`;
  }).join('');
  const high = r.improvements.filter((i) => i.priority === 'high').length;
  const meta = high ? `<strong>${high}</strong> critical` : `${r.improvements.length} suggestions`;
  return `
    <section class="section" aria-labelledby="sec-fixes">
      <div id="sec-fixes">${sectionHead('list', 'Top fixes', meta)}</div>
      <p class="whatif-hint">Tick “I’ll fix this” on the changes you plan to make — your projected score updates live.</p>
      <div class="fix-list">${cards}</div>
      ${extra > 0 ? `<button type="button" class="btn btn-secondary show-all" data-action="show-all-fixes" aria-expanded="false">Show all ${r.improvements.length} fixes</button>` : ''}
    </section>`;
}

function atsSection(r) {
  if (!r.atsChecks.length) return '';
  const passed = r.atsChecks.filter((c) => c.passed).length;
  const rows = r.atsChecks.map((c) => `
    <li class="check ${c.passed ? 'is-pass' : 'is-fail'}">
      <span class="check-icon" aria-hidden="true">${c.passed ? ICONS.check : ICONS.warn}</span>
      <div>
        <p class="check-label">${esc(c.label)}<span class="check-status">${c.passed ? 'Pass' : 'Fix'}</span></p>
        ${c.note ? `<p class="check-note">${esc(c.note)}</p>` : ''}
      </div>
    </li>`).join('');
  return `
    <section class="section" aria-labelledby="sec-ats">
      <div id="sec-ats">${sectionHead('shield', 'ATS check', `<strong>${passed}/${r.atsChecks.length}</strong> passed`)}</div>
      <div class="card ats-card"><ul class="check-grid">${rows}</ul></div>
    </section>`;
}

function keywordsSection(r) {
  const { matched, missing } = r.keywords;
  const total = matched.length + missing.length;
  let body;
  if (!total) {
    body = `
      <div class="card empty">
        ${ICONS.target}
        <p>${state.hadJD ? 'No specific keywords were identified for this job.' : 'Add a job description to see which keywords from the posting your resume covers — and which it’s missing.'}</p>
        ${state.hadJD ? '' : '<button type="button" class="btn btn-secondary btn-sm" data-action="edit-jd">Add job description</button>'}
      </div>`;
  } else {
    const pct = Math.round((matched.length / total) * 100);
    const band = bandFor(pct);
    const filterBtn = (key, label, count) => `
      <button type="button" data-kw-filter="${key}" aria-pressed="${key === 'all'}">${label}<span class="count">${count}</span></button>`;
    body = `
      <div class="card kw-card">
        <div class="kw-progress">
          <span class="bar" role="img" aria-label="${matched.length} of ${total} keywords matched"><span class="bar-fill" data-band="${band}" style="width:${pct}%"></span></span>
        </div>
        ${matched.length && missing.length ? `
          <div class="segmented" role="group" aria-label="Filter keywords">
            ${filterBtn('all', 'All', total)}${filterBtn('matched', 'Matched', matched.length)}${filterBtn('missing', 'Missing', missing.length)}
          </div>` : ''}
        ${matched.length ? `
          <div class="kw-group" data-kw-group="matched">
            <h3 class="kw-group-title">Found in your resume (${matched.length})</h3>
            <ul class="chip-list">${matched.map((k) => `<li class="chip chip-match">${ICONS.check}${esc(k)}</li>`).join('')}</ul>
          </div>` : ''}
        ${missing.length ? `
          <div class="kw-group" data-kw-group="missing">
            <h3 class="kw-group-title">Missing — click to copy (${missing.length})</h3>
            <ul class="chip-list">${missing.map((k) => `<li><button type="button" class="chip chip-missing" data-copy-keyword="${esc(k)}" aria-label="Copy keyword: ${esc(k)}">${ICONS.plus}${esc(k)}</button></li>`).join('')}</ul>
          </div>` : ''}
      </div>`;
  }
  const meta = total ? `<strong>${matched.length}/${total}</strong> matched` : '';
  return `
    <section class="section" aria-labelledby="sec-keywords">
      <div id="sec-keywords">${sectionHead('target', 'Keyword match', meta)}</div>
      ${body}
    </section>`;
}

/**
 * Word-level diff (LCS). Returns escaped HTML for both sides with
 * removed words wrapped in .diff-del and added words in <mark class="diff-add">.
 */
function diffWords(before, after) {
  const A = before.split(/\s+/).filter(Boolean);
  const B = after.split(/\s+/).filter(Boolean);
  const plain = (words) => words.map(esc).join(' ');
  if (!A.length || A.length * B.length > 60000) return { before: plain(A), after: plain(B) };

  const key = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}%$+#]+/gu, '') || w;
  const ka = A.map(key);
  const kb = B.map(key);
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = ka[i] === kb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const keepA = new Array(n).fill(false);
  const keepB = new Array(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ka[i] === kb[j]) { keepA[i] = true; keepB[j] = true; i += 1; j += 1; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1;
    else j += 1;
  }
  // Group consecutive changed words into a single highlight.
  const render = (words, keep, open, close) => {
    const out = [];
    let run = [];
    const flush = () => {
      if (run.length) out.push(`${open}${run.join(' ')}${close}`);
      run = [];
    };
    words.forEach((w, idx) => {
      if (keep[idx]) { flush(); out.push(esc(w)); }
      else run.push(esc(w));
    });
    flush();
    return out.join(' ');
  };
  return {
    before: render(A, keepA, '<span class="diff-del">', '</span>'),
    after: render(B, keepB, '<mark class="diff-add">', '</mark>'),
  };
}

function rewritesSection(r) {
  if (!r.bulletRewrites.length) return '';
  const items = r.bulletRewrites.map((b, i) => {
    const diff = b.original ? diffWords(b.original, b.improved) : { before: '', after: esc(b.improved) };
    return `
    <article class="card rewrite">
      <div class="rewrite-grid">
        ${b.original ? `
        <div class="rw-side rw-before">
          <span class="rw-label">Before</span>
          <p><span class="visually-hidden">Original: </span>${diff.before}</p>
        </div>` : ''}
        <div class="rw-side rw-after">
          <div class="rw-after-head">
            <span class="rw-label">${ICONS.check}After</span>
            <button type="button" class="btn btn-secondary btn-sm" data-copy-rewrite="${i}" aria-label="Copy improved bullet">${ICONS.copy}Copy</button>
          </div>
          <p>${diff.after}</p>
        </div>
      </div>
      ${b.reason ? `<p class="reason">${ICONS.bulb}<span>${esc(b.reason)}</span></p>` : ''}
    </article>`;
  }).join('');
  return `
    <section class="section" aria-labelledby="sec-rewrites">
      <div id="sec-rewrites">${sectionHead('pen', 'Bullet rewrites', `${r.bulletRewrites.length} suggested · new words highlighted`)}</div>
      <div class="rewrite-list">${items}</div>
    </section>`;
}

function categoriesSection(r) {
  if (!r.categories.length) return '';
  const items = r.categories.map((cat, i) => {
    const band = bandFor(cat.score);
    const open = cat.score < 60;
    return `
      <div class="card acc" id="cat-${i}">
        <h3>
          <button type="button" class="acc-btn" id="cat-${i}-btn" aria-expanded="${open}" aria-controls="cat-${i}-panel">
            <span class="acc-name">${esc(cat.name)}</span>
            <span class="acc-badge band-${band}">${cat.score}<span>${esc(BANDS[band].label)}</span></span>
            ${ICONS.chevron}
          </button>
        </h3>
        <div class="acc-panel" id="cat-${i}-panel" role="region" aria-labelledby="cat-${i}-btn"${open ? '' : ' hidden'}>
          <p>${esc(cat.feedback || 'No additional feedback for this category.')}</p>
        </div>
      </div>`;
  }).join('');
  return `
    <section class="section" aria-labelledby="sec-categories">
      <div id="sec-categories">${sectionHead('layers', 'Category details')}</div>
      <div class="acc-list">${items}</div>
    </section>`;
}

function skillsSection(r) {
  const { hard, soft } = r.skills;
  if (!hard.length && !soft.length) return '';
  const group = (title, list) => (list.length ? `
    <div class="kw-group">
      <h3 class="kw-group-title">${esc(title)} (${list.length})</h3>
      <ul class="chip-list">${list.map((s) => `<li class="chip">${esc(s)}</li>`).join('')}</ul>
    </div>` : '');
  return `
    <section class="section" aria-labelledby="sec-skills">
      <div id="sec-skills">${sectionHead('sparkle', 'Skills detected')}</div>
      <div class="card skills-card">${group('Hard skills', hard)}${group('Soft skills', soft)}</div>
    </section>`;
}

function strengthsSection(r) {
  if (!r.strengths.length) return '';
  return `
    <section class="section" aria-labelledby="sec-strengths">
      <div class="card strengths-card">
        <h2 id="sec-strengths"><span class="section-icon" aria-hidden="true">${ICONS.thumb}</span> What’s working</h2>
        <ul class="strength-list">${r.strengths.map((s) => `<li>${ICONS.check}<span>${esc(s)}</span></li>`).join('')}</ul>
      </div>
    </section>`;
}

function renderMain(r) {
  els.main.innerHTML = [
    summarySection(r),
    fixesSection(r),
    atsSection(r),
    keywordsSection(r),
    rewritesSection(r),
    categoriesSection(r),
    skillsSection(r),
    strengthsSection(r),
  ].filter(Boolean).join('');

  [...els.main.children].forEach((section, i) => {
    section.classList.add('reveal');
    section.style.setProperty('--i', String(i));
  });
}

/* ==========================================================================
   Score ring animation, category preview, what-if projection
   ========================================================================== */

let ringAnimToken = 0;

/** Count-up numbers + ring stroke, synced on one rAF loop. Resolves when done. */
function animateRings(root) {
  const token = ++ringAnimToken;
  const rings = [...root.querySelectorAll('.ring[data-score]')].map((el) => ({
    el,
    target: Number(el.dataset.score) || 0,
    value: el.querySelector('.ring-value'),
    fill: el.querySelector('.ring-fill'),
  }));
  const paint = (t) => rings.forEach((r) => {
    const v = r.target * t;
    r.value.textContent = String(Math.round(v));
    r.fill.style.strokeDashoffset = String(100 - v);
    r.fill.style.strokeLinecap = v > 0.5 ? 'round' : 'butt';
  });
  const done = () => {
    paint(1);
    rings.forEach((r) => r.el.classList.add('is-live'));
  };

  return new Promise((resolve) => {
    if (reducedMotion()) {
      done();
      resolve();
      return;
    }
    const duration = 1200;
    const start = performance.now();
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    let finished = false;
    const finish = () => {
      if (finished || token !== ringAnimToken) return;
      finished = true;
      done();
      resolve();
    };
    const frame = (now) => {
      if (finished || token !== ringAnimToken) return;
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      paint(easeOut(p));
      if (p < 1) requestAnimationFrame(frame);
      else finish();
    };
    paint(0);
    requestAnimationFrame(frame);
    // Safety net: background tabs throttle rAF.
    setTimeout(finish, duration + 250);
  });
}

function overallRing() {
  return els.sidebar.querySelector('.ring-lg');
}

/** Hovering/focusing a category bar previews that score in the overall ring. */
function previewCategory(index) {
  const ring = overallRing();
  const r = state.result;
  if (!ring || !r || !ring.classList.contains('is-live')) return;
  const fill = ring.querySelector('.ring-fill');
  const value = ring.querySelector('.ring-value');
  const caption = ring.querySelector('.ring-caption');
  els.sidebar.querySelectorAll('.subscore.is-hot').forEach((b) => b.classList.remove('is-hot'));

  const cat = index == null ? null : r.categories[index];
  const score = cat ? cat.score : r.overallScore;
  ring.dataset.band = bandFor(score);
  ring.classList.toggle('is-preview', Boolean(cat));
  fill.style.strokeDashoffset = String(100 - score);
  value.textContent = String(score);
  caption.textContent = cat ? cat.name : 'Overall';
  if (cat) els.sidebar.querySelector(`.subscore[data-cat="${index}"]`)?.classList.add('is-hot');
}

let projectionShown = 0;
let projectionRaf = 0;

function projectedScore() {
  const r = state.result;
  if (!r) return 0;
  let add = 0;
  state.whatIf.forEach((i) => { add += WHATIF_POINTS[r.improvements[i]?.priority] || 0; });
  return Math.min(100, r.overallScore + add);
}

function updateProjection() {
  const r = state.result;
  const box = document.getElementById('projection');
  if (!r || !box) return;
  const target = projectedScore();
  const delta = target - r.overallScore;
  const valueEl = document.getElementById('projection-value');
  const deltaEl = document.getElementById('projection-delta');
  const hintEl = document.getElementById('projection-hint');

  box.classList.toggle('is-active', state.whatIf.size > 0);
  deltaEl.hidden = delta <= 0;
  deltaEl.textContent = `+${delta}`;
  hintEl.textContent = state.whatIf.size
    ? `${state.whatIf.size} planned ${state.whatIf.size === 1 ? 'fix' : 'fixes'} · ${BANDS[bandFor(target)].label}${target >= 100 ? ' (capped at 100)' : ''}`
    : 'Tick the fixes you plan to make to see your projected score.';

  // Ghost arc on the overall ring.
  const proj = overallRing()?.querySelector('.ring-proj');
  if (proj) {
    proj.style.strokeDashoffset = String(100 - target);
    proj.style.stroke = target >= 90 ? 'url(#accent-grad)' : `var(--${bandFor(target)})`;
  }

  // Tween the number.
  cancelAnimationFrame(projectionRaf);
  const from = projectionShown;
  if (reducedMotion() || from === target) {
    projectionShown = target;
    valueEl.textContent = String(target);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, Math.max(0, (now - start) / 450));
    const v = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
    valueEl.textContent = String(v);
    projectionShown = v;
    if (p < 1) projectionRaf = requestAnimationFrame(step);
  };
  projectionRaf = requestAnimationFrame(step);
}

/* ==========================================================================
   Confetti (score >= 85)
   ========================================================================== */

function confettiBurst(originEl) {
  if (reducedMotion() || !originEl) return;
  const rect = originEl.getBoundingClientRect();
  const box = document.createElement('div');
  box.className = 'confetti';
  box.setAttribute('aria-hidden', 'true');
  box.style.setProperty('--ox', `${rect.left + rect.width / 2}px`);
  box.style.setProperty('--oy', `${rect.top + rect.height / 2}px`);
  const colors = ['#4F46E5', '#8B5CF6', '#16A34A', '#F59E0B', '#06B6D4', '#EC4899'];
  const pieces = 90;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < pieces; i += 1) {
    const p = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 260;
    p.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--y', `${Math.sin(angle) * dist - 120}px`);
    p.style.setProperty('--r', `${(Math.random() * 2 - 1) * 720}deg`);
    p.style.setProperty('--d', `${Math.random() * 120}ms`);
    p.style.setProperty('--c', colors[i % colors.length]);
    if (i % 3 === 0) p.style.borderRadius = '50%';
    frag.append(p);
  }
  box.append(frag);
  document.body.append(box);
  setTimeout(() => box.remove(), 2200);
}

async function renderResults(r) {
  state.whatIf = new Set();
  projectionShown = r.overallScore;
  els.sidebar.classList.remove('is-ready');
  renderSidebar(r);
  renderMain(r);
  showView('results');
  window.scrollTo({ top: 0, behavior: 'auto' });
  els.resultsTitle.focus({ preventScroll: true });
  const ringsDone = animateRings(els.sidebar);
  await nextFrame();
  els.sidebar.classList.add('is-ready');
  await ringsDone;
  updateProjection();
  if (r.overallScore >= 85 && state.result === r) {
    confettiBurst(overallRing());
    toast(`${BANDS[bandFor(r.overallScore)].label} resume — nice work!`);
  }
}

/* ==========================================================================
   Results interactions
   ========================================================================== */

function setAccordion(btn, open) {
  btn.setAttribute('aria-expanded', String(open));
  const panel = document.getElementById(btn.getAttribute('aria-controls'));
  if (panel) panel.hidden = !open;
}

function scrollToCategory(id) {
  const acc = document.getElementById(id);
  if (!acc) return;
  const btn = acc.querySelector('.acc-btn');
  setAccordion(btn, true);
  acc.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  btn.focus({ preventScroll: true });
  acc.classList.add('is-flash');
  setTimeout(() => acc.classList.remove('is-flash'), 1200);
}

function suggestionsAsText(r) {
  const lines = [
    'RESUME ANALYSIS — SUGGESTED IMPROVEMENTS',
    `Overall score: ${r.overallScore}/100 (${BANDS[bandFor(r.overallScore)].label})`,
  ];
  if (r.jobMatchScore != null) lines.push(`Job match: ${r.jobMatchScore}/100`);
  lines.push('');
  r.improvements.forEach((fix, i) => {
    const ci = categoryIndex(r, fix.category);
    const cat = ci >= 0 ? r.categories[ci].name : fix.category;
    const planned = state.whatIf.has(i) ? ' [planned]' : '';
    lines.push(`${i + 1}. [${PRIORITY[fix.priority].label}] ${fix.title}${cat ? ` (${cat})` : ''}${planned}`);
    if (fix.detail) lines.push(`   ${fix.detail}`);
    if (fix.example) lines.push(`   Example: ${fix.example}`);
    lines.push('');
  });
  if (r.keywords.missing.length) {
    lines.push(`Missing keywords: ${r.keywords.missing.join(', ')}`);
  }
  return lines.join('\n').trim();
}

function goToForm({ focus } = {}) {
  showView('home');
  showPanel('form');
  renderUploadState();
  window.scrollTo({ top: 0, behavior: 'auto' });
  requestAnimationFrame(() => {
    scrollToCard();
    focus?.focus({ preventScroll: true });
  });
}

function reanalyze() {
  // New file, keep the job description.
  state.source = null;
  state.pasteMode = false;
  els.pasteInput.value = '';
  clearUploadError();
  setJdOpen(Boolean(els.jdInput.value.trim()));
  goToForm({ focus: els.dropzone });
}

function editJobDescription() {
  // Keep the current resume; reopen the JD panel.
  if (state.lastJob?.input) {
    const input = state.lastJob.input;
    if (input.type === 'paste') {
      state.pasteMode = true;
      els.pasteInput.value = input.text;
    } else {
      state.pasteMode = false;
      state.source = input.type === 'sample' ? { type: 'sample' } : { type: 'file', file: input.file };
    }
  }
  setJdOpen(true);
  renderJdCounter();
  goToForm({ focus: els.jdInput });
}

function startOver() {
  state.runId += 1;
  state.abort?.abort();
  state.source = null;
  state.pasteMode = false;
  state.result = null;
  state.lastJob = null;
  state.whatIf = new Set();
  els.pasteInput.value = '';
  els.jdInput.value = '';
  renderJdCounter();
  setJdOpen(false);
  clearUploadError();
  els.sidebar.replaceChildren();
  els.main.replaceChildren();
  els.sidebar.classList.remove('is-ready');
  goToForm({ focus: els.dropzone });
}

function setKeywordFilter(btn) {
  const filter = btn.dataset.kwFilter;
  const card = btn.closest('.kw-card');
  card.querySelectorAll('[data-kw-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  card.querySelectorAll('[data-kw-group]').forEach((g) => {
    g.classList.toggle('is-filtered-out', filter !== 'all' && g.dataset.kwGroup !== filter);
  });
}

async function handleResultsClick(e) {
  const target = e.target.closest('button');
  if (!target || !els.viewResults.contains(target)) return;
  const r = state.result;

  if (target.dataset.scrollTo) {
    scrollToCategory(target.dataset.scrollTo);
    return;
  }
  if (target.classList.contains('acc-btn')) {
    setAccordion(target, target.getAttribute('aria-expanded') !== 'true');
    return;
  }
  if (target.dataset.kwFilter) {
    setKeywordFilter(target);
    return;
  }
  if (target.dataset.copyKeyword !== undefined) {
    const ok = await copyText(target.dataset.copyKeyword);
    toast(ok ? 'Copied!' : 'Couldn’t copy — select the text manually', ok ? 'success' : 'error');
    return;
  }
  if (target.dataset.copyRewrite !== undefined && r) {
    const item = r.bulletRewrites[Number(target.dataset.copyRewrite)];
    const ok = item ? await copyText(item.improved) : false;
    toast(ok ? 'Copied!' : 'Couldn’t copy — select the text manually', ok ? 'success' : 'error');
    return;
  }

  switch (target.dataset.action) {
    case 'show-all-fixes': {
      const expanded = target.getAttribute('aria-expanded') === 'true';
      els.main.querySelectorAll('.fix[data-extra]').forEach((el) => { el.hidden = expanded; });
      target.setAttribute('aria-expanded', String(!expanded));
      target.textContent = expanded ? `Show all ${r?.improvements.length ?? ''} fixes` : 'Show fewer';
      break;
    }
    case 'reanalyze': reanalyze(); break;
    case 'edit-jd': editJobDescription(); break;
    case 'print': window.print(); break;
    case 'copy-suggestions': {
      if (!r || !r.improvements.length) {
        toast('No suggestions to copy', 'error');
        break;
      }
      const ok = await copyText(suggestionsAsText(r));
      toast(ok ? 'Suggestions copied to clipboard' : 'Couldn’t copy to clipboard', ok ? 'success' : 'error');
      break;
    }
    case 'start-over': startOver(); break;
    default: break;
  }
}

function handleWhatIfChange(e) {
  const box = e.target;
  if (!(box instanceof HTMLInputElement) || box.dataset.whatif === undefined) return;
  const i = Number(box.dataset.whatif);
  if (box.checked) state.whatIf.add(i);
  else state.whatIf.delete(i);
  box.closest('.fix')?.classList.toggle('is-planned', box.checked);
  updateProjection();
}

function initResults() {
  els.viewResults.addEventListener('click', handleResultsClick);
  els.viewResults.addEventListener('change', handleWhatIfChange);

  // Category bar hover/focus -> preview in the overall ring.
  const catFrom = (e) => e.target.closest?.('.subscore[data-cat]');
  els.sidebar.addEventListener('pointerover', (e) => {
    const b = catFrom(e);
    previewCategory(b ? Number(b.dataset.cat) : null);
  });
  els.sidebar.addEventListener('pointerleave', () => previewCategory(null));
  els.sidebar.addEventListener('focusin', (e) => {
    const b = catFrom(e);
    previewCategory(b ? Number(b.dataset.cat) : null);
  });
  els.sidebar.addEventListener('focusout', (e) => {
    if (!els.sidebar.contains(e.relatedTarget)) previewCategory(null);
  });

  // Print in light theme regardless of the current theme.
  let themeBeforePrint = null;
  window.addEventListener('beforeprint', () => {
    themeBeforePrint = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light');
  });
  window.addEventListener('afterprint', () => {
    if (themeBeforePrint) document.documentElement.setAttribute('data-theme', themeBeforePrint);
    else document.documentElement.removeAttribute('data-theme');
  });

  els.brandLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (!els.viewResults.hidden) {
      showView('home');
      showPanel('form');
    }
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
}

/* ==========================================================================
   Pointer effects: card glow + hero tilt
   ========================================================================== */

function initPointerEffects() {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // Cursor-follow glow on cards (CSS vars, one write per frame).
  let pending = null;
  let raf = 0;
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pending = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const card = pending?.target?.closest?.('.card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${pending.clientX - rect.left}px`);
      card.style.setProperty('--my', `${pending.clientY - rect.top}px`);
    });
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest?.('.card');
    if (card && !card.contains(e.relatedTarget)) {
      card.style.removeProperty('--mx');
      card.style.removeProperty('--my');
    }
  });

  // 3D tilt on the hero mockup.
  const visual = document.querySelector('.hero-visual');
  const tilt = els.heroTilt;
  if (!visual || !tilt) return;
  const area = els.viewHome;
  area.addEventListener('pointermove', (e) => {
    if (!finePointer.matches || reducedMotion() || e.pointerType !== 'mouse') return;
    const rect = visual.getBoundingClientRect();
    if (!rect.width) return;
    const x = (e.clientX - (rect.left + rect.width / 2)) / window.innerWidth;
    const y = (e.clientY - (rect.top + rect.height / 2)) / window.innerHeight;
    tilt.classList.add('is-tilting');
    tilt.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
    tilt.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
  }, { passive: true });
  area.addEventListener('pointerleave', () => {
    tilt.classList.remove('is-tilting');
    tilt.style.setProperty('--rx', '0deg');
    tilt.style.setProperty('--ry', '0deg');
  });
}

/* ==========================================================================
   Keyboard shortcuts + help
   ========================================================================== */

function openHelp() {
  if (els.helpDialog.open) return;
  els.helpDialog.showModal?.();
  els.helpClose.focus();
}

function focusJobDescription() {
  if (!els.viewResults.hidden) {
    editJobDescription();
    return;
  }
  if (els.panelForm.hidden) return;
  setJdOpen(true);
  els.jdInput.focus();
  els.jdInput.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
}

function initShortcuts() {
  els.helpOpen.addEventListener('click', openHelp);
  els.helpClose.addEventListener('click', () => els.helpDialog.close());
  els.helpDialog.addEventListener('click', (e) => {
    if (e.target === els.helpDialog) els.helpDialog.close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (els.dialog.open || els.helpDialog.open) return;
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]')) return;

    switch (e.key) {
      case '/':
        e.preventDefault();
        focusJobDescription();
        break;
      case '?':
        e.preventDefault();
        openHelp();
        break;
      case 'u':
      case 'U':
        if (!els.viewHome.hidden && !els.panelForm.hidden) {
          e.preventDefault();
          els.fileInput.click();
        }
        break;
      case 't':
      case 'T':
        e.preventDefault();
        els.themeToggle.click();
        break;
      case ',':
        e.preventDefault();
        openSettings();
        break;
      case 'p':
      case 'P':
        if (!els.viewResults.hidden) {
          e.preventDefault();
          window.print();
        }
        break;
      default:
        break;
    }
  });
}

/* ==========================================================================
   Boot
   ========================================================================== */

initTheme();
initSettings();
initUpload();
initAnalysis();
initResults();
initPointerEffects();
initShortcuts();
