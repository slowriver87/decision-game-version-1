// Side-view bridge drawings, built to each bridge's real proportions.
import { s } from './dom.js';

const W = 160, H = 84, MID = W / 2;
const INK = 'var(--text)', BANK = 'var(--line)', LOAD = 'var(--s2)';

export function bridgeSvg(b, maxSpan) {
  const half = (b.span / maxSpan) * 66;
  const xL = MID - half, xR = MID + half;
  const px = m => (m / b.span) * (2 * half); // metres → pixels, true to scale
  // Put the deck where this design's shape fits best, so every drawing fills its card.
  const h = b.depth ? px(b.depth) : 0;
  const DECK = b.design === 'arch' ? Math.min(40, H - 8 - h) : b.design === 'truss' || b.design === 'suspension' ? Math.max(40, 12 + h) : 40;
  const parts = [];
  const line = (x1, y1, x2, y2, w = 3) => s('line', { x1, y1, x2, y2, stroke: INK, 'stroke-width': w, 'stroke-linecap': 'round' });

  // Banks
  parts.push(s('path', { d: `M0 ${DECK} H${xL} V${H} H0 Z M${W} ${DECK} H${xR} V${H} H${W} Z`, fill: BANK }));
  parts.push(s('path', { d: `M${xL} ${H - 3} H${xR}`, stroke: 'var(--s1)', 'stroke-width': 2, opacity: 0.5 })); // the water

  switch (b.design) {
    case 'plankFlat':
      parts.push(s('rect', { x: xL, y: DECK - 2, width: xR - xL, height: 3, rx: 1, fill: INK }));
      parts.push(section('flat'));
      break;
    case 'plankEdge':
      parts.push(s('rect', { x: xL, y: DECK - 6, width: xR - xL, height: 7, rx: 1, fill: INK }));
      parts.push(section('edge'));
      break;
    case 'ibeam': {
      const d = Math.max(5, Math.min(14, px(b.depth) * 2.2)); // exaggerated so depth differences are visible
      parts.push(s('rect', { x: xL, y: DECK - d, width: xR - xL, height: d + 1, rx: 1, fill: 'none', stroke: INK, 'stroke-width': 2 }));
      parts.push(line(xL, DECK - d / 2, xR, DECK - d / 2, 1));
      parts.push(section('ibeam'));
      break;
    }
    case 'truss': {
      const r = px(b.depth);
      parts.push(line(xL, DECK, xR, DECK, 3));
      parts.push(line(xL, DECK, MID, DECK - r), line(xR, DECK, MID, DECK - r), line(MID, DECK - r, MID, DECK, 1.5));
      break;
    }
    case 'arch': {
      const r = px(b.depth);
      // Ribs push up from the bank faces to the crown under the deck's centre.
      parts.push(line(xL, DECK + r, MID, DECK + 2), line(xR, DECK + r, MID, DECK + 2));
      for (const f of [1 / 3, 2 / 3]) { // posts from the ribs up to the deck
        const y = DECK + r - f * (r - 2);
        parts.push(line(xL + f * half, y, xL + f * half, DECK, 1.2), line(xR - f * half, y, xR - f * half, DECK, 1.2));
      }
      parts.push(line(xL, DECK, xR, DECK, 2));
      break;
    }
    case 'suspension': {
      const sag = px(b.depth);
      const top = DECK - sag;
      parts.push(line(xL, DECK, xL, top - 4, 3), line(xR, DECK, xR, top - 4, 3));      // towers
      parts.push(line(xL, top, MID, DECK - 2, 1.8), line(xR, top, MID, DECK - 2, 1.8)); // cable
      for (const f of [1 / 3, 2 / 3]) { // hangers from the cable down to the deck
        const y = top + f * (DECK - 2 - top);
        parts.push(line(xL + f * half, y, xL + f * half, DECK, 1), line(xR - f * half, y, xR - f * half, DECK, 1));
      }
      parts.push(line(xL, DECK, xR, DECK, 2));
      break;
    }
  }
  // The load
  parts.push(s('path', { d: `M${MID - 6} ${DECK - 16} h12 v7 h-12 Z`, fill: LOAD }));
  parts.push(s('path', { d: `M${MID} ${DECK - 9} L${MID - 3} ${DECK - 6} H${MID + 3} Z`, fill: LOAD }));
  return s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bridge-art', 'aria-hidden': 'true' }, parts);
}

/** Small cross-section icon in the corner, so a plank flat vs on edge is obvious. */
function section(kind) {
  const g = [];
  const x = 8, y = 8;
  g.push(s('rect', { x: x - 4, y: y - 4, width: 30, height: 30, rx: 6, fill: 'var(--surface)', stroke: 'var(--line)' }));
  if (kind === 'flat') g.push(s('rect', { x, y: y + 9, width: 22, height: 5, fill: INK }));
  else if (kind === 'edge') g.push(s('rect', { x: x + 8.5, y, width: 5, height: 22, fill: INK }));
  else g.push(s('path', { d: `M${x + 3} ${y} h16 v4 h-6 v14 h6 v4 h-16 v-4 h6 v-14 h-6 Z`, fill: INK }));
  return s('g', {}, g);
}
