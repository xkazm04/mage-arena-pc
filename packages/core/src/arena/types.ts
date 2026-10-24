import type { CombatTuning, School } from './tuning.ts';
import type { Spell } from './catalog.ts';
import type { Vec } from './math.ts';
export type Family = 'magic' | 'physical' | 'unblockable';
/** The one spelling of the difficulty ids (feel.json pace.enemy keys); the save schema and settings derive from it. */
export const difficulties = ['easy', 'normal', 'hard'] as const;
export type Difficulty = typeof difficulties[number];
/** Arena stat ranks 1-5. `agility` (PC build depth, progression.ts) is optional: absent = rank 1 = no effect, so a
 * state without it serializes exactly as before. */
export interface Ranks { vigor: number; focus: number; nerve: number; agility?: number }
/** Spell ranks 1-5 keyed by Fire/Air spell id or Water line row `<line>:<tier>` (progression.ts); absent key = rank 1. */
export type SpellRanks = Record<string, number>;
/** The one spelling of the Water line ids: the type, the save schema and the spell-id pattern derive from it. */
export const waterLines = ['tide_orb', 'lash', 'mire', 'mend', 'mirror'] as const;
export type WaterLine = typeof waterLines[number];
export interface Composition { name: string; lines: WaterLine[]; branches: { lash: 'A' | 'B'; mirror: 'A' | 'B'; tide_orb: 'A' | 'B' } }
export interface WaterState { composition: Composition; flow: number; lastLine: string; lastCastTick: number; lastActivityTick: number; cooldowns: Record<string, number>; stored: number;
  rootUntil: number; encasedUntil: number; slowUntil: number; slowMult: number; wardUntil: number; sheenUntil: number; hotUntil: number; hotPerTick: number;
  crests: number; healing: number; controlTicks: number; decoy?: { pos: Vec; until: number } }
/** W8 schools with their own catalogue and resource (VR CR-002 Fire, CR-007 Air); Water keeps `WaterState`. */
export const slotSchools = ['fire', 'air'] as const;
export type SlotSchool = typeof slotSchools[number];
/** Bolt fixed, four free slots, no branches (the authored Fire sheet). Ids are the school CSV `id` column verbatim. */
export interface SlotComposition { school: SlotSchool; name: string; bolt: string; slots: [string, string, string, string] }
/** Heat (Fire) or Momentum (Air), 0..100. Present only on a Fire or Air actor, so Water actors serialize exactly as before. */
export interface SchoolState {
  school: SlotSchool; loadout: SlotComposition; value: number;
  /** Tick of the last gain (Heat's decay idle) and the tick a lock (Furnace Heart, Eye of the Storm) ends; 0 = none. */
  lastGainTick: number; lockedUntil: number; gained: boolean;
  cooldowns: Record<string, number>;
  /** Air Form's evasion window end; 0 = none. */
  formUntil: number;
  /** An AI rival that chooses from the whole catalogue: slot n is row n (VR CR-002 slots 0-9), ignoring the loadout. */
  catalogue?: true;
  /** Fire: the first Sunfall has released (ends the CR-002 bank rule). */
  sunfallLoosed?: true;
  /** A school root (Kindle, Sunfall, Tempest windups) ends at this tick; absent = none. */
  rootUntil?: number;
}
/** A spell-owned effect that lives across ticks (beam, trail, delayed detonation, volley). Owned and stepped by arena/shapes.ts. */
export interface SchoolEffect { id: number; ownerId: number; activationId: number; spellId: string; kind: 'beam' | 'trail' | 'detonation' | 'volley';
  startTick: number; nextTick: number; endTick: number; origin: Vec; target: Vec; damage: number; family: Family; tier: number;
  hitLog: { tick: number; targetId: number }[]; survivesOwner?: boolean; remaining?: number;
  /** The contact template each tick copies (base damage before live multipliers), and the shape's geometry and cadence. */
  hit?: Hit; everyTicks?: number; lengthM?: number; radiusM?: number; perfectFirstTickOnly?: boolean; ticksDone?: number }
export interface InputFrame { move: Vec; aim: Vec; slot: number; cast: boolean; absorb: boolean; roll: boolean; sprint: boolean }
export interface Hit { ownerId: number; activationId: number; damage: number; family: Family; tier: number; source: Vec; bolt?: boolean; reaction?: boolean; delivery?: 'projectile' | 'area' | 'melee';
  /** W8 school hits only (absent on Water hits): Heat paid to a Fire owner when the blow connects; skips a front shield block (Brand Lance); refuses the fresh-raise perfect (Brand Wrath after its first tick). */
  heat?: number; pierceShields?: boolean; suppressPerfect?: boolean;
  /** Momentum paid to an Air owner when the blow connects (W8; absent on Water hits). */
  momentumOnHit?: number;
  /** PC rank-5 ultimate whose on-hit effect this blow carries (progression.ts; the spell id). Present only on a rank-5 cast. */
  ultimate?: string }
export interface EnemyBrain { id: string; readyTick: number; backoffUntil: number; stunnedUntil: number; attackIndex: number; deathQueued: boolean; recoveryUntil?: number }
/** A rival plan (mage-ai rival-plan.ts); present only when plans are enabled, so disabled runs serialize exactly as before. */
export interface RivalPlan { preset: string; phase: 'hold' | 'approach' | 'withdraw'; until: number; rearmTick: number; seenRelease: number; prevRelease: number; flight: number; counterUntil: number; armed: boolean; counterTick: number; wardFrom: number }
export interface MageBrain { aggression?: number; rival?: RivalPlan; plan?: { threatId: number; perfect: boolean }; competence: number; nextDecisionTick: number; input: InputFrame; observed: { id: number; firstSeenTick: number; reacted: boolean; denied?: boolean }[]; defendUntil: number; plannedRaiseTick: number; plannedReleaseTick: number; targetPoint: Vec; decisionTicks: number[]; reactionAges: number[] }
export interface PendingCast { spell?: Spell; kind: 'bolt' | 'staff' | 'spell'; releaseTick: number; startTick: number; aim: Vec; activationId: number; spellId?: string; damageMult?: number; targetId?: number }
export interface Actor {
  school?: School; velocity?: Vec; staggerUntil?: number; staggerImmuneUntil?: number; rollRecoveryUntil?: number;
  id: number; team: number; label: string; pos: Vec; previousPos: Vec; facing: Vec; radius: number;
  ranks: Ranks; hp: number; maxHp: number; mana: number; maxMana: number; stamina: number; maxStamina: number;
  tags: ('DEFEATED' | 'STAGGERED')[]; poise: number; defeatedTick?: number; defeatDirection?: Vec; dummy: boolean; absorb: boolean; absorbFreshTick: number; releaseTick: number; absorbExhausted: boolean;
  water: WaterState;
  /** Fire/Air resource and loadout (arena/schools.ts). Absent for Water and non-mages: never null or zeroed. */
  schoolState?: SchoolState;
  /** Spell ranks (progression.ts); present only when set, so unranked actors serialize exactly as before. */
  spellRanks?: SpellRanks;
  /** PC exchange window (exchange.ts, D1 4.1 A): opened by a clean close hit from `fromId`; absent until the first one. */
  exchange?: { fromId: number; guardUntil: number; guardsLeft: number };
  enemy?: EnemyBrain; mageAI?: MageBrain; speedMps?: number;
  /** Time scale of this actor's own actions (tuning.ts pace), fixed at spawn; absent is the authored 1x. */
  pace?: number;
  lastInput: InputFrame; rollUntil: number; immuneUntil: number; recoveryUntil: number; rollDirection: Vec;
  staminaUsedTick: number; cooldownUntil: number; pending?: PendingCast;
  waveStartTick: number; tier: number; lastUnlockTick: number; clockAdvanceTicks: number; unlockTicks: number[];
  metrics: { manaCast?: number; perfects: number; blocks: number; hits: number; damageDealt: number; damageTaken: number; manaDrained: number; manaRaised: number; manaReturned: number; casts: number; rolls: number };
}
export interface Projectile extends Hit { id: number; pos: Vec; previousPos: Vec; velocity: Vec; radius: number; remainingM: number; hitIds: number[]; burstRadiusM?: number; piercing?: boolean; reflected?: boolean;
  /** Air (W8, absent otherwise): extra bodies this projectile may still pass (CR-007 spellsPierce), and a Veering Bolt's fixed-curvature flight. */
  pierceLeft?: number; arc?: { centre: Vec; radiusM: number; angle: number; sign: number; leftM: number } }
export interface Zone { id: number; ownerId: number; pos: Vec; radiusM: number; until: number; kind: 'slow' | 'fog'; slowMult: number }
export interface Telegraph extends Hit { id: number; kind: 'projectile' | 'lane' | 'melee' | 'area' | 'charge'; origin: Vec; target: Vec; resolveTick: number; startTick: number; speedMps: number; rangeM: number; widthM: number; rootS?: number; pullM?: number; survivesOwner?: boolean; wallStunS?: number;
  /** Committed body attack: after resolveTick the owner travels travelM over travelTicks along origin->target (a lunge carries a reachM weapon sector).
   * `contacted` exists only during travel and lists every target already met by this activation. */
  travelM?: number; travelTicks?: number; reachM?: number; contacted?: number[] }
export interface ArenaEvent { direction?: Vec; spellId?: string; at?: Vec; family?: Family; contactDamage?: number; guarded?: boolean; activationId?: number; tick: number; kind: 'perfect' | 'hit' | 'cast' | 'release' | 'down' | 'unlock' | 'interrupt' | 'roll' | 'stagger' | 'phase'; actorId: number; targetId?: number; value: number }
export interface RandomDraw { tick: number; purpose: string; value: number }
export interface ArenaState {
  tuning?: CombatTuning; lab?: { damageEnabled: boolean };
  /** Fixed for the life of the state; absent (raw kernel tests, art fixtures) spawns every actor at the authored 1x. */
  difficulty?: Difficulty;
  tick: number; seed: number; rng: number; nextId: number; actors: Actor[]; projectiles: Projectile[];
  telegraphs: Telegraph[]; zones: Zone[]; events: ArenaEvent[]; randomLog: RandomDraw[];
  /** Created on the first Fire/Air effect; absent otherwise, so Water states hash as before. */
  schoolEffects?: SchoolEffect[];
  /** 'canonical' runs VR's numbers (parity suites); absent applies the PC balance overlay (school-balance.pc.json). */
  balance?: 'canonical';
}
export const idleInput = (aim: Vec = { x: 32, y: 10 }): InputFrame => ({ move: { x: 0, y: 0 }, aim, slot: 0, cast: false, absorb: false, roll: false, sprint: false });

export const isDefeated = (a: Actor): boolean => a.tags.includes("DEFEATED");
export const activationBlockedTags = ["DEFEATED", "STAGGERED"] as const;
export const activationBlocked = (a: Actor): boolean => activationBlockedTags.some(tag => a.tags.includes(tag));
