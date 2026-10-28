import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keysOf, normalizeLang, translate } from '../src/i18n.js';
import { SHAPES } from '../src/shapes.js';

test('English and Turkish tables have the same keys', () => {
  assert.deepEqual([...keysOf('tr')].sort(), [...keysOf('en')].sort());
});

test('every built-in shape has a name in both languages', () => {
  for (const lang of ['en', 'tr']) {
    for (const shape of SHAPES) assert.notEqual(translate(lang, `shape.${shape.id}`), `shape.${shape.id}`);
  }
});

test('placeholders are filled and unknown languages fall back to English', () => {
  assert.equal(translate('en', 'terms.value', { k: 40, n: 256, energy: '99.1' }), '40 of 256 · 99.1% energy');
  assert.equal(translate('tr', 'terms.value', { k: 40, n: 256, energy: '99.1' }), '40 / 256 · enerjinin %99.1');
  assert.equal(normalizeLang('de'), 'en');
  assert.equal(translate('de', 'btn.draw'), 'Draw');
  assert.equal(translate('en', 'missing.key'), 'missing.key');
});
