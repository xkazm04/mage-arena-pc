// The Gale mage's choices (mage-arena-vr docs/schools/AIR.md, ChooseAirSpell): Tempest when legal, Air Form against
// aimed blockable threats, Slipstream under 40 Momentum. W8 lane A owns this file. WP0 stub: never casts, no threats.
import { bolt } from './kernel.ts';
import type { SchoolBrain } from './mage-ai-schools.ts';

export const airBrain: SchoolBrain = {
  boltSpeedMps: () => bolt.speedMps,
  choose: () => undefined,
  threats: () => [],
};
