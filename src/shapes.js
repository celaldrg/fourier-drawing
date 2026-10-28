/**
 * Built-in shapes stored as SVG path data in a 200 x 200 box (y grows downwards).
 * Display names live in the i18n module under the key `shape.<id>`.
 */
export const SHAPES = Object.freeze([
  { id: 'star', d: 'M100 10 L123 75 L192 75 L136 116 L157 182 L100 141 L43 182 L64 116 L8 75 L77 75 Z' },
  {
    id: 'heart',
    d: 'M100 180 C40 135 10 100 10 65 C10 35 35 15 60 15 C80 15 95 28 100 42 C105 28 120 15 140 15 C165 15 190 35 190 65 C190 100 160 135 100 180 Z',
  },
  {
    id: 'spiral',
    d: 'M100 100 a10 10 0 0 1 20 0 a20 20 0 0 1 -40 0 a30 30 0 0 1 60 0 a40 40 0 0 1 -80 0 a50 50 0 0 1 100 0 a60 60 0 0 1 -120 0 a70 70 0 0 1 140 0 Z',
  },
  { id: 'fish', d: 'M20 100 C50 50 120 40 160 100 L190 70 L185 100 L190 130 L160 100 C120 160 50 150 20 100 Z' },
  { id: 'house', d: 'M40 190 V95 H20 L100 20 L180 95 H160 V190 H115 V135 H85 V190 Z' },
  { id: 'leaf', d: 'M100 190 V165 C40 140 30 70 100 10 C170 70 160 140 100 165 Z' },
  {
    id: 'cat',
    d: 'M50 180 C20 160 20 110 35 85 L30 25 L75 60 C90 55 110 55 125 60 L170 25 L165 85 C180 110 180 160 150 180 Q100 200 50 180 Z',
  },
  { id: 'squiggle', d: 'M15 90 Q40 30 65 90 T115 90 T165 90 L185 110 Q160 170 135 110 T85 110 T35 110 Z' },
  { id: 'note', d: 'M120 30 L160 45 V70 L130 60 V150 C130 175 90 190 75 170 C62 150 90 128 120 135 Z' },
  { id: 'bolt', d: 'M110 10 L40 115 H95 L75 190 L160 80 H105 L130 10 Z' },
]);

/**
 * Look up a built-in shape by id.
 * @param {string} id
 * @returns {{id: string, d: string} | undefined}
 */
export function getShape(id) {
  return SHAPES.find((s) => s.id === id);
}
