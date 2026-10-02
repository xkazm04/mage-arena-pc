import { combat, waterRows } from './data.generated.ts';
import runtime from './data/runtime.json' with { type: 'json' };
import type { Actor, Composition, Family, WaterLine, WaterState } from './types.ts';
export interface Spell {
  id: string; line: string; tier: number; branch: string; name: string; castS: number; cooldownS: number; mana: number;
  damage: number; family: Family; telegraphS: number; rangeM: number;
  kind: 'projectile' | 'cone' | 'ring' | 'zone' | 'target' | 'self' | 'passive' | 'wave';
  speedMps: number; radiusM: number; count: number; spreadDeg: number; arcDeg: number;
  effect: string; durationS: number; amount: number; burstRadiusM: number;
}
const number = (source: string, regex: RegExp, group = 1): number => {
  const match = source.match(regex); if (!match) throw Error(`Spell shape not understood: ${source} / ${regex}`); return Number(match[group]);
};
export const spells: Spell[] = waterRows.map(row => {
  const s: Spell = { id: `${row.line}:${row.tier}:${row.branch || 'base'}`, line: row.line, tier: +row.tier, branch: row.branch, name: row.name,
    castS: +row.cast_s, cooldownS: +row.cooldown_s, mana: +row.mana, damage: /^\d/.test(row.damage) ? parseFloat(row.damage) : 0,
    family: row.blockable === 'UNBLOCKABLE' ? 'unblockable' : 'magic', telegraphS: +row.telegraph_s, rangeM: +row.range_m,
    kind: 'self', speedMps: 0, radiusM: 0, count: 1, spreadDeg: 0, arcDeg: 360, effect: '', durationS: 0, amount: 0, burstRadiusM: 0 };
  const shape: string = row.shape;
  if (row.line === 'bolt' || row.line === 'tide_orb') {
    s.kind = 'projectile';
    s.speedMps = shape.includes('m/s') ? number(shape, /([\d.]+) m\/s/) : runtime.water.fanSpeedMps;
    if (shape.includes('two projectiles')) { s.count = 2; s.spreadDeg = 2 * number(shape, /\+-([\d.]+) deg/); }
    if (shape.includes('-orb fan')) { s.count = number(shape, /(\d+)-orb/); s.spreadDeg = number(shape, /fan ([\d.]+) deg/); }
    if (shape.includes('bursts')) s.burstRadiusM = number(shape, /bursts r ([\d.]+) m/);
    else if (shape.includes(' r ')) s.radiusM = number(shape, /r ([\d.]+) m/);
  } else if (row.line === 'lash') {
    s.kind = row.tier === '3' ? 'ring' : 'cone';
    const basic = waterRows.find(r => r.line === 'lash' && r.tier === '1')!;
    s.arcDeg = s.kind === 'ring' ? 360 : number(basic.shape, /cone ([\d.]+) deg/);
    if (shape.includes('pull') || shape.includes('push')) { s.effect = shape.includes('pull') ? 'pull' : 'push'; s.amount = number(shape, /(?:pull|push) ([\d.]+) m/); }
    if (shape.includes('root')) { s.effect = 'root'; s.durationS = number(shape, /root ([\d.]+) s/); }
  } else if (row.line === 'mire') {
    s.kind = row.tier === '4' ? 'target' : 'zone';
    if (s.kind === 'zone') s.radiusM = number(shape, /r ([\d.]+) m/);
    if (row.tier === '1') { s.effect = 'slow'; s.amount = number(shape, /slow ([\d.]+)%/) / 100; s.durationS = number(shape, /for ([\d.]+) s/); }
    if (row.tier === '2') { s.effect = 'fog'; s.durationS = number(shape, /for ([\d.]+) s/); }
    if (row.tier === '3') { s.effect = 'root'; s.durationS = number(shape, /root ([\d.]+) s/); }
    if (row.tier === '4') { s.effect = 'encase'; s.durationS = number(shape, /target ([\d.]+) s/); }
  } else if (row.line === 'mend') {
    if (row.tier === '1') { s.effect = 'heal'; s.amount = number(row.damage, /heal ([\d.]+)/); }
    if (row.tier === '2') { s.effect = 'ward'; s.amount = number(shape, /-([\d.]+)%/) / 100; s.durationS = number(shape, /for ([\d.]+) s/); }
    if (row.tier === '3') { s.effect = 'hot'; s.amount = number(row.damage, /heal ([\d.]+)/); s.durationS = number(row.damage, /over ([\d.]+) s/); }
    if (row.tier === '4') { s.effect = 'font'; s.amount = number(shape, /restore ([\d.]+) mana/); }
  } else if (row.line === 'mirror') {
    if (row.tier === '1') { s.effect = 'sheen'; s.amount = number(shape, /\+([\d.]+)%/) / 100; s.durationS = number(shape, /self ([\d.]+) s/); }
    if (row.tier === '2') { s.kind = 'passive'; s.effect = row.branch === 'A' ? 'reflection' : 'ripple'; }
    if (row.tier === '3') { s.effect = 'decoy'; s.durationS = number(shape, /for ([\d.]+) s/); }
    if (row.tier === '4') { s.kind = 'wave'; s.effect = 'return'; s.amount = number(row.damage, /max ([\d.]+)/); s.damage = s.amount; }
  } else throw Error('Unrecognized Water line');
  return s;
});
export const waterLines: WaterLine[] = ['tide_orb', 'lash', 'mire', 'mend', 'mirror'];
export const presets = runtime.water.presets as Composition[];
export function validateComposition(c: Composition): string[] {
  const errors: string[] = [];
  if (c.lines.length !== combat.lines.slots || new Set(c.lines).size !== c.lines.length || c.lines.some(l => !waterLines.includes(l))) errors.push('Choose exactly three distinct Water lines.');
  for (const line of ['lash', 'mirror', 'tide_orb'] as const) if (!['A', 'B'].includes(c.branches[line])) errors.push(`Choose branch A or B for ${line}.`);
  return errors;
}
export function newWaterState(composition: Composition = presets[0]!): WaterState {
  const errors = validateComposition(composition); if (errors.length) throw Error(errors.join(' '));
  return { composition: structuredClone(composition), flow: 0, lastLine: '', lastCastTick: -1e9, lastActivityTick: -1e9, cooldowns: {}, stored: 0,
    rootUntil: 0, encasedUntil: 0, slowUntil: 0, slowMult: 1, wardUntil: 0, sheenUntil: 0, hotUntil: 0, hotPerTick: 0, crests: 0, healing: 0, controlTicks: 0 };
}
export function spellFor(actor: Actor, slot: number): Spell | undefined {
  const line = slot === 0 ? 'bolt' : actor.water.composition.lines[slot - 1];
  if (!line) return undefined;
  const tier = slot === 0 ? 0 : actor.tier;
  const branch = line === 'lash' || line === 'mirror' || line === 'tide_orb' ? actor.water.composition.branches[line] : '';
  return spells.find(s => s.line === line && s.tier === tier && (!s.branch || s.branch === branch));
}
export function lintSpells(catalog: Spell[] = spells): string[] {
  const errors: string[] = [];
  for (const line of waterLines) for (let tier = 1; tier <= 4; tier++) if (!catalog.some(s => s.line === line && s.tier === tier)) errors.push(`Missing ${line} tier ${tier}`);
  for (const s of catalog) {
    if (s.branch && !(combat.lines.branchAtTiers as readonly number[]).includes(s.tier)) errors.push(`${s.id}: illegal branch tier`);
    if (s.family === 'unblockable' && s.telegraphS < combat.reactionBands.minimumTelegraphUnblockableS) errors.push(`${s.id}: short unblockable warning`);
    if (s.kind === 'zone' && s.telegraphS < combat.reactionBands.minimumTelegraphPositionalS) errors.push(`${s.id}: short positional warning`);
    if ([s.castS, s.cooldownS, s.mana, s.damage, s.telegraphS, s.rangeM, s.durationS, s.amount].some(n => !Number.isFinite(n) || n < 0)) errors.push(`${s.id}: invalid magnitude/unit`);
    if (catalog.filter(other => other.id === s.id).length !== 1) errors.push(`${s.id}: duplicate id`);
  }
  return errors;
}
