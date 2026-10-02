import { bridgeRules } from '@mage/core';
import { compositionScreen } from './composition.ts';
import { seasonCommand, type SeasonView } from './season-api.ts';

export function seasonPanel(host: HTMLElement, view: SeasonView, refresh: (view: SeasonView) => void, arena: () => void) {
  const state = view.season;
  if (!state) return;
  const panel = document.createElement('section'); panel.className = 'season-gate'; host.prepend(panel);
  const error = (e: unknown) => { const p = document.createElement('p'); p.setAttribute('role', 'alert'); p.textContent = String(e); panel.append(p); };
  const action = (label: string, id: string, run: () => Promise<void>) => { const b = document.createElement('button'); b.id = id; b.className = 'primary'; b.textContent = label; b.onclick = () => { b.disabled = true; void run().catch(error).finally(() => { b.disabled = false; }); }; panel.append(b); };
  if (state.complete) { panel.innerHTML = '<h2>Two weeks survived</h2><p>The Tide has a place in the camp. Your board and journal remember the path here.</p><p>This chapter ends here. Later Games tiers await another chapter.</p>'; return; }
  if (state.bout) { action('Return to the arena', 'enter-arena', async () => arena()); return; }
  const trial = state.trial;
  if (state.due === 'trial') {
    panel.innerHTML = '<p class="eyebrow">GAMES EVE / TENT TRIAL</p><h2>Who carries the Tide?</h2><p>Unarmed, best of three exchanges. Read the rival: brace beats press, feint beats brace, press beats feint. Each choice costs stamina. The elder weighs the bout, favour, and renown.</p>';
    if (trial?.day === view.day.day) {
      const detail = document.createElement('p'); detail.textContent = `${trial.rivalName} · ${trial.score.join(' : ')} exchanges · stamina ${trial.stamina.join(' / ')}`; panel.append(detail);
      if (trial.phase === 'active') {
        const tell = document.createElement('p'); tell.className = 'trial-tell'; tell.textContent = `Their stance: ${trial.tell}`; panel.append(tell);
        for (const stance of bridgeRules.trial.stances) action(`${stance} · ${bridgeRules.trial.costs[stance as keyof typeof bridgeRules.trial.costs]} stamina`, `trial-${stance}`, async () => refresh(await seasonCommand({ type: 'exchange', stance: stance as 'press' | 'brace' | 'feint' })));
      } else {
        const result = document.createElement('p'); result.textContent = `${trial.entrantName} is selected. ${trial.weights?.map(n => n.toFixed(3)).join(' / ')} weighted score.`; panel.append(result);
        action('Accept the Trial and return to camp', 'receive-trial', async () => refresh(await seasonCommand({ type: 'receive-trial' })));
      }
    } else if (view.location === 'pit') action('Step into the Tent Trial', 'start-trial', async () => refresh(await seasonCommand({ type: 'trial' })));
    else { const p = document.createElement('p'); p.textContent = 'Travel to the Pit to take your place. If your time is spent, the Vigil will escort you to the summons.'; panel.append(p); action('Answer the Trial summons', 'escort-trial', async () => refresh(await seasonCommand({ type: 'escort-trial' }))); }
  } else if (state.due === 'games') {
    panel.innerHTML = '<p class="eyebrow">GAMES DAY / TIRO</p><h2>The first gate opens</h2><p>Four bouts: soldiers, creatures, and two Water mage opponents. Both weeks use Tiro; higher Games tiers are not yet available.</p>';
    action('Compose and enter the Games', 'prepare-games', async () => {
      const shell = document.createElement('div'); shell.className = 'arena-root'; host.append(shell);
      const composer = compositionScreen(choice => {
        void seasonCommand({ type: 'prepare', composition: choice }).then(() => seasonCommand({ type: 'start' })).then(() => { composer.dispose(); shell.remove(); arena(); }).catch(e => { composer.dispose(); shell.remove(); error(e); });
      }, paused => { if (!paused) { composer.dispose(); shell.remove(); } }, shell);
      composer.open('Enter season Games');
    });
  }
}
