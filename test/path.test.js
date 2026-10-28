import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bounds, clampSamples, cleanPath, closedLength, normalize, resampleClosed } from '../src/path.js';
import { createRng } from '../src/rng.js';

/** Arc-length position of p on the closed polygon, searching segments from `fromSeg` onwards. */
function arcPosition(poly, p, fromSeg) {
  let acc = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (i >= fromSeg && len > 0) {
      const u = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len);
      const qx = a.x + u * (b.x - a.x);
      const qy = a.y + u * (b.y - a.y);
      if (u >= -1e-9 && u <= 1 + 1e-9 && Math.hypot(p.x - qx, p.y - qy) < 1e-7) {
        return { pos: acc + u * len, seg: i };
      }
    }
    acc += len;
  }
  throw new Error('point not on path');
}

function assertEquallySpaced(poly, n) {
  const total = closedLength(poly);
  const out = resampleClosed(poly, n);
  assert.equal(out.length, n);
  let seg = 0;
  out.forEach((p, j) => {
    const hit = arcPosition(poly, p, seg);
    seg = hit.seg;
    assert.ok(Math.abs(hit.pos - (j * total) / n) < 1e-6 * total, `point ${j}`);
  });
}

test('closedLength includes the closing segment', () => {
  assert.equal(closedLength([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }]), 12);
});

test('cleanPath drops duplicates, non-finite points and the repeated start', () => {
  const out = cleanPath([
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: NaN, y: 2 }, { x: 1, y: 1 }, { x: 0, y: 0 },
  ]);
  assert.deepEqual(out, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
});

test('resampling a rectangle spaces points equally by arc length', () => {
  const rect = [
    { x: 0, y: 0 }, { x: 70, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 40 },
  ];
  assertEquallySpaced(rect, 256);
  assertEquallySpaced(rect, 64);
  assertEquallySpaced(rect, 1000);
});

test('resampling random polygons spaces points equally within 1e-6 of the length', () => {
  const rng = createRng(2026);
  for (let i = 0; i < 10; i++) {
    const poly = Array.from({ length: 5 + i * 7 }, () => ({ x: rng() * 400, y: rng() * 300 }));
    assertEquallySpaced(poly, [64, 256, 1024][i % 3]);
  }
});

test('resampling starts at the first point and closes the path', () => {
  const out = resampleClosed([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], 8);
  assert.deepEqual(out[0], { x: 0, y: 0 });
  assert.deepEqual(out[7], { x: 0, y: 2 });
});

test('degenerate paths resample to repeated points', () => {
  assert.deepEqual(resampleClosed([{ x: 2, y: 3 }, { x: 2, y: 3 }], 4), Array(4).fill({ x: 2, y: 3 }));
  assert.throws(() => resampleClosed([], 4), RangeError);
});

test('clampSamples keeps N in [64, 1024]', () => {
  assert.equal(clampSamples(10), 64);
  assert.equal(clampSamples(5000), 1024);
  assert.equal(clampSamples(300.4), 300);
  assert.equal(clampSamples('abc'), 256);
});

test('normalize centres the box and scales the larger side to 200', () => {
  const out = normalize([{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 30 }]);
  assert.deepEqual(bounds(out), { minX: -100, minY: -50, maxX: 100, maxY: 50 });
});
