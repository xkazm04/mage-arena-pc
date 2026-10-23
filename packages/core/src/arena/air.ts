// Air: Momentum and the ten Air rows, as mage-arena-vr docs/schools/AIR.md reads them (T23; accepted 2026-10-23 as CR-007).
// W8 lane A owns this file. WP0 stub: the Water-default answers, so an Air actor casts nothing yet.
import type { SchoolRules } from './schools.ts';

export const airRules: SchoolRules = {
  tick: () => {},
  tryCast: () => false,
  release: () => {},
  drainMult: () => 1,
  staminaRegenMult: () => 1,
  rollStaminaMult: () => 1,
  evades: () => false,
  onHit: () => {},
  deflects: () => false,
  afterMove: () => {},
  reset: () => {},
};
