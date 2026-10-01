import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { planSession, ROUNDS } from '../js/core/session.js';
import { updateStreak, liveStreak, dayKey, daysBetween, accuracySeries, recentAccuracy, mostCommonBias, sessionBreakdown } from '../js/core/stats.js';
import { tallyBiases, BIASES } from '../js/core/bias.js';
import { defaultState, normalize, importJson, exportJson, load, save } from '../js/core/storage.js';

test('session plan: 8 rounds, every type, no back-to-back repeats', () => {
  const r = makeRng(3);
  for (let i = 0; i < 300; i++) {
    const plan = planSession(r, ['ev', 'bayes', 'poker'], { ev: 0.9, bayes: 0.1, poker: 0.5 });
    assert.equal(plan.length, ROUNDS);
    for (const t of ['ev', 'bayes', 'poker']) assert.ok(plan.filter(x => x === t).length >= 2);
    for (let k = 1; k < plan.length; k++) assert.notEqual(plan[k], plan[k - 1], plan.join(','));
  }
});

test('session plan respects per-type limits', () => {
  const r = makeRng(4);
  for (let i = 0; i < 200; i++) {
    const plan = planSession(r, ['ev', 'bayes', 'kelly'], {}, { kelly: 1 });
    assert.equal(plan.length, ROUNDS);
    assert.ok(plan.filter(x => x === 'kelly').length <= 1);
  }
});

test('weaker types get more rounds on average', () => {
  const r = makeRng(5);
  let weak = 0, strong = 0;
  for (let i = 0; i < 500; i++) {
    const plan = planSession(r, ['ev', 'bayes', 'poker'], { ev: 1, bayes: 0, poker: 0 });
    weak += plan.filter(x => x === 'ev').length;
    strong += plan.filter(x => x === 'bayes').length;
  }
  assert.ok(weak > strong);
});

test('streaks', () => {
  let s = updateStreak(undefined, '2026-01-30');
  assert.deepEqual(s, { current: 1, best: 1, last: '2026-01-30' });
  s = updateStreak(s, '2026-01-30');                  // same day: unchanged
  assert.equal(s.current, 1);
  s = updateStreak(s, '2026-01-31');
  s = updateStreak(s, '2026-02-01');                  // across a month boundary
  assert.equal(s.current, 3);
  s = updateStreak(s, '2026-02-03');                  // missed a day
  assert.deepEqual(s, { current: 1, best: 3, last: '2026-02-03' });
  assert.equal(liveStreak(s, '2026-02-04'), 1);
  assert.equal(liveStreak(s, '2026-02-05'), 0);
  assert.equal(liveStreak(undefined, '2026-02-05'), 0);
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2); // leap year
  assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
});

const sessions = [
  { day: '2026-01-01', rounds: [{ type: 'ev', score: 1, correct: true, biasTags: [] }, { type: 'bayes', score: 0.5, correct: false, biasTags: ['baseRateNeglect'] }] },
  { day: '2026-01-02', rounds: [{ type: 'ev', score: 0, correct: false, biasTags: ['lossAversion'] }, { type: 'bayes', score: 0, correct: false, biasTags: ['baseRateNeglect'] }] },
];

test('accuracy series and recent accuracy', () => {
  assert.deepEqual(accuracySeries(sessions, 'ev'), [1, 0]);
  assert.deepEqual(accuracySeries(sessions, 'poker'), [null, null]);
  assert.equal(recentAccuracy(sessions, 'bayes'), 0.25);
  assert.equal(recentAccuracy(sessions, 'ev', 1), 0);
  assert.equal(recentAccuracy(sessions, 'poker'), null);
});

test('bias tallies', () => {
  assert.deepEqual(mostCommonBias(sessions), { id: 'baseRateNeglect', count: 2 });
  assert.equal(mostCommonBias([]), null);
  assert.deepEqual(tallyBiases([{ biasTags: ['b', 'a'] }, { biasTags: ['a'] }]), [{ id: 'a', count: 2 }, { id: 'b', count: 1 }]);
  for (const b of Object.values(BIASES)) assert.ok(b.name && b.insight && b.fix);
});

test('session breakdown', () => {
  const b = sessionBreakdown(sessions[0].rounds);
  assert.deepEqual(b.find(x => x.type === 'bayes'), { type: 'bayes', n: 1, score: 0.5, correct: 0, avg: 0.5 });
});

test('storage: export/import round trip and validation', () => {
  const s = { ...defaultState(), theme: 'light', sessions: [{ ts: 1, day: '2026-01-01', rounds: [{ type: 'ev', level: 2, score: 1, correct: true, biasTags: [], evLost: 0 }] }], skills: { ev: { rating: 2.5 } } };
  const back = importJson(exportJson(s));
  assert.equal(back.theme, 'light');
  assert.deepEqual(back.sessions, s.sessions);
  assert.deepEqual(back.skills, s.skills);
  assert.throws(() => importJson('"hello"'), /not a JSON object/);
  assert.throws(() => importJson('{"v":2}'), /unknown version/);
  assert.throws(() => importJson('{not json'));
  // Junk fields are cleaned, not trusted.
  const n = normalize({ v: 1, theme: 'neon', skills: { ev: { rating: 99 } }, sessions: [{ day: 5 }, { day: '2026-01-01', rounds: [{ type: 'ev', score: 7 }] }] });
  assert.equal(n.theme, 'dark');
  assert.equal(n.skills.ev.rating, 5.99);
  assert.equal(n.sessions.length, 1);
  assert.equal(n.sessions[0].rounds[0].score, 1);
});

test('storage: load/save with a fake localStorage, survives corruption', () => {
  const mem = new Map();
  const fake = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(load(fake), defaultState());
  const s = { ...defaultState(), theme: 'light' };
  assert.equal(save(s, fake), true);
  assert.equal(load(fake).theme, 'light');
  mem.set('decision-making.v1', '{corrupt');
  assert.deepEqual(load(fake), defaultState());
  assert.equal(save(s, { setItem: () => { throw new Error('quota'); } }), false);
});
