// Confidence scoring and calibration: are your "75% sure" calls right 75% of the time?

export const CONFIDENCE_LEVELS = [0.25, 0.5, 0.75, 0.95];

/**
 * Score a pick made with confidence c (0..1). A strictly proper scoring rule:
 * if your real chance of being right is p, your expected score is highest when c = p.
 * Right: 1 − ½(1 − c)²  (0.72 at 25% … ~1.0 at 95%)
 * Wrong: ½(1 − c²)       (0.47 at 25% … 0.05 at 95%)
 */
export function confidenceScore(correct, c) {
  if (!(c >= 0 && c <= 1)) throw new Error('confidence must be between 0 and 1');
  return correct ? 1 - 0.5 * (1 - c) ** 2 : 0.5 * (1 - c * c);
}

/** Expected score if your true hit rate is p and you report c. */
export const expectedScore = (p, c) => p * confidenceScore(true, c) + (1 - p) * confidenceScore(false, c);

/** For each confidence level you used: how often were you actually right? */
export function calibrationTable(sessions) {
  const rows = new Map();
  for (const s of sessions) for (const r of s.rounds) {
    if (typeof r.conf !== 'number') continue;
    const row = rows.get(r.conf) ?? { conf: r.conf, n: 0, right: 0 };
    row.n++;
    if (r.correct) row.right++;
    rows.set(r.conf, row);
  }
  return [...rows.values()].sort((a, b) => a.conf - b.conf).map(r => ({ ...r, rate: r.right / r.n }));
}
