// Generate many scenarios of every type at every level and check they're well formed and correct.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { TYPES } from '../js/scenarios/index.js';
import { expectedValue } from '../js/core/ev.js';
import { truthOf } from '../js/scenarios/bayes.js';
import { equity, requiredEquity } from '../js/core/poker.js';
import { evaluate } from '../js/core/cards.js';
import { FLOAT_JUNK, BAD_TOKEN } from './helpers.js';
import { BIASES } from '../js/core/bias.js';

const RUNS = { ev: 400, bayes: 400, poker: 80 };

function checkText(where, g) {
  const text = [g.headline, g.sub, g.takeaway, g.realWorld, ...g.steps].join(' ');
  assert.ok(!BAD_TOKEN.test(text), `${where}: bad token in "${text.match(BAD_TOKEN)?.[0]}" → ${text.slice(0, 300)}`);
  assert.ok(!FLOAT_JUNK.test(text), `${where}: float junk ${text.match(FLOAT_JUNK)?.[0]}`);
  assert.ok(g.steps.length >= 3 && g.takeaway && g.realWorld);
  for (const t of g.biasTags) assert.ok(BIASES[t], `${where}: unknown bias ${t}`);
}

for (const [id, mod] of Object.entries(TYPES)) {
  test(`${id}: meta has a name and primer`, () => {
    assert.equal(mod.meta.id, id);
    assert.ok(mod.meta.name && mod.meta.primer.length >= 2);
  });
}

test('ev: exactly one best option, sizeable gap, grading consistent', () => {
  for (let level = 1; level <= 5; level++) {
    const r = makeRng(100 + level);
    for (let i = 0; i < RUNS.ev; i++) {
      const s = TYPES.ev.generate(r, level);
      assert.equal(s.options.length, 2);
      const evs = s.options.map(o => expectedValue(o.outcomes));
      assert.notEqual(evs[0], evs[1], 'tied EVs');
      const results = [0, 1].map(c => TYPES.ev.grade(s, c));
      assert.equal(results.filter(g => g.correct).length, 1);
      const best = evs[0] > evs[1] ? 0 : 1;
      assert.ok(results[best].correct);
      assert.ok(Math.abs(results[1 - best].evLost - Math.abs(evs[0] - evs[1])) < 1e-9);
      assert.ok(results[1 - best].biasTags.length === 1);
      for (const o of s.options) for (const oc of o.outcomes) assert.ok(oc.p > 0 && oc.p <= 1);
      results.forEach((g, c) => checkText(`ev L${level} choice ${c}`, g));
      const text = [s.title, s.body, ...s.options.flatMap(o => [o.label, o.detail])].join(' ');
      assert.ok(!BAD_TOKEN.test(text) && !FLOAT_JUNK.test(text), text);
    }
  }
});

test('bayes: truth matches formula; grading and grid are consistent', () => {
  for (let level = 1; level <= 5; level++) {
    const r = makeRng(200 + level);
    for (let i = 0; i < RUNS.bayes; i++) {
      const s = TYPES.bayes.generate(r, level);
      const t = truthOf(s);
      assert.ok(t > 0 && t < 1, `truth ${t}`);
      assert.notEqual(s.hit, s.falseAlarm, 'signal must carry information');
      const exact = TYPES.bayes.grade(s, t);
      assert.equal(exact.correct, true);
      assert.equal(exact.score, 1);
      const far = TYPES.bayes.grade(s, t > 0.5 ? 0 : 1);
      assert.equal(far.correct, false);
      assert.ok(far.biasTags.length === 1);
      const g = exact.grid;
      assert.equal(g.hPos + g.hNeg + g.notHPos + g.notHNeg, 1000);
      checkText(`bayes L${level} ${s.kind}`, exact);
      checkText(`bayes L${level} ${s.kind}`, far);
      assert.ok(!BAD_TOKEN.test(s.body + s.question) && !FLOAT_JUNK.test(s.body), s.body);
    }
  }
});

test('poker: behind now, equity verified independently, clear margin, one right answer', () => {
  const MARGIN = [0, 0.1, 0.07, 0.05, 0.035, 0.02];
  for (let level = 1; level <= 5; level++) {
    const r = makeRng(300 + level);
    for (let i = 0; i < RUNS.poker; i++) {
      const s = TYPES.poker.generate(r, level);
      assert.equal(new Set([...s.hero, ...s.villain, ...s.board]).size, 4 + s.board.length, 'duplicate card');
      assert.equal(s.board.length, s.street === 'flop' ? 3 : 4);
      if (level < 3) assert.equal(s.street, 'turn');
      assert.ok(evaluate([...s.hero, ...s.board]) < evaluate([...s.villain, ...s.board]));
      assert.ok(Math.abs(equity(s.hero, s.villain, s.board).equity - s.equity) < 1e-12);
      const req = requiredEquity(s.pot, s.bet);
      assert.ok(Math.abs(s.equity - req) >= MARGIN[level] - 1e-12);
      const call = TYPES.poker.grade(s, true), fold = TYPES.poker.grade(s, false);
      assert.notEqual(call.correct, fold.correct);
      checkText(`poker L${level}`, call);
      checkText(`poker L${level}`, fold);
    }
  }
});
