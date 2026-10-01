// Idealised bridge physics: one steel budget, one load at mid-span, rigid supports,
// self-weight ignored. Simple, but every number is real statics.

export const STEEL = { yield: 250e6, E: 200e9, density: 7850 }; // Pa, Pa, kg/m³
const G = 9.81;

/* ---------------- Cross-sections ---------------- */

/** Section modulus of a solid rectangle, width b (sideways) × depth h (vertical). */
export const rectModulus = (b, h) => (b * h * h) / 6;

/** Second moment of area and section modulus of a symmetric I-beam. */
export function iBeam({ depth: H, flange: w, t }) {
  const I = (w * H ** 3 - (w - t) * (H - 2 * t) ** 3) / 12;
  return { I, S: I / (H / 2), area: 2 * w * t + (H - 2 * t) * t };
}

/** I-beam of a given depth and steel area: flanges half as wide as it is deep, equal plate thickness. */
export function iBeamForArea(depth, area) {
  // area = 2·(depth/2)·t + (depth − 2t)·t = 2·depth·t − 2t²  →  solve for t
  const t = (2 * depth - Math.sqrt(4 * depth * depth - 8 * area)) / 4;
  if (!Number.isFinite(t) || t <= 0) throw new Error('area too large for this depth');
  return { depth, flange: depth / 2, t };
}

/** Thin-walled steel tube (wall = radius/10) with a given steel area. */
export function tubeForArea(area) {
  const R = Math.sqrt((10 * area) / (2 * Math.PI));
  return { R, I: (Math.PI * R ** 4) / 10 };
}

/** Euler buckling load of a pin-ended strut. */
export const eulerLoad = (I, length, E = STEEL.E) => (Math.PI ** 2 * E * I) / length ** 2;

/** Mid-span point load at which a simply supported beam yields: M = PL/4 = σ·S. */
export const beamCapacity = (S, span, sigma = STEEL.yield) => (4 * sigma * S) / span;

/* ---------------- Member forces for the triangle-shaped bridges ----------------
   A load P at mid-span shared by two straight members, each rising (or sagging)
   `h` over half the span. Each carries (P/2) / sin θ along its length. */

export function legForce(span, h) {
  const len = Math.hypot(span / 2, h);
  return { len, perLoad: len / (2 * h) }; // (1/2)/sin θ = len / (2h)
}

/* ---------------- Designs ---------------- */

export const DESIGNS = {
  plankFlat: { name: 'Plank, laid flat', kind: 'beam' },
  plankEdge: { name: 'Plank, on edge', kind: 'beam' },
  ibeam: { name: 'I-beam', kind: 'beam' },
  truss: { name: 'Truss', kind: 'truss' },
  arch: { name: 'Arch', kind: 'arch' },
  suspension: { name: 'Suspension', kind: 'suspension' },
};

/**
 * Capacity of one bridge in newtons, plus the plain-English reason it fails.
 * bridge: { design, span (m), steel (kg), depth (m, for ibeam/truss/arch/suspension) }
 */
export function capacity(bridge) {
  const { design, span } = bridge;
  const V = bridge.steel / STEEL.density; // m³ of steel
  switch (design) {
    case 'plankFlat':
    case 'plankEdge': {
      const area = V / span;                    // plank 4× as wide as it is thick
      const thin = Math.sqrt(area / 4), wide = 4 * thin;
      const [b, h] = design === 'plankFlat' ? [wide, thin] : [thin, wide];
      return { N: beamCapacity(rectModulus(b, h), span), mode: 'bending', b, h };
    }
    case 'ibeam': {
      const area = V / span;
      const shape = iBeamForArea(bridge.depth, area);
      return { N: beamCapacity(iBeam(shape).S, span), mode: 'bending', shape };
    }
    case 'truss': {
      // King-post truss: two sloping struts (squeezed), a bottom tie (pulled), a centre post (pulled, = P).
      const { len, perLoad } = legForce(span, bridge.depth);
      const total = 2 * len + span + bridge.depth;
      const area = V / total;
      const tube = tubeForArea(area);
      const tieForce = span / (4 * bridge.depth);  // (P/2)/tan θ per unit P
      const yieldN = (STEEL.yield * area) / Math.max(perLoad, tieForce, 1);
      const buckleN = eulerLoad(tube.I, len) / perLoad;
      return buckleN < yieldN
        ? { N: buckleN, mode: 'buckling', memberLen: len, perLoad }
        : { N: yieldN, mode: 'yield', memberLen: len, perLoad };
    }
    case 'arch': {
      // Two straight ribs pushing up from the banks to the crown; the ground takes the outward thrust.
      const { len, perLoad } = legForce(span, bridge.depth);
      const area = V / (2 * len);
      const tube = tubeForArea(area);
      const yieldN = (STEEL.yield * area) / perLoad;
      const buckleN = eulerLoad(tube.I, len) / perLoad;
      return buckleN < yieldN
        ? { N: buckleN, mode: 'buckling', memberLen: len, perLoad }
        : { N: yieldN, mode: 'yield', memberLen: len, perLoad };
    }
    case 'suspension': {
      // A cable sagging from two towers to the deck's centre. Cables can't buckle.
      const { len, perLoad } = legForce(span, bridge.depth);
      const area = V / (2 * len);
      return { N: (STEEL.yield * area) / perLoad, mode: 'yield', memberLen: len, perLoad };
    }
    default:
      throw new Error(`unknown design ${design}`);
  }
}

/** Newtons → metric tonnes of load. */
export const toTonnes = N => N / (G * 1000);
