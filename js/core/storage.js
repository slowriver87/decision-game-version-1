// Saved progress: a single JSON blob in localStorage, plus export/import.

export const STORAGE_KEY = 'decision-making.v1';
export const MAX_SESSIONS = 500;

export const defaultState = () => ({
  v: 1,
  theme: 'dark',
  skills: {},          // { [type]: { rating } }
  sessions: [],        // [{ ts, day, rounds: [{ type, level, score, correct, biasTags, evLost }] }]
  streak: { current: 0, best: 0, last: null },
  seenPrimers: {},     // { [type]: true }
});

/** Accept anything; return a clean, valid state (or throw on hopeless input). */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Backup is not a JSON object.');
  if (raw.v !== 1) throw new Error('This backup is from an unknown version of the app.');
  const base = defaultState();
  const sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
  const cleanRound = r => ({
    type: String(r.type),
    level: Number(r.level) || 1,
    score: Math.max(0, Math.min(1, Number(r.score) || 0)),
    correct: !!r.correct,
    biasTags: Array.isArray(r.biasTags) ? r.biasTags.map(String) : [],
    evLost: Number(r.evLost) || 0,
  });
  return {
    ...base,
    theme: raw.theme === 'light' ? 'light' : 'dark',
    skills: Object.fromEntries(Object.entries(raw.skills || {})
      .map(([k, s]) => [k, { rating: Math.max(1, Math.min(5.99, Number(s?.rating) || 1)) }])),
    sessions: sessions
      .filter(s => s && Array.isArray(s.rounds) && typeof s.day === 'string')
      .map(s => ({ ts: Number(s.ts) || 0, day: s.day, rounds: s.rounds.map(cleanRound) }))
      .slice(-MAX_SESSIONS),
    streak: {
      current: Number(raw.streak?.current) || 0,
      best: Number(raw.streak?.best) || 0,
      last: typeof raw.streak?.last === 'string' ? raw.streak.last : null,
    },
    seenPrimers: { ...(raw.seenPrimers || {}) },
  };
}

export function load(storage = globalThis.localStorage) {
  try {
    const txt = storage?.getItem(STORAGE_KEY);
    return txt ? normalize(JSON.parse(txt)) : defaultState();
  } catch {
    return defaultState();
  }
}

export function save(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export const exportJson = state => JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
export const importJson = text => normalize(JSON.parse(text));
