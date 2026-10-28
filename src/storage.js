/**
 * Tiny localStorage wrapper; every access is guarded so private mode or blocked storage never throws.
 */
const PREFIX = 'fourier-drawing:';

function backend() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Read a stored string.
 * @param {string} key
 * @param {string | null} [fallback=null]
 * @returns {string | null}
 */
export function loadValue(key, fallback = null) {
  try {
    const value = backend()?.getItem(PREFIX + key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Store a string; failures are ignored.
 * @param {string} key
 * @param {string} value
 * @returns {boolean} Whether the value was written.
 */
export function saveValue(key, value) {
  try {
    const store = backend();
    if (!store) return false;
    store.setItem(PREFIX + key, String(value));
    return true;
  } catch {
    return false;
  }
}
