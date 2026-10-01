import { Application, Graphics } from 'pixi.js';
import { combat, createTraining, FixedStepper, runtime, seconds, stepTraining, timingBot, newWaterState, presets, spellFor, spells, type TrainingKind, type BotKind, type Composition } from '@mage-arena/core/arena';
import { ArenaInput } from './input';
import { addEnemy, advanceGames, attachMageAI, createGames, enemyInputs, enemyRoster, queueDeathEffects, stepArena, stepGames, tiro, type Games } from '@mage-arena/core/arena';
import { compositionScreen } from './composition';
import './style.css';

async function main(): Promise<void> {
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="shell"><header class="masthead"><div><div class="eyebrow">Castra Clausa · the proving ground</div><h1>Mage Arena</h1><div class="subtitle">Water answers what the collar cannot hold.</div></div>
<div class="toolbar"><label for="scenario">Training</label><select id="scenario"><option value="magic">Magic thrower</option><option value="physical">Steel from the side</option><option value="flanker">Alternating flanks</option><option value="charge">Unblockable lane</option><option value="stream">Three-bolt stream</option><option value="performance">Projectile field</option></select><button id="restart">Restart</button><button id="pause">Pause</button></div></header>
<div class="arena-wrap"><div class="arena-caption"><div class="eyebrow">The Tide · Cassia</div><p id="instruction">Face the light. Raise the ward just before impact.</p></div><div id="canvas"></div><div class="message" id="message"></div></div>
<div class="resource-row"><div><div class="meter-label"><span>VITALITY</span><span id="hp-value"></span></div><div class="meter"><span class="hp" id="hp-bar"></span></div></div><div><div class="meter-label"><span>MANA</span><span id="mana-value"></span></div><div class="meter"><span class="mana" id="mana-bar"></span></div></div><div><div class="meter-label"><span>STAMINA</span><span id="stamina-value"></span></div><div class="meter"><span class="stamina" id="stamina-bar"></span></div></div><div><div class="clock-label" id="clock"></div><div class="clock-detail" id="clock-detail"></div></div></div>
<div class="slots">${['Rain Needle', 'Line I', 'Line II', 'Line III'].map((name, i) => `<button class="slot ${i === 0 ? 'active' : ''}" data-slot="${i}"><span class="key">${i + 1}</span><span class="slot-name">${name}</span><small>${i === 0 ? 'Light bolt · staff at close range' : 'Composition unlocks in Water practice'}</small></button>`).join('')}</div>
<div class="controls"><span><b>W A S D</b> move &nbsp; <b>Shift</b> sprint &nbsp; <b>Space</b> roll</span><span><b>Mouse</b> aim &nbsp; <b>Left</b> cast &nbsp; <b>Right hold</b> absorb &nbsp; <b>1–4 / wheel</b> choose slot</span></div>
<div class="legend"><span><i class="dot" style="background:#7de0ed"></i>MAGIC · face & absorb</span><span><i class="dot" style="background:#eee9da"></i>STEEL · roll</span><span><i class="dot" style="background:#e65e63"></i>UNBLOCKABLE · leave the mark</span></div>
<p class="note">Training arena · placeholder shapes · missio at zero vitality</p></main>`;
const app = new Application();
await app.init({ width: runtime.presentation.widthPx, height: runtime.presentation.heightPx, background: '#172630', antialias: true, autoStart: false, preference: 'webgl' });
document.querySelector('#canvas')!.appendChild(app.canvas);
app.canvas.tabIndex = 0; app.canvas.setAttribute('aria-label', 'Arena. WASD move, mouse aim, left cast, right absorb, Space roll.');
const backdrop = new Graphics(), graphics = new Graphics(); app.stage.addChild(backdrop, graphics);
let backdropReady = false;
const input = new ArenaInput(app.canvas, { x: combat.arena.widthM, y: combat.arena.heightM });
let training = createTraining(), paused = false, clock = new FixedStepper(), bot: BotKind | undefined;
let composition: Composition = structuredClone(presets[0]!);
let mode: 'training' | 'roster' | 'tiro' = 'training', rosterId = 'conscript', games: Games | undefined, startGamesAfterCompose = false, referencePlayer = false;
let lastPerfect = -1e9, lastEventIndex = 0, audio: AudioContext | undefined;
const frames: number[] = [], cpu: number[] = []; let frameCount = 0;
const params = new URLSearchParams(location.search);
if (params.has('scenario')) training = createTraining(params.get('scenario') as TrainingKind);
document.querySelector<HTMLSelectElement>('#scenario')!.value = training.kind;
function restart(kind = training.kind): void {
  mode = 'training'; games = undefined; referencePlayer = false;
  training = createTraining(kind); clock = new FixedStepper(); input.clear(); lastPerfect = -1e9; lastEventIndex = 0; paused = false;
  training.player.water = newWaterState(composition);
  document.querySelector('#pause')!.textContent = 'Pause';
  app.canvas.focus();
}
function startTiro(seed = Number(params.get('seed') ?? 1)): void {
  restart(); mode = 'tiro'; games = createGames(seed, composition); syncGames(); document.querySelector<HTMLSelectElement>('#scenario')!.value = 'tiro';
}
function syncGames(): void { if (games) { training.state = games.state; training.player = games.player; training.dummy = games.state.actors[1]!; } }
function startRoster(id: string): void {
  restart(); mode = 'roster'; rosterId = id; training.state.actors = [training.player];
  const spec = enemyRoster.find(s => s.id === id)!;
  for (let i = 0; i < (spec.packSize ?? runtime.games.rosterPracticeCount); i++) addEnemy(training.state, id, { x: runtime.games.enemySpawn.x, y: runtime.games.enemySpawn.y + (i - ((spec.packSize ?? 1) - 1) / 2) * runtime.games.spawnRowSpacingM });
  training.dummy = training.state.actors[1]!;
}
document.querySelector('#restart')!.addEventListener('click', () => mode === 'tiro' ? startTiro() : mode === 'roster' ? startRoster(rosterId) : restart());
const composer = compositionScreen(choice => { composition = choice; if (startGamesAfterCompose) startTiro(); else restart(); app.canvas.focus(); }, value => { paused = value; input.clear(); });
const composeButton = document.createElement('button'); composeButton.id = 'compose'; composeButton.textContent = 'Compose'; composeButton.onclick = () => { startGamesAfterCompose = false; composer.open(); }; document.querySelector('.toolbar')!.prepend(composeButton);
const gamesButton = document.createElement('button'); gamesButton.id = 'start-tiro'; gamesButton.className = 'primary'; gamesButton.textContent = 'Tiro Games'; gamesButton.onclick = () => { startGamesAfterCompose = true; composer.open('Enter Tiro Games'); }; document.querySelector('.toolbar')!.prepend(gamesButton);
const scenarioSelect = document.querySelector<HTMLSelectElement>('#scenario')!;
const currentGamesOption = document.createElement('option'); currentGamesOption.value = 'tiro'; currentGamesOption.textContent = 'Tiro Games'; currentGamesOption.disabled = true; scenarioSelect.prepend(currentGamesOption);
const rosterGroup = document.createElement('optgroup'); rosterGroup.label = 'Roster practice';
for (const spec of enemyRoster) { const option = document.createElement('option'); option.value = `enemy:${spec.id}`; option.textContent = spec.name; rosterGroup.append(option); }
scenarioSelect.append(rosterGroup);
scenarioSelect.addEventListener('change', () => scenarioSelect.value.startsWith('enemy:') ? startRoster(scenarioSelect.value.slice(6)) : restart(scenarioSelect.value as TrainingKind));
document.querySelector('#message')!.addEventListener('click', e => {
  const action = (e.target as HTMLElement).closest<HTMLElement>('[data-game-action]')?.dataset.gameAction;
  if (action === 'next' && games) { advanceGames(games); syncGames(); input.clear(); clock = new FixedStepper(); lastPerfect = -1e9; app.canvas.focus(); }
  if (action === 'retry') { startTiro(); app.canvas.focus(); }
});
document.querySelector('#pause')!.addEventListener('click', () => { paused = !paused; input.clear(); document.querySelector('#pause')!.textContent = paused ? 'Resume' : 'Pause'; if (!paused) app.canvas.focus(); });
for (const slot of document.querySelectorAll<HTMLButtonElement>('[data-slot]')) slot.addEventListener('click', () => { input.slot = Number(slot.dataset.slot); app.canvas.focus(); });
function bell(): void {
  if (!audio || audio.state !== 'running') return;
  const osc = audio.createOscillator(), gain = audio.createGain(); osc.connect(gain); gain.connect(audio.destination);
  osc.frequency.value = runtime.presentation.bellHz;
  gain.gain.setValueAtTime(0.04, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + runtime.presentation.bellDurationS);
  osc.start(); osc.stop(audio.currentTime + runtime.presentation.bellDurationS);
}
app.canvas.addEventListener('pointerdown', () => { audio ??= new AudioContext(); void audio.resume(); });
const color = (family: string): number => family === 'unblockable' ? 0xef616b : family === 'physical' ? 0xece8dc : 0x7bdded;
function render(alpha: number): void {
  const { state, player } = training; const scale = runtime.presentation.pixelsPerMetre; const g = graphics; g.clear();
  if (!backdropReady) {
    backdrop.roundRect(28, 28, app.screen.width - 56, app.screen.height - 56, 90).fill(0x20343d).stroke({ width: 2, color: 0x536265 });
    backdrop.roundRect(45, 45, app.screen.width - 90, app.screen.height - 90, 78).stroke({ width: 1, color: 0x3b5158 });
    for (let x = 2; x < combat.arena.widthM; x += 2) for (let y = 2; y < combat.arena.heightM; y += 2) backdrop.circle(x * scale, y * scale, 1).fill(0x42545a);
    for (const x of [2, combat.arena.widthM - 2]) for (const y of [3, combat.arena.heightM - 3]) {
      backdrop.poly([x * scale, y * scale - 16, x * scale + 12, y * scale, x * scale, y * scale + 16, x * scale - 12, y * scale]).fill(0x3c5360).stroke({ width: 2, color: 0x80908c });
    }
    backdropReady = true;
  }
  for (const t of state.telegraphs) {
    const x = t.origin.x * scale, y = t.origin.y * scale;
    const progress = (state.tick - t.startTick) / (t.resolveTick - t.startTick);
    if (t.kind === 'lane' || t.kind === 'charge') {
      const angle = Math.atan2(t.target.y - t.origin.y, t.target.x - t.origin.x), dx = Math.cos(angle), dy = Math.sin(angle), w = t.widthM * scale / 2;
      const ex = x + dx * t.rangeM * scale, ey = y + dy * t.rangeM * scale;
      g.poly([x - dy * w, y + dx * w, ex - dy * w, ey + dx * w, ex + dy * w, ey - dx * w, x + dy * w, y - dx * w]).fill({ color: 0x181219, alpha: 0.8 }).stroke({ width: 2, color: color(t.family), alpha: 0.5 + progress / 2 });
    }
    if (t.kind === 'area') {
      g.circle(t.target.x * scale, t.target.y * scale, t.widthM * scale).stroke({ color: color(t.family), width: 2 });
      g.circle(t.target.x * scale, t.target.y * scale, t.widthM * scale * Math.max(0, progress)).fill({ color: color(t.family), alpha: 0.17 });
    }
    if (t.kind === 'melee') {
      const angle = Math.atan2(t.target.y - t.origin.y, t.target.x - t.origin.x), arc = t.widthM * Math.PI / 360;
      g.moveTo(x, y).arc(x, y, t.rangeM * scale, angle - arc, angle + arc).lineTo(x, y).fill({ color: color(t.family), alpha: 0.08 + progress * 0.15 }).stroke({ color: color(t.family), width: 1 });
    }
    g.circle(x, y, 18 + (1 - progress) * 27).stroke({ color: color(t.family), width: 2 });
  }
  for (const zone of state.zones) {
    const color = zone.kind === 'fog' ? 0xb7c6cb : 0x4598b8;
    g.circle(zone.pos.x * scale, zone.pos.y * scale, zone.radiusM * scale).fill({ color, alpha: 0.18 }).stroke({ color, width: 1 });
  }
  for (const a of state.actors) {
    if (a.pending?.kind === 'spell') {
      const s = spells.find(s => s.id === a.pending!.spellId)!;
      const progress = (state.tick - a.pending.startTick) / Math.max(1, a.pending.releaseTick - a.pending.startTick);
      const centre = s.kind === 'zone' || s.kind === 'target' ? a.pending.aim : a.pos;
      const radius = s.radiusM || (s.kind === 'cone' || s.kind === 'ring' ? s.rangeM : 1);
      g.circle(centre.x * scale, centre.y * scale, radius * scale).stroke({ color: color(s.family), width: 2, alpha: 0.4 + progress / 2 });
      g.circle(centre.x * scale, centre.y * scale, radius * scale * progress).fill({ color: color(s.family), alpha: 0.1 });
      if (s.family === 'unblockable' && s.kind === 'projectile') {
        const angle = Math.atan2(a.pending.aim.y - a.pos.y, a.pending.aim.x - a.pos.x);
        g.moveTo(a.pos.x * scale, a.pos.y * scale).lineTo((a.pos.x + Math.cos(angle) * s.rangeM) * scale, (a.pos.y + Math.sin(angle) * s.rangeM) * scale).stroke({ color: 0xec646a, width: (s.radiusM || 0.5) * scale * 2, alpha: 0.2 });
      }
    }
    if (a.water.decoy) g.circle(a.water.decoy.pos.x * scale, a.water.decoy.pos.y * scale, a.radius * scale).fill({ color: 0x91e0ef, alpha: 0.3 }).stroke({ color: 0xc6eaf0, width: 1 });
    if (state.tick < a.water.encasedUntil) g.rect((a.pos.x - 0.6) * scale, (a.pos.y - 0.6) * scale, 1.2 * scale, 1.2 * scale).fill({ color: 0x96e1ec, alpha: 0.45 });
  }
  for (const p of state.projectiles) {
    const x = (p.previousPos.x + (p.pos.x - p.previousPos.x) * alpha) * scale, y = (p.previousPos.y + (p.pos.y - p.previousPos.y) * alpha) * scale;
    g.circle(x, y, p.radius * scale + 5).fill({ color: color(p.family), alpha: 0.12 });
    g.circle(x, y, p.radius * scale).fill(color(p.family));
  }
  for (const a of state.actors) {
    const x = (a.previousPos.x + (a.pos.x - a.previousPos.x) * alpha) * scale, y = (a.previousPos.y + (a.pos.y - a.previousPos.y) * alpha) * scale;
    g.ellipse(x, y + 10, 19, 8).fill({ color: 0x080f15, alpha: 0.5 });
    if (a.enemy) {
      const id = a.enemy.id, c = a.down ? 0x455158 : id === 'cinder_hound' ? 0xd18b61 : id === 'mire_maw' ? 0x81976e : id === 'thornback' ? 0xab7978 : id === 'hush_moth' ? 0xaaa0c5 : 0xc5bcaa;
      if (id === 'shieldman') {
        g.roundRect(x - 12, y - 16, 24, 32, 4).fill(c);
        const angle = Math.atan2(a.facing.y, a.facing.x); g.arc(x, y, 25, angle - Math.PI / 3, angle + Math.PI / 3).stroke({ color: 0xe3d5b7, width: 6 });
      } else if (id === 'mire_maw') g.ellipse(x, y, 24, 19).fill(c).stroke({ color: 0xb8c59a, width: 2 });
      else if (id === 'hush_moth') { g.ellipse(x - 6, y, 10, 6).fill(c); g.ellipse(x + 6, y, 10, 6).fill(c); }
      else if (id === 'thornback') g.star(x, y, 7, 25, 16).fill(c).stroke({ color: 0xe2aca0, width: 1 });
      else if (id === 'netter') { g.circle(x, y, 14).fill(c); g.rect(x - 8, y - 8, 16, 16).stroke({ color: 0x4b5b60, width: 2 }); }
      else g.poly([x + a.facing.x * 19, y + a.facing.y * 19, x - a.facing.y * 12 - a.facing.x * 9, y + a.facing.x * 12 - a.facing.y * 9, x + a.facing.y * 12 - a.facing.x * 9, y - a.facing.x * 12 - a.facing.y * 9]).fill(c).stroke({ color: 0xe0caae, width: 1 });
    } else if (a.dummy) g.poly([x, y - 20, x + 15, y, x, y + 20, x - 15, y]).fill(a.down ? 0x3c4347 : 0xad8460).stroke({ width: 2, color: 0xe1ba80 });
    else {
      g.circle(x, y, a.radius * scale).fill(a.down ? 0x536167 : a.team === player.team ? 0x68b9d0 : 0xb99dd5).stroke({ width: 2, color: 0xbbeaf0 });
      g.moveTo(x, y).lineTo(x + a.facing.x * 25, y + a.facing.y * 25).stroke({ width: 3, color: 0xe2f1ec });
      for (let i = 0; i < 4; i++) { const angle = i * Math.PI / 2 + Math.PI / 4; g.circle(x + Math.cos(angle) * 26, y + Math.sin(angle) * 26, 3).fill(i < a.tier ? 0xe2c88d : 0x596973); }
    }
    if (a.absorb) {
      const angle = Math.atan2(a.facing.y, a.facing.x), arc = combat.absorb.arcDeg * Math.PI / 360;
      g.arc(x, y, 34, angle - arc, angle + arc).stroke({ color: 0x99e4e9, width: 4 });
      g.arc(x, y, 40, angle - arc, angle + arc).stroke({ color: 0x76becd, width: 1, alpha: 0.45 });
    }
    if (state.tick < a.immuneUntil) g.circle(x, y, 22).stroke({ color: 0xfff0bf, width: 2 });
    if (a.hp < a.maxHp) { g.rect(x - 21, y - 33, 42, 3).fill(0x323d43); g.rect(x - 21, y - 33, 42 * a.hp / a.maxHp, 3).fill(0xdba58c); }
  }
  if (seconds(state.tick - lastPerfect) < runtime.presentation.perfectFlashS) g.circle(player.pos.x * scale, player.pos.y * scale, 42 + (state.tick - lastPerfect) * 3).stroke({ color: 0xffffff, width: 3, alpha: 1 - seconds(state.tick - lastPerfect) / runtime.presentation.perfectFlashS });
  const aim = input.aim; g.circle(aim.x * scale, aim.y * scale, 5).stroke({ width: 1, color: 0xd7c9a6, alpha: 0.6 });
  app.renderer.render(app.stage);
  for (const [name, current, max] of [['hp', player.hp, player.maxHp], ['mana', player.mana, player.maxMana], ['stamina', player.stamina, player.maxStamina]] as const) {
    document.querySelector(`#${name}-value`)!.textContent = `${Math.ceil(current)} / ${max}`;
    (document.querySelector(`#${name}-bar`) as HTMLElement).style.width = `${current / max * 100}%`;
  }
  document.querySelector('#clock')!.textContent = `COLLAR ${['', 'I', 'II', 'III', 'IV'][player.tier]} · ${seconds(state.tick - player.waveStartTick).toFixed(1)} s`;
  const nextTier = (player.tier + 1) as 2 | 3 | 4;
  const until = nextTier <= 4 ? Math.max(combat.tierClock.unlockAtSeconds[nextTier] - seconds(state.tick - player.waveStartTick + player.clockAdvanceTicks), combat.tierClock.minimumSecondsBetweenUnlocks - seconds(state.tick - player.lastUnlockTick), 0) : 0;
  document.querySelector('#clock-detail')!.textContent = `${nextTier <= 4 ? `Next rune in ${until.toFixed(1)} s · ` : ''}${player.metrics.perfects} perfect absorbs`;
  for (const b of document.querySelectorAll<HTMLElement>('[data-slot]')) {
    const slot = Number(b.dataset.slot), s = spellFor(player, slot)!; b.classList.toggle('active', slot === input.slot);
    b.querySelector('.slot-name')!.textContent = s.name;
    const remaining = Math.max(0, seconds((player.water.cooldowns[s.line] ?? 0) - state.tick));
    b.querySelector('small')!.textContent = s.kind === 'passive' ? 'Passive · perfect absorb counter' : remaining > 0 ? `${remaining.toFixed(1)} s · recovering` : `${player.water.flow >= combat.flow.max ? 'FREE CREST' : `${s.mana} mana`} · ${s.cooldownS} s cooldown`;
  }
  document.querySelector('#instruction')!.textContent = `${composition.name} · Flow ${player.water.flow}/${combat.flow.max}${player.water.flow >= combat.flow.max ? ' · CREST READY' : ''} · Face the light. Time your ward.`;
  const remainingEnemies = state.actors.filter(a => a.team !== player.team && !a.down).length;
  document.querySelector('.arena-caption .eyebrow')!.textContent = mode === 'tiro' && games ? `Tiro Games · Bout ${games.wave + 1} / ${tiro.waves.length} · ${tiro.waves[games.wave]!.kind} · ${remainingEnemies} opponent${remainingEnemies === 1 ? '' : 's'}${games.wave >= 2 ? ' · Water proxy mage' : ''}` : mode === 'roster' ? `${training.dummy.label} · ${remainingEnemies} remaining` : 'The Tide · Cassia';
  composeButton.disabled = mode === 'tiro' && !!games && (games.phase === 'active' || games.phase === 'intermission');
  let message = player.down ? 'MISSIO<small>The crowd grants your life. Restart to train again.</small>' : paused ? 'PAUSED' : seconds(state.tick - lastPerfect) < runtime.presentation.perfectFlashS ? 'PERFECT' : '';
  if (games?.phase === 'intermission') message = `BOUT WON<small>The next gate is ready. Recover before you enter.</small><button data-game-action="next" id="next-bout">Enter bout ${games.wave + 2}</button>`;
  if (games?.result) message = `${games.phase === 'complete' ? 'TIRO CHAMPION' : 'MISSIO'}<small>${games.result.wavesCleared} bouts won · ${games.result.gold} gold · ${games.result.renown} renown<br>The Games ${games.phase === 'complete' ? 'are yours' : 'end here. Your life is spared'}.</small><button data-game-action="retry" id="retry-games">New Tiro Games</button>`;
  if (mode === 'roster' && !remainingEnemies && !state.telegraphs.length && !state.projectiles.length) message = 'PRACTICE CLEAR<small>Choose another opponent or enter the Tiro Games.</small>';
  const messageNode = document.querySelector<HTMLElement>('#message')!; if (messageNode.innerHTML !== message) messageNode.innerHTML = message;
  messageNode.classList.toggle('interactive', !!games && games.phase !== 'active');
}
let previous = performance.now();
function frame(now: number): void {
  const elapsed = (now - previous) / 1000; previous = now; const start = performance.now();
  let alpha = 1;
  if (!paused && !training.player.down && !document.hidden) alpha = clock.advance(elapsed, () => {
    if (mode === 'tiro' && games) stepGames(games, referencePlayer ? undefined : input.frame());
    else if (mode === 'roster') { stepArena(training.state, { ...enemyInputs(training.state), [training.player.id]: input.frame() }); queueDeathEffects(training.state); }
    else stepTraining(training, bot ? timingBot(training, bot) : input.frame());
    for (const event of training.state.events.slice(lastEventIndex)) if (event.kind === 'perfect' && event.actorId === training.player.id) { lastPerfect = event.tick; bell(); }
    lastEventIndex = training.state.events.length;
  });
  render(alpha);
  if (frameCount++ >= runtime.presentation.performanceWarmupFrames) { frames.push(elapsed * 1000); cpu.push(performance.now() - start); if (frames.length > runtime.presentation.performanceFrames) { frames.shift(); cpu.shift(); } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Harness access is read-only in ordinary play and only exposes mutations with ?harness=1.
const harness = { snapshot: () => structuredClone({ state: training.state, player: training.player, slot: input.slot, paused, projectiles: training.state.projectiles.length, mode, games }), performance: () => ({ frames: [...frames], cpu: [...cpu], frameCount }),
  ...(params.has('harness') ? { reset: restart, setBot: (kind?: BotKind) => { bot = kind; }, clearInput: () => input.clear(),
    setReferencePlayer: (enabled: boolean) => { referencePlayer = enabled; if (games && enabled) attachMageAI(games.player, runtime.games.referenceCompetence, games.state.tick); },
    runGamesTicks: (count: number) => { if (games) { for (let i = 0; i < count && games.phase === 'active'; i++) stepGames(games, referencePlayer ? undefined : input.frame()); lastEventIndex = games.state.events.length; } },
    startGames: startTiro, startRoster } : {}) };
Object.assign(window, { __arena: harness });
}
void main().catch(error => { console.error(error); document.querySelector('#app')!.textContent = `Arena could not start: ${String(error)}`; });
