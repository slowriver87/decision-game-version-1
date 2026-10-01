// Base-rate problems: a signal fires; how likely is the thing it's meant to detect?
import { posterior, posteriorRepeated, naturalFrequencies, scoreEstimate, CORRECT_WITHIN } from '../core/bayes.js';
import { pct, int } from '../core/format.js';

// Base-rate ranges (in %) by level: rarer conditions are harder to reason about.
const PRIOR = [null, [10, 30, 5], [5, 15, 1], [2, 10, 1], [1, 5, 1], [1, 3, 0.5]];

const prior = (rng, level) => {
  const [lo, hi, step] = PRIOR[level];
  return rng.step(lo, hi, step) / 100;
};

const TEMPLATES = {
  medical(rng, level) {
    const p = prior(rng, level);
    const hit = rng.step(80, 99, 1) / 100;
    const fa = rng.step(3, 15, 1) / 100;
    const disease = rng.pick(['a rare blood condition', 'an early-stage infection', 'a genetic marker']);
    const twice = level >= 5 && rng.chance(0.5);
    return {
      prior: p, hit, falseAlarm: fa, times: twice ? 2 : 1,
      title: 'The positive test',
      body: `${pct(p)} of people your age have ${disease}. The test catches ${pct(hit)} of real cases. It also flags ${pct(fa)} of healthy people by mistake. ` +
        (twice ? 'You test positive, then test positive <b>again</b> on an independent retest.' : 'You test positive.'),
      question: 'What\'s the chance you actually have it?',
      unit: 'people', hName: 'sick', notHName: 'healthy', sigName: 'test positive',
      realWorld: 'Mammograms, PSA tests and drug screens all have this structure. A positive result on a rare condition is often more likely to be a false alarm, which is why doctors order a second test.',
    };
  },
  fraud(rng, level) {
    const p = prior(rng, Math.min(5, level + 1));
    const hit = rng.step(85, 99, 1) / 100;
    const fa = rng.step(1, 8, 1) / 100;
    return {
      prior: p, hit, falseAlarm: fa, times: 1,
      title: 'Fraud alert',
      body: `${pct(p)} of card transactions at a merchant are fraudulent. The bank's model flags ${pct(hit)} of fraud. It also flags ${pct(fa)} of honest transactions.`,
      question: 'A transaction gets flagged. What\'s the chance it\'s really fraud?',
      unit: 'transactions', hName: 'fraudulent', notHName: 'honest', sigName: 'get flagged',
      realWorld: 'This is why your card gets declined on perfectly normal purchases. When fraud is rare, most alerts are false positives. Banks tune the threshold to balance annoyed customers against missed fraud.',
    };
  },
  urn(rng, level) {
    const die = level === 1 ? null : rng.int(1, 4);
    const p = die ? die / 6 : 0.5;
    let a, b;
    do { a = rng.int(2, 9); b = rng.int(1, 8); } while (a === b);
    return {
      prior: p, hit: a / 10, falseAlarm: b / 10, times: 1,
      title: 'Which urn?',
      body: (die
        ? `Roll a die. On 1${die > 1 ? '–' + die : ''} I use <b>Urn A</b>; otherwise <b>Urn B</b>. `
        : 'I flip a fair coin to pick <b>Urn A</b> or <b>Urn B</b>. ') +
        `Urn A holds ${a} red balls out of 10. Urn B holds ${b} red out of 10. I draw one ball without showing you which urn, and it's <b>red</b>.`,
      question: 'What\'s the chance it came from Urn A?',
      unit: 'draws', hName: 'from Urn A', notHName: 'from Urn B', sigName: 'are red',
      realWorld: 'Every time you update on evidence ("this CEO bought shares, so is the stock undervalued?"), you\'re asking which urn the ball came from. How much it should move you depends on how much likelier that evidence is under each story.',
    };
  },
  recession(rng, level) {
    const p = rng.step(level <= 2 ? 15 : 8, level <= 2 ? 30 : 20, 1) / 100;
    const hit = rng.step(70, 95, 5) / 100;
    const fa = rng.step(10, 30, 5) / 100;
    const [signal, noun] = rng.pick([
      ['the yield curve inverts', 'An inversion'],
      ['a famous strategist calls a recession', 'A call like that'],
      ['a leading indicator flashes red', 'A red flash'],
    ]);
    return {
      prior: p, hit, falseAlarm: fa, times: 1,
      title: 'Recession signal',
      body: `In any given year there's a ${pct(p)} chance a recession starts. Before ${pct(hit)} of recessions, ${signal}. ${noun} also shows up in ${pct(fa)} of years with no recession.`,
      question: `This year ${signal}. What's the chance of a recession?`,
      unit: 'years', hName: 'recession years', notHName: 'normal years', sigName: 'see the signal',
      realWorld: 'The yield curve famously has "predicted nine of the last five recessions." A signal that fires before most crashes can still be wrong most of the time, because crashes are rare.',
    };
  },
  tell(rng, level) {
    const p = rng.step(level <= 2 ? 20 : 10, level <= 2 ? 40 : 25, 5) / 100;
    const hit = rng.step(70, 95, 5) / 100;
    const fa = rng.step(20, 50, 5) / 100;
    return {
      prior: p, hit, falseAlarm: fa, times: 1,
      title: 'Reading a big bet',
      body: `An opponent has a monster hand ${pct(p)} of the time in this spot. With a monster they bet big ${pct(hit)} of the time. With anything else they still bet big ${pct(fa)} of the time.`,
      question: 'They just bet big. What\'s the chance they have a monster?',
      unit: 'hands', hName: 'monster hands', notHName: 'weaker hands', sigName: 'bet big',
      realWorld: 'This is hand reading. A big bet is evidence, but how much depends on how often this player bets big with everything else, i.e. their bluff frequency.',
    };
  },
};

export function generate(rng, level) {
  const kinds = level === 1 ? ['medical', 'urn', 'fraud', 'tell'] : Object.keys(TEMPLATES);
  const kind = rng.pick(kinds);
  const t = TEMPLATES[kind](rng, level);
  return { type: 'bayes', level, kind, ...t };
}

export function truthOf(s) {
  return posteriorRepeated(s.prior, s.hit, s.falseAlarm, s.times);
}

export function grade(s, guess) {
  const truth = truthOf(s);
  const score = scoreEstimate(guess, truth);
  const correct = Math.abs(guess - truth) <= CORRECT_WITHIN;
  const hit = s.times === 2 ? s.hit ** 2 : s.hit;
  const fa = s.times === 2 ? s.falseAlarm ** 2 : s.falseAlarm;
  const f = naturalFrequencies(1000, s.prior, hit, fa);
  const totalPos = f.hPos + f.notHPos;

  const biasTags = [];
  if (guess - truth > 0.15) biasTags.push('baseRateNeglect');
  else if (truth - guess > 0.15) biasTags.push('conservatism');

  const steps = [
    `Picture <b>1,000 ${s.unit}</b>. The base rate (how common it is before any evidence) is ${pct(s.prior)}, so about <b>${int(f.h)}</b> are ${s.hName} and ${int(f.notH)} are ${s.notHName}.`,
    s.times === 2
      ? `Of the ${int(f.h)}, ${pct(s.hit)} × ${pct(s.hit)} = ${pct(hit)} ${s.sigName} twice, which is about <b>${int(f.hPos)}</b>.`
      : `Of the ${int(f.h)} who are ${s.hName}, ${pct(s.hit)} ${s.sigName}, about <b>${int(f.hPos)}</b>.`,
    s.times === 2
      ? `Of the ${int(f.notH)} ${s.notHName}, ${pct(s.falseAlarm)} × ${pct(s.falseAlarm)} = ${pct(fa, 2)} ${s.sigName} twice by bad luck, about <b>${int(f.notHPos)}</b>.`
      : `But ${pct(s.falseAlarm)} of the ${int(f.notH)} ${s.notHName} ${s.sigName} too. That's about <b>${int(f.notHPos)}</b> false alarms.`,
    `So ${int(totalPos)} ${s.unit} ${s.sigName}, and only ${int(f.hPos)} of them are ${s.hName}: ${int(f.hPos)} ÷ ${int(totalPos)} ≈ <b>${pct(truth)}</b>.`,
    `Formula version: (${pct(s.prior)} × ${pct(hit)}) ÷ (${pct(s.prior)} × ${pct(hit)} + ${pct(1 - s.prior)} × ${pct(fa, 2)}) = ${pct(truth)}. The top is "real positives"; the bottom is "all positives".`,
    `You said <b>${pct(guess, 0)}</b>. ${correct ? 'That\'s within 5 points, full credit.' : `You were ${Math.round(Math.abs(guess - truth) * 100)} points ${guess > truth ? 'too high' : 'too low'}.`}`,
  ];

  let takeaway;
  if (truth < 0.5 && s.hit >= 0.8) takeaway = 'An accurate test on a rare thing still mostly produces false alarms. Start from the base rate, then adjust.';
  else if (truth > 0.7) takeaway = 'Here the evidence was strong enough to overwhelm the base rate. Strong evidence should move you a lot.';
  else takeaway = 'Your answer depends on two things: how common it was to start with, and how much likelier the evidence is if it\'s true than if it\'s false.';

  return {
    correct,
    score,
    biasTags,
    headline: correct ? 'Nailed it.' : score > 0.5 ? 'Close.' : guess > truth ? 'Too high. The base rate got lost.' : 'Too low. The evidence deserved more weight.',
    sub: `True answer: ${pct(truth)}. You said ${pct(guess, 0)}.`,
    steps,
    takeaway,
    realWorld: s.realWorld,
    grid: { ...f, hName: s.hName, notHName: s.notHName, sigName: s.sigName },
  };
}

export const meta = {
  id: 'bayes',
  name: 'Bayesian updating',
  short: 'Bayes',
  primer: [
    'You\'ll get a <b>base rate</b> (how common something is) and a <b>signal</b> (a test, an alert, a tell) that\'s right most of the time but not always.',
    'The trick: imagine 1,000 cases. Count the true alarms and the false alarms. Your answer is true alarms ÷ all alarms.',
    'When the thing is rare, false alarms from the huge "normal" group often outnumber the real cases.',
  ],
};
