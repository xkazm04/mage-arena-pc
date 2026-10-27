// W8 school seam: the Fire/Air catalogues, the PC balance overlay, authored loadouts, and the kernel's dispatch into
// fire.ts / air.ts. Every hook is a no-op for an actor without `schoolState`, so Water states step and hash as before.
import { schoolIdentity } from './data.generated.ts';
import balance from './data/school-balance.pc.json' with { type: 'json' };
import presetData from './data/school-presets.json' with { type: 'json' };
import { schoolKit, schoolSheet } from './school-kit.ts';
import { maxSpellRank, rankPower, spellRank } from './progression.ts';
import { activeBrandDrag, brandDragSpell } from './brand-drag.ts';
/** The Veering Bolt's curved flight step, used by the kernel's projectile update (Air owns the geometry). */
export { curvedStep } from './air.ts';
import type { Vec } from './math.ts';
import { slotSchools, type Actor, type ArenaState, type Family, type Hit, type InputFrame, type Projectile, type SchoolState, type SlotComposition, type SlotSchool } from './types.ts';

/** One Fire/Air row with its numeric cells read; `shape`, `gain` and `notes` stay prose for the school module to read. */
export interface SchoolSpell {
  id: string; school: SlotSchool; name: string; tier: number; shape: string; castS: number; cooldownS: number; mana: number;
  damage: number; family: Family | 'self'; telegraphS: number; rangeM: number; gain: string; notes: string;
}
const balanceColumns = ['castS', 'cooldownS', 'mana', 'damage', 'telegraphS', 'rangeM'] as const;
function readRow(school: SlotSchool, row: Readonly<Record<string, string>>): SchoolSpell {
  // CR-002: UNBLOCKABLE -> unblockable, absorbable -> magic, n/a (self rows) kept apart; a damage cell starting with a digit is that number.
  const family = row.blockable === 'UNBLOCKABLE' ? 'unblockable' : row.blockable === 'absorbable' ? 'magic' : row.blockable === 'n/a' ? 'self' : undefined;
  if (!family) throw Error(`${row.id}: unknown blockable cell ${row.blockable}`);
  return { id: row.id!, school, name: row.name!, tier: +row.tier!, shape: row.shape!, castS: +row.cast_s!, cooldownS: +row.cooldown_s!, mana: +row.mana!,
    damage: /^\d/.test(row.damage!) ? parseFloat(row.damage!) : 0, family, telegraphS: +row.telegraph_s!, rangeM: +row.range_m!,
    gain: row[gainColumn(school, row)]!, notes: row.notes! };
}
/** The school's resource gain column (heat_gain, momentum_gain): the one `*_gain` column of its sheet. */
function gainColumn(school: SlotSchool, row: Readonly<Record<string, string>>): string {
  const columns = Object.keys(row).filter(k => k.endsWith('_gain'));
  if (columns.length !== 1) throw Error(`${row.id}: ${school} sheet needs one *_gain column, has ${columns.join(', ') || 'none'}`);
  return columns[0]!;
}
/** VR's numbers, unmodified. */
export const canonicalSpells = Object.fromEntries(slotSchools.map(school => [school, schoolSheet(school).map(row => readRow(school, row))])) as Record<SlotSchool, SchoolSpell[]>;
export function schoolSpellById(id: string): SchoolSpell | undefined {
  for (const school of slotSchools) { const spell = canonicalSpells[school].find(s => s.id === id); if (spell) return spell; }
  return undefined;
}

type Identity = (typeof schoolIdentity)[SlotSchool];
/** Problems with an overlay: every key must name a real spell column or a numeric identity path, with a finite number. */
export function overlayProblems(candidate: Record<string, unknown>): string[] {
  return Object.entries(candidate).flatMap(([key, value]) => {
    const [head, column, ...rest] = key.split('.');
    const known = (slotSchools as readonly string[]).includes(head!) && column === 'identity' && rest.length > 0
      ? typeof readPath(schoolIdentity[head as SlotSchool], rest) === 'number'
      : schoolSpellById(head!) !== undefined && (balanceColumns as readonly string[]).includes(column!) && rest.length === 0;
    return known && typeof value === 'number' && Number.isFinite(value) ? [] : [`school-balance.pc.json: unknown or non-numeric key ${key}`];
  });
}
const overrides: Record<string, number> = balance.overrides;
const overlayErrors = overlayProblems(overrides);
if (overlayErrors.length) throw Error(overlayErrors.join(' '));
function readPath(source: unknown, path: string[]): unknown {
  return path.reduce<unknown>((at, key) => (at && typeof at === 'object' ? (at as Record<string, unknown>)[key] : undefined), source);
}
const usesOverlay = (state?: ArenaState): boolean => state?.balance !== 'canonical';
/** A row as this state plays it: the PC overlay unless the state runs canonical (parity). */
export function balancedSpell(spell: SchoolSpell, state?: ArenaState): SchoolSpell {
  if (!usesOverlay(state)) return spell;
  let out = spell;
  for (const column of balanceColumns) {
    const value = overrides[`${spell.id}.${column}`];
    if (value !== undefined) out = { ...out, [column]: value };
  }
  return out;
}
/** A row as this actor plays it at release: the balanced row with its spell rank's power on damage (progression.ts;
 * ranks 1-4 power, rank 5 = rank 4 power). Cost, cast time and cooldown stay the balanced row's. Identity at rank 1 and
 * under canonical balance. The one place a Fire/Air rank multiplies a number. */
export function rankedSpell(spell: SchoolSpell, a: Actor, state?: ArenaState): SchoolSpell {
  const out = balancedSpell(spell, state), power = rankPower(spellRank(a, spell.id, state));
  return power === 1 ? out : { ...out, damage: out.damage * power };
}
/** A numeric identity value (dotted path under schools-combat.json `<school>`), overlay applied unless canonical. */
export function identityNumber(school: SlotSchool, path: string, state?: ArenaState): number {
  const override = usesOverlay(state) ? overrides[`${school}.identity.${path}`] : undefined;
  const value = override ?? readPath(schoolIdentity[school] as Identity, path.split('.'));
  if (typeof value !== 'number') throw Error(`schools-combat.json ${school}.${path} is not a number`);
  return value;
}

export function validateLoadout(c: SlotComposition): string[] {
  const errors: string[] = [], own = canonicalSpells[c.school];
  if (c.bolt !== `${c.school}_bolt`) errors.push(`The bolt slot holds ${c.school}_bolt.`);
  if (c.slots.length !== 4 || new Set(c.slots).size !== 4) errors.push('Choose four distinct spells.');
  for (const id of c.slots) if (!own.some(s => s.id === id && s.tier > 0)) errors.push(`${id} is not a ${c.school} slot spell.`);
  return errors;
}
export const schoolPresets: Record<SlotSchool, SlotComposition[]> = Object.fromEntries(slotSchools.map(school => [school, presetData[school].map(p => {
  const c: SlotComposition = { school, name: p.name, bolt: `${school}_bolt`, slots: [p.slots[0]!, p.slots[1]!, p.slots[2]!, p.slots[3]!] };
  const problems = validateLoadout(c);
  if (problems.length) throw Error(`Authored ${school} preset ${p.name}: ${problems.join(' ')}`);
  return c;
})])) as Record<SlotSchool, SlotComposition[]>;
export function newSchoolState(loadout: SlotComposition): SchoolState {
  const errors = validateLoadout(loadout); if (errors.length) throw Error(errors.join(' '));
  return { school: loadout.school, loadout: structuredClone(loadout), value: 0, lastGainTick: 0, lockedUntil: 0, gained: false, cooldowns: {}, formUntil: 0 };
}
/** The spell on a slot this tick: slot 0 is the bolt; a slot whose tier the collar has not unlocked is dark (undefined). */
export function slotSpell(actor: Actor, slot: number, state?: ArenaState): SchoolSpell | undefined {
  const s = actor.schoolState; if (!s) return undefined;
  const spell = s.catalogue ? canonicalSpells[s.school][slot] : schoolSpellById((slot === 0 ? s.loadout.bolt : s.loadout.slots[slot - 1]) ?? '');
  if (!spell) return undefined;
  const arm = spell.id === brandDragSpell && spellRank(actor, spell.id, state) >= maxSpellRank ? activeBrandDrag() : undefined;
  const row = arm ? { ...spell, ...(arm.tier !== undefined ? { tier: arm.tier } : {}) } : spell;
  if (row.tier > (row.tier === 0 ? 0 : actor.tier)) return undefined;
  const out = balancedSpell(row, state);
  return arm ? { ...out, ...(arm.cooldownS !== undefined ? { cooldownS: arm.cooldownS } : {}), ...(arm.mana !== undefined ? { mana: arm.mana } : {}) } : out;
}

/** What a school module answers for the kernel. Defaults are the Water behaviour (no change). */
export interface SchoolRules {
  /** Start of the actor's step, before its release (CR-002 resource tick): gains, decay, locks. */
  tick(state: ArenaState, a: Actor): void;
  /** Press on a slot; true when a cast started (mana spent, pending set). */
  tryCast(state: ArenaState, a: Actor, input: InputFrame): boolean;
  /** A named rival's granted signature (VR CR-005): start `spellId` unpaid, skipping the tier gate and the cooldown;
   * false when the hands are busy or the spell is not this school's. */
  grantedCast?(state: ArenaState, a: Actor, spellId: string, aim: Vec): boolean;
  release(state: ArenaState, a: Actor): void;
  drainMult(state: ArenaState, a: Actor): number;
  staminaRegenMult(state: ArenaState, a: Actor): number;
  rollStaminaMult(state: ArenaState, a: Actor): number;
  /** Before damage: true when the hit is evaded (Air Form). */
  evades(state: ArenaState, target: Actor, hit: Hit): boolean;
  /** After a contact resolved, for the target's and the owner's resource. */
  /** `role` says whose resource this call is for: the struck target's or the hit owner's (called once per role). */
  onHit(state: ArenaState, target: Actor, owner: Actor | undefined, hit: Hit, result: { damage: number; perfect: boolean; reduction: number }, role: 'target' | 'owner'): void;
  /** A perfect absorb of a projectile; true when the school handled it (Air deflect replaces the Water reflection). */
  deflects(state: ArenaState, target: Actor, p: Projectile): boolean;
  afterMove(state: ArenaState, a: Actor): void;
  reset(a: Actor): void;
  /** The kernel interrupted this actor; stop channels. True when something was cancelled (counts as a cast for the event). */
  interrupted?(state: ArenaState, a: Actor): boolean;
  /** Hands busy (a beam or a volley runs): no staff strike and no new cast. */
  busy?(state: ArenaState, a: Actor): boolean;
  /** Rooted by a school cast this tick (beside `schoolState.rootUntil`). */
  rooted?(state: ArenaState, a: Actor): boolean;
}
const of = (a: Actor | undefined): SchoolRules | undefined => a?.schoolState ? schoolKit(a.schoolState.school).rules : undefined;

export const schoolTick = (state: ArenaState, a: Actor): void => of(a)?.tick(state, a);
export const hasSchoolLoadout = (a: Actor): boolean => a.schoolState !== undefined;
export const trySchoolCast = (state: ArenaState, a: Actor, input: InputFrame): boolean => of(a)?.tryCast(state, a, input) ?? false;
export const startGrantedSchoolCast = (state: ArenaState, a: Actor, spellId: string, aim: Vec): boolean => of(a)?.grantedCast?.(state, a, spellId, aim) ?? false;
export const releaseSchoolSpell = (state: ArenaState, a: Actor): void => of(a)?.release(state, a);
export const schoolDrainMult = (state: ArenaState, a: Actor): number => of(a)?.drainMult(state, a) ?? 1;
export const schoolStaminaRegenMult = (state: ArenaState, a: Actor): number => of(a)?.staminaRegenMult(state, a) ?? 1;
export const schoolRollStaminaMult = (state: ArenaState, a: Actor): number => of(a)?.rollStaminaMult(state, a) ?? 1;
export const schoolEvades = (state: ArenaState, target: Actor, hit: Hit): boolean => of(target)?.evades(state, target, hit) ?? false;
export function schoolOnHit(state: ArenaState, target: Actor, owner: Actor | undefined, hit: Hit, result: { damage: number; perfect: boolean; reduction: number }): void {
  of(target)?.onHit(state, target, owner, hit, result, 'target');
  if (owner && owner !== target) of(owner)?.onHit(state, target, owner, hit, result, 'owner');
}
export const schoolDeflects = (state: ArenaState, target: Actor, p: Projectile): boolean => of(target)?.deflects(state, target, p) ?? false;
export const schoolAfterMove = (state: ArenaState, a: Actor): void => of(a)?.afterMove(state, a);
export const resetSchool = (a: Actor): void => of(a)?.reset(a);
export const schoolInterrupted = (state: ArenaState, a: Actor): boolean => of(a)?.interrupted?.(state, a) ?? false;
export const schoolBusy = (state: ArenaState, a: Actor): boolean => of(a)?.busy?.(state, a) ?? false;
export const schoolRooted = (state: ArenaState, a: Actor): boolean => (a.schoolState?.rootUntil !== undefined && state.tick < a.schoolState.rootUntil) || (of(a)?.rooted?.(state, a) ?? false);
