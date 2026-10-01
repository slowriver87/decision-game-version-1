// Number formatting that never leaks float junk like 0.30000000000000004.

const round = (x, d) => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

/** $1,234 or -$1,234.50 (cents only when needed and asked for). */
export function money(x, { cents = false, sign = false } = {}) {
  const v = cents ? round(x, 2) : Math.round(x);
  const abs = Math.abs(v);
  const s = abs.toLocaleString('en-US', {
    minimumFractionDigits: cents && abs % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  if (v < 0) return `−$${s}`;
  return `${sign && v > 0 ? '+' : ''}$${s}`;
}

/** Probability 0..1 as a percent string, e.g. 0.1234 -> "12.3%". */
export function pct(p, digits = 1) {
  if (!Number.isFinite(p)) return '—';
  let v = round(p * 100, digits);
  if (v === 0 && p > 0) return `<${(10 ** -digits).toFixed(digits)}%`;
  // Drop trailing ".0"
  const s = v.toFixed(digits).replace(/\.0+$/, '');
  return `${s}%`;
}

/** Plain integer with thousands separators. */
export const int = x => Math.round(x).toLocaleString('en-US');

/** Decimal with up to `d` places and no trailing zeros. */
export function num(x, d = 2) {
  return round(x, d).toLocaleString('en-US', { maximumFractionDigits: d });
}

/** "1 in 250" style for small probabilities. */
export function oneIn(p) {
  const n = Math.round(1 / p);
  return `1 in ${int(n)}`;
}
