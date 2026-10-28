/**
 * Epicycle terms derived from Fourier coefficients: sorting, partial reconstruction and error metrics.
 * @typedef {{x: number, y: number}} Point
 * @typedef {{freq: number, re: number, im: number, amp: number, phase: number}} Term
 */
import { transform } from './fourier.js';

/**
 * Map a bin index 0..N-1 to a signed frequency in (-N/2, N/2].
 * @param {number} k
 * @param {number} n
 * @returns {number}
 */
export function signedFrequency(k, n) {
  return k <= n / 2 ? k : k - n;
}

/**
 * Sort terms by amplitude (largest first) or by frequency (0, 1, -1, 2, -2, ...).
 * Ties are broken by frequency so the order is deterministic.
 * @param {Term[]} terms
 * @param {'amplitude' | 'frequency'} mode
 * @returns {Term[]} A new sorted array.
 */
export function sortTerms(terms, mode) {
  const byFreq = (a, b) => Math.abs(a.freq) - Math.abs(b.freq) || b.freq - a.freq;
  const cmp = mode === 'frequency' ? byFreq : (a, b) => b.amp - a.amp || byFreq(a, b);
  return [...terms].sort(cmp);
}

/**
 * Build epicycle terms for a closed path of N points.
 * @param {Point[]} points Equally spaced samples of the path.
 * @param {'amplitude' | 'frequency'} [mode='amplitude'] Sort order.
 * @returns {Term[]}
 */
export function buildTerms(points, mode = 'amplitude') {
  const n = points.length;
  const terms = transform(points).map((c, k) => ({
    freq: signedFrequency(k, n),
    re: c.re,
    im: c.im,
    amp: Math.hypot(c.re, c.im),
    phase: Math.atan2(c.im, c.re),
  }));
  return sortTerms(terms, mode);
}

/**
 * Joint positions of the epicycle chain at time t; the last entry is the tip.
 * @param {Term[]} terms
 * @param {number} count Number of terms to use (K).
 * @param {number} t Time in [0, 1).
 * @returns {Point[]} count + 1 points, starting at the origin.
 */
export function chainAt(terms, count, t) {
  const joints = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;
  const k = Math.min(count, terms.length);
  for (let i = 0; i < k; i++) {
    const { freq, amp, phase } = terms[i];
    const angle = 2 * Math.PI * freq * t + phase;
    x += amp * Math.cos(angle);
    y += amp * Math.sin(angle);
    joints.push({ x, y });
  }
  return joints;
}

/**
 * Position of the chain's tip at time t.
 * @param {Term[]} terms
 * @param {number} count
 * @param {number} t
 * @returns {Point}
 */
export function tipAt(terms, count, t) {
  const joints = chainAt(terms, count, t);
  return joints[joints.length - 1];
}

/**
 * Reconstruct the path from the first `count` terms at `samples` equally spaced times.
 * @param {Term[]} terms
 * @param {number} count
 * @param {number} samples
 * @returns {Point[]}
 */
export function reconstruct(terms, count, samples) {
  return Array.from({ length: samples }, (_, j) => tipAt(terms, count, j / samples));
}

/**
 * Share of total energy (sum of |c_k|^2) kept by the first `count` terms, in [0, 1].
 * @param {Term[]} terms
 * @param {number} count
 * @returns {number}
 */
export function energyShare(terms, count) {
  let total = 0;
  let kept = 0;
  terms.forEach((term, i) => {
    const e = term.amp * term.amp;
    total += e;
    if (i < count) kept += e;
  });
  return total === 0 ? 1 : kept / total;
}

/**
 * Root-mean-square distance between the points and their reconstruction from `count` terms.
 * @param {Point[]} points
 * @param {Term[]} terms
 * @param {number} count
 * @returns {number}
 */
export function rmsError(points, terms, count) {
  const approx = reconstruct(terms, count, points.length);
  let sum = 0;
  points.forEach((p, j) => {
    sum += (p.x - approx[j].x) ** 2 + (p.y - approx[j].y) ** 2;
  });
  return Math.sqrt(sum / points.length);
}
