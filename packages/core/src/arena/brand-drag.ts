// Brand Drag arms (D1 6.13, a reading only): three off-by-default variants that give Brand Wrath rank 5 more casts per fight.
// The arms live in the PC overlay (school-balance.pc.json `brandDrag.arms`); none is on until a census (or a test) selects one in
// `brandDragArm`. Leaf module: schools.ts (the row an actor plays) and archetypes.ts (the heavy plan's mana reserve) read it.
import balance from './data/school-balance.pc.json' with { type: 'json' };

/** One arm: the row columns it changes on a rank-5 Brand Wrath, and/or how many tiers ahead the heavy plan keeps payoff mana. */
export interface BrandDragArm { tier?: number; cooldownS?: number; mana?: number; reserveTiers?: number }
const armKeys = ['tier', 'cooldownS', 'mana', 'reserveTiers'] as const;
/** The spell whose rank-5 form the arms re-time. */
export const brandDragSpell = 'fire_wrath';

/** Problems with the overlay's `brandDrag` section (absent is fine): `arms` maps a name to numeric keys from `armKeys`. */
export function brandDragProblems(candidate: unknown): string[] {
  if (candidate === undefined) return [];
  const at = 'school-balance.pc.json brandDrag';
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [`${at}: not an object`];
  const arms = (candidate as { arms?: unknown }).arms;
  if (!arms || typeof arms !== 'object' || Array.isArray(arms)) return [`${at}.arms: not an object`];
  return Object.entries(arms).flatMap(([name, arm]) => {
    if (!arm || typeof arm !== 'object' || Array.isArray(arm)) return [`${at}.arms.${name}: not an object`];
    const entries = Object.entries(arm);
    return [...(entries.length ? [] : [`${at}.arms.${name}: empty`]),
      ...entries.flatMap(([k, v]) => (armKeys as readonly string[]).includes(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0 ? [] : [`${at}.arms.${name}: unknown or invalid key ${k}`])];
  });
}
const loaded = (balance as { brandDrag?: { arms?: Record<string, BrandDragArm> } }).brandDrag;
const errors = brandDragProblems(loaded);
if (errors.length) throw Error(errors.join(' '));
export const brandDragArms: Readonly<Record<string, BrandDragArm>> = loaded?.arms ?? {};
/** The selected arm's name; undefined = off (the default, so every digest and golden is untouched). One shared object like `exchangeRule`. */
export const brandDragArm: { name?: string } = {};
/** The selected arm, or undefined when off. */
export const activeBrandDrag = (): BrandDragArm | undefined => brandDragArm.name === undefined ? undefined : brandDragArms[brandDragArm.name];
/** Run `body` with an arm selected (the census's arm switch); an unknown name throws. */
export function withBrandDrag<T>(name: string | undefined, body: () => T): T {
  if (name !== undefined && !brandDragArms[name]) throw Error(`Unknown Brand Drag arm ${name}`);
  const saved = brandDragArm.name; brandDragArm.name = name;
  try { return body(); } finally { brandDragArm.name = saved; }
}
