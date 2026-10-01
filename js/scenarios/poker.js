// Pot-odds spots: you're on a draw, villain's hand is face up, villain is all-in. Call or fold?
import { evaluate, describe, fullDeck, rankName, rankPlural, rankOf, suitOf, SUITS } from '../core/cards.js';
import { equity, outs, ruleOf2And4, ruleOf4Adjusted, requiredEquity, callEv, straightDrawRanks, flushDrawSuit } from '../core/poker.js';
import { money, pct, int } from '../core/format.js';

// Minimum gap between your equity and the price, by level. Smaller = closer decisions.
const MARGIN = [0, 0.1, 0.07, 0.05, 0.035, 0.02];
// Bet sizes as a fraction of the pot.
const SIZES = [1 / 10, 1 / 8, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.25, 1.5, 2, 3];
const SUIT_NAME = { s: 'spade', h: 'heart', d: 'diamond', c: 'club' };

const REAL_WORLD = [
  'Pot odds are a risk/reward ratio. A trader risking $1 to make $3 only needs to be right more than 25% of the time, the same math as calling a pot-sized bet.',
  'Buying an option works the same way: you pay a small premium (the call) for a chance at a bigger payoff. It\'s only worth it if the chance is better than the price implies.',
  'Venture capitalists make "calls" that usually lose. They only need enough winners to beat the price they paid for the equity.',
  'Sports bettors convert odds into an implied probability (the "price") and bet only when their estimated chance beats it, which is pot odds with a different name.',
];

function deal(rng, boardSize) {
  const d = rng.shuffle(fullDeck());
  return { hero: d.slice(0, 2), villain: d.slice(2, 4), board: d.slice(4, 4 + boardSize) };
}

/** Plain-English list of what the hero is drawing to. */
function drawDescription(hero, board) {
  const all = [...hero, ...board];
  const parts = [];
  const fs = flushDrawSuit(all);
  if (fs >= 0 && hero.some(c => (c & 3) === fs)) parts.push(`a ${SUIT_NAME[SUITS[fs]]} flush draw`);
  const sr = straightDrawRanks(all);
  if (sr.length >= 2) parts.push('an open-ended straight draw');
  else if (sr.length === 1) parts.push(`a gutshot straight draw (you need a ${rankName(sr[0])})`);
  return parts;
}

/** Group outs for display: "9 hearts, 3 Nines" etc. */
function outsSummary(outCards, hero, board) {
  const fs = flushDrawSuit([...hero, ...board]);
  const groups = [];
  let rest = outCards;
  if (fs >= 0) {
    const flushOuts = rest.filter(c => suitOf(c) === fs);
    if (flushOuts.length >= 4) {
      groups.push(`${flushOuts.length} ${SUIT_NAME[SUITS[fs]]}s`);
      rest = rest.filter(c => suitOf(c) !== fs);
    }
  }
  const byRank = new Map();
  for (const c of rest) byRank.set(rankOf(c), (byRank.get(rankOf(c)) || 0) + 1);
  [...byRank.entries()].sort((a, b) => b[0] - a[0]).forEach(([r, k]) => {
    groups.push(`${k} ${k === 1 ? rankName(r) : rankPlural(r)}`);
  });
  return groups.join(', ');
}

export function generate(rng, level) {
  const flopAllowed = level >= 3;
  const wantCall = rng.chance(0.5);
  for (let tries = 0; tries < 500; tries++) {
    const street = flopAllowed && rng.chance(0.5) ? 'flop' : 'turn';
    const { hero, villain, board } = deal(rng, street === 'flop' ? 3 : 4);
    const hNow = evaluate([...hero, ...board]);
    const vNow = evaluate([...villain, ...board]);
    if (hNow >= vNow) continue; // you must be behind right now
    const o = outs(hero, villain, board);
    const n = o.winning.length;
    if (n < 4 || n > 15) continue;
    const eq = equity(hero, villain, board);
    if (eq.equity < 0.08 || eq.equity > 0.6) continue;
    // Lower levels: stick to spots where the rule of thumb is close to the truth.
    const toCome = street === 'flop' ? 2 : 1;
    const est = toCome === 2 ? ruleOf4Adjusted(n) : ruleOf2And4(n, 1);
    if (level <= 2 && Math.abs(est - eq.equity) > 0.04) continue;

    const pot = rng.step(60, 400, 20);
    const options = SIZES
      .map(f => Math.max(10, Math.round((f * pot) / 10) * 10))
      .filter((b, i, arr) => arr.indexOf(b) === i)
      .filter(b => Math.abs(eq.equity - requiredEquity(pot, b)) >= MARGIN[level]);
    const side = options.filter(b => (eq.equity > requiredEquity(pot, b)) === wantCall);
    if (!side.length && tries < 400) continue; // keep call/fold answers balanced
    const pool = side.length ? side : options;
    if (!pool.length) continue;
    const bet = rng.pick(pool);

    return {
      type: 'poker', level, street, hero, villain, board, pot, bet,
      heroHand: describe(hNow), villainHand: describe(vNow),
      draws: drawDescription(hero, board),
      outsText: outsSummary(o.winning, hero, board),
      outs: o.winning, ties: o.tying.length, unseen: o.unseen,
      equity: eq.equity, runouts: eq.runouts,
      realWorld: rng.pick(REAL_WORLD),
    };
  }
  throw new Error('could not generate a poker spot');
}

export function grade(s, called) {
  const req = requiredEquity(s.pot, s.bet);
  const shouldCall = s.equity > req;
  const correct = called === shouldCall;
  const ev = callEv(s.equity, s.pot, s.bet);
  const n = s.outs.length;
  const toCome = s.street === 'flop' ? 2 : 1;
  const rough = ruleOf2And4(n, toCome);
  const adjusted = ruleOf4Adjusted(n);

  const biasTags = [];
  if (!correct) biasTags.push(called ? 'chasingDraws' : 'tooTight');

  const steps = [];
  steps.push(`<b>Outs</b> are the unseen cards that put you ahead. You have <b>${n}</b> of the ${s.unseen} unseen cards: ${s.outsText}.` +
    (s.draws.length ? ` That includes ${s.draws.join(' and ')}.` : '') +
    (s.ties ? ` (${s.ties} more would tie.)` : ''));
  if (toCome === 1) {
    steps.push(`<b>Rule of 2:</b> one card to come, so outs × 2 ≈ <b>${pct(rough, 0)}</b>. Exact: ${n} ÷ ${s.unseen} = ${pct(n / s.unseen)}.`);
  } else {
    steps.push(`<b>Rule of 4:</b> two cards to come (villain is all-in, so you see both), so outs × 4 ≈ <b>${pct(rough, 0)}</b>.` +
      (n > 8 ? ` With more than 8 outs the rule runs high. Subtract (outs − 8) to get ≈ ${pct(adjusted, 0)}.` : ''));
  }
  steps.push(`<b>Exact equity</b> is your share of the pot across all ${int(s.runouts)} possible runouts: <b>${pct(s.equity)}</b>.` +
    (Math.abs(s.equity - (toCome === 2 ? adjusted : rough)) > 0.04
      ? ' It differs from the rule because some runouts help villain too, or give you backdoor wins.'
      : ''));
  steps.push(`<b>Pot odds:</b> you call ${money(s.bet)} to win ${money(s.pot + s.bet)} (the pot plus their bet). To break even you need ${money(s.bet)} ÷ ${money(s.pot + 2 * s.bet)} (the final pot) = <b>${pct(req)}</b> equity.`);
  steps.push(`${pct(s.equity)} ${shouldCall ? '>' : '<'} ${pct(req)}, so <b>${shouldCall ? 'call' : 'fold'}</b>. Calling here averages ${money(ev, { cents: true, sign: true })} per hand: ${pct(s.equity)} × ${money(s.pot + s.bet)} − ${pct(1 - s.equity)} × ${money(s.bet)}.`);
  if (!correct) steps.push(`That ${called ? 'call' : 'fold'} cost about <b>${money(Math.abs(ev), { cents: true })}</b> in expected value.`);

  return {
    correct,
    score: correct ? 1 : 0,
    biasTags,
    headline: correct ? (shouldCall ? 'Good call.' : 'Good fold.') : (called ? 'Too loose. That call loses money.' : 'Too tight. That fold gave up value.'),
    sub: `Equity ${pct(s.equity)} vs price ${pct(req)}.`,
    steps,
    takeaway: shouldCall
      ? 'If your chance of winning beats the share of the final pot you\'re putting in, call. Even though you\'ll usually lose this hand.'
      : 'A draw isn\'t a reason to call by itself. The price has to be right.',
    realWorld: s.realWorld,
    evLost: correct ? 0 : Math.abs(ev),
    outs: s.outs,
  };
}

export const meta = {
  id: 'poker',
  name: 'Poker pot odds',
  short: 'Poker',
  primer: [
    'Texas Hold\'em. You\'re behind and villain is <b>all-in</b>, so there\'s no more betting. You see their cards. Call or fold?',
    '<b>Outs</b> are cards that win it for you. <b>Rule of 2 and 4:</b> outs × 2 ≈ your % with one card to come; outs × 4 with two.',
    '<b>Pot odds:</b> your call ÷ the final pot = the win rate you need. Call when your chance beats it.',
  ],
};
