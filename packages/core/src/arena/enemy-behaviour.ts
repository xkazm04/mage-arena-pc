import type { runtime } from './kernel.ts';
import type { Family } from './types.ts';
export interface AttackSpec { id: string; family: Family; damage: number; windupS: number; recoveryS?: number; cooldownS?: number; rangeM?: number; projectileMps?: number; tier?: number; effect?: string; telegraph?: string; onWallHit?: string; travelM?: number; travelS?: number; reachM?: number }
export interface EnemySpec { id: string; name: string; poise: number; hp: number; speedMps: number; attacks: readonly AttackSpec[]; behaviour: string; frontBlockDeg?: number; frontBlockMult?: number; armourMultVsBolt?: number; keepDistanceM?: readonly number[]; packSize?: number; onDeath?: { id: string; family: Family; tier: number; damage: number; radiusM: number; delayS: number } }
type GamesSeconds = { [K in keyof typeof runtime.games]: (typeof runtime.games)[K] extends number ? K : never }[keyof typeof runtime.games];

/** How one attack's telegraph departs from the shared melee/projectile default, with its magnitudes parsed from the authored prose. */
export type AttackShape =
  | { kind: 'strike' }
  | { kind: 'net'; widthM: number; rootS: number }
  | { kind: 'lane'; pullM: number }
  | { kind: 'charge'; widthM: number; rangeM: number; wallStunS: number }
  | { kind: 'drain'; manaPerS: number };
/** An enemy's behaviour, compiled once at load: enemies.ts steps this record and never reads ids or prose. */
export interface EnemyBehaviour {
  /** absorb-first: whoever holds absorb outranks distance in the target sort. */
  target: 'nearest' | 'absorb-first';
  /** band: hold keepDistanceM; stationary: plant inside attack range; net-strafe: circle at half to full net range; close: walk in, stop at 0.8 of range. */
  approach: 'close' | 'band' | 'stationary' | 'net-strafe';
  /** Drains its target's mana on contact instead of scheduling attacks. */
  contactDrain: boolean;
  /** Seconds (before pace) of the post-attack backoff. */
  backoffS?: number;
  /** Pack members nearest the target that may engage; the rest circle. */
  engagementSlots?: number;
  /** Runtime cooldown when an attack authors none (otherwise windup + travel + recovery). */
  cooldown?: GamesSeconds;
  /** Runtime reload that holds the enemy after each windup. */
  reload?: GamesSeconds;
  /** Sprints to close a gap outside its backoff. */
  sprint: boolean;
  /** One shape per spec.attacks entry, same order. */
  attacks: readonly AttackShape[];
}
type AttackRule = Exclude<AttackShape['kind'], 'strike'>;
export interface BehaviourRule { target?: 'absorb-first'; approach?: 'stationary' | 'net-strafe'; contactDrain?: true; backoff?: true; engagementSlots?: true; cooldown?: GamesSeconds; reload?: GamesSeconds; sprint?: true; attacks?: Readonly<Record<string, AttackRule>> }

/** The one place an enemy id means anything: what each authored creature does beyond the shared rules. An enemy absent here is a plain walker-striker. */
export const behaviourTable: Readonly<Record<string, BehaviourRule>> = {
  conscript: { backoff: true, sprint: true },
  slinger: { reload: 'slingerReloadS' },
  netter: { approach: 'net-strafe', attacks: { net_cast: 'net' } },
  cinder_hound: { engagementSlots: true },
  mire_maw: { approach: 'stationary', cooldown: 'mawArtilleryCooldownS', attacks: { tongue_pull: 'lane' } },
  thornback: { cooldown: 'chargeCooldownS', attacks: { thorn_charge: 'charge' } },
  hush_moth: { target: 'absorb-first', contactDrain: true, attacks: { mana_sip: 'drain' } },
};

/** Compiles a spec's behaviour, throwing by enemy id when its rule names an unknown attack or its prose lacks a magnitude. */
export function compileBehaviour(spec: EnemySpec, rule: BehaviourRule = behaviourTable[spec.id] ?? {}): EnemyBehaviour {
  const magnitude = (text: string | undefined, pattern: RegExp, what: string): number => {
    const match = text?.match(pattern); if (!match) throw Error(`Enemy ${spec.id}: missing ${what} magnitude in "${text ?? ''}"`); return Number(match[1]);
  };
  const attackIds = new Set(spec.attacks.map(attack => attack.id));
  for (const id of Object.keys(rule.attacks ?? {})) if (!attackIds.has(id)) throw Error(`Enemy ${spec.id}: behaviour names unknown attack ${id}`);
  const attacks = spec.attacks.map((attack): AttackShape => {
    switch (rule.attacks?.[attack.id]) {
      case 'net': return { kind: 'net', widthM: magnitude(attack.telegraph, /([\d.]+) m/, 'net width'), rootS: magnitude(attack.effect, /root ([\d.]+) s/, 'root') };
      case 'lane': return { kind: 'lane', pullM: magnitude(attack.effect, /pull ([\d.]+) m/, 'pull') };
      case 'charge': return { kind: 'charge', widthM: magnitude(attack.telegraph, /lane ([\d.]+) m/, 'lane width'), rangeM: magnitude(attack.telegraph, /x ([\d.]+) m/, 'lane length'),
        wallStunS: magnitude(attack.onWallHit, /self-stun ([\d.]+) s/, 'wall stun') };
      case 'drain': return { kind: 'drain', manaPerS: magnitude(attack.effect, /drain ([\d.]+) mana/, 'drain') };
      default: return { kind: 'strike' };
    }
  });
  if (rule.contactDrain && attacks.some(shape => shape.kind !== 'drain')) throw Error(`Enemy ${spec.id}: a contact drainer needs a drain on every attack`);
  return {
    target: rule.target ?? 'nearest', approach: spec.keepDistanceM ? 'band' : rule.approach ?? 'close', contactDrain: rule.contactDrain ?? false,
    ...(rule.backoff ? { backoffS: magnitude(spec.behaviour, /back off ([\d.]+) s/, 'back off') } : {}),
    ...(rule.engagementSlots ? { engagementSlots: magnitude(spec.behaviour, /uses (\d+) engagement slots/, 'engagement slots') } : {}),
    ...(rule.cooldown ? { cooldown: rule.cooldown } : {}), ...(rule.reload ? { reload: rule.reload } : {}),
    sprint: rule.sprint ?? false, attacks,
  };
}
/** Every table row must name a spec in the roster it compiles against. */
export function checkBehaviourTable(roster: readonly EnemySpec[]): void {
  const ids = new Set(roster.map(spec => spec.id));
  for (const id of Object.keys(behaviourTable)) if (!ids.has(id)) throw Error(`Enemy behaviour table names unknown enemy ${id}`);
}
