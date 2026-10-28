/**
 * UI entry point: wires the DOM controls, pointer and keyboard input to the pure game module
 * and runs the animation loop.
 */
import { createDemoGame, createGame, MAX_SPEED, MIN_SPEED } from './game.js';
import { normalizeLang, translate } from './i18n.js';
import { drawChart, drawScene, screenToWorld } from './render.js';
import { decodeHash } from './share.js';
import { SHAPES } from './shapes.js';
import { resolveShortcut } from './shortcuts.js';
import { loadValue, saveValue } from './storage.js';

const MIN_STROKE_POINTS = 8;
const MIN_STROKE_SPAN = 20;
const STROKE_STEP = 1.2;

const $ = (id) => document.getElementById(id);
const el = {
  stage: $('stage'),
  canvas: $('canvas'),
  hint: $('stage-hint'),
  stats: $('stage-stats'),
  play: $('btn-play'),
  draw: $('btn-draw'),
  reset: $('btn-reset'),
  lang: $('btn-lang'),
  panelBtn: $('btn-panel'),
  panel: $('panel'),
  terms: $('terms'),
  termsOut: $('terms-out'),
  speed: $('speed'),
  speedOut: $('speed-out'),
  samples: $('samples'),
  showCircles: $('show-circles'),
  showOriginal: $('show-original'),
  presets: $('presets'),
  chart: $('chart'),
  svgInput: $('svg-input'),
  svgBtn: $('btn-svg'),
  svgMsg: $('svg-msg'),
  share: $('btn-share'),
  exportBtn: $('btn-export'),
  shareMsg: $('share-msg'),
};

const isDemo = new URLSearchParams(window.location.search).has('demo');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ui = {
  lang: isDemo ? 'en' : normalizeLang(loadValue('lang', 'en')),
  stroke: [],
  drawing: false,
  hintKey: '',
  view: null,
  messages: { svg: '', share: '' },
};

const game = isDemo ? createDemoGame() : createGame({ speed: reducedMotion ? 0.5 : 1 });
if (isDemo) game.setPlaying(false);
else loadFromHash();

const t = (key, vars) => translate(ui.lang, key, vars);

/** Load the path shared in the URL hash, if any. */
function loadFromHash() {
  const points = decodeHash(window.location.hash);
  if (points) game.loadPoints(points);
}

function formatPercent(share) {
  const pct = share * 100;
  if (pct >= 100 - 1e-9) return '100';
  return pct >= 99 ? (Math.floor(pct * 100) / 100).toFixed(2) : pct.toFixed(1);
}

function formatRms(rms) {
  if (rms < 1e-6) return '0';
  return rms < 0.1 ? rms.toExponential(1) : rms.toFixed(2);
}

/** Put every static and dynamic string in the current language. */
function applyLanguage() {
  document.documentElement.lang = ui.lang;
  document.title = t('app.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('doc.description'));
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  }
  for (const node of document.querySelectorAll('[data-i18n-placeholder]')) {
    node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
  }
  el.lang.textContent = ui.lang === 'en' ? 'TR' : 'EN';
  buildPresets();
  syncControls();
}

function buildPresets() {
  el.presets.replaceChildren(
    ...SHAPES.map((shape) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.dataset.shape = shape.id;
      btn.textContent = t(`shape.${shape.id}`);
      return btn;
    }),
  );
}

function setMessage(which, key) {
  ui.messages[which] = key;
  const node = which === 'svg' ? el.svgMsg : el.shareMsg;
  node.textContent = key ? t(key) : '';
}

/** Refresh every control and label from the game state. */
function syncControls() {
  const s = game.getState();
  el.terms.max = String(s.maxK);
  el.terms.value = String(s.k);
  el.termsOut.textContent = t('terms.value', { k: s.k, n: s.maxK, energy: formatPercent(s.energy) });
  el.speed.value = String(s.speed);
  el.speedOut.textContent = t('speed.value', { v: s.speed.toFixed(1) });
  el.samples.value = String(s.samples);
  el.showCircles.checked = s.showCircles;
  el.showOriginal.checked = s.showOriginal;
  el.stats.textContent = t('stats.line', { n: s.samples, rms: formatRms(s.rms) });

  const drawing = s.mode === 'draw';
  el.play.textContent = t(s.playing && !drawing ? 'btn.pause' : 'btn.play');
  el.draw.textContent = t(drawing ? 'btn.cancel' : 'btn.draw');
  el.draw.classList.toggle('is-active', drawing);
  el.stage.classList.toggle('is-drawing', drawing);
  el.hint.hidden = !drawing;
  if (drawing) el.hint.textContent = t(ui.hintKey || 'stage.drawHint');

  for (const seg of document.querySelectorAll('[data-sort]')) {
    seg.setAttribute('aria-pressed', String(seg.dataset.sort === s.sort));
  }
  for (const btn of el.presets.children) {
    btn.classList.toggle('is-active', btn.dataset.shape === s.shapeId);
  }
  for (const [which, key] of Object.entries(ui.messages)) setMessage(which, key);
  drawChart(el.chart, s);
}

function enterDraw() {
  game.enterDrawMode();
  ui.stroke = [];
  ui.hintKey = 'stage.drawHint';
  syncControls();
}

function toggleDraw() {
  if (game.getState().mode === 'draw') {
    game.cancelDraw();
    ui.stroke = [];
    syncControls();
  } else {
    enterDraw();
  }
}

/* ---------- pointer input ---------- */

function pointerWorld(event) {
  const rect = el.canvas.getBoundingClientRect();
  return screenToWorld(ui.view, event.clientX - rect.left, event.clientY - rect.top);
}

function strokeIsUsable(stroke) {
  if (stroke.length < MIN_STROKE_POINTS) return false;
  const xs = stroke.map((p) => p.x);
  const ys = stroke.map((p) => p.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return span >= MIN_STROKE_SPAN;
}

function onPointerDown(event) {
  if (!ui.view) return;
  if (game.getState().mode !== 'draw') {
    game.togglePlay();
    syncControls();
    return;
  }
  event.preventDefault();
  el.canvas.setPointerCapture(event.pointerId);
  ui.drawing = true;
  ui.stroke = [pointerWorld(event)];
}

function onPointerMove(event) {
  if (!ui.drawing) return;
  const p = pointerWorld(event);
  const last = ui.stroke[ui.stroke.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) >= STROKE_STEP) ui.stroke.push(p);
}

function onPointerUp() {
  if (!ui.drawing) return;
  ui.drawing = false;
  if (strokeIsUsable(ui.stroke) && game.loadPoints(ui.stroke)) {
    game.setPlaying(true);
    ui.stroke = [];
  } else {
    ui.hintKey = 'stage.drawShort';
  }
  syncControls();
}

/* ---------- keyboard ---------- */

/**
 * Classifies the focused element for the shortcut rules.
 * @param {EventTarget | null} target
 * @returns {import('./shortcuts.js').TargetKind}
 */
function targetKind(target) {
  if (!(target instanceof HTMLElement)) return 'other';
  if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return 'text';
  if (target.tagName === 'INPUT') {
    const type = /** @type {HTMLInputElement} */ (target).type;
    if (type === 'range') return 'range';
    return ['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type) ? 'control' : 'text';
  }
  return target.tagName === 'BUTTON' || target.tagName === 'A' ? 'control' : 'other';
}

function onKeyDown(event) {
  const action = resolveShortcut(event, targetKind(event.target), game.getState().mode === 'draw');
  if (!action) return;
  if (action.type === 'toggle-play') game.togglePlay();
  else if (action.type === 'terms') game.changeTerms(action.delta);
  else if (action.type === 'reset') game.reset();
  else toggleDraw();
  event.preventDefault();
  syncControls();
}

/* ---------- controls ---------- */

function downloadSvg() {
  const blob = new Blob([game.exportSvg()], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fourier-drawing.svg';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setMessage('share', 'export.done');
}

async function shareLink() {
  const hash = game.shareHash();
  window.history.replaceState(null, '', hash);
  try {
    await navigator.clipboard.writeText(window.location.href);
    setMessage('share', 'share.copied');
  } catch {
    setMessage('share', 'share.inUrl');
  }
}

function loadSvgInput() {
  const ok = game.loadSvg(el.svgInput.value);
  setMessage('svg', ok ? 'svg.ok' : 'svg.error');
  if (ok) game.setPlaying(true);
  syncControls();
}

function bindControls() {
  const on = (node, type, handler) => node.addEventListener(type, handler);
  const after = (fn) => (event) => {
    fn(event);
    syncControls();
  };

  on(el.play, 'click', after(() => game.togglePlay()));
  on(el.draw, 'click', toggleDraw);
  on(el.reset, 'click', after(() => game.reset()));
  on(el.lang, 'click', () => {
    ui.lang = ui.lang === 'en' ? 'tr' : 'en';
    saveValue('lang', ui.lang);
    applyLanguage();
  });
  on(el.panelBtn, 'click', () => {
    const collapsed = el.panel.classList.toggle('is-collapsed');
    el.panelBtn.setAttribute('aria-expanded', String(!collapsed));
    syncControls();
  });
  on(el.terms, 'input', after(() => game.setTerms(Number(el.terms.value))));
  on(el.speed, 'input', after(() => game.setSpeed(Number(el.speed.value))));
  on(el.samples, 'change', after(() => game.setSamples(Number(el.samples.value))));
  on(el.showCircles, 'change', after(() => game.setShowCircles(el.showCircles.checked)));
  on(el.showOriginal, 'change', after(() => game.setShowOriginal(el.showOriginal.checked)));
  for (const seg of document.querySelectorAll('[data-sort]')) {
    on(seg, 'click', after(() => game.setSort(seg.dataset.sort)));
  }
  on(el.presets, 'click', after((event) => {
    const btn = event.target instanceof Element ? event.target.closest('[data-shape]') : null;
    if (btn && game.loadShape(btn.dataset.shape)) game.setPlaying(true);
  }));
  on(el.svgBtn, 'click', loadSvgInput);
  on(el.share, 'click', shareLink);
  on(el.exportBtn, 'click', downloadSvg);

  on(el.canvas, 'pointerdown', onPointerDown);
  on(el.canvas, 'pointermove', onPointerMove);
  on(el.canvas, 'pointerup', onPointerUp);
  on(el.canvas, 'pointercancel', onPointerUp);
  on(window, 'keydown', onKeyDown);
  on(window, 'hashchange', after(loadFromHash));
  on(window, 'resize', () => drawChart(el.chart, game.getState()));
}

/* ---------- loop ---------- */

let lastTime = 0;
function frame(now) {
  const dt = lastTime ? (now - lastTime) / 1000 : 0;
  lastTime = now;
  game.update(dt);
  ui.view = drawScene(el.canvas, game.getState(), ui.stroke);
  window.requestAnimationFrame(frame);
}

el.speed.min = String(MIN_SPEED);
el.speed.max = String(MAX_SPEED);
if (window.matchMedia('(max-width: 860px)').matches) el.panel.classList.add('is-collapsed');
bindControls();
applyLanguage();
ui.view = drawScene(el.canvas, game.getState(), ui.stroke);
window.requestAnimationFrame(frame);
