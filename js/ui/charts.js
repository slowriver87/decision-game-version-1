// Accuracy-over-time sparkline: one series per chart (small multiples), tap a point for its value.
import { h, s } from './dom.js';
import { pct } from '../core/format.js';

const W = 300, H = 64, PAD = 6;

export function sparkline(points /* [{ value 0..1, label }] */) {
  const wrap = h('div', { class: 'spark' });
  if (!points.length) {
    wrap.append(h('p', { class: 'note' }, 'No rounds yet.'));
    return wrap;
  }
  const x = i => (points.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (points.length - 1));
  const y = v => H - PAD - v * (H - 2 * PAD);
  const grid = [0, 0.5, 1].map(v => s('line', { x1: 0, x2: W, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const line = s('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' });
  const last = points.length - 1;
  const lastDot = s('circle', { cx: x(last), cy: y(points[last].value), r: 4, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
  const focus = s('circle', { r: 4, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden', 'vector-effect': 'non-scaling-stroke' });
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img',
    'aria-label': `Accuracy by session: ${points.map(p => pct(p.value, 0)).join(', ')}` }, grid, line, lastDot, focus);
  const tip = h('div', { class: 'tip', hidden: true });

  // Tap / drag anywhere: snap to the nearest session.
  const show = ev => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    const p = points[best];
    focus.setAttribute('cx', x(best)); focus.setAttribute('cy', y(p.value)); focus.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.textContent = `${p.label}: ${pct(p.value, 0)}`;
    const left = (x(best) / W) * rect.width;
    tip.style.left = `${Math.max(40, Math.min(rect.width - 40, left))}px`;
    tip.style.top = `${(y(p.value) / H) * rect.height - 6}px`;
  };
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') show(e); });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; focus.setAttribute('visibility', 'hidden'); });
  wrap.append(svg, tip);
  return wrap;
}
