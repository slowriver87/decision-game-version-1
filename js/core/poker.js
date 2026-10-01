// Heads-up, both hands known: exact equity, outs, and pot odds.
import { evaluate, fullDeck, rankOf, suitOf, straightTop } from './cards.js';

const remaining = used => {
  const set = new Set(used);
  return fullDeck().filter(c => !set.has(c));
};

/**
 * Exact equity by enumerating every possible runout to the river.
 * Ties count as half a win (you split the pot).
 */
export function equity(hero, villain, board) {
  const deck = remaining([...hero, ...villain, ...board]);
  const need = 5 - board.length;
  let win = 0, tie = 0, total = 0;
  const run = runout => {
    const b = [...board, ...runout];
    const h = evaluate([...hero, ...b]);
    const v = evaluate([...villain, ...b]);
    if (h > v) win++; else if (h === v) tie++;
    total++;
  };
  if (need === 0) run([]);
  else if (need === 1) for (const c of deck) run([c]);
  else if (need === 2) {
    for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) run([deck[i], deck[j]]);
  } else throw new Error('equity needs at least a flop');
  return { equity: (win + tie / 2) / total, win: win / total, tie: tie / total, runouts: total };
}

/**
 * Outs: unseen cards that, dealt next, put the hero strictly ahead.
 * (Ties are returned separately.)
 */
export function outs(hero, villain, board) {
  const deck = remaining([...hero, ...villain, ...board]);
  const winning = [], tying = [];
  for (const c of deck) {
    const b = [...board, c];
    const h = evaluate([...hero, ...b]);
    const v = evaluate([...villain, ...b]);
    if (h > v) winning.push(c); else if (h === v) tying.push(c);
  }
  return { winning, tying, unseen: deck.length };
}

/** Rule of 2 and 4: outs × 2 with one card to come, × 4 with two. Returns a probability. */
export function ruleOf2And4(nOuts, cardsToCome) {
  return (nOuts * (cardsToCome === 2 ? 4 : 2)) / 100;
}

/** The refined rule of 4: with more than 8 outs, subtract (outs − 8) points. */
export function ruleOf4Adjusted(nOuts) {
  return (nOuts * 4 - Math.max(0, nOuts - 8)) / 100;
}

/**
 * Equity needed to break even on a call.
 * pot: what was in the middle before the bet. bet: the amount you must call.
 */
export function requiredEquity(pot, bet) {
  return bet / (pot + 2 * bet);
}

/** Expected profit of calling (folding = $0). Winning collects pot + their bet; losing costs your call. */
export function callEv(eq, pot, bet) {
  return eq * (pot + bet) - (1 - eq) * bet;
}

/** Ranks that would complete a straight if added to these cards (and don't already make one). */
export function straightDrawRanks(cs) {
  let mask = 0;
  for (const c of cs) mask |= 1 << rankOf(c);
  if (straightTop(mask) >= 0) return [];
  const out = [];
  for (let r = 0; r < 13; r++) if (!(mask & (1 << r)) && straightTop(mask | (1 << r)) >= 0) out.push(r);
  return out;
}

/** Suit with exactly four cards among these, or -1. */
export function flushDrawSuit(cs) {
  const counts = [0, 0, 0, 0];
  for (const c of cs) counts[suitOf(c)]++;
  return counts.findIndex(n => n === 4);
}
