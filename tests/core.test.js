import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { money, pct, int, num, oneIn } from '../js/core/format.js';
import { expectedValue, stdDev, compareEv, evGivenUp } from '../js/core/ev.js';
import { posterior, posteriorRepeated, naturalFrequencies, scoreEstimate } from '../js/core/bayes.js';
import { updateRating, levelOf } from '../js/core/difficulty.js';
import { close } from './helpers.js';

test('rng is deterministic and in range', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const r = makeRng(1);
  for (let i = 0; i < 2000; i++) {
    const x = r.int(3, 7);
    assert.ok(x >= 3 && x <= 7 && Number.isInteger(x));
    const s = r.step(10, 90, 5);
    assert.ok(s >= 10 && s <= 90 && s % 5 === 0);
  }
  const shuffled = r.shuffle([1, 2, 3, 4, 5]);
  assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4, 5]);
});

test('money and percent formatting', () => {
  assert.equal(money(1234), '$1,234');
  assert.equal(money(-50), '−$50');
  assert.equal(money(12.5, { cents: true }), '$12.50');
  assert.equal(money(12, { cents: true }), '$12');
  assert.equal(money(30, { sign: true }), '+$30');
  assert.equal(pct(0.1234), '12.3%');
  assert.equal(pct(0.25), '25%');
  assert.equal(pct(0.3 * 0.1 * 10), '30%');
  assert.equal(pct(0.0001, 1), '<0.1%');
  assert.equal(int(1234.6), '1,235');
  assert.equal(num(0.1 + 0.2), '0.3');
  assert.equal(oneIn(0.004), '1 in 250');
});

test('expected value', () => {
  assert.equal(expectedValue([{ p: 1, v: 400 }]), 400);
  assert.ok(close(expectedValue([{ p: 0.3, v: 1500 }, { p: 0.7, v: 0 }]), 450));
  assert.ok(close(expectedValue([{ p: 0.5, v: 150 }, { p: 0.5, v: -100 }]), 25));
  assert.throws(() => expectedValue([{ p: 0.5, v: 1 }]), /sum/);
});

test('standard deviation', () => {
  assert.equal(stdDev([{ p: 1, v: 100 }]), 0);
  // Fair ±$100 coin flip: SD = $100.
  assert.ok(close(stdDev([{ p: 0.5, v: 100 }, { p: 0.5, v: -100 }]), 100));
});

test('compareEv and evGivenUp', () => {
  const sure = [{ p: 1, v: 400 }];
  const gamble = [{ p: 0.3, v: 1500 }, { p: 0.7, v: 0 }];
  const c = compareEv(sure, gamble);
  assert.equal(c.best, 1);
  assert.ok(close(c.gap, 50));
  assert.ok(close(evGivenUp([sure, gamble], 0), 50));
  assert.equal(evGivenUp([sure, gamble], 1), 0);
});

test('Bayes posterior: classic mammogram numbers', () => {
  // 1% prevalence, 90% sensitivity, 9% false positive rate → ~9.2%.
  assert.ok(close(posterior(0.01, 0.9, 0.09), 0.009 / (0.009 + 0.0891)));
  assert.ok(Math.abs(posterior(0.01, 0.9, 0.09) - 0.0917) < 0.0005);
  // Coin flip between urns with 7/10 and 3/10 red, drew red → 70%.
  assert.ok(close(posterior(0.5, 0.7, 0.3), 0.7));
  // Uninformative signal leaves the prior unchanged.
  assert.ok(close(posterior(0.2, 0.6, 0.6), 0.2));
  assert.throws(() => posterior(0, 0.5, 0));
});

test('Bayes: repeated update equals squaring the likelihoods', () => {
  const twice = posteriorRepeated(0.02, 0.9, 0.05, 2);
  const direct = posterior(0.02, 0.81, 0.0025);
  assert.ok(close(twice, direct));
  assert.equal(posteriorRepeated(0.3, 0.9, 0.1, 0), 0.3);
});

test('natural frequencies always add up', () => {
  const r = makeRng(9);
  for (let i = 0; i < 500; i++) {
    const f = naturalFrequencies(1000, r.next(), r.next(), r.next());
    assert.equal(f.h + f.notH, 1000);
    assert.equal(f.hPos + f.hNeg, f.h);
    assert.equal(f.notHPos + f.notHNeg, f.notH);
    assert.ok(f.hNeg >= 0 && f.notHNeg >= 0);
  }
  const f = naturalFrequencies(1000, 0.01, 0.9, 0.09);
  assert.deepEqual([f.h, f.hPos, f.notHPos], [10, 9, 89]);
});

test('estimate scoring', () => {
  assert.equal(scoreEstimate(0.1, 0.1), 1);
  assert.equal(scoreEstimate(0.15, 0.1), 1);          // within 5 points
  assert.ok(close(scoreEstimate(0.25, 0.1), 0.5));    // 15 off → halfway
  assert.equal(scoreEstimate(0.9, 0.1), 0);
  assert.equal(scoreEstimate(0.35, 0.1), 0);          // 25 off → zero
});

test('difficulty climbs slowly and is clamped', () => {
  let r = 1;
  for (let i = 0; i < 3; i++) r = updateRating(r, 1);
  assert.equal(levelOf(r), 1);  // three right isn't enough
  r = updateRating(r, 1);
  assert.equal(levelOf(r), 2);  // four is
  for (let i = 0; i < 100; i++) r = updateRating(r, 1);
  assert.equal(levelOf(r), 5);
  for (let i = 0; i < 100; i++) r = updateRating(r, 0);
  assert.equal(r, 1);
  assert.equal(updateRating(2, 0.6), 2.08);
});
