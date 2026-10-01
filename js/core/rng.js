// Seeded random numbers, so any scenario can be regenerated from its seed
// (and tests are deterministic).

export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  // mulberry32
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    /** Integer in [min, max], inclusive. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** Value in [min, max] on a grid of `step`. */
    step: (min, max, step) => min + step * Math.floor(next() * (Math.round((max - min) / step) + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    shuffle: arr => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
  return rng;
}

export const newSeed = () => (Math.random() * 2 ** 32) >>> 0;
