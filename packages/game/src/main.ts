import { Application } from 'pixi.js';
import { combat, createTraining, FixedStepper, runtime, seconds, stepTraining, timingBot, newWaterState, presets, spellFor, type TrainingKind, type BotKind, type Composition } from '@mage-arena/core/arena';
import { ArenaInput } from './input';
import { addEnemy, advanceGames, attachMageAI, createGames, enemyInputs, enemyRoster, queueDeathEffects, stepArena, stepGames, tiro, type Games } from '@mage-arena/core/arena';
import { compositionScreen } from './composition';
import { cameraMetrics, contract, groundToScreen, interpolate, makeCamera, type Camera } from './camera';
import { ArenaScene } from './arena-scene';
import { openingPosition, openingSeparationM, spawnProjectile, addMage } from '@mage-arena/core/arena';
import './style.css';

async function main(): Promise<void> {
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="shell"><header class="masthead"><div><div class="eyebrow">Castra Clausa · the proving ground</div><h1>Mage Arena</h1><div class="subtitle">Water answers what the collar cannot hold.</div></div>
<div class="toolbar"><label for="scenario">Training</label><select id="scenario"><option value="magic">Magic thrower</option><option value="physical">Steel from the side</option><option value="flanker">Alternating flanks</option><option value="charge">Unblockable lane</option><option value="stream">Three-bolt stream</option><option value="performance">Projectile field</option></select><label for="zoom">View</label><input id="zoom" type="range" step="0.05" aria-label="Camera zoom"><button id="scale-debug" aria-pressed="false">Scale overlay</button><button id="restart">Restart</button><button id="pause">Pause</button></div></header>
<div class="arena-wrap"><div class="arena-caption"><div class="eyebrow">The Tide · Cassia</div><p id="instruction">Face the light. Raise the ward just before impact.</p></div><div id="canvas"></div><pre id="scale-overlay" hidden></pre><div class="message" id="message"></div></div>
<div class="resource-row"><div><div class="meter-label"><span>VITALITY</span><span id="hp-value"></span></div><div class="meter"><span class="hp" id="hp-bar"></span></div></div><div><div class="meter-label"><span>MANA</span><span id="mana-value"></span></div><div class="meter"><span class="mana" id="mana-bar"></span></div></div><div><div class="meter-label"><span>STAMINA</span><span id="stamina-value"></span></div><div class="meter"><span class="stamina" id="stamina-bar"></span></div></div><div><div class="clock-label" id="clock"></div><div class="clock-detail" id="clock-detail"></div></div></div>
<div class="slots">${['Rain Needle', 'Line I', 'Line II', 'Line III'].map((name, i) => `<button class="slot ${i === 0 ? 'active' : ''}" data-slot="${i}"><span class="key">${i + 1}</span><span class="slot-name">${name}</span><small>${i === 0 ? 'Light bolt · staff at close range' : 'Composition unlocks in Water practice'}</small></button>`).join('')}</div>
<div class="controls"><span><b>W A S D</b> move &nbsp; <b>Shift</b> sprint &nbsp; <b>Space</b> roll</span><span><b>Mouse</b> aim at feet &nbsp; <b>Left</b> cast &nbsp; <b>Right hold</b> absorb &nbsp; <b>1–4 / wheel</b> choose slot</span></div>
<div class="legend"><span><i class="dot" style="background:#7de0ed"></i>MAGIC · face & absorb</span><span><i class="dot" style="background:#eee9da"></i>STEEL · roll</span><span><i class="dot" style="background:#e65e63"></i>UNBLOCKABLE · leave the mark</span></div>
<p class="note">Training arena · placeholder shapes · missio at zero vitality</p></main>`;
const app = new Application();
await app.init({ width: window.innerWidth, height: window.innerHeight, background: '#98755a', antialias: true, autoStart: false, preference: 'webgl' });
document.querySelector('#canvas')!.appendChild(app.canvas);
app.canvas.tabIndex = 0; app.canvas.setAttribute('aria-label', 'Arena. WASD move, mouse aim, left cast, right absorb, Space roll.');
const scene = new ArenaScene(app);
let camera: Camera = makeCamera({ width: window.innerWidth, height: window.innerHeight }, runtime.training.player);
let debugScale = new URLSearchParams(location.search).has('debug');
const input = new ArenaInput(app.canvas, () => camera);
let training = createTraining(), paused = false, clock = new FixedStepper(), bot: BotKind | undefined;
let composition: Composition = structuredClone(presets[0]!);
let mode: 'training' | 'roster' | 'tiro' = 'training', rosterId = 'conscript', games: Games | undefined, startGamesAfterCompose = false, referencePlayer = false;
let lastPerfect = -1e9, lastEventIndex = 0, audio: AudioContext | undefined;
const frames: number[] = [], cpu: number[] = [], projectileSamples: number[] = [], visibleProjectileSamples: number[] = []; let frameCount = 0;
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
  const count = spec.packSize ?? runtime.games.rosterPracticeCount;
  for (let i = 0; i < count; i++) addEnemy(training.state, id, openingPosition(i, count));
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
const zoomControl = document.querySelector<HTMLInputElement>('#zoom')!;
zoomControl.min = String(contract.camera.zoom_range[0]); zoomControl.max = String(contract.camera.zoom_range[1]); zoomControl.value = String(camera.zoom);
zoomControl.addEventListener('input', () => { camera = makeCamera(camera, camera.centre, Number(zoomControl.value)); });
document.querySelector('#scale-debug')!.addEventListener('click', () => { debugScale = !debugScale; });
window.addEventListener('resize', () => { app.renderer.resize(window.innerWidth, window.innerHeight); camera = makeCamera({ width: window.innerWidth, height: window.innerHeight }, camera.centre, camera.zoom); });
// Empty shipping manifest uses original procedural figures until accepted A3 frames arrive.
void scene.library.load(new URL(params.get('sprites') ?? 'arena-sprites.json', location.href).href);
function render(alpha: number): void {
  const { state, player } = training;
  camera = makeCamera({ width: app.screen.width, height: app.screen.height }, interpolate(player.previousPos, player.pos, alpha), camera.zoom);
  input.refreshAim();
  scene.render(state, player, camera, alpha, input.aim, lastPerfect, debugScale);
  const overlay = document.querySelector<HTMLElement>('#scale-overlay')!; overlay.hidden = !debugScale;
  document.querySelector('#scale-debug')!.setAttribute('aria-pressed', String(debugScale));
  if (debugScale) {
    const m = cameraMetrics(camera);
    overlay.textContent = `${contract.version} · ${camera.width} × ${camera.height}
Oblique ${camera.elevation}° · zoom ${camera.zoom.toFixed(2)} · near ${contract.distances.find(d => d.id === 'near')!.zoom.toFixed(2)}
Mage head–sole ${m.figureHeightPx.toFixed(1)} px (${(m.figureHeightPx / camera.height * 100).toFixed(1)}%)
Ground ${m.pxPerMetreX.toFixed(2)} / ${m.pxPerMetreY.toFixed(2)} px/m X/Y
${m.metresPerPixelX.toFixed(4)} / ${m.metresPerPixelY.toFixed(4)} m/px X/Y
Visible ${m.visibleGroundM.x.toFixed(2)} × ${m.visibleGroundM.y.toFixed(2)} m
Oval ${contract.arena_metres.join(' × ')} m · ruler ${openingSeparationM} m
Ward ${contract.absorb.angle_degrees}° · radius ${contract.absorb.visual_radius_metres} m · rear ${contract.absorb.rear_open_degrees}°
Warning locator ≥ ${contract.telegraph.minimum_ground_diameter_metres} m · outline ≥ ${m.outlinePx.toFixed(1)} px
Projectile core ≥ ${m.projectileCorePx.toFixed(1)} px · visible ${scene.visibleProjectiles}
Aim ground ${input.aim.x.toFixed(2)}, ${input.aim.y.toFixed(2)}
Sprites ${scene.library.loadedFrames} loaded · ${scene.library.diagnostics.length} load warnings`;
  }
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
  messageNode.classList.toggle('paused-label', paused && message === 'PAUSED');
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
  if (frameCount++ >= runtime.presentation.performanceWarmupFrames) {
    frames.push(elapsed * 1000); cpu.push(performance.now() - start); projectileSamples.push(training.state.projectiles.length); visibleProjectileSamples.push(scene.visibleProjectiles);
    if (frames.length > runtime.presentation.performanceFrames) { frames.shift(); cpu.shift(); projectileSamples.shift(); visibleProjectileSamples.shift(); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Harness access is read-only in ordinary play and only exposes mutations with ?harness=1.
const harness = { snapshot: () => structuredClone({ state: training.state, player: training.player, slot: input.slot, aim: input.aim, paused, projectiles: training.state.projectiles.length, visibleProjectiles: scene.visibleProjectiles, mode, games, camera, cameraMetrics: cameraMetrics(camera), sortedActorIds: scene.sortedActorIds, sprites: { loaded: scene.library.loadedFrames, diagnostics: scene.library.diagnostics } }), project: (point: { x: number; y: number }) => groundToScreen(point, camera), performance: () => ({ frames: [...frames], cpu: [...cpu], projectileSamples: [...projectileSamples], visibleProjectileSamples: [...visibleProjectileSamples], frameCount }),
  ...(params.has('harness') ? { reset: restart, setBot: (kind?: BotKind) => { bot = kind; }, clearInput: () => input.clear(),
    setReferencePlayer: (enabled: boolean) => { referencePlayer = enabled; if (games && enabled) attachMageAI(games.player, runtime.games.referenceCompetence, games.state.tick); },
    runGamesTicks: (count: number) => { if (games) { for (let i = 0; i < count && games.phase === 'active'; i++) stepGames(games, referencePlayer ? undefined : input.frame()); lastEventIndex = games.state.events.length; } },
    startGames: startTiro, startRoster,
    // Explicit, paused visual fixtures for scale/occlusion screenshots; never enter ordinary play.
    visualFixture: (kind: 'scale' | 'depth' | 'aim', direction = 0) => {
      restart('magic'); paused = true; const { state, player } = training;
      state.actors = [player]; state.telegraphs = []; state.projectiles = [];
      if (kind === 'aim') {
        const target = addMage(state, 1, { x: player.pos.x + Math.cos(direction) * 9, y: player.pos.y + Math.sin(direction) * 9 }); target.dummy = true; training.dummy = target;
      } else if (kind === 'depth') {
        addMage(state, 1, { x: player.pos.x, y: player.pos.y - 0.6 });
        addMage(state, 1, { x: player.pos.x + 0.3, y: player.pos.y + 0.6 });
      } else {
        player.absorb = true; player.facing = { x: 0.7, y: -0.7 };
        for (const [id, x, y] of [['netter', -9, -6], ['shieldman', 10, -8], ['cinder_hound', -10, 7], ['slinger', 13, 8]] as const) addEnemy(state, id, { x: player.pos.x + x, y: player.pos.y + y });
        for (const [x, y] of [[-6, -3], [7, 7]]) state.telegraphs.push({ id: state.nextId++, activationId: state.nextId++, ownerId: state.actors[1]!.id, source: player.pos, origin: player.pos, target: { x: player.pos.x + x!, y: player.pos.y + y! }, startTick: 0, resolveTick: 60, damage: 0, family: 'unblockable', tier: 1, kind: 'area', widthM: 2, rangeM: 10, speedMps: 0 });
        spawnProjectile(state, { ownerId: player.id, activationId: state.nextId++, source: player.pos, damage: 0, family: 'magic', tier: 1 }, { x: player.pos.x + 5, y: player.pos.y - 5 }, { x: 1, y: -1 }, 8, 12);
        spawnProjectile(state, { ownerId: state.actors[1]!.id, activationId: state.nextId++, source: player.pos, damage: 0, family: 'physical', tier: 1 }, { x: player.pos.x - 5, y: player.pos.y + 4 }, { x: 1, y: -1 }, 8, 12);
      }
      camera = makeCamera(camera, player.pos, camera.zoom); render(1);
    },
    stepInput: (count: number) => { for (let i = 0; i < count; i++) stepArena(training.state, { [training.player.id]: input.frame() }); render(1); },
    panPlayer: (pos: { x: number; y: number }) => { training.player.pos = { ...pos }; training.player.previousPos = { ...pos }; render(1); }
  } : {}) };
Object.assign(window, { __arena: harness });
}
void main().catch(error => { console.error(error); document.querySelector('#app')!.textContent = `Arena could not start: ${String(error)}`; });
