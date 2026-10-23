// The Ember mage's choices (VR CR-002 "Fire mage"): T07 competence model, 18 m/s aim lead, the Sunfall bank rule.
// W8 lane F owns this file. WP0 stub: never casts, presents no threats.
import { bolt } from './kernel.ts';
import type { SchoolBrain } from './mage-ai-schools.ts';

export const fireBrain: SchoolBrain = {
  boltSpeedMps: () => bolt.speedMps,
  choose: () => undefined,
  threats: () => [],
};
