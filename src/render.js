/**
 * Canvas rendering for Fourier Drawing: the epicycle scene and the amplitude bar chart.
 * UI module (uses the canvas API); it only reads the state snapshot from game.getState().
 * @typedef {{x: number, y: number}} Point
 */

const ACCENT = '192, 132, 252';
const WORLD_RADIUS = 122;
const TRAIL_CHUNK = 16;
const CHART_BARS = 48;

/**
 * Resize a canvas backing store to its CSS size times devicePixelRatio.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ctx: CanvasRenderingContext2D, width: number, height: number}} Size in CSS pixels.
 */
export function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const pw = Math.round(width * dpr);
  const ph = Math.round(height * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

/**
 * World-to-screen mapping that fits the 200-unit shape box into the canvas.
 * @param {number} width
 * @param {number} height
 * @returns {{cx: number, cy: number, scale: number}}
 */
export function viewFor(width, height) {
  return { cx: width / 2, cy: height / 2, scale: Math.min(width, height) / 2 / WORLD_RADIUS };
}

/**
 * Convert a screen point (CSS pixels, relative to the canvas) to world coordinates.
 * @param {{cx: number, cy: number, scale: number}} view
 * @param {number} sx
 * @param {number} sy
 * @returns {Point}
 */
export function screenToWorld(view, sx, sy) {
  return { x: (sx - view.cx) / view.scale, y: (sy - view.cy) / view.scale };
}

function tracePath(ctx, view, points, from, to, close) {
  ctx.beginPath();
  for (let i = from; i < to; i++) {
    const p = points[i];
    const x = view.cx + p.x * view.scale;
    const y = view.cy + p.y * view.scale;
    if (i === from) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  if (close) ctx.closePath();
}

function drawGrid(ctx, width, height, view) {
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  const step = 25 * view.scale;
  ctx.beginPath();
  for (let x = view.cx % step; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = view.cy % step; y < height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

function drawOriginal(ctx, view, points) {
  if (points.length < 2) return;
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1.5;
  tracePath(ctx, view, points, 0, points.length, true);
  ctx.stroke();
  ctx.restore();
}

function drawEpicycles(ctx, view, state) {
  const { chain, terms } = state;
  ctx.lineWidth = 1;
  for (let i = 1; i < chain.length; i++) {
    const r = terms[i - 1].amp * view.scale;
    if (r < 0.6) continue;
    const c = chain[i - 1];
    const fade = 0.32 - 0.22 * (i / chain.length);
    ctx.strokeStyle = `rgba(148, 163, 184, ${fade.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(view.cx + c.x * view.scale, view.cy + c.y * view.scale, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)';
  ctx.lineWidth = 1.3;
  ctx.lineJoin = 'round';
  tracePath(ctx, view, chain, 0, chain.length, false);
  ctx.stroke();
  ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
  const joints = Math.min(chain.length - 1, 12);
  for (let i = 0; i < joints; i++) {
    ctx.beginPath();
    ctx.arc(view.cx + chain[i].x * view.scale, view.cy + chain[i].y * view.scale, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrail(ctx, view, trail) {
  const n = trail.length;
  if (n < 2) return;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let start = 0; start < n - 1; start += TRAIL_CHUNK) {
    const end = Math.min(n, start + TRAIL_CHUNK + 1);
    const age = end / n;
    const alpha = 0.08 + 0.92 * age * age;
    tracePath(ctx, view, trail, start, end, false);
    ctx.strokeStyle = `rgba(${ACCENT}, ${(alpha * 0.22).toFixed(3)})`;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${ACCENT}, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
}

function drawTip(ctx, view, tip) {
  const x = view.cx + tip.x * view.scale;
  const y = view.cy + tip.y * view.scale;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 18);
  glow.addColorStop(0, `rgba(${ACCENT}, 0.85)`);
  glow.addColorStop(1, `rgba(${ACCENT}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5ecff';
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawStroke(ctx, view, stroke) {
  if (stroke.length < 2) return;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${ACCENT}, 0.95)`;
  ctx.lineWidth = 3;
  tracePath(ctx, view, stroke, 0, stroke.length, false);
  ctx.stroke();
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = `rgba(${ACCENT}, 0.45)`;
  ctx.lineWidth = 1.5;
  tracePath(ctx, view, [stroke[stroke.length - 1], stroke[0]], 0, 2, false);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw the whole scene.
 * @param {HTMLCanvasElement} canvas
 * @param {ReturnType<ReturnType<typeof import('./game.js').createGame>['getState']>} state Snapshot from game.getState().
 * @param {Point[]} stroke Points of a stroke being drawn (draw mode), in world coordinates.
 * @returns {{cx: number, cy: number, scale: number}} The view used, for pointer mapping.
 */
export function drawScene(canvas, state, stroke) {
  const { ctx, width, height } = fitCanvas(canvas);
  const view = viewFor(width, height);
  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, width, height, view);
  if (state.mode === 'draw') {
    drawStroke(ctx, view, stroke);
    return view;
  }
  if (state.showOriginal) drawOriginal(ctx, view, state.points);
  drawTrail(ctx, view, state.trail);
  if (state.showCircles) drawEpicycles(ctx, view, state);
  drawTip(ctx, view, state.tip);
  return view;
}

/**
 * Draw the amplitude bar chart of the first terms in the current order; used terms are highlighted.
 * @param {HTMLCanvasElement} canvas
 * @param {{terms: {amp: number}[], k: number}} state
 */
export function drawChart(canvas, state) {
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const bars = state.terms.slice(0, CHART_BARS);
  const maxAmp = bars.reduce((m, t) => Math.max(m, t.amp), 0) || 1;
  const gap = 2;
  const bw = Math.max(1, (width - gap * (bars.length - 1)) / Math.max(1, bars.length));
  bars.forEach((term, i) => {
    const h = Math.max(1, Math.sqrt(term.amp / maxAmp) * (height - 2));
    ctx.fillStyle = i < state.k ? `rgba(${ACCENT}, 0.9)` : 'rgba(148, 163, 184, 0.3)';
    ctx.fillRect(i * (bw + gap), height - h, bw, h);
  });
}
