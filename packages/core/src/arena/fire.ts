// Fire: Heat and the ten Fire rows, to VR CR-002 to the letter (mage-arena-vr docs/change-requests/CR-002-fire-school.md).
// W8 lane F owns this file. WP0 stub: the Water-default answers, so a Fire actor casts nothing yet.
import type { SchoolRules } from './schools.ts';

export const fireRules: SchoolRules = {
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
