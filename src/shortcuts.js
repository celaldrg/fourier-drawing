/**
 * Pure keyboard-shortcut mapping (no DOM access), so the rules are unit-testable.
 */

/**
 * Kinds of focused element that matter for shortcuts:
 * 'text'    - typing field (text input, textarea, select, contenteditable): no shortcuts at all
 * 'range'   - slider: arrow keys belong to the slider
 * 'control' - button, checkbox, link: Space belongs to the control
 * 'other'   - anything else (body, canvas)
 * @typedef {'text' | 'range' | 'control' | 'other'} TargetKind
 */

/**
 * Resolves a key press to an app action, or null when the key should be left to the browser.
 * @param {{key: string, shiftKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean}} press
 * @param {TargetKind} target kind of the focused element
 * @param {boolean} drawing whether the app is in draw mode
 * @returns {{type: 'toggle-play'} | {type: 'terms', delta: number} | {type: 'reset'} | {type: 'draw'} | null}
 */
export function resolveShortcut(press, target, drawing) {
  if (press.ctrlKey || press.metaKey || press.altKey || target === 'text') return null;
  const step = press.shiftKey ? 10 : 1;
  switch (press.key) {
    case ' ':
      return target === 'control' ? null : { type: 'toggle-play' };
    case 'ArrowRight':
    case 'ArrowUp':
      return target === 'range' ? null : { type: 'terms', delta: step };
    case 'ArrowLeft':
    case 'ArrowDown':
      return target === 'range' ? null : { type: 'terms', delta: -step };
    case 'r':
    case 'R':
      return { type: 'reset' };
    case 'd':
    case 'D':
      return { type: 'draw' };
    case 'Escape':
      return drawing ? { type: 'draw' } : null;
    default:
      return null;
  }
}
