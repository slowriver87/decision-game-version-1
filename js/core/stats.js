// Streaks, accuracy over time, and the "most common bias".
import { tallyBiases } from './bias.js';

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

/** Record a finished session on `today`. */
export function updateStreak(streak, today) {
  const s = { current: 0, best: 0, last: null, ...streak };
  if (s.last === today) return s;
  const gap = s.last ? daysBetween(s.last, today) : Infinity;
  const current = gap === 1 ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), last: today };
}

/** Streak as shown today: still alive if you played today or yesterday. */
export function liveStreak(streak, today) {
  if (!streak?.last) return 0;
  const gap = daysBetween(streak.last, today);
  return gap <= 1 ? streak.current : 0;
}

/** Accuracy for one type within each session (null where it didn't appear). */
export function accuracySeries(sessions, type) {
  return sessions.map(s => {
    const rs = s.rounds.filter(r => r.type === type);
    if (!rs.length) return null;
    return rs.reduce((a, r) => a + r.score, 0) / rs.length;
  });
}

/** Average score for a type over the last `n` rounds of that type. */
export function recentAccuracy(sessions, type, n = 12) {
  const rs = sessions.flatMap(s => s.rounds.filter(r => r.type === type)).slice(-n);
  if (!rs.length) return null;
  return rs.reduce((a, r) => a + r.score, 0) / rs.length;
}

export function mostCommonBias(sessions, lastN = 20) {
  const top = tallyBiases(sessions.slice(-lastN).flatMap(s => s.rounds))[0];
  return top || null;
}

/** Per-type summary for one finished session. */
export function sessionBreakdown(rounds) {
  const by = {};
  for (const r of rounds) {
    by[r.type] ??= { type: r.type, n: 0, score: 0, correct: 0 };
    by[r.type].n++;
    by[r.type].score += r.score;
    by[r.type].correct += r.correct ? 1 : 0;
  }
  return Object.values(by).map(b => ({ ...b, avg: b.score / b.n }));
}
