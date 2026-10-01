// 1,000-dot frequency grid: see Bayes' rule as counts instead of a formula.
import { h, s } from './dom.js';
import { int } from '../core/format.js';

const COLS = 40, ROWS = 25, CELL = 10, R = 3.4;

export function frequencyGrid(g) {
  // Positives first, so the two groups you compare (real vs false alarms) sit together at the top.
  const groups = [
    { n: g.hPos, color: 'var(--s1)', label: `${cap(g.hName)} and ${g.sigName}` },
    { n: g.notHPos, color: 'var(--s2)', label: `${cap(g.notHName)} but ${g.sigName} anyway (false alarms)` },
    { n: g.hNeg, color: 'var(--s3)', label: `${cap(g.hName)}, but missed` },
    { n: g.notHNeg, color: 'var(--dot)', label: `${cap(g.notHName)}, no signal` },
  ];
  const dots = [];
  let i = 0;
  for (const grp of groups) {
    for (let k = 0; k < grp.n; k++, i++) {
      const col = i % COLS, row = Math.floor(i / COLS);
      dots.push(s('circle', { cx: col * CELL + CELL / 2, cy: row * CELL + CELL / 2, r: R, fill: grp.color }));
    }
  }
  const svg = s('svg', { viewBox: `0 0 ${COLS * CELL} ${ROWS * CELL}`, role: 'img', 'aria-label': groups.map(x => `${x.n} ${x.label}`).join('; ') }, dots);
  const total = g.hPos + g.notHPos;
  return h('div', { class: 'card grid-wrap' },
    h('div', { class: 'eyebrow' }, 'Out of 1,000'),
    svg,
    h('ul', { class: 'legend' }, groups.map(x =>
      h('li', {}, h('span', { class: 'sw', style: `background:${x.color}` }), h('span', {}, x.label), h('span', { class: 'n' }, int(x.n))))),
    h('p', { class: 'small sub', style: 'margin:10px 0 0', html:
      `Every dot with a signal is <b>blue or orange</b>. Your answer is blue ÷ (blue + orange) = ${int(g.hPos)} ÷ ${int(total)}.` }));
}

const cap = t => t[0].toUpperCase() + t.slice(1);
