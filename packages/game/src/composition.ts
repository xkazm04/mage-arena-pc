import { combat, presets, spells, validateComposition, waterLines, type Composition } from '@mage/core/arena';
export function compositionScreen(onStart: (composition: Composition) => void, onPause: (paused: boolean) => void, root: HTMLElement = document.body): { open: (label?: string) => void; dispose: () => void } {
  let choice = structuredClone(presets[0]!);
  let startLabel = 'Enter practice';
  const dialog = document.createElement('dialog'); dialog.id = 'composition'; dialog.className = 'composition'; root.append(dialog);
  function render(): void {
    const errors = validateComposition(choice);
    dialog.innerHTML = `<div class="eyebrow">Before the collar opens</div><h2>Compose your Water</h2><p>Bring three lines. Each grows in place as the collar unlocks. Rain Needle is always yours.</p>
    <div class="preset-row">${presets.map((p, i) => `<button data-preset="${i}" class="${choice.name === p.name ? 'chosen' : ''}">${p.name}</button>`).join('')}</div>
    <div class="line-picks">${choice.lines.map((line, i) => `<label>Slot ${i + 2}<select data-line="${i}">${waterLines.map(l => `<option value="${l}" ${line === l ? 'selected' : ''}>${l.replace('_', ' ')}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="branch-picks">${(['lash','mirror','tide_orb'] as const).filter(l => choice.lines.includes(l)).map(line => `<label>${line.replace('_', ' ')} branch<select data-branch="${line}">${spells.filter(s => s.line === line && s.branch).map(s => `<option value="${s.branch}" ${s.branch === choice.branches[line] ? 'selected' : ''}>${s.branch} · ${s.name}</option>`).join('')}</select></label>`).join('')}</div>
    <table class="curve"><thead><tr><th>Line</th>${Object.values(combat.tierClock.unlockAtSeconds).map((s, i) => `<th>${['I','II','III','IV'][i]}<small>${s} s</small></th>`).join('')}</tr></thead><tbody>${choice.lines.map(line => `<tr><th>${line.replace('_', ' ')}</th>${[1,2,3,4].map(tier => { const s = spells.find(s => s.line === line && s.tier === tier && (!s.branch || choice.branches[line as keyof typeof choice.branches] === s.branch))!; return `<td>${s.name}<small>${s.kind === 'passive' ? 'Passive counter' : `${s.mana} mana · ${s.cooldownS} s cooldown`}</small></td>`; }).join('')}</tr>`).join('')}</tbody></table>
    <div class="flow-explainer"><b>Flow rewards alternation.</b> Change lines quickly to build Flow. At ${combat.flow.max}, the next spell is a free Crest. A perfect absorb adds Flow and opens the next collar rune sooner.</div>
    <p id="composition-error" role="status">${errors.join(' ')}</p><div class="composition-actions"><button id="composition-cancel">Back</button><button id="composition-start" class="primary" ${errors.length ? 'disabled' : ''}>${startLabel}</button></div>`;
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-preset]')) button.onclick = () => { choice = structuredClone(presets[Number(button.dataset.preset)]!); render(); };
    for (const select of dialog.querySelectorAll<HTMLSelectElement>('[data-line]')) select.onchange = () => { choice.lines[Number(select.dataset.line)] = select.value as typeof choice.lines[number]; choice.name = 'Custom'; render(); };
    for (const select of dialog.querySelectorAll<HTMLSelectElement>('[data-branch]')) select.onchange = () => { choice.branches[select.dataset.branch as keyof typeof choice.branches] = select.value as 'A' | 'B'; choice.name = 'Custom'; render(); };
    dialog.querySelector<HTMLButtonElement>('#composition-cancel')!.onclick = () => { dialog.close(); onPause(false); };
    dialog.querySelector<HTMLButtonElement>('#composition-start')!.onclick = () => { if (validateComposition(choice).length) return; dialog.close(); onStart(structuredClone(choice)); };
  }
  dialog.addEventListener('cancel', () => onPause(false));
  return { dispose: () => dialog.remove(), open(label = 'Enter practice') { startLabel = label; render(); onPause(true); dialog.showModal(); } };
}
