import { Application, Graphics } from 'pixi.js';
import { combat, createTraining, FixedStepper, runtime, seconds, stepTraining, timingBot, type TrainingKind, type BotKind } from '@mage-arena/core/arena';
import { ArenaInput } from './input';
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
let lastPerfect = -1e9, lastEventIndex = 0, audio: AudioContext | undefined;
const frames: number[] = [], cpu: number[] = []; let frameCount = 0;
const params = new URLSearchParams(location.search);
if (params.has('scenario')) training = createTraining(params.get('scenario') as TrainingKind);
document.querySelector<HTMLSelectElement>('#scenario')!.value = training.kind;
function restart(kind = training.kind): void {
  training = createTraining(kind); clock = new FixedStepper(); input.clear(); lastPerfect = -1e9; lastEventIndex = 0; paused = false;
  document.querySelector('#pause')!.textContent = 'Pause';
}
document.querySelector('#restart')!.addEventListener('click', () => restart());
document.querySelector<HTMLSelectElement>('#scenario')!.addEventListener('change', e => restart((e.target as HTMLSelectElement).value as TrainingKind));
document.querySelector('#pause')!.addEventListener('click', () => { paused = !paused; input.clear(); document.querySelector('#pause')!.textContent = paused ? 'Resume' : 'Pause'; });
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
    if (t.kind === 'lane') {
      const angle = Math.atan2(t.target.y - t.origin.y, t.target.x - t.origin.x), dx = Math.cos(angle), dy = Math.sin(angle), w = t.widthM * scale / 2;
      const ex = x + dx * t.rangeM * scale, ey = y + dy * t.rangeM * scale;
      g.poly([x - dy * w, y + dx * w, ex - dy * w, ey + dx * w, ex + dy * w, ey - dx * w, x + dy * w, y - dx * w]).fill({ color: 0x181219, alpha: 0.8 }).stroke({ width: 2, color: color(t.family), alpha: 0.5 + progress / 2 });
    }
    g.circle(x, y, 18 + (1 - progress) * 27).stroke({ color: color(t.family), width: 2 });
  }
  for (const p of state.projectiles) {
    const x = (p.previousPos.x + (p.pos.x - p.previousPos.x) * alpha) * scale, y = (p.previousPos.y + (p.pos.y - p.previousPos.y) * alpha) * scale;
    g.circle(x, y, p.radius * scale + 5).fill({ color: color(p.family), alpha: 0.12 });
    g.circle(x, y, p.radius * scale).fill(color(p.family));
  }
  for (const a of state.actors) {
    const x = (a.previousPos.x + (a.pos.x - a.previousPos.x) * alpha) * scale, y = (a.previousPos.y + (a.pos.y - a.previousPos.y) * alpha) * scale;
    g.ellipse(x, y + 10, 19, 8).fill({ color: 0x080f15, alpha: 0.5 });
    if (a.dummy) g.poly([x, y - 20, x + 15, y, x, y + 20, x - 15, y]).fill(a.down ? 0x3c4347 : 0xad8460).stroke({ width: 2, color: 0xe1ba80 });
    else {
      g.circle(x, y, a.radius * scale).fill(a.down ? 0x536167 : 0x68b9d0).stroke({ width: 2, color: 0xbbeaf0 });
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
  document.querySelector('#clock')!.textContent = `COLLAR ${['', 'I', 'II', 'III', 'IV'][player.tier]} · ${seconds(state.tick).toFixed(1)} s`;
  const nextTier = (player.tier + 1) as 2 | 3 | 4;
  const until = nextTier <= 4 ? Math.max(combat.tierClock.unlockAtSeconds[nextTier] - seconds(state.tick - player.waveStartTick + player.clockAdvanceTicks), combat.tierClock.minimumSecondsBetweenUnlocks - seconds(state.tick - player.lastUnlockTick), 0) : 0;
  document.querySelector('#clock-detail')!.textContent = `${nextTier <= 4 ? `Next rune in ${until.toFixed(1)} s · ` : ''}${player.metrics.perfects} perfect absorbs`;
  for (const b of document.querySelectorAll<HTMLElement>('[data-slot]')) b.classList.toggle('active', Number(b.dataset.slot) === input.slot);
  document.querySelector('#message')!.innerHTML = player.down ? 'MISSIO<small>The crowd grants your life. Restart to train again.</small>' : paused ? 'PAUSED' : seconds(state.tick - lastPerfect) < runtime.presentation.perfectFlashS ? 'PERFECT' : '';
}
let previous = performance.now();
function frame(now: number): void {
  const elapsed = (now - previous) / 1000; previous = now; const start = performance.now();
  let alpha = 1;
  if (!paused && !training.player.down && !document.hidden) alpha = clock.advance(elapsed, () => {
    stepTraining(training, bot ? timingBot(training, bot) : input.frame());
    for (const event of training.state.events.slice(lastEventIndex)) if (event.kind === 'perfect' && event.actorId === training.player.id) { lastPerfect = event.tick; bell(); }
    lastEventIndex = training.state.events.length;
  });
  render(alpha);
  if (frameCount++ >= runtime.presentation.performanceWarmupFrames) { frames.push(elapsed * 1000); cpu.push(performance.now() - start); if (frames.length > runtime.presentation.performanceFrames) { frames.shift(); cpu.shift(); } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Harness access is read-only in ordinary play and only exposes mutations with ?harness=1.
const harness = { snapshot: () => ({ state: training.state, player: training.player, slot: input.slot, paused, projectiles: training.state.projectiles.length }), performance: () => ({ frames: [...frames], cpu: [...cpu], frameCount }),
  ...(params.has('harness') ? { reset: restart, setBot: (kind?: BotKind) => { bot = kind; }, clearInput: () => input.clear() } : {}) };
Object.assign(window, { __arena: harness });
}
void main().catch(error => { console.error(error); document.querySelector('#app')!.textContent = `Arena could not start: ${String(error)}`; });
