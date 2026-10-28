import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dft, fft, idft, ifft, inverseTransform, isPowerOfTwo, transform } from '../src/fourier.js';
import { resampleClosed } from '../src/path.js';
import { signedFrequency } from '../src/epicycles.js';
import { createRng } from '../src/rng.js';

const TOL = 1e-9;

function randomPoints(rng, n) {
  return Array.from({ length: n }, () => ({ x: rng() * 200 - 100, y: rng() * 200 - 100 }));
}

function maxDiffComplex(a, b) {
  return Math.max(...a.map((c, i) => Math.hypot(c.re - b[i].re, c.im - b[i].im)));
}

function maxDiffPoints(a, b) {
  return Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)));
}

test('isPowerOfTwo', () => {
  assert.deepEqual([1, 2, 64, 1024].map(isPowerOfTwo), [true, true, true, true]);
  assert.deepEqual([0, 3, 100, -4, 2.5].map(isPowerOfTwo), [false, false, false, false, false]);
});

test('DFT and FFT agree within 1e-9 on 50 seeded random inputs', () => {
  const rng = createRng(12345);
  const sizes = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
  for (let i = 0; i < 50; i++) {
    const pts = randomPoints(rng, sizes[i % sizes.length]);
    assert.ok(maxDiffComplex(dft(pts), fft(pts)) < TOL, `input ${i}`);
  }
});

test('inverse transforms reproduce the input within 1e-9', () => {
  const rng = createRng(777);
  for (let i = 0; i < 20; i++) {
    const pts = randomPoints(rng, 2 ** (1 + (i % 10)));
    assert.ok(maxDiffPoints(ifft(fft(pts)), pts) < TOL);
    assert.ok(maxDiffPoints(idft(dft(pts)), pts) < TOL);
    assert.ok(maxDiffPoints(ifft(dft(pts)), pts) < TOL);
  }
  for (const n of [3, 5, 100, 257]) {
    const pts = randomPoints(rng, n);
    assert.ok(maxDiffPoints(inverseTransform(transform(pts)), pts) < TOL, `n=${n}`);
  }
});

test('FFT rejects lengths that are not powers of two', () => {
  assert.throws(() => fft(randomPoints(createRng(1), 6)), RangeError);
  assert.throws(() => ifft([{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }]), RangeError);
});

test('a circle traced at constant speed has exactly one non-zero term', () => {
  for (const [dir, expected] of [[1, 1], [-1, -1]]) {
    const n = 256;
    const r = 37;
    const pts = Array.from({ length: n }, (_, j) => ({
      x: 5 + r * Math.cos((dir * 2 * Math.PI * j) / n),
      y: -3 + r * Math.sin((dir * 2 * Math.PI * j) / n),
    }));
    const coeffs = fft(pts);
    coeffs.forEach((c, k) => {
      const f = signedFrequency(k, n);
      const amp = Math.hypot(c.re, c.im);
      if (f === expected) assert.ok(Math.abs(amp - r) < TOL);
      else if (f === 0) assert.ok(Math.hypot(c.re - 5, c.im + 3) < TOL);
      else assert.ok(amp < TOL, `k=${f} amp=${amp}`);
    });
  }
});

function squareCoefficients() {
  // Counter-clockwise square centred on the origin, traced at constant speed (resampled by arc length).
  const corners = [{ x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];
  const n = 1024;
  const pts = resampleClosed(corners, n);
  return fft(pts).map((c, k) => ({ f: signedFrequency(k, n), amp: Math.hypot(c.re, c.im) }));
}

test('square: only frequencies with k mod 4 = 1 are non-zero', () => {
  const coeffs = squareCoefficients();
  const largest = Math.max(...coeffs.map((c) => c.amp));
  for (const { f, amp } of coeffs) {
    const mod = ((f % 4) + 4) % 4;
    if (mod === 1) assert.ok(amp > 1e-6 * largest, `k=${f} should be non-zero`);
    else assert.ok(amp < 1e-9 * largest, `k=${f} amp=${amp}`);
  }
  const nonZero = coeffs.filter((c) => c.amp > 1e-9 * largest).map((c) => c.f);
  for (const k of [1, -3, 5, -7, 9, -11]) assert.ok(nonZero.includes(k));
});

test('square: |c_k| * k^2 is constant within 1% for |k| <= 41', () => {
  const coeffs = squareCoefficients();
  const products = coeffs
    .filter(({ f }) => Math.abs(f) <= 41 && ((f % 4) + 4) % 4 === 1)
    .map(({ f, amp }) => amp * f * f);
  assert.equal(products.length, 21);
  const min = Math.min(...products);
  const max = Math.max(...products);
  assert.ok(max / min - 1 < 0.01, `spread ${max / min - 1}`);
  // Continuous limit for this square: |c_k| = 8 / (pi^2 k^2) * sqrt(2).
  assert.ok(Math.abs(products[0] / ((8 * Math.SQRT2) / Math.PI ** 2) - 1) < 0.01);
});
