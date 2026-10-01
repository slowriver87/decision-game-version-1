// Expected value: the average result per play if you could repeat a choice many times.

/** outcomes: [{ p, v }] with probabilities summing to 1. */
export function expectedValue(outcomes) {
  const total = outcomes.reduce((s, o) => s + o.p, 0);
  if (Math.abs(total - 1) > 1e-9) throw new Error(`probabilities sum to ${total}, not 1`);
  return outcomes.reduce((s, o) => s + o.p * o.v, 0);
}

/** Standard deviation of the outcome: how far a single play typically lands from the EV. */
export function stdDev(outcomes) {
  const m = expectedValue(outcomes);
  return Math.sqrt(outcomes.reduce((s, o) => s + o.p * (o.v - m) ** 2, 0));
}

/** Compare two options. Returns the index of the higher-EV one and the gap between them. */
export function compareEv(a, b) {
  const ea = expectedValue(a), eb = expectedValue(b);
  return { evs: [ea, eb], best: ea >= eb ? 0 : 1, gap: Math.abs(ea - eb) };
}

/** EV you gave up by choosing `chosen` instead of the best option. 0 if you chose best. */
export function evGivenUp(options, chosen) {
  const evs = options.map(expectedValue);
  return Math.max(...evs) - evs[chosen];
}
