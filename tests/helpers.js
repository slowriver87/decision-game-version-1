export const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
// Something like 35.00000000000001 or 0.30000000000000004 leaking into display text.
export const FLOAT_JUNK = /\d\.\d*(0{5,}|9{5,})\d/;
export const BAD_TOKEN = /undefined|NaN|Infinity|\[object/;
