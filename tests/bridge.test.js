import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rectModulus, iBeam, iBeamForArea, tubeForArea, eulerLoad, beamCapacity, legForce, capacity, toTonnes, STEEL } from '../js/core/bridges.js';
import { confidenceScore, expectedScore, calibrationTable, CONFIDENCE_LEVELS } from '../js/core/calibration.js';
import { generate, grade, spec } from '../js/scenarios/bridge.js';
import { makeRng } from '../js/core/rng.js';
import { BIASES } from '../js/core/bias.js';
import { close, FLOAT_JUNK, BAD_TOKEN } from './helpers.js';

const rel = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

test('rectangle section modulus: depth counts squared', () => {
  assert.ok(close(rectModulus(0.2, 0.05), (0.2 * 0.0025) / 6));
  // Same plank on edge (4:1) is 4× stronger in bending.
  assert.ok(close(rectModulus(0.05, 0.2) / rectModulus(0.2, 0.05), 4));
});

test('I-beam: formula matches a solid rectangle when the web fills it', () => {
  // Plates as thick as the flange is wide fill the "I" into a solid w × H rectangle.
  const { I, S, area } = iBeam({ depth: 0.4, flange: 0.1, t: 0.1 });
  assert.ok(rel(I, (0.1 * 0.4 ** 3) / 12));
  assert.ok(rel(S, rectModulus(0.1, 0.4)));
  assert.ok(rel(area, 0.1 * 0.4));
});

test('iBeamForArea hits the requested area', () => {
  for (const [d, A] of [[0.5, 0.01], [1, 0.02], [0.3, 0.004]]) {
    const shape = iBeamForArea(d, A);
    assert.ok(rel(iBeam(shape).area, A, 1e-9));
  }
  assert.throws(() => iBeamForArea(0.1, 1));
});

test('tube and Euler buckling', () => {
  const t = tubeForArea(0.01);
  assert.ok(rel(2 * Math.PI * t.R * (t.R / 10), 0.01));
  // Doubling length quarters the buckling load.
  assert.ok(rel(eulerLoad(t.I, 5) / eulerLoad(t.I, 10), 4));
  assert.ok(rel(eulerLoad(1e-6, 1, 200e9), Math.PI ** 2 * 200e3));
});

test('beam capacity: PL/4 = σS', () => {
  const S = 1e-4, L = 10;
  const P = beamCapacity(S, L);
  assert.ok(rel((P * L) / 4, STEEL.yield * S));
  assert.ok(rel(beamCapacity(S, 20), P / 2)); // twice the span, half the load
});

test('leg force: statics of two members meeting at mid-span', () => {
  // 45° legs: each carries (P/2)/sin45 = P/√2.
  const { len, perLoad } = legForce(10, 5);
  assert.ok(rel(len, Math.hypot(5, 5)));
  assert.ok(rel(perLoad, 1 / Math.SQRT2));
  // Flatter legs carry more force.
  assert.ok(legForce(10, 1).perLoad > legForce(10, 3).perLoad);
});

test('capacities: sensible ordering for one steel budget', () => {
  const base = { span: 20, steel: 2000 };
  const t = d => toTonnes(capacity({ ...base, ...d }).N);
  assert.ok(rel(t({ design: 'plankEdge' }) / t({ design: 'plankFlat' }), 4));
  assert.ok(t({ design: 'ibeam', depth: 0.8 }) > t({ design: 'plankEdge' }));
  assert.ok(t({ design: 'ibeam', depth: 1.2 }) > t({ design: 'ibeam', depth: 0.6 }));
  assert.ok(t({ design: 'suspension', depth: 5 }) > t({ design: 'suspension', depth: 2 }));
  assert.equal(capacity({ ...base, design: 'suspension', depth: 4 }).mode, 'yield'); // cables never buckle
  // Half the span with the same steel: the plank is also √2× thicker and wider → (√2)³ × 2 = 2^2.5 stronger.
  assert.ok(rel(capacity({ ...base, span: 10, design: 'plankFlat' }).N, 2 ** 2.5 * capacity({ ...base, design: 'plankFlat' }).N));
  assert.throws(() => capacity({ ...base, design: 'catapult' }));
});

test('confidence scoring is strictly proper: honesty maximises expected score', () => {
  for (const p of [0.1, 0.25, 0.4, 0.5, 0.75, 0.9, 1]) {
    let bestC = 0, best = -1;
    for (let k = 0; k <= 100; k++) {
      const c = k / 100;
      const e = expectedScore(p, c);
      if (e > best) { best = e; bestC = c; }
    }
    assert.ok(Math.abs(bestC - p) < 0.011, `p=${p} best c=${bestC}`);
  }
  assert.ok(confidenceScore(true, 0.95) > confidenceScore(true, 0.25));
  assert.ok(confidenceScore(false, 0.95) < confidenceScore(false, 0.25));
  assert.ok(confidenceScore(true, 0.25) > confidenceScore(false, 0.25));
  assert.throws(() => confidenceScore(true, 1.5));
});

test('calibration table', () => {
  const sessions = [{ rounds: [
    { conf: 0.75, correct: true }, { conf: 0.75, correct: false }, { conf: 0.95, correct: true }, { type: 'ev', correct: true },
  ] }];
  assert.deepEqual(calibrationTable(sessions), [
    { conf: 0.75, n: 2, right: 1, rate: 0.5 },
    { conf: 0.95, n: 1, right: 1, rate: 1 },
  ]);
  assert.deepEqual(calibrationTable([]), []);
});

test('bridge scenarios: one clear winner, grading consistent, text clean', () => {
  const MARGIN = [0, 2, 1.6, 1.35, 1.2, 1.1];
  for (let level = 1; level <= 5; level++) {
    const r = makeRng(500 + level);
    for (let i = 0; i < 200; i++) {
      const s = generate(r, level);
      assert.equal(s.bridges.length, 4);
      assert.deepEqual(s.bridges.map(b => b.letter), ['A', 'B', 'C', 'D']);
      const caps = s.bridges.map(b => toTonnes(capacity(b).N));
      caps.forEach((c, k) => { assert.ok(Number.isFinite(c) && c > 0); assert.ok(rel(c, s.bridges[k].tonnes)); });
      const sorted = [...caps].sort((a, b) => b - a);
      assert.ok(sorted[0] >= MARGIN[level] * sorted[1] - 1e-9, `L${level} margin ${sorted[0] / sorted[1]}`);
      if (level <= 1) assert.equal(new Set(s.bridges.map(b => b.design)).size, 4);
      if (level < 4) assert.equal(new Set(s.bridges.map(b => b.span)).size, 1);
      const best = caps.indexOf(sorted[0]);
      for (let pick = 0; pick < 4; pick++) for (const conf of CONFIDENCE_LEVELS) {
        const g = grade(s, { pick, conf });
        assert.equal(g.correct, pick === best);
        assert.ok(g.score >= 0 && g.score <= 1);
        for (const t of g.biasTags) assert.ok(BIASES[t]);
        const text = [g.headline, g.sub, g.takeaway, g.realWorld, ...g.steps].join(' ');
        assert.ok(!BAD_TOKEN.test(text) && !FLOAT_JUNK.test(text), text.slice(0, 200));
      }
      for (const b of s.bridges) assert.ok(!BAD_TOKEN.test(spec(b, s)));
    }
  }
});
