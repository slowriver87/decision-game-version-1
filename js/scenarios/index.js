import * as ev from './ev.js';
import * as bayes from './bayes.js';
import * as poker from './poker.js';

export const TYPES = { ev, bayes, poker };
export const TYPE_IDS = Object.keys(TYPES);
// Long mini-games are capped per session (used by Phase 2 types).
export const LIMITS = {};
