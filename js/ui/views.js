// Per-type rendering: the question (with its answer controls) and the type-specific feedback visual.
import { h } from './dom.js';
import { money, pct } from '../core/format.js';
import { RANKS, SUITS, SUIT_SYMBOL, rankOf, suitOf } from '../core/cards.js';
import { frequencyGrid } from './grid.js';
import { bridgeSvg } from './bridgeArt.js';
import { spec as bridgeSpec, CONFIDENCE_LEVELS } from '../scenarios/bridge.js';
import { DESIGNS } from '../core/bridges.js';

export function cardEl(c, mini = false) {
  const suit = SUITS[suitOf(c)];
  const rank = RANKS[rankOf(c)] === 'T' ? '10' : RANKS[rankOf(c)];
  const names = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
  return h('span', { class: `pcard s-${suit}${mini ? ' mini' : ''}`, role: 'img', 'aria-label': `${rank} of ${names[suit]}` },
    h('span', {}, rank), h('span', { class: 's' }, SUIT_SYMBOL[suit]));
}

/* ---------------- Question views: return { body, actions } ---------------- */

function evQuestion(sc, answer) {
  return {
    body: [
      h('h2', {}, sc.title),
      h('p', { class: 'scenario-body' }, sc.body),
      h('p', { class: 'question' }, 'Which choice has the higher expected value?'),
      h('p', { class: 'note' }, 'Judge it as if you\'d face this exact choice many times.'),
    ],
    actions: h('div', { class: 'stack' }, sc.options.map((o, i) =>
      h('button', { class: 'choice', onclick: () => answer(i) },
        h('span', { class: 'label' }, o.label),
        h('span', { class: 'detail' }, o.detail)))),
  };
}

function bayesQuestion(sc, answer) {
  let val = 50;
  const readout = h('div', { class: 'readout', 'aria-live': 'polite' }, '50%');
  const range = h('input', { type: 'range', min: 0, max: 100, step: 1, value: 50, 'aria-label': 'Your probability estimate in percent' });
  const set = v => { val = Math.max(0, Math.min(100, v)); range.value = val; readout.textContent = `${val}%`; };
  range.addEventListener('input', () => set(+range.value));
  return {
    body: [
      h('h2', {}, sc.title),
      h('p', { class: 'scenario-body', html: sc.body }),
      h('p', { class: 'question' }, sc.question),
    ],
    actions: h('div', { class: 'stack' },
      h('div', { class: 'estimate' }, readout, h('div', { class: 'hint' }, 'Drag, or use − / + to fine-tune. Within 5 points counts as correct.')),
      h('div', { class: 'slider-row' },
        h('button', { class: 'step-btn', 'aria-label': 'Decrease by 1', onclick: () => set(val - 1) }, '−'),
        range,
        h('button', { class: 'step-btn', 'aria-label': 'Increase by 1', onclick: () => set(val + 1) }, '+')),
      h('button', { class: 'btn primary', onclick: () => answer(val / 100) }, 'Lock in')),
  };
}

function pokerTable(sc, { showOuts = false, outs = [] } = {}) {
  return h('div', { class: 'table' },
    h('div', { class: 'money-row', style: 'margin:0 0 8px' },
      h('div', {}, h('div', { class: 'k' }, 'Pot'), h('div', { class: 'v' }, money(sc.pot))),
      h('div', {}, h('div', { class: 'k' }, 'To call'), h('div', { class: 'v' }, money(sc.bet))),
      h('div', {}, h('div', { class: 'k' }, 'Cards to come'), h('div', { class: 'v' }, sc.street === 'flop' ? '2' : '1'))),
    h('div', { class: 'hand-row' },
      h('div', { class: 'who' }, h('b', {}, 'Villain (all-in)'), sc.villainHand),
      h('div', { class: 'cards' }, sc.villain.map(c => cardEl(c)))),
    h('div', { class: 'board', 'aria-label': 'Board' }, sc.board.map(c => cardEl(c))),
    h('div', { class: 'hand-row' },
      h('div', { class: 'who' }, h('b', {}, 'You'), sc.heroHand),
      h('div', { class: 'cards' }, sc.hero.map(c => cardEl(c)))),
    showOuts && outs.length ? h('div', { style: 'margin-top:12px' },
      h('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, `Your ${outs.length} outs`),
      h('div', { class: 'cards' }, outs.map(c => cardEl(c, true)))) : null);
}

function pokerQuestion(sc, answer) {
  return {
    body: [
      h('h2', {}, sc.street === 'flop' ? 'All-in on the flop' : 'All-in on the turn'),
      h('p', { class: 'scenario-body' }, `Villain shoves and shows you their hand. You're behind${sc.draws.length ? ' with ' + sc.draws.join(' and ') : ''}. Call or fold?`),
      pokerTable(sc),
    ],
    actions: h('div', { class: 'actions two', style: 'padding:0;position:static;background:none' },
      h('button', { class: 'btn', onclick: () => answer(false) }, 'Fold'),
      h('button', { class: 'btn primary', onclick: () => answer(true) }, `Call ${money(sc.bet)}`)),
  };
}

function bridgeCard(sc, b, maxSpan, extra = {}) {
  return h(extra.tag || 'div', { class: `bcard${extra.cls ? ' ' + extra.cls : ''}`, ...extra.attrs },
    bridgeSvg(b, maxSpan),
    h('span', { class: 'lbl' }, `${b.letter} · ${DESIGNS[b.design].name}`),
    h('span', { class: 'spec' }, bridgeSpec(b, sc) || '\u00a0'),
    extra.footer || null);
}

function bridgeQuestion(sc, answer) {
  const maxSpan = Math.max(...sc.bridges.map(b => b.span));
  let pick = null;
  const confBtns = CONFIDENCE_LEVELS.map(c =>
    h('button', { class: 'btn', disabled: true, onclick: () => pick != null && answer({ pick, conf: c }) }, pct(c, 0)));
  const hint = h('div', { class: 'hint' }, 'Tap the strongest bridge, then how sure you are.');
  const cards = sc.bridges.map((b, i) => bridgeCard(sc, b, maxSpan, {
    tag: 'button',
    attrs: {
      'aria-pressed': 'false',
      'aria-label': `${b.letter}: ${DESIGNS[b.design].name}${bridgeSpec(b, sc) ? ', ' + bridgeSpec(b, sc) : ''}`,
      onclick: () => {
        pick = i;
        cards.forEach((c, j) => c.setAttribute('aria-pressed', String(j === i)));
        confBtns.forEach(btn => { btn.disabled = false; });
        hint.textContent = `You picked ${b.letter}. How sure are you?`;
      },
    },
  }));
  return {
    body: [
      h('h2', {}, 'Which bridge holds the most?'),
      h('p', { class: 'scenario-body' }, sc.variedSteel
        ? 'Each carries a load at mid-span. Spans and the amount of steel differ.'
        : sc.variedSpan
          ? 'Each uses the same amount of steel and carries a load at mid-span. Spans differ.'
          : 'Each uses the same amount of steel, spans the same gap, and carries a load at mid-span.'),
      h('div', { class: 'bridge-grid' }, cards),
    ],
    actions: h('div', { class: 'stack' },
      h('div', { class: 'estimate' }, hint),
      h('div', { class: 'conf-row' }, confBtns)),
  };
}

export const QUESTION = { ev: evQuestion, bayes: bayesQuestion, poker: pokerQuestion, bridge: bridgeQuestion };

/* ---------------- Feedback visuals ---------------- */

function evVisual(sc, result) {
  // Simple EV comparison bars on one shared scale.
  const evs = sc.options.map(o => o.outcomes.reduce((a, x) => a + x.p * x.v, 0));
  const maxAbs = Math.max(...evs.map(Math.abs), 1);
  return h('div', { class: 'card' },
    h('div', { class: 'eyebrow' }, 'Average result per play (EV)'),
    sc.options.map((o, i) => h('div', { class: 'type-row' },
      h('span', { class: 'name' }, o.label),
      h('span', { class: 'val' }, money(evs[i], { cents: true })),
      h('div', { class: 'bar' }, h('span', { style: `width:${(Math.abs(evs[i]) / maxAbs) * 100}%;${evs[i] < 0 ? 'background:var(--bad)' : ''}` })))));
}

export const VISUAL = {
  ev: evVisual,
  bayes: (sc, result) => frequencyGrid(result.grid),
  poker: (sc, result) => pokerTable(sc, { showOuts: true, outs: result.outs }),
  bridge: (sc, result) => {
    const maxSpan = Math.max(...sc.bridges.map(b => b.span));
    return h('div', { class: 'bridge-grid', style: 'margin:12px 0' }, sc.bridges.map((b, i) => bridgeCard(sc, b, maxSpan, {
      cls: [i === result.best ? 'best' : '', i === result.pick && i !== result.best ? 'picked' : ''].join(' ').trim(),
      footer: h('span', { class: 'tonnes' }, `${b.tonnes >= 100 ? Math.round(b.tonnes) : b.tonnes.toFixed(1)} t`,
        i === result.best ? ' ✓ strongest' : i === result.pick ? ' · your pick' : ''),
    })));
  },
};

export { pct };
