// The ways a gut call goes wrong, and what to do about each one.

export const BIASES = {
  riskAverseGains: {
    name: 'Grabbing the sure thing',
    insight: 'When you were ahead, you took guaranteed money even when the gamble paid more on average.',
    fix: 'Ask yourself: "If I faced this 100 times, which would I want?"',
  },
  lossChasing: {
    name: 'Gambling to avoid a loss',
    insight: 'Facing a sure loss, you gambled to escape it even though the gamble cost more on average.',
    fix: 'A smaller certain loss is often the cheapest exit. Price it like any other bet.',
  },
  overInsuring: {
    name: 'Overpaying for safety',
    insight: 'You locked in a sure loss that was bigger than the average cost of riding out the risk.',
    fix: 'Insure against ruin, not against every bump.',
  },
  overweightRare: {
    name: 'Overweighting rare outcomes',
    insight: 'You were drawn to small chances at big payoffs that were priced worse than they felt.',
    fix: 'Multiply it out: a 2% shot at $10,000 is worth $200, no more.',
  },
  lossAversion: {
    name: 'Loss aversion',
    insight: 'You turned down favourable bets because the possible loss loomed larger than the bigger possible gain.',
    fix: 'If you can afford to lose it and the EV is positive, take it.',
  },
  riskSeeking: {
    name: 'Taking bad bets',
    insight: 'You accepted bets that lose money on average.',
    fix: 'Excitement isn\'t edge. Check the EV before you take a bet.',
  },
  baseRateNeglect: {
    name: 'Ignoring base rates',
    insight: 'You trusted the test or signal and forgot how rare the thing was to begin with.',
    fix: 'Always start with "out of 1,000…" and count the false alarms.',
  },
  conservatism: {
    name: 'Underreacting to evidence',
    insight: 'The evidence was strong, but you barely moved off your starting point.',
    fix: 'Ask how much likelier the evidence is if it\'s true than if it\'s false. Big ratios deserve big updates.',
  },
  chasingDraws: {
    name: 'Chasing draws',
    insight: 'You called with draws when the price was too high for your chance of hitting.',
    fix: 'Compare outs × 2 (or × 4) against your call ÷ the final pot before calling.',
  },
  tooTight: {
    name: 'Folding too much',
    insight: 'You folded draws that were getting a good enough price to call.',
    fix: 'Losing most of the time is fine when the payoff is big enough. Trust the price.',
  },
  overconfidence: {
    name: 'Overconfidence',
    insight: 'You said you were very sure and turned out wrong. That costs more than an honest "not sure".',
    fix: 'Before locking in 95%, ask: would I really be wrong only 1 time in 20?',
  },
  underconfidence: {
    name: 'Underconfidence',
    insight: 'You were right but said you were basically guessing, which left points on the table.',
    fix: 'If you have a reason for your pick, back it with more than 25%.',
  },
  overBetting: {
    name: 'Over-betting',
    insight: 'You staked more than your edge justified, so a few losses did outsized damage.',
    fix: 'Size bets to your edge. Half-Kelly is a good default.',
  },
  underBetting: {
    name: 'Under-betting',
    insight: 'You had a real edge but bet so little it barely mattered.',
    fix: 'When the odds are in your favour, a meaningful (but not huge) stake is how the edge pays off.',
  },
  stoppedEarly: {
    name: 'Settling too early',
    insight: 'You accepted an offer before you\'d seen enough to know what "good" looks like.',
    fix: 'Spend the first ~37% just looking.',
  },
  stoppedLate: {
    name: 'Holding out too long',
    insight: 'You passed on strong options hoping for better, then ran out of chances.',
    fix: 'After the look phase, take the first option that beats everything so far.',
  },
  pushedTooFar: {
    name: 'Pushing your luck',
    insight: 'You kept going past the point where one more try was worth the risk.',
    fix: 'Stop when what you could lose outweighs what you expect to add.',
  },
  bankedTooEarly: {
    name: 'Banking too early',
    insight: 'You stopped while continuing still had positive expected value.',
    fix: 'Small risks to a small pot are worth taking.',
  },
};

/** Tally bias tags across rounds. Returns [{ id, count }] most common first. */
export function tallyBiases(rounds) {
  const counts = {};
  for (const r of rounds) for (const t of r.biasTags || []) counts[t] = (counts[t] || 0) + 1;
  return Object.entries(counts)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}
