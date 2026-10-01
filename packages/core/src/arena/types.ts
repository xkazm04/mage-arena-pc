import type { Vec } from './math';
export type Family = 'magic' | 'physical' | 'unblockable';
export interface Ranks { vigor: number; focus: number; nerve: number }
export interface InputFrame { move: Vec; aim: Vec; slot: number; cast: boolean; absorb: boolean; roll: boolean; sprint: boolean }
export interface Hit { ownerId: number; activationId: number; damage: number; family: Family; tier: number; source: Vec; bolt?: boolean }
export interface PendingCast { kind: 'bolt' | 'staff'; releaseTick: number; aim: Vec; activationId: number }
export interface Actor {
  id: number; team: number; label: string; pos: Vec; previousPos: Vec; facing: Vec; radius: number;
  ranks: Ranks; hp: number; maxHp: number; mana: number; maxMana: number; stamina: number; maxStamina: number;
  down: boolean; dummy: boolean; absorb: boolean; absorbFreshTick: number; releaseTick: number; absorbExhausted: boolean;
  lastInput: InputFrame; rollUntil: number; immuneUntil: number; recoveryUntil: number; rollDirection: Vec;
  staminaUsedTick: number; cooldownUntil: number; pending?: PendingCast;
  waveStartTick: number; tier: number; lastUnlockTick: number; clockAdvanceTicks: number; unlockTicks: number[];
  metrics: { perfects: number; blocks: number; hits: number; damageDealt: number; damageTaken: number; manaDrained: number; manaRaised: number; manaReturned: number; casts: number; rolls: number };
}
export interface Projectile extends Hit { id: number; pos: Vec; previousPos: Vec; velocity: Vec; radius: number; remainingM: number; hitIds: number[] }
export interface Telegraph extends Hit { id: number; kind: 'projectile' | 'lane'; origin: Vec; target: Vec; resolveTick: number; startTick: number; speedMps: number; rangeM: number; widthM: number }
export interface ArenaEvent { tick: number; kind: 'perfect' | 'hit' | 'cast' | 'down' | 'unlock' | 'interrupt' | 'roll'; actorId: number; targetId?: number; value: number }
export interface RandomDraw { tick: number; purpose: string; value: number }
export interface ArenaState {
  tick: number; seed: number; rng: number; nextId: number; actors: Actor[]; projectiles: Projectile[];
  telegraphs: Telegraph[]; events: ArenaEvent[]; randomLog: RandomDraw[];
}
export const idleInput = (aim: Vec = { x: 32, y: 10 }): InputFrame => ({ move: { x: 0, y: 0 }, aim, slot: 0, cast: false, absorb: false, roll: false, sprint: false });
