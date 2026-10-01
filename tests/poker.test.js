import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, categoryOf, describe, cards, card, straightTop } from '../js/core/cards.js';
import { equity, outs, ruleOf2And4, ruleOf4Adjusted, requiredEquity, callEv, straightDrawRanks, flushDrawSuit } from '../js/core/poker.js';
import { close } from './helpers.js';

const cat = s => categoryOf(evaluate(cards(s)));
const beats = (a, b) => evaluate(cards(a)) > evaluate(cards(b));

test('hand categories', () => {
  assert.equal(cat('2c 7d 9h Js Kd'), 0);
  assert.equal(cat('2c 2d 9h Js Kd'), 1);
  assert.equal(cat('2c 2d 9h 9s Kd'), 2);
  assert.equal(cat('2c 2d 2h 9s Kd'), 3);
  assert.equal(cat('5c 6d 7h 8s 9d'), 4);
  assert.equal(cat('Ac 2d 3h 4s 5d'), 4);          // wheel
  assert.equal(cat('2h 7h 9h Jh Kh'), 5);
  assert.equal(cat('2c 2d 2h 9s 9d'), 6);
  assert.equal(cat('2c 2d 2h 2s 9d'), 7);
  assert.equal(cat('5h 6h 7h 8h 9h'), 8);
  assert.equal(cat('Ah 2h 3h 4h 5h 9c Kd'), 8);    // steel wheel from 7 cards
});

test('7-card best-hand picks', () => {
  assert.equal(cat('Ah Kh Qh Jh 9h 9c 9d'), 5);    // flush beats trips
  assert.equal(cat('9h 9c 9d 5s 5c 5d 2h'), 6);    // two trips = full house
  assert.equal(cat('Kh Kc Qd Qs Jc Jd 2h'), 2);    // three pairs = two pair
  assert.equal(cat('2c 3d 4h 5s 6d 7c 8h'), 4);
});

test('ranking within a category', () => {
  assert.ok(beats('Ac Ad 2h 3s 4d', 'Kc Kd Qh Js 9d'));           // higher pair
  assert.ok(beats('Ac Ad Kh 3s 4d', 'Ah As Qh Js 9d'));           // kicker
  assert.ok(beats('6c 7d 8h 9s Td', 'Ac 2d 3h 4s 5d'));           // wheel is the lowest straight
  assert.ok(beats('2c 2d 2h 3s 3d', 'Ac Ad Kh Ks Qd'));           // boat beats two pair
  assert.equal(evaluate(cards('Ac Kd Qh Js 9d')), evaluate(cards('As Kh Qd Jc 9h'))); // suits don't matter
});

test('straightTop', () => {
  assert.equal(straightTop(0b1111100000000), 12);
  assert.equal(straightTop((1 << 12) | 0b1111), 3);
  assert.equal(straightTop(0b1011100000000), -1);
});

test('describe', () => {
  assert.equal(describe(evaluate(cards('Kc Kd 7h 7s 2d'))), 'two pair, Kings and Sevens');
  assert.equal(describe(evaluate(cards('Ah Kh Qh Jh Th'))), 'a royal flush');
  assert.equal(describe(evaluate(cards('6c 6d 6h 9s 9d'))), 'a full house, Sixes full of Nines');
});

test('turn flush draw + wheel draw + overcard vs top pair: 15 outs, equity = 15/44', () => {
  const hero = cards('Ah 5h'), villain = cards('Ks Qd'), board = cards('Kh 8h 2c 3d');
  const o = outs(hero, villain, board);
  // 9 hearts, 3 more fours (wheel), and 3 more aces (pair of Aces beats pair of Kings).
  const hearts = o.winning.filter(c => (c & 3) === 1).length;
  assert.equal(hearts, 9);
  assert.equal(o.winning.length, 15);
  const e = equity(hero, villain, board);
  assert.equal(e.runouts, 44);
  assert.ok(close(e.equity, 15 / 44));
});

test('flop equity enumerates all 990 runouts', () => {
  const e = equity(cards('Ah Kh'), cards('Qs Qd'), cards('2h 7h 9c'));
  assert.equal(e.runouts, 990);
  assert.ok(e.equity > 0.5 && e.equity < 0.6);     // nut flush draw + 2 overs is a slight favourite vs QQ
  assert.ok(close(e.win + e.tie + (1 - e.win - e.tie), 1));
});

test('identical hands split', () => {
  const e = equity(cards('Ac Kd'), cards('Ad Kc'), cards('2h 7s 9c Jd'));
  assert.ok(close(e.equity, 0.5));
});

test('rule of 2 and 4', () => {
  assert.ok(close(ruleOf2And4(9, 1), 0.18));
  assert.ok(close(ruleOf2And4(9, 2), 0.36));
  assert.ok(close(ruleOf4Adjusted(8), 0.32));
  assert.ok(close(ruleOf4Adjusted(15), 0.53));
});

test('pot odds and call EV', () => {
  assert.ok(close(requiredEquity(100, 100), 1 / 3));
  assert.ok(close(requiredEquity(100, 50), 0.25));
  // Exactly at the price, a call breaks even.
  assert.ok(close(callEv(requiredEquity(240, 80), 240, 80), 0));
  assert.ok(close(callEv(0.5, 100, 100), 50));
  assert.ok(callEv(0.1, 100, 100) < 0);
});

test('draw detection', () => {
  assert.equal(flushDrawSuit(cards('Ah 5h Kh 8h 2c')), 1);
  assert.equal(flushDrawSuit(cards('Ah 5d Kh 8h 2c')), -1);
  assert.deepEqual(straightDrawRanks(cards('8c 9d Th Js 2c')).sort(), [card('7c') >> 2, card('Qc') >> 2].sort());
  assert.deepEqual(straightDrawRanks(cards('8c 9d Jh Qs 2c')), [card('Tc') >> 2]);
  assert.deepEqual(straightDrawRanks(cards('8c 9d Th Js Qc')), []);   // already a straight
});
