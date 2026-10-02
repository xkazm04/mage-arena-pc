import './style.css';
import './season-style.css';
import { mountCamp } from './camp-entry.ts';
import { mountArena, type ArenaDisposer } from './arena-entry.ts';
import { request, seasonCommand, type SeasonView } from './season-api.ts';
import { linkBout, type SeasonBout } from '@mage/core';

const root = document.querySelector<HTMLElement>('#app')!;
let dispose: (() => void) | undefined, arena: ArenaDisposer | undefined, routing = false;
const nav = document.createElement('nav'); nav.className = 'global-nav'; nav.setAttribute('aria-label', 'Season controls');
nav.innerHTML = '<button id="main-menu">Menu</button><button id="settings">Pause / controls · Esc</button>';
document.body.append(nav);
const settings = document.createElement('dialog'); settings.id = 'settings-dialog';
settings.innerHTML = `<p class="eyebrow">PAUSED / SETTINGS</p><h2>Your hands, your magic</h2>
<p><b>W A S D</b> move · <b>Mouse</b> aim at feet · <b>Left button</b> cast<br><b>Right button held</b> directional absorb · <b>Space</b> roll · <b>Shift</b> sprint<br><b>1–4 / wheel</b> choose spell slot · <b>View slider</b> camera zoom</p>
<p>Camp: click places and actions; Tab / Enter activate controls.<br>Listening: A / D or 1–3 choose cover, hold Space to listen.<br>Trial: choose a stance; brace beats press, feint beats brace, press beats feint.</p>
<label><input type="checkbox" id="sound-setting" checked> Perfect absorb bell</label>
<p id="save-status" role="status"></p><div class="menu-actions"><button id="save-season">Save season</button><button id="load-season">Load season</button><button id="resume-season" class="primary">Resume</button></div>`;
document.body.append(settings);
const status = (message: string) => { settings.querySelector('#save-status')!.textContent = message; };
const sound = settings.querySelector<HTMLInputElement>('#sound-setting')!;
sound.checked = localStorage.getItem('mage-sound') !== 'off'; sound.onchange = () => localStorage.setItem('mage-sound', sound.checked ? 'on' : 'off');
async function pause(value: boolean) {
  arena?.pause(true); await arena?.flush();
  await request('session'); await request('pause', { paused: value });
  arena?.pause(value);
}
async function showSettings() { if (settings.open) return; await pause(true); settings.showModal(); status(''); }
async function resume() { await pause(false); settings.close(); root.querySelector<HTMLCanvasElement>('canvas')?.focus(); }
settings.querySelector<HTMLButtonElement>('#resume-season')!.onclick = () => void resume().catch(e => status(String(e)));
settings.addEventListener('cancel', e => { e.preventDefault(); void resume(); });
nav.querySelector<HTMLButtonElement>('#settings')!.onclick = () => void showSettings().catch(e => status(String(e)));
nav.querySelector<HTMLButtonElement>('#main-menu')!.onclick = () => void navigate('/');
window.addEventListener('keydown', e => { if (e.code === 'Escape' && !document.querySelector('dialog[open]')) { e.preventDefault(); void showSettings(); } });
settings.querySelector<HTMLButtonElement>('#save-season')!.onclick = () => { void request('save', {}).then(() => status('Season saved.')).catch(e => status(String(e))); };
settings.querySelector<HTMLButtonElement>('#load-season')!.onclick = () => { void request('load', {}).then(async () => { settings.close(); await navigate('/camp'); }).catch(e => status(String(e))); };

function menu() {
  root.innerHTML = '<main class="main-menu"><p class="eyebrow">MAGE ARENA</p><h1>Beyond the closed grille</h1><p>Six weeks beneath the collar. Two weeks to find your feet.</p><div class="menu-actions"><button id="pick-character" class="primary">Choose your mage</button><button id="continue-season">Continue season</button><button id="training-arena">Training arena</button></div><p>Water is playable in this chapter. Fire, Earth and Air share the camp as allies and rivals.</p><p class="menu-note">Tiro Games · mouse and keyboard · procedural figure placeholders</p></main>';
  root.querySelector<HTMLButtonElement>('#pick-character')!.onclick = () => void pick();
  root.querySelector<HTMLButtonElement>('#continue-season')!.onclick = () => void navigate('/camp');
  root.querySelector<HTMLButtonElement>('#training-arena')!.onclick = () => void navigate('/training');
}
async function pick() {
  const view = await request<SeasonView>('session');
  root.innerHTML = '<main class="main-menu"><p class="eyebrow">THE FOUR BOUND TOGETHER</p><h1>Choose your mage</h1><div class="character-picks"></div><p>The other three live alongside you in the camp. Their playable schools arrive in a later chapter.</p></main>';
  for (const ally of view.season.allies) {
    const card = document.createElement('article'); card.className = `character ${ally.school}`;
    const title = document.createElement('h2'); title.textContent = ally.name;
    const label = document.createElement('p'); label.textContent = ally.school.toUpperCase();
    const b = document.createElement('button'); b.disabled = ally.school !== 'water'; b.textContent = b.disabled ? 'Camp ally' : 'Play Water · Cassia'; b.id = `choose-${ally.school}`;
    b.onclick = () => void navigate('/camp'); card.append(title, label, b); root.querySelector('.character-picks')!.append(card);
  }
}
async function navigate(path: string) {
  if (routing) return; routing = true;
  try {
    arena?.pause(true); await arena?.flush(); dispose?.(); dispose = undefined; arena = undefined;
    root.replaceChildren(); history.replaceState(null, '', `${path}${location.search}`);
    if (path === '/') { await request('session'); await request('pause', { paused: true }); menu(); return; }
    await request('session'); await request('pause', { paused: false });
    const view = await request<SeasonView>('session');
    if (path === '/training') { arena = await mountArena(root); dispose = arena; }
    else if (view.season.bout) {
      if (view.season.bout.phase === 'prepared') await seasonCommand({ type: 'start' });
      const bout = linkBout(await request<SeasonBout>('bout'));
      arena = await mountArena(root, { bout,
        send: (entries, hash) => request('bout-input', { id: bout.id, entries, hash }),
        finish: async () => { await seasonCommand({ type: 'receive' }); await navigate('/camp'); },
      }); dispose = arena;
    } else dispose = await mountCamp(root, () => { void navigate('/arena'); });
  } catch (e) { console.error(e); root.textContent = `The scene could not open: ${String(e)}`; }
  finally { routing = false; }
}
void navigate(location.pathname);
window.addEventListener('pagehide', () => dispose?.());
