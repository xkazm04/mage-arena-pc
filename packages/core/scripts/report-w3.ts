import { mkdirSync, writeFileSync } from 'node:fs';
import { arenaTiers, enemyData } from '../src/arena/data.generated.ts';
import { addMage, combat, createTraining, idleInput, lintSpells, newWaterState, presets, runtime, seconds, spellFor, spells, stepTraining, ticks, timingBot, type Composition } from '../src/arena/index.ts';
const destination = new URL('../../../docs/waves/W3-evidence/', import.meta.url); mkdirSync(destination, { recursive: true });
const errors = lintSpells(); if (errors.length) throw Error(errors.join('\n'));
const mutation = structuredClone(spells); mutation.find(s => s.family === 'unblockable')!.telegraphS = 0; mutation.find(s => s.line === 'mend')!.branch = 'A';
if (lintSpells(mutation).length !== 2) throw Error('Linter failed to reject planted contradictions');
function probe(composition: Composition, scenario: 'magic dummy' | 'stationary soldiers') {
  const t = createTraining('magic', 3103); t.player.water = newWaterState(composition); t.player.hp -= 40;
  t.dummy.pos = { x: t.player.pos.x + runtime.water.reportRangeM, y: t.player.pos.y };
  if (scenario === 'stationary soldiers') {
    t.state.actors = [t.player]; t.dummy.down = true;
    let index = 0;
    for (const spawn of arenaTiers.tiers[0].waves[0].spawns) {
      const spec = enemyData.soldiers.find(s => s.id === spawn.enemy)!;
      for (let i = 0; i < spawn.count; i++) {
        const a = addMage(t.state, 1, { x: t.player.pos.x + runtime.water.reportRangeM + (index % 2) * 0.5, y: t.player.pos.y + (Math.floor(index / 2) - 1) * 0.8 }, spec.name);
        a.hp = a.maxHp = spec.hp; index++;
      }
    }
  }
  const windows: { fromS: number; toS: number; damage: number; dps: number; healing: number; mana: number; flow: number; crests: number }[] = [];
  let lastDamage = 0, lastHealing = 0, firstClearS: number | null = null, cycles = 0, decisions = 0;
  for (let i = 0; i < ticks(runtime.water.reportDurationS); i++) {
    const target = t.state.actors.find(a => a.team !== t.player.team && !a.down);
    const input = scenario === 'magic dummy' ? timingBot(t, 'perfect') : idleInput(target?.pos);
    if (target) input.aim = { ...target.pos };
    if (!input.absorb && i % ticks(runtime.water.reportCastCadenceS) === 0) {
      const order = Array.from({ length: combat.lines.slots + 1 }, (_, j) => (j + decisions) % (combat.lines.slots + 1)); decisions++;
      const slot = order.find(slot => { const s = spellFor(t.player, slot); return s && s.kind !== 'passive' && (t.player.water.cooldowns[s.line] ?? 0) <= t.state.tick + 1 && (t.player.water.flow >= combat.flow.max || s.mana <= t.player.mana); });
      if (slot !== undefined) { input.slot = slot; input.cast = true; }
    }
    stepTraining(t, input);
    if (!t.state.actors.some(a => a.team !== t.player.team && !a.down)) {
      firstClearS ??= seconds(t.state.tick); cycles++;
      // Continuous target-range probe, never a claimed enemy fight: re-rack the stationary formation.
      for (const a of t.state.actors.filter(a => a.team !== t.player.team)) { a.down = false; a.hp = a.maxHp; }
    }
    if (t.state.tick % ticks(combat.tierClock.unlockAtSeconds[2]) === 0) {
      const damage = t.player.metrics.damageDealt - lastDamage, healing = t.player.water.healing - lastHealing;
      windows.push({ fromS: seconds(t.state.tick) - combat.tierClock.unlockAtSeconds[2], toS: seconds(t.state.tick), damage, dps: damage / combat.tierClock.unlockAtSeconds[2], healing, mana: t.player.mana, flow: t.player.water.flow, crests: t.player.water.crests });
      lastDamage = t.player.metrics.damageDealt; lastHealing = t.player.water.healing;
    }
  }
  return { composition: composition.name, scenario, windows, firstClearS, cycles, down: t.player.down, damage: t.player.metrics.damageDealt, healing: t.player.water.healing, controlTicks: t.player.water.controlTicks, perfects: t.player.metrics.perfects, manaReturned: t.player.metrics.manaReturned, finalMana: t.player.mana };
}
const probes = presets.flatMap(c => [probe(c, 'magic dummy'), probe(c, 'stationary soldiers')]);
// Compare capabilities as well as damage: Mire control, Mend sustain, Mirror counters are different axes.
const profiles = presets.map(c => ({ composition: c.name, capabilities: [...new Set(spells.filter(s => c.lines.includes(s.line as never) && (!s.branch || c.branches[s.line as keyof typeof c.branches] === s.branch)).map(s => s.effect).filter(Boolean))],
  dps: probes.filter(p => p.composition === c.name).flatMap(p => p.windows.map(w => w.dps)) }));
const dominanceFlags = profiles.flatMap(a => profiles.filter(b => b !== a && a.dps.length === b.dps.length && b.capabilities.every(c => a.capabilities.includes(c)) && a.dps.every((v, i) => v >= b.dps[i]!) && a.dps.some((v, i) => v > b.dps[i]!)).map(b => `${a.composition} dominates ${b.composition} in this probe`));
const ceiling = spells.map(s => ({ id: s.id, name: s.name, unit: 'damage per 15 s; unlimited mana, all projectiles land; no Flow', damage: s.kind === 'passive' ? 0 : s.damage * s.count * (s.cooldownS > 0 ? Math.ceil(combat.tierClock.unlockAtSeconds[2] / s.cooldownS) : 0) }));
const report = { label: 'simulated', command: 'npm --prefix packages/core run report:w3', linterErrors: errors, mutationChecks: 2,
  methodology: 'Same kernel and rank-one resources. Fixed half-second rotation policy plus instrumented ward timing. Starts with missing HP to measure healing. Stationary soldiers have Tiro wave-one counts/HP, no attacks/AI, and re-rack after each clear for continuous per-window curves. Range/formation are authored probe parameters; movement effects can push targets away. No mana/stamina refill, no player resurrection. This is not W4 balance or human play.',
  probes, authoredCeilings: ceiling, profiles, dominanceFlags,
  limitations: ['DPS probe does not certify utility quality or feel.', 'Stationary soldier first-clear times are not AI wave durations.', 'Ceilings exclude travel/casting time and affordability; Return Tide ceiling assumes full storage.'] };
writeFileSync(new URL('water-curves.json', destination), JSON.stringify(report, null, 2) + '\n');
console.table(probes.map(p => ({ composition: p.composition, scenario: p.scenario, damage: p.damage.toFixed(1), healing: p.healing.toFixed(1), firstClearS: p.firstClearS, windows: p.windows.map(w => w.dps.toFixed(2)).join(' / '), down: p.down })));
if (dominanceFlags.length) throw Error(dominanceFlags.join('\n'));
console.log('Catalog, mutation and composition trade-off gates passed.');
