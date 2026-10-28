import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHash, encodeHash, pathToSvg } from '../src/share.js';
import { loadValue, saveValue } from '../src/storage.js';

test('encodeHash rounds to one decimal and decodeHash reads it back', () => {
  const hash = encodeHash([{ x: 1.26, y: -0.04 }, { x: -3, y: 4.449 }, { x: 0, y: 7 }]);
  assert.equal(hash, '#p=1.3,0,-3,4.4,0,7');
  assert.deepEqual(decodeHash(hash), [{ x: 1.3, y: 0 }, { x: -3, y: 4.4 }, { x: 0, y: 7 }]);
  assert.deepEqual(decodeHash('p=1,2,3,4,5,6'), [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }]);
});

test('decodeHash rejects missing or invalid data', () => {
  for (const h of ['', '#', '#x=1,2', '#p=1,2,3', '#p=1,2,3,4', '#p=1,2,3,4,5,abc', '#p=1,2,3,4,5,1e9', '#p=%E0%A4%A']) {
    assert.equal(decodeHash(h), null, h);
  }
  assert.equal(decodeHash(`#p=${Array(2050).fill(1).join(',')}`), null);
});

test('pathToSvg builds a padded viewBox around the points', () => {
  const svg = pathToSvg([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }], { padding: 1, stroke: '#fff' });
  assert.match(svg, /viewBox="-1 -1 12 7"/);
  assert.match(svg, /d="M0 0 L10 0 L10 5 Z"/);
  assert.match(svg, /stroke="#fff"/);
});

test('storage helper survives missing and throwing localStorage', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
    assert.equal(loadValue('lang', 'en'), 'en');
    assert.equal(saveValue('lang', 'tr'), false);

    const map = new Map();
    const fake = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v) };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: fake });
    assert.equal(loadValue('lang', 'en'), 'en');
    assert.equal(saveValue('lang', 'tr'), true);
    assert.equal(loadValue('lang'), 'tr');

    const full = { getItem() { throw new Error('x'); }, setItem() { throw new Error('quota'); } };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: full });
    assert.equal(loadValue('lang', 'en'), 'en');
    assert.equal(saveValue('lang', 'tr'), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
