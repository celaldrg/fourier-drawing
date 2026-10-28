/**
 * Minimal SVG path-data parser that flattens a path into a polyline.
 * Supports M L H V C S Q T A Z in absolute and relative form, with implicit repeated commands.
 * @typedef {{x: number, y: number}} Point
 */

const COMMANDS = 'MmLlHhVvCcSsQqTtAaZz';
const ARG_COUNT = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

/** Character scanner over the path string. */
class Scanner {
  constructor(text) {
    this.text = text;
    this.pos = 0;
  }

  skipSeparators() {
    while (this.pos < this.text.length && /[\s,]/.test(this.text[this.pos])) this.pos++;
  }

  atEnd() {
    this.skipSeparators();
    return this.pos >= this.text.length;
  }

  peekIsCommand() {
    this.skipSeparators();
    return COMMANDS.includes(this.text[this.pos]);
  }

  readCommand() {
    this.skipSeparators();
    return this.text[this.pos++];
  }

  readNumber() {
    this.skipSeparators();
    const match = NUMBER_RE.exec(this.text.slice(this.pos));
    if (!match) throw new SyntaxError(`Expected a number at position ${this.pos}`);
    this.pos += match[0].length;
    return Number(match[0]);
  }

  readFlag() {
    this.skipSeparators();
    const ch = this.text[this.pos];
    if (ch !== '0' && ch !== '1') throw new SyntaxError(`Expected an arc flag at position ${this.pos}`);
    this.pos++;
    return ch === '1';
  }
}

function readArgs(scanner, lower) {
  if (lower === 'a') {
    const r = [scanner.readNumber(), scanner.readNumber(), scanner.readNumber()];
    return [...r, scanner.readFlag() ? 1 : 0, scanner.readFlag() ? 1 : 0, scanner.readNumber(), scanner.readNumber()];
  }
  return Array.from({ length: ARG_COUNT[lower] }, () => scanner.readNumber());
}

function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

function quadAt(p0, p1, p2, t) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}

function angleBetween(ux, uy, vx, vy) {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
  return sign * Math.acos(Math.max(-1, Math.min(1, dot)));
}

/**
 * Flatten an elliptical arc (SVG endpoint parameterisation, spec section B.2.4).
 * @returns {Point[]} Points after the start point, ending exactly at the end point.
 */
function arcPoints(from, rxIn, ryIn, rotationDeg, largeArc, sweep, to, steps) {
  if (from.x === to.x && from.y === to.y) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [{ ...to }];
  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cosPhi * dx + sinPhi * dy;
  const y1 = -sinPhi * dx + cosPhi * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1) / ry;
  const cyp = (-coef * ry * x1) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;
  const theta1 = angleBetween(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let delta = angleBetween((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const count = Math.max(2, Math.ceil((Math.abs(delta) / (Math.PI / 2)) * steps));
  const out = [];
  for (let i = 1; i < count; i++) {
    const a = theta1 + (delta * i) / count;
    const ex = rx * Math.cos(a);
    const ey = ry * Math.sin(a);
    out.push({ x: cosPhi * ex - sinPhi * ey + cx, y: sinPhi * ex + cosPhi * ey + cy });
  }
  out.push({ ...to });
  return out;
}

/** Mutable state while walking the path. */
function createWalker(steps) {
  return { steps, points: [], cur: { x: 0, y: 0 }, start: { x: 0, y: 0 }, lastCubic: null, lastQuad: null };
}

function lineTo(w, p) {
  w.points.push({ ...p });
  w.cur = { ...p };
}

function curveTo(w, sampler, end) {
  for (let i = 1; i < w.steps; i++) w.points.push(sampler(i / w.steps));
  lineTo(w, end);
}

function reflect(control, about) {
  return control ? { x: 2 * about.x - control.x, y: 2 * about.y - control.y } : { ...about };
}

/** Apply one command segment with absolute-ised arguments. */
function applySegment(w, cmd, args, relative) {
  const ox = relative ? w.cur.x : 0;
  const oy = relative ? w.cur.y : 0;
  const pt = (i) => ({ x: args[i] + ox, y: args[i + 1] + oy });
  const p0 = { ...w.cur };
  let cubic = null;
  let quad = null;
  switch (cmd) {
    case 'm':
      w.start = pt(0);
      lineTo(w, w.start);
      break;
    case 'l':
      lineTo(w, pt(0));
      break;
    case 'h':
      lineTo(w, { x: args[0] + ox, y: w.cur.y });
      break;
    case 'v':
      lineTo(w, { x: w.cur.x, y: args[0] + oy });
      break;
    case 'c':
    case 's': {
      const c1 = cmd === 'c' ? pt(0) : reflect(w.lastCubic, p0);
      const c2 = cmd === 'c' ? pt(2) : pt(0);
      const end = cmd === 'c' ? pt(4) : pt(2);
      curveTo(w, (t) => cubicAt(p0, c1, c2, end, t), end);
      cubic = c2;
      break;
    }
    case 'q':
    case 't': {
      const c = cmd === 'q' ? pt(0) : reflect(w.lastQuad, p0);
      const end = cmd === 'q' ? pt(2) : pt(0);
      curveTo(w, (t) => quadAt(p0, c, end, t), end);
      quad = c;
      break;
    }
    case 'a':
      for (const p of arcPoints(p0, args[0], args[1], args[2], args[3], args[4], pt(5), w.steps)) lineTo(w, p);
      break;
    case 'z':
      if (w.cur.x !== w.start.x || w.cur.y !== w.start.y) lineTo(w, w.start);
      w.cur = { ...w.start };
      break;
  }
  w.lastCubic = cubic;
  w.lastQuad = quad;
}

/**
 * Parse SVG path data into a flat polyline (all subpaths concatenated).
 * Curves are flattened with `curveSteps` segments each; arcs with `curveSteps` segments per quarter turn.
 * @param {string} d SVG path data, e.g. "M0 0 L10 0 Z".
 * @param {{curveSteps?: number}} [options]
 * @returns {Point[]}
 * @throws {SyntaxError} On malformed input.
 */
export function parseSvgPath(d, options = {}) {
  const w = createWalker(Math.max(1, Math.round(options.curveSteps ?? 24)));
  const scanner = new Scanner(String(d));
  let cmd = null;
  while (!scanner.atEnd()) {
    if (scanner.peekIsCommand()) {
      cmd = scanner.readCommand();
    } else if (cmd === null || cmd.toLowerCase() === 'z') {
      throw new SyntaxError(`Unexpected data at position ${scanner.pos}`);
    }
    const lower = cmd.toLowerCase();
    const relative = cmd === lower;
    applySegment(w, lower, readArgs(scanner, lower), relative);
    if (lower === 'm') cmd = relative ? 'l' : 'L';
  }
  return w.points;
}
