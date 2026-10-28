/**
 * Discrete Fourier transforms of closed 2D paths treated as complex signals z_n = x_n + i*y_n.
 *
 * Convention (forward transform is normalised):
 *   c_k = (1/N) * sum_n z_n * exp(-2*pi*i*k*n/N)
 *   z_n = sum_k c_k * exp(+2*pi*i*k*n/N)
 *
 * @typedef {{x: number, y: number}} Point
 * @typedef {{re: number, im: number}} Complex
 */

/**
 * True when n is a positive power of two.
 * @param {number} n
 * @returns {boolean}
 */
export function isPowerOfTwo(n) {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

/**
 * Direct O(N^2) forward DFT.
 * @param {Point[]} points
 * @returns {Complex[]} Coefficients indexed by bin 0..N-1.
 */
export function dft(points) {
  const n = points.length;
  const out = new Array(n);
  for (let k = 0; k < n; k++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < n; j++) {
      const angle = (-2 * Math.PI * ((k * j) % n)) / n;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      re += points[j].x * c - points[j].y * s;
      im += points[j].x * s + points[j].y * c;
    }
    out[k] = { re: re / n, im: im / n };
  }
  return out;
}

/**
 * Direct O(N^2) inverse DFT.
 * @param {Complex[]} coeffs
 * @returns {Point[]}
 */
export function idft(coeffs) {
  const n = coeffs.length;
  const out = new Array(n);
  for (let j = 0; j < n; j++) {
    let x = 0;
    let y = 0;
    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * ((k * j) % n)) / n;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      x += coeffs[k].re * c - coeffs[k].im * s;
      y += coeffs[k].re * s + coeffs[k].im * c;
    }
    out[j] = { x, y };
  }
  return out;
}

/**
 * In-place iterative radix-2 Cooley-Tukey FFT (unnormalised).
 * @param {Float64Array} re
 * @param {Float64Array} im
 * @param {number} sign -1 for forward, +1 for inverse.
 */
function fftInPlace(re, im, sign) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    for (let m = 0; m < half; m++) {
      const angle = (sign * 2 * Math.PI * m) / len;
      const wr = Math.cos(angle);
      const wi = Math.sin(angle);
      for (let start = 0; start < n; start += len) {
        const a = start + m;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

function assertPowerOfTwo(n) {
  if (!isPowerOfTwo(n)) throw new RangeError(`FFT length must be a power of two, got ${n}`);
}

/**
 * Iterative radix-2 forward FFT; same result as {@link dft}.
 * @param {Point[]} points Length must be a power of two.
 * @returns {Complex[]}
 */
export function fft(points) {
  const n = points.length;
  assertPowerOfTwo(n);
  const re = Float64Array.from(points, (p) => p.x);
  const im = Float64Array.from(points, (p) => p.y);
  fftInPlace(re, im, -1);
  return Array.from(re, (r, k) => ({ re: r / n, im: im[k] / n }));
}

/**
 * Iterative radix-2 inverse FFT; same result as {@link idft}.
 * @param {Complex[]} coeffs Length must be a power of two.
 * @returns {Point[]}
 */
export function ifft(coeffs) {
  assertPowerOfTwo(coeffs.length);
  const re = Float64Array.from(coeffs, (c) => c.re);
  const im = Float64Array.from(coeffs, (c) => c.im);
  fftInPlace(re, im, 1);
  return Array.from(re, (x, j) => ({ x, y: im[j] }));
}

/**
 * Forward transform choosing the FFT for powers of two and the direct DFT otherwise.
 * @param {Point[]} points
 * @returns {Complex[]}
 */
export function transform(points) {
  return isPowerOfTwo(points.length) ? fft(points) : dft(points);
}

/**
 * Inverse transform choosing the FFT for powers of two and the direct DFT otherwise.
 * @param {Complex[]} coeffs
 * @returns {Point[]}
 */
export function inverseTransform(coeffs) {
  return isPowerOfTwo(coeffs.length) ? ifft(coeffs) : idft(coeffs);
}
