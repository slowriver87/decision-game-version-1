// Per-type skill rating. It climbs slowly with good answers and slips with bad ones.
// Level = floor(rating), 1..5. Four strong answers in a row is about one level.

export const MIN_RATING = 1;
export const MAX_RATING = 5.99;

export function updateRating(rating, score) {
  let delta;
  if (score >= 0.8) delta = 0.25;
  else if (score >= 0.5) delta = 0.08;
  else delta = -0.2;
  return Math.min(MAX_RATING, Math.max(MIN_RATING, +(rating + delta).toFixed(3)));
}

export const levelOf = rating => Math.max(1, Math.min(5, Math.floor(rating)));
