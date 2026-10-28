/**
 * Sharing helpers: URL-hash encoding of a path and SVG export of a traced path.
 * @typedef {{x: number, y: number}} Point
 */

const HASH_KEY = 'p=';
const MAX_HASH_POINTS = 1024;

function round1(v) {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Encode points as a URL hash "#p=x,y,x,y,..." with one decimal.
 * @param {Point[]} points
 * @returns {string}
 */
export function encodeHash(points) {
  return `#${HASH_KEY}${points.map((p) => `${round1(p.x)},${round1(p.y)}`).join(',')}`;
}

/**
 * Decode a URL hash produced by {@link encodeHash}.
 * @param {string} hash With or without the leading "#".
 * @returns {Point[] | null} Null when the hash is missing or invalid.
 */
export function decodeHash(hash) {
  const text = String(hash || '').replace(/^#/, '');
  if (!text.startsWith(HASH_KEY)) return null;
  let parts;
  try {
    parts = decodeURIComponent(text.slice(HASH_KEY.length)).split(',');
  } catch {
    return null;
  }
  if (parts.length % 2 !== 0 || parts.length < 6 || parts.length > 2 * MAX_HASH_POINTS) return null;
  const nums = parts.map((s) => (/^\s*-?\d+(\.\d+)?\s*$/.test(s) ? Number(s) : NaN));
  if (nums.some((v) => !Number.isFinite(v))) return null;
  const points = [];
  for (let i = 0; i < nums.length; i += 2) points.push({ x: nums[i], y: nums[i + 1] });
  return points;
}

/**
 * Build a standalone SVG document showing a closed path.
 * @param {Point[]} points
 * @param {{stroke?: string, background?: string, padding?: number, strokeWidth?: number}} [options]
 * @returns {string}
 */
export function pathToSvg(points, options = {}) {
  const { stroke = '#c084fc', background = '#0f172a', padding = 10, strokeWidth = 2 } = options;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!points.length) minX = minY = maxX = maxY = 0;
  const vx = round1(minX - padding);
  const vy = round1(minY - padding);
  const vw = round1(maxX - minX + 2 * padding);
  const vh = round1(maxY - minY + 2 * padding);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round1(p.x)} ${round1(p.y)}`).join(' ');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`,
    `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${background}"/>`,
    `<path d="${d}${points.length ? ' Z' : ''}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`,
    '</svg>',
    '',
  ].join('\n');
}
