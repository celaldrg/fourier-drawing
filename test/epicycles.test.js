import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTerms, chainAt, energyShare, reconstruct, rmsError, signedFrequency, sortTerms, tipAt,
} from '../src/epicycles.js';
import { normalize, resampleClosed } from '../src/path.js';
import { SHAPES } from '../src/shapes.js';
import { parseSvgPath } from '../src/svgpath.js';

function shapePoints(shape, n) {
  return resampleClosed(normalize(parseSvgPath(shape.d)), n);
}

test('signedFrequency maps bins to (-N/2, N/2]', () => {
  assert.deepEqual([0, 1, 3, 4, 5, 7].map((k) => signedFrequency(k, 8)), [0, 1, 3, 4, -3, -1]);
});

test('sortTerms orders by amplitude or by frequency', () => {
  const terms = [0, 1, -1, 2, -2, 3].map((freq, i) => ({ freq, re: 0, im: 0, amp: [5, 1, 9, 9, 2, 0][i], phase: 0 }));
  assert.deepEqual(sortTerms(terms, 'amplitude').map((t) => t.freq), [-1, 2, 0, -2, 1, 3]);
  assert.deepEqual(sortTerms(terms, 'frequency').map((t) => t.freq), [0, 1, -1, 2, -2, 3]);
});

test('ten shapes: RMS error never increases with K and is below 1e-9 with all N terms', () => {
  assert.ok(SHAPES.length >= 10);
  for (const shape of SHAPES.slice(0, 10)) {
    for (const mode of ['amplitude', 'frequency']) {
      const pts = shapePoints(shape, 128);
      const terms = buildTerms(pts, mode);
      let prev = Infinity;
      for (let k = 0; k <= pts.length; k++) {
        const err = rmsError(pts, terms, k);
        assert.ok(err <= prev + 1e-9, `${shape.id}/${mode}: K=${k} error ${err} > ${prev}`);
        prev = err;
      }
      assert.ok(prev < 1e-9, `${shape.id}/${mode}: full error ${prev}`);
    }
  }
});

test('RMS error squared equals the energy of the dropped terms (Parseval)', () => {
  const pts = shapePoints(SHAPES[0], 256);
  const terms = buildTerms(pts);
  for (const k of [1, 5, 20, 100]) {
    const dropped = terms.slice(k).reduce((sum, t) => sum + t.amp * t.amp, 0);
    assert.ok(Math.abs(rmsError(pts, terms, k) ** 2 - dropped) < 1e-8);
  }
});

test('tip at t = j/N equals point j with all terms', () => {
  for (const shape of SHAPES) {
    for (const n of [64, 256]) {
      const pts = shapePoints(shape, n);
      const terms = buildTerms(pts);
      pts.forEach((p, j) => {
        const tip = tipAt(terms, n, j / n);
        assert.ok(Math.hypot(tip.x - p.x, tip.y - p.y) < 1e-9, `${shape.id} n=${n} j=${j}`);
      });
    }
  }
});

test('energy share grows with K and reaches 1', () => {
  const pts = shapePoints(SHAPES[1], 256);
  const terms = buildTerms(pts);
  let prev = 0;
  for (let k = 0; k <= 256; k += 8) {
    const e = energyShare(terms, k);
    assert.ok(e >= prev - 1e-15 && e <= 1 + 1e-12);
    prev = e;
  }
  assert.ok(Math.abs(energyShare(terms, 256) - 1) < 1e-12);
  assert.equal(energyShare(terms, 0), 0);
  assert.equal(energyShare([], 3), 1);
});

test('chainAt returns K + 1 joints from the origin to the tip', () => {
  const pts = shapePoints(SHAPES[2], 64);
  const terms = buildTerms(pts);
  const chain = chainAt(terms, 10, 0.3);
  assert.equal(chain.length, 11);
  assert.deepEqual(chain[0], { x: 0, y: 0 });
  assert.deepEqual(chain[10], tipAt(terms, 10, 0.3));
  assert.equal(chainAt(terms, 1000, 0).length, 65);
  for (let i = 1; i < chain.length; i++) {
    const len = Math.hypot(chain[i].x - chain[i - 1].x, chain[i].y - chain[i - 1].y);
    assert.ok(Math.abs(len - terms[i - 1].amp) < 1e-9);
  }
});

test('reconstruct with all terms reproduces the resampled points', () => {
  const pts = shapePoints(SHAPES[3], 64);
  const out = reconstruct(buildTerms(pts, 'frequency'), 64, 64);
  out.forEach((p, j) => assert.ok(Math.hypot(p.x - pts[j].x, p.y - pts[j].y) < 1e-9));
});

test('non-power-of-two N uses the direct DFT and still round-trips', () => {
  const pts = shapePoints(SHAPES[4], 100);
  const terms = buildTerms(pts);
  assert.equal(terms.length, 100);
  assert.ok(rmsError(pts, terms, 100) < 1e-9);
});
