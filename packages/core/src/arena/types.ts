import type { CombatTuning, School } from './tuning.ts';
import type { Spell } from './catalog.ts';
import type { Vec } from './math.ts';
export type Family = 'magic' | 'physical' | 'unblockable';
export interface Ranks { vigor: number; focus: number; nerve: number }
export type WaterLine = 'tide_orb' | 'lash' | 'mire' | 'mend' | 'mirror';
export interface Composition { name: string; lines: WaterLine[]; branches: { lash: 'A' | 'B'; mirror: 'A' | 'B'; tide_orb: 'A' | 'B' } }
export interface WaterState { composition: Composition; flow: number; lastLine: string; lastCastTick: number; lastActivityTick: number; cooldowns: Record<string, number>; stored: number;
  rootUntil: number; encasedUntil: number; slowUntil: number; slowMult: number; wardUntil: number; sheenUntil: number; hotUntil: number; hotPerTick: number;
  crests: number; healing: number; controlTicks: number; decoy?: { pos: Vec; until: number } }
export interface InputFrame { move: Vec; aim: Vec; slot: number; cast: boolean; absorb: boolean; roll: boolean; sprint: boolean }
export interface Hit { ownerId: number; activationId: number; damage: number; family: Family; tier: number; source: Vec; bolt?: boolean; reaction?: boolean; delivery?: 'projectile' | 'area' | 'melee' }
export interface EnemyBrain { id: string; readyTick: number; backoffUntil: number; stunnedUntil: number; attackIndex: number; deathQueued: boolean; recoveryUntil?: number }
export interface MageBrain { aggression?: number; competence: number; nextDecisionTick: number; input: InputFrame; observed: { id: number; firstSeenTick: number; reacted: boolean }[]; defendUntil: number; plannedRaiseTick: number; plannedReleaseTick: number; targetPoint: Vec; decisionTicks: number[]; reactionAges: number[] }
export interface PendingCast { spell?: Spell; kind: 'bolt' | 'staff' | 'spell'; releaseTick: number; startTick: number; aim: Vec; activationId: number; spellId?: string; damageMult?: number; targetId?: number }
export interface Actor {
  school?: School; velocity?: Vec; staggerUntil?: number; staggerImmuneUntil?: number; rollRecoveryUntil?: number;
  id: number; team: number; label: string; pos: Vec; previousPos: Vec; facing: Vec; radius: number;
  ranks: Ranks; hp: number; maxHp: number; mana: number; maxMana: number; stamina: number; maxStamina: number;
  tags: ('DEFEATED' | 'STAGGERED')[]; poise: number; defeatedTick?: number; defeatDirection?: Vec; dummy: boolean; absorb: boolean; absorbFreshTick: number; releaseTick: number; absorbExhausted: boolean;
  water: WaterState;
  enemy?: EnemyBrain; mageAI?: MageBrain; speedMps?: number;
  lastInput: InputFrame; rollUntil: number; immuneUntil: number; recoveryUntil: number; rollDirection: Vec;
  staminaUsedTick: number; cooldownUntil: number; pending?: PendingCast;
  waveStartTick: number; tier: number; lastUnlockTick: number; clockAdvanceTicks: number; unlockTicks: number[];
  metrics: { manaCast?: number; perfects: number; blocks: number; hits: number; damageDealt: number; damageTaken: number; manaDrained: number; manaRaised: number; manaReturned: number; casts: number; rolls: number };
}
export interface Projectile extends Hit { id: number; pos: Vec; previousPos: Vec; velocity: Vec; radius: number; remainingM: number; hitIds: number[]; burstRadiusM?: number; piercing?: boolean; reflected?: boolean }
export interface Zone { id: number; ownerId: number; pos: Vec; radiusM: number; until: number; kind: 'slow' | 'fog'; slowMult: number }
export interface Telegraph extends Hit { id: number; kind: 'projectile' | 'lane' | 'melee' | 'area' | 'charge'; origin: Vec; target: Vec; resolveTick: number; startTick: number; speedMps: number; rangeM: number; widthM: number; rootS?: number; pullM?: number; survivesOwner?: boolean; wallStunS?: number }
export interface ArenaEvent { direction?: Vec; spellId?: string; at?: Vec; family?: Family; contactDamage?: number; guarded?: boolean; activationId?: number; tick: number; kind: 'perfect' | 'hit' | 'cast' | 'release' | 'down' | 'unlock' | 'interrupt' | 'roll' | 'stagger'; actorId: number; targetId?: number; value: number }
export interface RandomDraw { tick: number; purpose: string; value: number }
export interface ArenaState {
  tuning?: CombatTuning; lab?: { damageEnabled: boolean };
  tick: number; seed: number; rng: number; nextId: number; actors: Actor[]; projectiles: Projectile[];
  telegraphs: Telegraph[]; zones: Zone[]; events: ArenaEvent[]; randomLog: RandomDraw[];
}
export const idleInput = (aim: Vec = { x: 32, y: 10 }): InputFrame => ({ move: { x: 0, y: 0 }, aim, slot: 0, cast: false, absorb: false, roll: false, sprint: false });

export const isDefeated = (a: Actor): boolean => a.tags.includes("DEFEATED");
export const activationBlockedTags = ["DEFEATED", "STAGGERED"] as const;
export const activationBlocked = (a: Actor): boolean => activationBlockedTags.some(tag => a.tags.includes(tag));
