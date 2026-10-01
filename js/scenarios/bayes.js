// Base-rate problems: a signal fires; how likely is the thing it's meant to detect?
import { posterior, posteriorRepeated, naturalFrequencies, scoreEstimate, CORRECT_WITHIN } from '../core/bayes.js';
import { pct, int } from '../core/format.js';

// Base-rate ranges (in %) by level: rarer things are harder to reason about.
const PRIOR = [null, [10, 30, 5], [5, 15, 1], [2, 10, 1], [1, 5, 1], [1, 3, 0.5]];

const prior = (rng, level) => {
  const [lo, hi, step] = PRIOR[level];
  return rng.step(lo, hi, step) / 100;
};

const TEMPLATES = {
  treasure(rng, level) {
    const p = prior(rng, level);
    const hit = rng.step(80, 99, 1) / 100;
    const fa = rng.step(3, 15, 1) / 100;
    const [place, prize] = rng.pick([
      ['an old shipwreck beach', 'a silver coin'],
      ['a Civil War campsite', 'a brass button'],
      ['a Roman fort site', 'a Roman coin'],
    ]);
    const twice = level >= 5 && rng.chance(0.5);
    return {
      prior: p, hit, falseAlarm: fa, times: twice ? 2 : 1,
      title: 'Metal detector',
      body: `You're sweeping ${place}. ${pct(p)} of the spots you check hide ${prize}. Your detector beeps over ${pct(hit)} of real finds. It also beeps over ${pct(fa)} of spots with nothing but bottle caps. ` +
        (twice ? 'It beeps, and then beeps <b>again</b> on a second, independent sweep.' : 'It beeps.'),
      question: `What's the chance there's really ${prize} down there?`,
      unit: 'spots', hName: 'real finds', notHName: 'bottle-cap spots', sigName: 'beep',
      realWorld: 'Any screen for a rare thing works like this, from spam filters and airport scanners to stock screeners. When the real thing is rare, most alarms are false, which is why a second independent check is so powerful.',
    };
  },
  letter(rng, level) {
    const p = prior(rng, Math.min(5, level + 1));
    const hit = rng.step(85, 99, 1) / 100;
    const fa = rng.step(2, 12, 1) / 100;
    const who = rng.pick(['Napoleon', 'Abraham Lincoln', 'Queen Elizabeth I', 'Benjamin Franklin']);
    const twice = level >= 5 && rng.chance(0.5);
    return {
      prior: p, hit, falseAlarm: fa, times: twice ? 2 : 1,
      title: 'The lost letter',
      body: `A "lost letter from ${who}" turns up at auction. Only ${pct(p)} of letters like this turn out genuine. An ink-and-paper expert approves ${pct(hit)} of genuine letters, but is also fooled by ${pct(fa)} of good fakes. ` +
        (twice ? 'The expert approves it, and a <b>second</b>, independent expert approves it too.' : 'The expert approves it.'),
      question: 'What\'s the chance the letter is genuine?',
      unit: 'letters', hName: 'genuine', notHName: 'fakes', sigName: 'get approved',
      realWorld: 'Art authentication, "lost" manuscripts and rare-coin grading all live with this. When fakes vastly outnumber the real thing, even a good expert\'s approval leaves real doubt. That\'s why big sales demand provenance as well.',
    };
  },
  rookie(rng, level) {
    const p = prior(rng, level);
    const hit = rng.step(70, 95, 5) / 100;
    const fa = rng.step(5, 25, 5) / 100;
    const sport = rng.pick(['basketball', 'baseball', 'football', 'hockey']);
    return {
      prior: p, hit, falseAlarm: fa, times: 1,
      title: 'The star scout',
      body: `${pct(p)} of first-round ${sport} rookies become All-Stars. A famous scout labels ${pct(hit)} of future All-Stars as "can't miss". But the scout also says "can't miss" about ${pct(fa)} of rookies who never make it.`,
      question: 'The scout calls your team\'s rookie "can\'t miss". What\'s the chance they become an All-Star?',
      unit: 'rookies', hName: 'future All-Stars', notHName: 'busts', sigName: 'get the label',
      realWorld: 'Draft hype, hot fund managers and "next big thing" startups. Rave reviews are common and true stars are rare, so most "can\'t miss" picks miss.',
    };
  },
  breakout(rng, level) {
    const p = prior(rng, level);
    const hit = rng.step(70, 95, 5) / 100;
    const fa = rng.step(5, 25, 5) / 100;
    return {
      prior: p, hit, falseAlarm: fa, times: 1,
      title: 'Breakout alert',
      body: `${pct(p)} of small-cap stocks double within a year. A popular screener flags ${pct(hit)} of those future doublers ahead of time. It also flags ${pct(fa)} of stocks that go nowhere.`,
      question: 'A stock just got flagged. What\'s the chance it doubles?',
      unit: 'stocks', hName: 'future doublers', notHName: 'duds', sigName: 'get flagged',
      realWorld: 'Every backtest that says "this signal caught 90% of the big winners" is quoting the hit rate. The question that matters is what share of flagged stocks win, and that depends on how many duds also trip the signal.',
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
  const kinds = level === 1 ? ['treasure', 'urn', 'letter', 'tell', 'rookie'] : Object.keys(TEMPLATES);
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
      : `Of the ${int(f.h)} that are ${s.hName}, ${pct(s.hit)} ${s.sigName}, about <b>${int(f.hPos)}</b>.`,
    s.times === 2
      ? `Of the ${int(f.notH)} ${s.notHName}, ${pct(s.falseAlarm)} × ${pct(s.falseAlarm)} = ${pct(fa, 2)} ${s.sigName} twice by bad luck, about <b>${int(f.notHPos)}</b>.`
      : `But ${pct(s.falseAlarm)} of the ${int(f.notH)} ${s.notHName} ${s.sigName} too. That's about <b>${int(f.notHPos)}</b> false alarms.`,
    `So ${int(totalPos)} ${s.unit} ${s.sigName}, and only ${int(f.hPos)} of them are ${s.hName}: ${int(f.hPos)} ÷ ${int(totalPos)} ≈ <b>${pct(truth)}</b>.`,
    `Formula version: (${pct(s.prior)} × ${pct(hit)}) ÷ (${pct(s.prior)} × ${pct(hit)} + ${pct(1 - s.prior)} × ${pct(fa, 2)}) = ${pct(truth)}. The top is "real positives"; the bottom is "all positives".`,
    `You said <b>${pct(guess, 0)}</b>. ${correct ? 'That\'s within 5 points, full credit.' : `You were ${Math.round(Math.abs(guess - truth) * 100)} points ${guess > truth ? 'too high' : 'too low'}.`}`,
  ];

  let takeaway;
  if (truth < 0.5 && s.hit >= 0.8) takeaway = 'An accurate signal for a rare thing still mostly produces false alarms. Start from the base rate, then adjust.';
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
    'You\'ll get a <b>base rate</b> (how common something is) and a <b>signal</b> (a detector beep, an expert\'s opinion, a tell) that\'s right most of the time but not always.',
    'The trick: imagine 1,000 cases. Count the true alarms and the false alarms. Your answer is true alarms ÷ all alarms.',
    'When the thing is rare, false alarms from the huge "normal" group often outnumber the real cases.',
  ],
};
