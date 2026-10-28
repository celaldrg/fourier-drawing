import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveShortcut } from '../src/shortcuts.js';

test('Space toggles play unless a button or checkbox has focus', () => {
  assert.deepEqual(resolveShortcut({ key: ' ' }, 'other', false), { type: 'toggle-play' });
  assert.deepEqual(resolveShortcut({ key: ' ' }, 'range', false), { type: 'toggle-play' });
  assert.equal(resolveShortcut({ key: ' ' }, 'control', false), null);
  assert.equal(resolveShortcut({ key: ' ' }, 'text', false), null);
});

test('arrow keys change K by 1 (10 with Shift) except on sliders', () => {
  assert.deepEqual(resolveShortcut({ key: 'ArrowRight' }, 'other', false), { type: 'terms', delta: 1 });
  assert.deepEqual(resolveShortcut({ key: 'ArrowUp', shiftKey: true }, 'control', false), { type: 'terms', delta: 10 });
  assert.deepEqual(resolveShortcut({ key: 'ArrowDown' }, 'other', false), { type: 'terms', delta: -1 });
  assert.deepEqual(resolveShortcut({ key: 'ArrowLeft', shiftKey: true }, 'other', false), { type: 'terms', delta: -10 });
  assert.equal(resolveShortcut({ key: 'ArrowLeft' }, 'range', false), null);
});

test('R resets, D toggles draw mode, Escape leaves draw mode only', () => {
  assert.deepEqual(resolveShortcut({ key: 'r' }, 'control', false), { type: 'reset' });
  assert.deepEqual(resolveShortcut({ key: 'D' }, 'other', false), { type: 'draw' });
  assert.deepEqual(resolveShortcut({ key: 'Escape' }, 'other', true), { type: 'draw' });
  assert.equal(resolveShortcut({ key: 'Escape' }, 'other', false), null);
});

test('modifier keys, typing fields and unknown keys are ignored', () => {
  assert.equal(resolveShortcut({ key: 'r', ctrlKey: true }, 'other', false), null);
  assert.equal(resolveShortcut({ key: ' ', metaKey: true }, 'other', false), null);
  assert.equal(resolveShortcut({ key: 'd', altKey: true }, 'other', false), null);
  assert.equal(resolveShortcut({ key: 'r' }, 'text', false), null);
  assert.equal(resolveShortcut({ key: 'x' }, 'other', false), null);
});
