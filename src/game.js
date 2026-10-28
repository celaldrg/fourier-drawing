/**
 * App state machine for Fourier Drawing: holds the current path, its epicycle terms and the animation clock.
 * Pure logic, no DOM access; the UI calls the methods and renders getState().
 * @typedef {{x: number, y: number}} Point
 * @typedef {import('./epicycles.js').Term} Term
 */
import { buildTerms, chainAt, energyShare, reconstruct, rmsError, sortTerms, tipAt } from './epicycles.js';
import { DEFAULT_SAMPLES, clampSamples, cleanPath, closedLength, normalize, resampleClosed } from './path.js';
import { encodeHash, pathToSvg } from './share.js';
import { getShape } from './shapes.js';
import { parseSvgPath } from './svgpath.js';

/** Seconds for one full cycle at speed 1. */
export const CYCLE_SECONDS = 12;
export const MIN_SPEED = 0.1;
export const MAX_SPEED = 4;
export const DEFAULT_TERMS = 64;
export const DEMO_SHAPE = 'cat';
export const DEMO_TERMS = 40;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Create an app instance.
 * @param {{shape?: string, points?: Point[], samples?: number, terms?: number, speed?: number,
 *   sort?: 'amplitude' | 'frequency', showCircles?: boolean, showOriginal?: boolean}} [opts]
 */
export function createGame(opts = {}) {
  const s = {
    mode: 'play',
    shapeId: null,
    source: [],
    n: clampSamples(opts.samples ?? DEFAULT_SAMPLES),
    points: [],
    terms: [],
    k: Math.max(1, Math.round(opts.terms ?? DEFAULT_TERMS)),
    sort: opts.sort === 'frequency' ? 'frequency' : 'amplitude',
    speed: clamp(opts.speed ?? 1, MIN_SPEED, MAX_SPEED),
    playing: true,
    showCircles: opts.showCircles ?? true,
    showOriginal: opts.showOriginal ?? true,
    elapsed: 0,
    trail: [],
    nextIndex: 0,
    metrics: null,
  };

  function rebuildTrail() {
    const start = Math.max(0, s.elapsed - 1);
    const first = Math.ceil(start * s.n - 1e-9);
    const last = Math.floor(s.elapsed * s.n + 1e-9);
    s.trail = [];
    for (let i = first; i <= last; i++) s.trail.push(tipAt(s.terms, s.k, i / s.n));
    s.nextIndex = last + 1;
  }

  function recompute() {
    s.points = resampleClosed(s.source, s.n);
    s.terms = buildTerms(s.points, s.sort);
    s.k = clamp(s.k, 1, s.n);
    s.metrics = null;
    rebuildTrail();
  }

  /**
   * Load a raw path (freehand stroke, decoded hash, parsed SVG). It is closed, centred and scaled.
   * @param {Point[]} raw
   * @param {string | null} [shapeId=null]
   * @returns {boolean} False when the path is degenerate (fewer than 3 points or zero length).
   */
  function loadPoints(raw, shapeId = null) {
    const clean = cleanPath(raw || []);
    if (clean.length < 3 || closedLength(clean) === 0) return false;
    s.source = normalize(clean);
    s.shapeId = shapeId;
    s.mode = 'play';
    s.elapsed = 0;
    recompute();
    return true;
  }

  /**
   * Load a built-in shape by id.
   * @param {string} id
   * @returns {boolean}
   */
  function loadShape(id) {
    const shape = getShape(id);
    return shape ? loadPoints(parseSvgPath(shape.d), id) : false;
  }

  /**
   * Load SVG path data.
   * @param {string} d
   * @returns {boolean} False when the data is malformed or degenerate.
   */
  function loadSvg(d) {
    try {
      return loadPoints(parseSvgPath(d));
    } catch {
      return false;
    }
  }

  function getMetrics() {
    if (!s.metrics) {
      s.metrics = { energy: energyShare(s.terms, s.k), rms: rmsError(s.points, s.terms, s.k) };
    }
    return s.metrics;
  }

  const api = {
    loadPoints,
    loadShape,
    loadSvg,

    /** @param {number} k Number of terms, clamped to [1, N]. */
    setTerms(k) {
      const next = clamp(Math.round(k), 1, s.n);
      if (next === s.k) return;
      s.k = next;
      s.metrics = null;
      rebuildTrail();
    },

    /** @param {number} delta Change the term count by delta. */
    changeTerms(delta) {
      api.setTerms(s.k + delta);
    },

    /** @param {number} n Sample count, clamped to [64, 1024]. */
    setSamples(n) {
      s.n = clampSamples(n);
      if (s.source.length) recompute();
    },

    /** @param {number} speed Cycle-speed multiplier, clamped to [0.1, 4]. */
    setSpeed(speed) {
      s.speed = clamp(Number(speed) || 1, MIN_SPEED, MAX_SPEED);
    },

    /** @param {'amplitude' | 'frequency'} mode */
    setSort(mode) {
      s.sort = mode === 'frequency' ? 'frequency' : 'amplitude';
      s.terms = sortTerms(s.terms, s.sort);
      s.metrics = null;
      rebuildTrail();
    },

    /** @param {boolean} on */
    setShowCircles(on) {
      s.showCircles = Boolean(on);
    },

    /** @param {boolean} on */
    setShowOriginal(on) {
      s.showOriginal = Boolean(on);
    },

    /** Toggle between playing and paused (switches back to play mode from draw mode). */
    togglePlay() {
      if (s.mode === 'draw') {
        s.mode = 'play';
        s.playing = true;
        return;
      }
      s.playing = !s.playing;
    },

    /** @param {boolean} on */
    setPlaying(on) {
      s.playing = Boolean(on);
    },

    /** Restart the trace from t = 0. */
    reset() {
      s.elapsed = 0;
      s.mode = 'play';
      rebuildTrail();
    },

    /** Switch to draw mode; the UI collects a stroke and calls loadPoints. */
    enterDrawMode() {
      s.mode = 'draw';
    },

    /** Leave draw mode without changing the path. */
    cancelDraw() {
      s.mode = 'play';
    },

    /**
     * Jump to an absolute time (in cycles) and rebuild the trail for the last cycle.
     * @param {number} cycles
     */
    seek(cycles) {
      s.elapsed = Math.max(0, cycles);
      rebuildTrail();
    },

    /**
     * Advance the animation.
     * @param {number} dt Seconds since the last frame.
     */
    update(dt) {
      if (!s.playing || s.mode !== 'play' || !s.terms.length || !(dt > 0)) return;
      s.elapsed += (Math.min(dt, 0.25) * s.speed) / CYCLE_SECONDS;
      while (s.nextIndex <= s.elapsed * s.n + 1e-9) {
        s.trail.push(tipAt(s.terms, s.k, s.nextIndex / s.n));
        s.nextIndex++;
      }
      if (s.trail.length > s.n + 1) s.trail.splice(0, s.trail.length - s.n - 1);
    },

    /** @returns {string} URL hash sharing the resampled points (one decimal). */
    shareHash() {
      return encodeHash(s.points);
    },

    /** @returns {string} SVG document of the path traced with the current K terms. */
    exportSvg() {
      return pathToSvg(reconstruct(s.terms, s.k, s.n));
    },

    /** Snapshot of everything the UI needs to render. */
    getState() {
      const t = s.elapsed - Math.floor(s.elapsed);
      const chain = chainAt(s.terms, s.k, t);
      const { energy, rms } = getMetrics();
      return {
        mode: s.mode,
        shapeId: s.shapeId,
        samples: s.n,
        points: s.points,
        terms: s.terms,
        k: s.k,
        maxK: s.n,
        energy,
        rms,
        sort: s.sort,
        speed: s.speed,
        playing: s.playing,
        showCircles: s.showCircles,
        showOriginal: s.showOriginal,
        t,
        elapsed: s.elapsed,
        chain,
        tip: chain[chain.length - 1],
        trail: s.trail,
      };
    },
  };

  if (opts.points) loadPoints(opts.points);
  else loadShape(opts.shape ?? 'star');
  return api;
}

/**
 * Build the deterministic "?demo" state: the cat shape traced half-way with 40 terms, circles visible.
 * @returns {ReturnType<typeof createGame>}
 */
export function createDemoGame() {
  const game = createGame({ shape: DEMO_SHAPE, terms: DEMO_TERMS, showCircles: true, showOriginal: true });
  game.seek(0.5);
  return game;
}
