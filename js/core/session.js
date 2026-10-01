// Decide which scenario types go into an 8-round session.

export const ROUNDS = 8;

/**
 * types: available type ids.
 * weakness: { [type]: 0..1 }, higher = needs more practice (e.g. 1 - recent accuracy).
 * limits: { [type]: max per session } for long mini-games.
 */
export function planSession(rng, types, weakness = {}, limits = {}) {
  const counts = Object.fromEntries(types.map(t => [t, 0]));
  const room = t => counts[t] < (limits[t] ?? ROUNDS);
  // Everyone gets a fair base share...
  const base = Math.max(1, Math.floor(ROUNDS / types.length));
  let total = 0;
  for (const t of rng.shuffle(types)) {
    while (counts[t] < base && room(t) && total < ROUNDS) { counts[t]++; total++; }
  }
  // ...then extra rounds lean toward weaker types.
  while (total < ROUNDS) {
    const open = types.filter(room);
    if (!open.length) break;
    const weights = open.map(t => 0.3 + (weakness[t] ?? 0.5));
    let x = rng.next() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (x > weights[i]) x -= weights[i++];
    counts[open[Math.min(i, open.length - 1)]]++;
    total++;
  }
  return order(rng, counts);
}

/** Can these counts be laid out with no two neighbours equal, not starting with `prev`? */
function arrangeable(left, prev) {
  const total = Object.values(left).reduce((a, b) => a + b, 0);
  return Object.entries(left).every(([t, k]) => k <= (t === prev ? Math.floor(total / 2) : Math.ceil(total / 2)));
}

/** Random order where the same type never appears twice in a row (when that's possible at all). */
function order(rng, counts) {
  const left = { ...counts };
  const out = [];
  const n = Object.values(left).reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    const prev = out[out.length - 1];
    const avail = Object.keys(left).filter(t => left[t] > 0);
    const safe = avail.filter(t => {
      if (t === prev) return false;
      left[t]--;
      const ok = arrangeable(left, t);
      left[t]++;
      return ok;
    });
    const pick = rng.pick(safe.length ? safe : avail.filter(t => t !== prev).length ? avail.filter(t => t !== prev) : avail);
    out.push(pick);
    left[pick]--;
  }
  return out;
}
