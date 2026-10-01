// Cards are integers 0..51: rank = c >> 2 (0 = deuce .. 12 = ace), suit = c & 3.

export const RANKS = '23456789TJQKA';
export const SUITS = ['s', 'h', 'd', 'c'];
export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK_NAME = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
const RANK_PLURAL = ['Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines', 'Tens', 'Jacks', 'Queens', 'Kings', 'Aces'];

export const rankOf = c => c >> 2;
export const suitOf = c => c & 3;
export const card = str => RANKS.indexOf(str[0]) * 4 + SUITS.indexOf(str[1]);
export const cards = str => str.trim().split(/\s+/).map(card);
export const cardStr = c => RANKS[rankOf(c)] + SUITS[suitOf(c)];
export const fullDeck = () => Array.from({ length: 52 }, (_, i) => i);
export const rankName = r => RANK_NAME[r];
export const rankPlural = r => RANK_PLURAL[r];

export const CATEGORY = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

/** Highest straight in a 13-bit rank mask, as top rank index, or -1. Handles the A-2-3-4-5 wheel. */
export function straightTop(mask) {
  for (let top = 12; top >= 4; top--) {
    const need = 0b11111 << (top - 4);
    if ((mask & need) === need) return top;
  }
  const wheel = (1 << 12) | 0b1111;
  return (mask & wheel) === wheel ? 3 : -1;
}

const pack = (cat, ks) => {
  let v = cat;
  for (let i = 0; i < 5; i++) v = v * 13 + (ks[i] ?? 0);
  return v;
};

/**
 * Evaluate the best 5-card hand from 5–7 cards.
 * Returns a number: higher beats lower, equal ties.
 */
export function evaluate(cs) {
  const counts = new Array(13).fill(0);
  const suitMasks = [0, 0, 0, 0];
  const suitCounts = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cs) {
    const r = c >> 2, s = c & 3;
    counts[r]++;
    suitMasks[s] |= 1 << r;
    suitCounts[s]++;
    mask |= 1 << r;
  }
  // Straight flush / flush
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCounts[s] >= 5) flushSuit = s;
  if (flushSuit >= 0) {
    const sf = straightTop(suitMasks[flushSuit]);
    if (sf >= 0) return pack(8, [sf]);
  }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quads.push(r);
    else if (counts[r] === 3) trips.push(r);
    else if (counts[r] === 2) pairs.push(r);
    else if (counts[r] === 1) singles.push(r);
  }
  if (quads.length) {
    const kicker = [...trips, ...pairs, ...singles].sort((a, b) => b - a)[0];
    return pack(7, [quads[0], kicker]);
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pairRank = Math.max(trips[1] ?? -1, pairs[0] ?? -1);
    return pack(6, [trips[0], pairRank]);
  }
  if (flushSuit >= 0) {
    const ks = [];
    for (let r = 12; r >= 0 && ks.length < 5; r--) if (suitMasks[flushSuit] & (1 << r)) ks.push(r);
    return pack(5, ks);
  }
  const st = straightTop(mask);
  if (st >= 0) return pack(4, [st]);
  if (trips.length) return pack(3, [trips[0], ...singles.slice(0, 2)]);
  if (pairs.length >= 2) {
    const kicker = [...pairs.slice(2), ...singles].sort((a, b) => b - a)[0];
    return pack(2, [pairs[0], pairs[1], kicker]);
  }
  if (pairs.length) return pack(1, [pairs[0], ...singles.slice(0, 3)]);
  return pack(0, singles.slice(0, 5));
}

export const categoryOf = value => Math.floor(value / 13 ** 5);

/** Human description, e.g. "two pair, Kings and Sevens". */
export function describe(value) {
  const cat = categoryOf(value);
  const k = [];
  let v = value;
  for (let i = 0; i < 5; i++) { k.unshift(v % 13); v = Math.floor(v / 13); }
  switch (cat) {
    case 0: return `${rankName(k[0])}-high`;
    case 1: return `a pair of ${rankPlural(k[0])}, ${rankName(k[1])} kicker`;
    case 2: return `two pair, ${rankPlural(k[0])} and ${rankPlural(k[1])}`;
    case 3: return `three ${rankPlural(k[0])}`;
    case 4: return `a ${rankName(k[0])}-high straight`;
    case 5: return `a ${rankName(k[0])}-high flush`;
    case 6: return `a full house, ${rankPlural(k[0])} full of ${rankPlural(k[1])}`;
    case 7: return `four ${rankPlural(k[0])}`;
    default: return k[0] === 12 ? 'a royal flush' : `a ${rankName(k[0])}-high straight flush`;
  }
}
