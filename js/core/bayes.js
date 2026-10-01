// Bayes' rule, in both formula and "count the people" form.

/**
 * P(H | positive signal).
 * prior: P(H). hit: P(signal | H). falseAlarm: P(signal | not H).
 */
export function posterior(prior, hit, falseAlarm) {
  const a = prior * hit;
  const b = (1 - prior) * falseAlarm;
  if (a + b === 0) throw new Error('signal is impossible under these numbers');
  return a / (a + b);
}

/** Two independent positive signals in a row: apply Bayes twice. */
export function posteriorRepeated(prior, hit, falseAlarm, times) {
  let p = prior;
  for (let i = 0; i < times; i++) p = posterior(p, hit, falseAlarm);
  return p;
}

/**
 * Natural frequencies: the same problem as whole counts out of `n`.
 * Rounds each group, and the four cells always sum to n.
 */
export function naturalFrequencies(n, prior, hit, falseAlarm) {
  const h = Math.round(n * prior);
  const hPos = Math.round(h * hit);
  const notH = n - h;
  const notHPos = Math.round(notH * falseAlarm);
  return { n, h, hPos, hNeg: h - hPos, notH, notHPos, notHNeg: notH - notHPos };
}

/**
 * Score a probability estimate. Within 5 points of the truth = full credit,
 * fading linearly to zero at 25 points off.
 */
export function scoreEstimate(guess, truth) {
  const err = Math.abs(guess - truth);
  const raw = 1 - Math.max(0, err - 0.05) / 0.2;
  return Math.max(0, Math.min(1, Math.round(raw * 1e6) / 1e6));
}

export const CORRECT_WITHIN = 0.05;
