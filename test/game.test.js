import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CYCLE_SECONDS, DEMO_SHAPE, DEMO_TERMS, createDemoGame, createGame } from '../src/game.js';
import { decodeHash } from '../src/share.js';
import { SHAPES } from '../src/shapes.js';

test('createGame starts with the star, 256 samples and 64 terms', () => {
  const s = createGame().getState();
  assert.equal(s.shapeId, 'star');
  assert.equal(s.samples, 256);
  assert.equal(s.points.length, 256);
  assert.equal(s.terms.length, 256);
  assert.equal(s.k, 64);
  assert.equal(s.mode, 'play');
  assert.equal(s.playing, true);
  assert.equal(s.chain.length, 65);
  assert.ok(s.energy > 0.9 && s.energy <= 1);
  assert.ok(s.rms >= 0);
});

test('every built-in shape loads', () => {
  const game = createGame();
  for (const shape of SHAPES) {
    assert.equal(game.loadShape(shape.id), true);
    assert.equal(game.getState().shapeId, shape.id);
  }
  assert.equal(game.loadShape('missing'), false);
});

test('terms are clamped to [1, N] and change with arrow-key steps', () => {
  const game = createGame({ samples: 64 });
  game.setTerms(500);
  assert.equal(game.getState().k, 64);
  game.setTerms(-3);
  assert.equal(game.getState().k, 1);
  game.changeTerms(4);
  assert.equal(game.getState().k, 5);
});

test('energy and RMS follow K', () => {
  const game = createGame();
  game.setTerms(5);
  const low = game.getState();
  game.setTerms(100);
  const high = game.getState();
  assert.ok(high.energy > low.energy);
  assert.ok(high.rms < low.rms);
  game.setTerms(256);
  assert.ok(game.getState().rms < 1e-9);
});

test('a long frame is capped at 0.25 s', () => {
  const game = createGame();
  game.update(10);
  assert.ok(Math.abs(game.getState().elapsed - 0.25 / CYCLE_SECONDS) < 1e-12);
});

test('update advances time and grows the trail; pausing stops it', () => {
  const game = createGame({ samples: 64 });
  for (let i = 0; i < 30; i++) game.update(CYCLE_SECONDS / 120);
  let s = game.getState();
  assert.ok(Math.abs(s.t - 0.25) < 1e-12);
  assert.equal(s.trail.length, 17);
  game.togglePlay();
  game.update(1);
  assert.ok(Math.abs(game.getState().t - 0.25) < 1e-12);
  game.setPlaying(true);
  for (let i = 0; i < 400; i++) game.update(0.05);
  s = game.getState();
  assert.ok(s.elapsed > 1);
  assert.ok(s.trail.length <= 65);
});

test('speed scales the clock and is clamped', () => {
  const game = createGame();
  game.setSpeed(2);
  for (let i = 0; i < 15; i++) game.update(CYCLE_SECONDS / 120);
  assert.ok(Math.abs(game.getState().t - 0.25) < 1e-12);
  game.setSpeed(100);
  assert.equal(game.getState().speed, 4);
  game.setSpeed(0);
  assert.equal(game.getState().speed, 1);
});

test('reset returns to t = 0 with an almost empty trail', () => {
  const game = createGame();
  for (let i = 0; i < 10; i++) game.update(0.2);
  game.reset();
  const s = game.getState();
  assert.equal(s.t, 0);
  assert.equal(s.trail.length, 1);
});

test('draw mode freezes the clock and a stroke switches back to play', () => {
  const game = createGame();
  game.enterDrawMode();
  game.update(1);
  assert.equal(game.getState().mode, 'draw');
  assert.equal(game.getState().elapsed, 0);
  const stroke = Array.from({ length: 50 }, (_, i) => ({ x: 300 + 80 * Math.cos(i / 8), y: 200 + 50 * Math.sin(i / 8) }));
  assert.equal(game.loadPoints(stroke), true);
  const s = game.getState();
  assert.equal(s.mode, 'play');
  assert.equal(s.shapeId, null);
  assert.equal(s.points.length, 256);
  game.enterDrawMode();
  game.cancelDraw();
  assert.equal(game.getState().mode, 'play');
  game.enterDrawMode();
  game.togglePlay();
  assert.equal(game.getState().mode, 'play');
});

test('degenerate or malformed input is rejected and keeps the old path', () => {
  const game = createGame({ shape: 'heart' });
  assert.equal(game.loadPoints([{ x: 1, y: 1 }, { x: 1, y: 1 }]), false);
  assert.equal(game.loadPoints([]), false);
  assert.equal(game.loadSvg('M0 0 L10'), false);
  assert.equal(game.loadSvg('M0 0 L5 5'), false);
  assert.equal(game.getState().shapeId, 'heart');
  assert.equal(game.loadSvg('M0 0 h10 v10 h-10 z'), true);
});

test('sample count can be changed between 64 and 1024', () => {
  const game = createGame();
  game.setSamples(1024);
  assert.equal(game.getState().points.length, 1024);
  game.setSamples(10);
  assert.equal(game.getState().samples, 64);
  assert.equal(game.getState().k, 64);
});

test('sorting by frequency puts the constant term first', () => {
  const game = createGame();
  game.setSort('frequency');
  const s = game.getState();
  assert.equal(s.sort, 'frequency');
  assert.deepEqual(s.terms.slice(0, 3).map((t) => t.freq), [0, 1, -1]);
  game.setSort('amplitude');
  const amps = game.getState().terms.map((t) => t.amp);
  assert.ok(amps.every((a, i) => i === 0 || amps[i - 1] >= a));
});

test('share hash round-trips through decodeHash and loadPoints', () => {
  const game = createGame({ shape: 'fish' });
  const hash = game.shareHash();
  const pts = decodeHash(hash);
  assert.equal(pts.length, 256);
  const other = createGame();
  assert.equal(other.loadPoints(pts), true);
  const a = game.getState().points;
  const b = other.getState().points;
  const maxErr = Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)));
  assert.ok(maxErr < 1, `max error ${maxErr}`);
});

test('exportSvg returns a standalone SVG of the traced path', () => {
  const svg = createGame().exportSvg();
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<path d="M[-\d.]+ [-\d.]+ L/);
  assert.match(svg, / Z" fill="none"/);
});

test('toggles for circles and the original shape', () => {
  const game = createGame();
  game.setShowCircles(false);
  game.setShowOriginal(false);
  const s = game.getState();
  assert.equal(s.showCircles, false);
  assert.equal(s.showOriginal, false);
});

test('demo state: preset traced half-way with 40 terms and circles visible', () => {
  const s = createDemoGame().getState();
  assert.equal(s.shapeId, DEMO_SHAPE);
  assert.equal(s.k, DEMO_TERMS);
  assert.equal(s.k, 40);
  assert.equal(s.t, 0.5);
  assert.equal(s.showCircles, true);
  assert.equal(s.trail.length, s.samples / 2 + 1);
  assert.deepEqual(createDemoGame().getState().trail, s.trail);
});

test('changing K rebuilds the trail for the elapsed time', () => {
  const game = createDemoGame();
  const before = game.getState().trail.slice();
  game.setTerms(256);
  const after = game.getState();
  assert.equal(after.trail.length, before.length);
  after.trail.forEach((p, j) => {
    assert.ok(Math.hypot(p.x - after.points[j].x, p.y - after.points[j].y) < 1e-9);
  });
});
