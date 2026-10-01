// Four bridges, one steel budget each. Which holds the most at mid-span? And how sure are you?
import { capacity, toTonnes, DESIGNS } from '../core/bridges.js';
import { confidenceScore, CONFIDENCE_LEVELS } from '../core/calibration.js';
import { pct, num } from '../core/format.js';

// How much stronger the winner must be than the runner-up, by level.
const MARGIN = [0, 2, 1.6, 1.35, 1.2, 1.1];
const LETTERS = ['A', 'B', 'C', 'D'];
const HEIGHT_RATIOS = [1 / 10, 1 / 6, 1 / 4, 1 / 3];   // truss / arch / suspension rise or sag ÷ span
const IBEAM_RATIOS = [1 / 40, 1 / 25, 1 / 15];          // I-beam depth ÷ span
const CONTENDERS = ['ibeam', 'truss', 'arch', 'suspension'];

const REAL_WORLD = [
  'The Brooklyn Bridge (1883) hung its deck from steel-wire cables, because steel is strongest when it\'s pulled. Suspension bridges still hold every span record.',
  'Roman arches have stood for 2,000 years. An arch turns the load into pure squeezing, which stone handles well. Its weak spots are thin, tall ribs that can bow sideways.',
  'Rolled I-beams (from the 1850s on) put the metal at the top and bottom, where bending stress is biggest. It\'s the plank-on-edge trick taken to the limit.',
  'Weather forecasters are famously well calibrated: when they say "70% chance of rain", it rains about 70% of those days. Poker players and traders train the same skill.',
  'In forecasting tournaments, the best "superforecasters" win partly by being right and partly by knowing how sure to be. Overconfidence costs them more than ignorance does.',
];

function randomBridge(rng, design, span, steel) {
  const b = { design, span, steel };
  if (design === 'ibeam') b.depth = +(span * rng.pick(IBEAM_RATIOS)).toFixed(2);
  else if (design !== 'plankFlat' && design !== 'plankEdge') b.depth = +(span * rng.pick(HEIGHT_RATIOS)).toFixed(1);
  return b;
}

const sameBridge = (a, b) => a.design === b.design && a.depth === b.depth && a.span === b.span && a.steel === b.steel;

export function generate(rng, level) {
  const baseSpan = rng.pick([12, 16, 20, 24, 30]);
  const baseSteel = rng.pick([1000, 1500, 2000, 3000]);
  let target = rng.pick(CONTENDERS);
  const variedSpan = level >= 4, variedSteel = level >= 5;
  const pool = Object.keys(DESIGNS);

  for (let tries = 0; tries < 4000; tries++) {
    if (tries % 200 === 199) target = rng.pick(CONTENDERS); // some winners are hard to set up at some levels
    const bridges = [];
    const used = new Set();
    for (let i = 0; i < 4; i++) {
      const design = i === 0 ? target : rng.pick(level <= 1 ? pool.filter(d => !used.has(d)) : pool);
      used.add(design);
      const span = variedSpan ? Math.round(baseSpan * rng.pick([0.7, 1, 1.3])) : baseSpan;
      const steel = variedSteel ? baseSteel * rng.pick([0.75, 1, 1.5]) : baseSteel;
      bridges.push(randomBridge(rng, design, span, steel));
    }
    if (bridges.some((b, i) => bridges.some((c, j) => j < i && sameBridge(b, c)))) continue;
    let caps;
    try { caps = bridges.map(b => toTonnes(capacity(b).N)); } catch { continue; }
    const order = caps.map((c, i) => i).sort((a, b) => caps[b] - caps[a]);
    if (order[0] !== 0) continue;                      // the target design must win…
    if (caps[0] < MARGIN[level] * caps[order[1]]) continue; // …by a clear enough margin
    // Shuffle so the winner isn't always card A.
    const shuffled = rng.shuffle(bridges.map((b, i) => ({ ...b, tonnes: caps[i] })));
    return { type: 'bridge', level, variedSpan, variedSteel, bridges: shuffled.map((b, i) => ({ ...b, letter: LETTERS[i] })), realWorld: rng.pick(REAL_WORLD) };
  }
  throw new Error('could not generate a bridge set');
}

export function spec(b, s) {
  const parts = [];
  if (b.design === 'ibeam') parts.push(`${num(b.depth, 2)} m deep`);
  else if (b.design === 'truss' || b.design === 'arch') parts.push(`rises ${num(b.depth, 1)} m`);
  else if (b.design === 'suspension') parts.push(`sags ${num(b.depth, 1)} m`);
  if (s?.variedSpan) parts.push(`${b.span} m span`);
  if (s?.variedSteel) parts.push(`${num(b.steel / 1000, 2)} t steel`);
  return parts.join(' · ');
}

function why(b) {
  const c = capacity(b);
  const name = `<b>${b.letter} · ${DESIGNS[b.design].name}</b>`;
  const t = `<b>${num(b.tonnes, 1)} t</b>`;
  switch (b.design) {
    case 'plankFlat':
      return `${name}: bends easily because it's thin top to bottom. Holds ${t}.`;
    case 'plankEdge':
      return `${name}: the same plank, 4× deeper. Bending strength grows with depth², but it also gets 4× narrower, so it ends up 4× stronger. Holds ${t}.`;
    case 'ibeam':
      return `${name}: the steel sits at the top and bottom, where bending stress is greatest, so it's far stronger than a plank. Holds ${t}.`;
    case 'truss':
      return `${name}: its sloping struts are squeezed with ${num(c.perLoad, 1)}× the load, and long squeezed struts ${c.mode === 'buckling' ? '<b>buckle</b> (bow sideways) well before the steel itself gives' : 'reach the steel\'s limit'}. Some steel also goes into the bottom tie. Holds ${t}.`;
    case 'arch':
      return `${name}: its ribs are squeezed with ${num(c.perLoad, 1)}× the load. ${c.mode === 'buckling' ? 'The ribs <b>buckle</b> first. Longer ribs buckle sooner (strength drops with length²), so taller isn\'t always better.' : 'Steep, stubby ribs reach the steel\'s limit.'} Holds ${t}.`;
    case 'suspension':
      return `${name}: the cable is <b>pulled</b> with ${num(c.perLoad, 1)}× the load. Steel is strongest in tension and a cable can't buckle, so all the steel works. Holds ${t}.`;
    default:
      return name;
  }
}

export function grade(s, answer) {
  const { pick, conf } = answer;
  const best = s.bridges.reduce((bi, b, i, arr) => (b.tonnes > arr[bi].tonnes ? i : bi), 0);
  const correct = pick === best;
  const score = confidenceScore(correct, conf);
  const ranked = s.bridges.slice().sort((a, b) => b.tonnes - a.tonnes);
  const ratio = ranked[0].tonnes / ranked[1].tonnes;

  const biasTags = [];
  if (!correct && conf >= 0.75) biasTags.push('overconfidence');
  if (correct && conf <= 0.25) biasTags.push('underconfidence');

  const steps = [
    `Model: each bridge carries one load at the middle of its span${s.variedSteel ? '' : ', and all use the same amount of steel'}. ${s.variedSpan ? 'Longer spans are weaker, since beams lose strength in proportion to span.' : 'Same span for all, so only shape matters.'}`,
    ...ranked.map(why),
    `${ranked[0].letter} wins by ${num(ratio, 2)}× over ${ranked[1].letter}.`,
    `You picked ${s.bridges[pick].letter} and said <b>${pct(conf, 0)}</b> sure. ${correct ? 'Right' : 'Wrong'}, so you score ${Math.round(score * 100)} / 100. ` +
      'The scoring is set up so the best long-run strategy is to say exactly how sure you are. Bluffing confidence costs points.',
  ];

  const winner = ranked[0].design;
  const takeaway = {
    suspension: 'Steel is strongest when pulled and never buckles in tension. That\'s why the longest bridges hang from cables.',
    arch: 'Turning bending into squeezing makes an arch strong, as long as its ribs are stubby enough not to buckle.',
    truss: 'Depth beats bulk. A truss gets its strength from height, but long squeezed members are its weak point.',
    ibeam: 'Depth matters most: put the material far from the middle, where bending stress is greatest.',
    plankEdge: 'Same plank, turned on edge: strength grows with depth², so a small rotation is a big win.',
  }[winner] ?? 'Shape beats amount of material.';

  return {
    correct,
    score,
    biasTags,
    headline: correct ? (conf >= 0.75 ? 'Right, and you knew it.' : 'Right. Trust yourself more next time.') : (conf >= 0.75 ? 'Wrong, and too sure.' : 'Wrong, but at least you hedged.'),
    sub: `${ranked[0].letter} · ${DESIGNS[winner].name} holds ${num(ranked[0].tonnes, 1)} t. Your ${pct(conf, 0)} confidence scored ${Math.round(score * 100)} / 100.`,
    steps,
    takeaway,
    realWorld: s.realWorld,
    conf,
    best,
    pick,
  };
}

export const meta = {
  id: 'bridge',
  name: 'Bridge builder',
  short: 'Bridges',
  primer: [
    'Four bridges made of steel, each with a load in the middle. Tap the one that holds the <b>most weight</b>, then say how sure you are.',
    'Hints: deeper is stronger. Steel is strongest when <b>pulled</b>. Long, thin parts that are <b>squeezed</b> bow sideways (buckle).',
    '<b>Confidence counts.</b> Saying 95% and being wrong costs a lot. Saying 25% when you\'re right leaves points behind. Be honest and you\'ll score best over time.',
  ],
};

export { CONFIDENCE_LEVELS };
