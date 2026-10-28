import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSvgPath } from '../src/svgpath.js';
import { SHAPES, getShape } from '../src/shapes.js';

const P = (x, y) => ({ x, y });

function assertPoints(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: length ${actual.length}`);
  actual.forEach((p, i) => {
    assert.ok(Math.abs(p.x - expected[i].x) < 1e-9 && Math.abs(p.y - expected[i].y) < 1e-9,
      `${label}: point ${i} is (${p.x}, ${p.y}), expected (${expected[i].x}, ${expected[i].y})`);
  });
}

// curveSteps = 2 puts one sample at t = 0.5 on every curve; arc cases use 1 step per quarter turn.
const CASES = [
  ['absolute lines and close', 'M0 0 L10 0 L10 10 Z', [P(0, 0), P(10, 0), P(10, 10), P(0, 0)]],
  ['relative move and line', 'm1 2 l3 4', [P(1, 2), P(4, 6)]],
  ['implicit L after M', 'M0 0 10 0 10 10', [P(0, 0), P(10, 0), P(10, 10)]],
  ['implicit l after m', 'm0 0 10 0 0 10', [P(0, 0), P(10, 0), P(10, 10)]],
  ['H V h v', 'M0 0 H5 V5 h-5 v-5', [P(0, 0), P(5, 0), P(5, 5), P(0, 5), P(0, 0)]],
  ['commas and no spaces', 'M0,0L1,1l1,-1', [P(0, 0), P(1, 1), P(2, 0)]],
  ['compact negatives and decimals', 'M0-1.5-2.5.5', [P(0, -1.5), P(-2.5, 0.5)]],
  ['exponents', 'M1e1 2E0 l-1e-1,0', [P(10, 2), P(9.9, 2)]],
  ['implicit repeated H', 'M0 0 H1 2 3', [P(0, 0), P(1, 0), P(2, 0), P(3, 0)]],
  ['cubic', 'M0 0 C0 10 10 10 10 0', [P(0, 0), P(5, 7.5), P(10, 0)]],
  ['relative cubic', 'M10 10 c0 10 10 10 10 0', [P(10, 10), P(15, 17.5), P(20, 10)]],
  ['smooth cubic reflects control', 'M0 0 C0 10 10 10 10 0 S20 -10 20 0',
    [P(0, 0), P(5, 7.5), P(10, 0), P(15, -7.5), P(20, 0)]],
  ['smooth cubic without previous cubic', 'M0 0 S10 10 20 0', [P(0, 0), P(6.25, 3.75), P(20, 0)]],
  ['implicit repeated cubic', 'M0 0 C0 10 10 10 10 0 10 -10 20 -10 20 0',
    [P(0, 0), P(5, 7.5), P(10, 0), P(15, -7.5), P(20, 0)]],
  ['quadratic', 'M0 0 Q10 10 20 0', [P(0, 0), P(10, 5), P(20, 0)]],
  ['smooth quadratic', 'M0 0 Q10 10 20 0 T40 0', [P(0, 0), P(10, 5), P(20, 0), P(30, -5), P(40, 0)]],
  ['relative quadratic chain', 'm0 0 q10 10 20 0 t20 0', [P(0, 0), P(10, 5), P(20, 0), P(30, -5), P(40, 0)]],
  ['smooth quadratic after a line is straight', 'M0 0 L10 0 T20 0', [P(0, 0), P(10, 0), P(12.5, 0), P(20, 0)]],
  ['arc, sweep 1', 1, 'M0 0 A10 10 0 0 1 20 0', [P(0, 0), P(10, -10), P(20, 0)]],
  ['arc, sweep 0', 1, 'M0 0 A10 10 0 0 0 20 0', [P(0, 0), P(10, 10), P(20, 0)]],
  ['relative arc with packed flags', 1, 'M0 0a10 10 0 0020 0', [P(0, 0), P(10, 10), P(20, 0)]],
  ['arc radius scaled up when too small', 1, 'M0 0 A1 1 0 0 1 20 0', [P(0, 0), P(10, -10), P(20, 0)]],
  ['arc with zero radius is a line', 1, 'M0 0 A0 5 0 0 1 10 0', [P(0, 0), P(10, 0)]],
  ['arc to the current point is skipped', 1, 'M5 5 A3 3 0 0 1 5 5 L6 5', [P(5, 5), P(6, 5)]],
  ['second subpath after close, relative', 'M0 0 L10 0 L10 10 Z m20 0 l5 0',
    [P(0, 0), P(10, 0), P(10, 10), P(0, 0), P(20, 0), P(25, 0)]],
  ['close when already at start adds nothing', 'M0 0 L1 0 L0 0 z', [P(0, 0), P(1, 0), P(0, 0)]],
];

for (const entry of CASES) {
  const [label, steps, d, expected] = entry.length === 4 ? entry : [entry[0], 2, entry[1], entry[2]];
  test(`parseSvgPath: ${label}`, () => {
    assertPoints(parseSvgPath(d, { curveSteps: steps }), expected, label);
  });
}

test('parseSvgPath: large rotated arcs stay on the ellipse', () => {
  const pts = parseSvgPath('M0 0 A10 10 0 1 1 10 10', { curveSteps: 4 });
  assert.equal(pts.length, 1 + 12); // three quarter turns, four steps each
  const centres = [P(10, 0), P(0, 10)];
  const onCircle = centres.filter((c) => pts.every((p) => Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - 10) < 1e-9));
  assert.equal(onCircle.length, 1);
  const rotated = parseSvgPath('M0 0 A20 10 90 0 1 0 40', { curveSteps: 1 });
  assert.equal(rotated.length, 3);
  assert.ok(Math.abs(Math.abs(rotated[1].x) - 10) < 1e-9 && Math.abs(rotated[1].y - 20) < 1e-9);
  assertPoints([rotated[2]], [P(0, 40)], 'rotated end');
});

test('parseSvgPath: default flattening is fine', () => {
  const pts = parseSvgPath('M0 0 C0 10 10 10 10 0');
  assert.equal(pts.length, 25);
});

test('parseSvgPath: malformed input throws SyntaxError', () => {
  for (const d of ['M0 0 L10', 'M0 0 X5 5', 'M0 0 A10 10 0 2 1 5 5', 'M0 0 Z 5 5', '10 10', 'M0 0 L1 1e']) {
    assert.throws(() => parseSvgPath(d), SyntaxError, d);
  }
  assert.deepEqual(parseSvgPath('   '), []);
});

test('built-in shapes: at least 8, unique ids, all parse into usable paths', () => {
  assert.ok(SHAPES.length >= 8);
  assert.equal(new Set(SHAPES.map((s) => s.id)).size, SHAPES.length);
  for (const shape of SHAPES) {
    const pts = parseSvgPath(shape.d);
    assert.ok(pts.length >= 8, shape.id);
    for (const p of pts) assert.ok(p.x >= 0 && p.x <= 200 && p.y >= 0 && p.y <= 200, `${shape.id} inside the box`);
  }
  assert.equal(getShape('heart').id, 'heart');
  assert.equal(getShape('nope'), undefined);
});
