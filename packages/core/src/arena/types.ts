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
export interface EnemyBrain { id: string; readyTick: number; backoffUntil: number; stunnedUntil: number; attackIndex: number; deathQueued: boolean }
export interface MageBrain { competence: number; nextDecisionTick: number; input: InputFrame; observed: { id: number; firstSeenTick: number; reacted: boolean }[]; defendUntil: number; plannedRaiseTick: number; plannedReleaseTick: number; targetPoint: Vec; decisionTicks: number[]; reactionAges: number[] }
export interface PendingCast { kind: 'bolt' | 'staff' | 'spell'; releaseTick: number; startTick: number; aim: Vec; activationId: number; spellId?: string; damageMult?: number; targetId?: number }
export interface Actor {
  id: number; team: number; label: string; pos: Vec; previousPos: Vec; facing: Vec; radius: number;
  ranks: Ranks; hp: number; maxHp: number; mana: number; maxMana: number; stamina: number; maxStamina: number;
  down: boolean; dummy: boolean; absorb: boolean; absorbFreshTick: number; releaseTick: number; absorbExhausted: boolean;
  water: WaterState;
  enemy?: EnemyBrain; mageAI?: MageBrain; speedMps?: number;
  lastInput: InputFrame; rollUntil: number; immuneUntil: number; recoveryUntil: number; rollDirection: Vec;
  staminaUsedTick: number; cooldownUntil: number; pending?: PendingCast;
  waveStartTick: number; tier: number; lastUnlockTick: number; clockAdvanceTicks: number; unlockTicks: number[];
  metrics: { perfects: number; blocks: number; hits: number; damageDealt: number; damageTaken: number; manaDrained: number; manaRaised: number; manaReturned: number; casts: number; rolls: number };
}
export interface Projectile extends Hit { id: number; pos: Vec; previousPos: Vec; velocity: Vec; radius: number; remainingM: number; hitIds: number[]; burstRadiusM?: number; piercing?: boolean; reflected?: boolean }
export interface Zone { id: number; ownerId: number; pos: Vec; radiusM: number; until: number; kind: 'slow' | 'fog'; slowMult: number }
export interface Telegraph extends Hit { id: number; kind: 'projectile' | 'lane' | 'melee' | 'area' | 'charge'; origin: Vec; target: Vec; resolveTick: number; startTick: number; speedMps: number; rangeM: number; widthM: number; rootS?: number; pullM?: number; survivesOwner?: boolean; wallStunS?: number }
export interface ArenaEvent { tick: number; kind: 'perfect' | 'hit' | 'cast' | 'down' | 'unlock' | 'interrupt' | 'roll'; actorId: number; targetId?: number; value: number }
export interface RandomDraw { tick: number; purpose: string; value: number }
export interface ArenaState {
  tick: number; seed: number; rng: number; nextId: number; actors: Actor[]; projectiles: Projectile[];
  telegraphs: Telegraph[]; zones: Zone[]; events: ArenaEvent[]; randomLog: RandomDraw[];
}
export const idleInput = (aim: Vec = { x: 32, y: 10 }): InputFrame => ({ move: { x: 0, y: 0 }, aim, slot: 0, cast: false, absorb: false, roll: false, sprint: false });
