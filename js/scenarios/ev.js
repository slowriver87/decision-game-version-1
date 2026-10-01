// "Take a sure thing or gamble?" scenarios, generated from scratch every time.
import { expectedValue, evGivenUp, stdDev } from '../core/ev.js';
import { money, pct } from '../core/format.js';

// Minimum EV gap between options, as a share of the larger |EV|. Harder levels = closer calls.
const MIN_GAP = [0, 0.3, 0.18, 0.1, 0.05, 0.025];
// Probability grid by level.
const P_STEP = [0, 10, 5, 5, 1, 1];

const niceRound = (x) => {
  const a = Math.abs(x);
  const step = a >= 2000 ? 100 : a >= 500 ? 50 : a >= 100 ? 10 : 5;
  return Math.round(x / step) * step;
};

const REAL_WORLD = {
  gain: [
    'Selling a winning stock early to "lock in" gains, even when your thesis says it should keep running, is the same pull toward the sure thing. It\'s called the disposition effect.',
    'Poker tournament "chops": players often take a guaranteed split below their chip-EV just to remove variance.',
    'Game shows like Deal or No Deal: contestants routinely take the banker\'s sure offer even when it\'s below the average of the boxes left.',
  ],
  loss: [
    'Traders who won\'t close a losing position, hoping to get back to even, are taking the gamble over the sure loss. Desks use hard stop-losses for exactly this reason.',
    'Insurance is a deliberately negative-EV bet against a loss. That\'s worth it for ruinous losses, but usually not for small ones you could absorb, like phone warranties.',
    'Gamblers "chasing losses" late in a session is the same pattern: a sure loss feels worse than a risky shot at breaking even.',
  ],
  mixed: [
    'Most people turn down a 50/50 bet to win $150 or lose $100. Losses feel roughly twice as painful as equal gains, an effect called loss aversion.',
    'Investors who check their portfolio daily see more red days and tend to hold less stock than those who check yearly. It\'s called myopic loss aversion.',
    'A positive-EV edge played over many hands is how professional poker and market-making firms earn money. Any single hand can lose.',
  ],
  longshot: [
    'Lottery tickets, far out-of-the-money options, and "lotto" crypto plays are longshots, and people consistently overpay for them.',
    'The favourite-longshot bias: at the racetrack, longshots win less often than their odds imply, so betting them loses more per dollar than betting favourites.',
    'Deep OTM options tend to be priced rich because buyers overweight tiny chances of huge payoffs.',
  ],
};

function describeGamble(outcomes) {
  return outcomes
    .filter(o => o.p > 0)
    .map(o => `${pct(o.p, 0)} chance of ${o.v < 0 ? 'losing ' + money(-o.v) : o.v === 0 ? 'nothing' : money(o.v)}`)
    .join(', ');
}

function makeGainOrLoss(rng, level, sign) {
  const pStep = P_STEP[level];
  for (;;) {
    const p = rng.step(Math.max(pStep, 10), 90, pStep) / 100;
    const big = niceRound(rng.int(3, 40) * 100);
    let outcomes;
    if (level >= 4 && rng.chance(0.5)) {
      // Three-outcome gamble.
      const p2 = Math.min(1 - p - 0.05, rng.step(5, 40, 5) / 100);
      if (p2 <= 0) continue;
      const mid = niceRound(big * rng.step(20, 60, 10) / 100);
      outcomes = [{ p, v: sign * big }, { p: p2, v: sign * mid }, { p: +(1 - p - p2).toFixed(4), v: 0 }];
    } else {
      outcomes = [{ p, v: sign * big }, { p: +(1 - p).toFixed(4), v: 0 }];
    }
    const evG = expectedValue(outcomes);
    const gap = MIN_GAP[level] + rng.next() * 0.2;
    const dir = rng.chance(0.5) ? 1 : -1;
    const sure = niceRound(evG * (1 + dir * gap));
    if (sure === 0 || Math.sign(sure) !== sign) continue;
    const actualGap = Math.abs(sure - evG) / Math.max(Math.abs(sure), Math.abs(evG));
    if (actualGap < MIN_GAP[level]) continue;
    return { sure, outcomes };
  }
}

function makeLongshot(rng, level) {
  for (;;) {
    const p = rng.pick(level >= 3 ? [0.01, 0.02, 0.03, 0.04, 0.05] : [0.01, 0.02, 0.05]);
    const big = niceRound(rng.int(5, 100) * 1000 * (p <= 0.02 ? 1 : 0.4));
    const outcomes = [{ p, v: big }, { p: +(1 - p).toFixed(4), v: 0 }];
    const evG = expectedValue(outcomes);
    const gap = MIN_GAP[level] + rng.next() * 0.25;
    const sure = niceRound(evG * (1 + (rng.chance(0.55) ? 1 : -1) * gap));
    if (sure <= 0) continue;
    if (Math.abs(sure - evG) / Math.max(sure, evG) < MIN_GAP[level]) continue;
    return { sure, outcomes };
  }
}

function makeMixed(rng, level) {
  for (;;) {
    const p = level <= 2 ? 0.5 : rng.step(30, 70, P_STEP[level]) / 100;
    const lose = niceRound(rng.int(1, 20) * 50);
    // Pick a win amount so EV is a meaningful fraction of the stake, either sign.
    const target = (rng.chance(0.6) ? 1 : -1) * (MIN_GAP[level] + rng.next() * 0.25) * lose;
    const win = niceRound((target + (1 - p) * lose) / p);
    if (win <= 0) continue;
    const outcomes = [{ p, v: win }, { p: +(1 - p).toFixed(4), v: -lose }];
    const ev = expectedValue(outcomes);
    if (Math.abs(ev) / lose < MIN_GAP[level] * 0.8) continue;
    return { sure: 0, outcomes };
  }
}

export function generate(rng, level) {
  const frames = level === 1 ? ['gain', 'loss', 'mixed'] : ['gain', 'loss', 'mixed', 'longshot'];
  const frame = rng.pick(frames);
  let built, title, body;
  if (frame === 'gain') {
    built = makeGainOrLoss(rng, level, 1);
    title = 'Sure thing or gamble?';
    body = 'You\'ve won a contest. Pick your prize.';
  } else if (frame === 'loss') {
    built = makeGainOrLoss(rng, level, -1);
    title = 'Cut the loss or gamble?';
    body = 'A position went against you. Choose how to close it out.';
  } else if (frame === 'longshot') {
    built = makeLongshot(rng, level);
    title = 'Cash or a longshot?';
    body = 'You can take cash now or a ticket on a longshot.';
  } else {
    built = makeMixed(rng, level);
    title = 'Take the coin flip?';
    body = 'A friend offers you a one-time bet.';
  }
  const sureOutcomes = [{ p: 1, v: built.sure }];
  const options = frame === 'mixed'
    ? [
        { label: 'Take the bet', detail: describeGamble(built.outcomes), outcomes: built.outcomes, risky: true },
        { label: 'Walk away', detail: 'Nothing happens: $0', outcomes: sureOutcomes, risky: false },
      ]
    : [
        { label: built.sure < 0 ? `Lose ${money(-built.sure)} for sure` : `Take ${money(built.sure)} for sure`, detail: 'Guaranteed', outcomes: sureOutcomes, risky: false },
        { label: 'Take the gamble', detail: describeGamble(built.outcomes), outcomes: built.outcomes, risky: true },
      ];
  // Show the two options in a random order so position isn't a tell.
  const ordered = rng.chance(0.5) ? options : [options[1], options[0]];
  return {
    type: 'ev', level, frame, title, body,
    realWorld: rng.pick(REAL_WORLD[frame]),
    options: ordered,
  };
}

function evLine(opt) {
  const ev = expectedValue(opt.outcomes);
  if (!opt.risky) return `<b>${opt.label}</b>: no uncertainty, so EV = <b>${money(ev)}</b>.`;
  const terms = opt.outcomes.map(o => `${pct(o.p, 0)} × ${money(o.v)}`).join(' + ');
  return `<b>${opt.label}</b>: ${terms} = <b>${money(ev, { cents: true })}</b>.`;
}

export function grade(s, choice) {
  const evs = s.options.map(o => expectedValue(o.outcomes));
  const best = evs[0] >= evs[1] ? 0 : 1;
  const correct = choice === best;
  const lost = evGivenUp(s.options.map(o => o.outcomes), choice);
  const riskyIdx = s.options.findIndex(o => o.risky);
  const pickedRisky = choice === riskyIdx;
  const riskyBetter = best === riskyIdx;

  const biasTags = [];
  if (!correct) {
    if (s.frame === 'gain') biasTags.push('riskAverseGains');
    else if (s.frame === 'loss') biasTags.push(pickedRisky ? 'lossChasing' : 'overInsuring');
    else if (s.frame === 'longshot') biasTags.push(pickedRisky ? 'overweightRare' : 'riskAverseGains');
    else biasTags.push(pickedRisky ? 'riskSeeking' : 'lossAversion');
  }

  const risky = s.options[riskyIdx];
  const sd = stdDev(risky.outcomes);
  const n = 100;
  const steps = [
    'EV (expected value) is what each choice pays <i>on average</i>: multiply each outcome by its chance, then add them up.',
    evLine(s.options[0]),
    evLine(s.options[1]),
    `So <b>${s.options[best].label.toLowerCase()}</b> is worth ${money(Math.abs(evs[0] - evs[1]), { cents: true })} more per play on average. Over ${n} plays that adds up to about ${money(n * Math.abs(evs[0] - evs[1]))}.`,
    `The catch is that the gamble swings by about ±${money(sd)} on any single play. That figure is its standard deviation, the typical distance from the average. The EV only shows up reliably over many plays.`,
  ];
  if (!correct) steps.push(`You gave up <b>${money(lost, { cents: true })}</b> of EV on this choice.`);

  const takeaways = {
    gain: riskyBetter
      ? 'When the gamble pays more on average, the sure thing is an expensive comfort blanket.'
      : 'The sure thing won here. "Sure" isn\'t automatically worse; run the numbers.',
    loss: riskyBetter
      ? 'Here the gamble really did lose less on average. Judge it by the numbers, not by how the sure loss feels.'
      : 'Gambling to dodge a sure loss usually costs more. Take the smaller loss on purpose.',
    longshot: riskyBetter
      ? 'This longshot was actually priced well. Rare isn\'t automatically bad, just usually overpriced.'
      : 'Tiny chances of huge prizes feel bigger than they are. Multiply them out.',
    mixed: riskyBetter
      ? 'A positive-EV bet you can afford to lose is worth taking, even though losing stings more than winning feels good.'
      : 'This bet loses on average. Walking away is a valid move.',
  };

  return {
    correct,
    score: correct ? 1 : 0,
    biasTags,
    headline: correct ? 'Right call.' : 'Not the best play.',
    sub: `You picked "${s.options[choice].label}". The higher-EV choice was "${s.options[best].label}".`,
    steps,
    takeaway: takeaways[s.frame],
    realWorld: s.realWorld,
    evLost: lost,
  };
}

export const meta = {
  id: 'ev',
  name: 'Expected value',
  short: 'EV',
  primer: [
    '<b>Expected value (EV)</b> is the average result per play if you could make the same choice thousands of times.',
    'Work it out by multiplying each outcome by its chance and adding them up. A 30% shot at $1,000 is worth 0.3 × $1,000 = $300 on average.',
    'The goal here is to pick whichever option has the higher EV. Your gut will pull you toward safety when you\'re winning and toward gambling when you\'re losing. Watch for it.',
  ],
};
