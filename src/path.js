/**
 * Geometry helpers for closed polylines: length, arc-length resampling and normalisation.
 * @typedef {{x: number, y: number}} Point
 */

export const MIN_SAMPLES = 64;
export const MAX_SAMPLES = 1024;
export const DEFAULT_SAMPLES = 256;

/**
 * Clamp a requested sample count to the supported range [64, 1024].
 * @param {number} n
 * @returns {number}
 */
export function clampSamples(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_SAMPLES;
  return Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, v));
}

/**
 * Remove consecutive duplicates and a trailing copy of the first point.
 * @param {Point[]} points
 * @returns {Point[]}
 */
export function cleanPath(points) {
  const out = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push({ x: p.x, y: p.y });
  }
  while (out.length > 1 && out[0].x === out[out.length - 1].x && out[0].y === out[out.length - 1].y) {
    out.pop();
  }
  return out;
}

/**
 * Perimeter of the closed polyline (the closing segment is included).
 * @param {Point[]} points
 * @returns {number}
 */
export function closedLength(points) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * Resample a closed polyline to n points equally spaced by arc length, starting at the first point.
 * @param {Point[]} points Input polyline; it is closed automatically.
 * @param {number} n Number of output points.
 * @returns {Point[]}
 */
export function resampleClosed(points, n) {
  const pts = cleanPath(points);
  if (pts.length === 0) throw new RangeError('Path has no points');
  const total = closedLength(pts);
  if (pts.length === 1 || total === 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const step = total / n;
  const out = [];
  let seg = 0;
  let segStart = 0;
  let segLen = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  for (let j = 0; j < n; j++) {
    const s = j * step;
    while (segStart + segLen < s && seg < pts.length - 1) {
      segStart += segLen;
      seg++;
      const a = pts[seg];
      const b = pts[(seg + 1) % pts.length];
      segLen = Math.hypot(b.x - a.x, b.y - a.y);
    }
    const a = pts[seg];
    const b = pts[(seg + 1) % pts.length];
    const u = segLen === 0 ? 0 : Math.min(1, (s - segStart) / segLen);
    out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
  }
  return out;
}

/**
 * Axis-aligned bounding box.
 * @param {Point[]} points
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
 */
export function bounds(points) {
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
  return { minX, minY, maxX, maxY };
}

/**
 * Centre the path on the origin (by bounding box) and scale it so its larger side spans 2*halfSize.
 * @param {Point[]} points
 * @param {number} [halfSize=100]
 * @returns {Point[]}
 */
export function normalize(points, halfSize = 100) {
  const b = bounds(points);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const scale = span > 0 ? (2 * halfSize) / span : 1;
  return points.map((p) => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale }));
}
