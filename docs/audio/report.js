// Offline review only. No network, no generator, no automatic owner choices.
(() => {
  const key = 'mage-arena.audio.au1.r1.v1';
  const status = document.getElementById('status');
  let state = { choices: {}, theme: 'system' };
  let storageOk = true;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && typeof saved === 'object' && saved.choices && typeof saved.choices === 'object') state = saved;
  } catch { storageOk = false; }
  const message = text => { if (status) status.textContent = text; };
  const save = () => {
    try { localStorage.setItem(key, JSON.stringify(state)); storageOk = true; }
    catch { storageOk = false; }
    message(storageOk ? 'Saved in this browser. Export before moving the report.' : 'Browser storage unavailable. Copy the Markdown to preserve your notes.');
  };
  const theme = document.getElementById('theme');
  const setTheme = () => {
    document.documentElement.dataset.theme = state.theme === 'light' || state.theme === 'dark' ? state.theme : 'system';
    if (theme) theme.value = state.theme;
  };
  setTheme();
  theme?.addEventListener('change', () => { state.theme = theme.value; setTheme(); save(); });
  document.querySelectorAll('[data-direction]').forEach(card => {
    const id = card.dataset.direction, stored = state.choices[id] || {};
    card.querySelectorAll('input[type=radio]').forEach(radio => {
      radio.checked = radio.value === stored.pick;
      radio.addEventListener('change', () => { state.choices[id] = { ...state.choices[id], pick: radio.value }; save(); });
    });
    const note = card.querySelector('textarea');
    if (note) { note.value = stored.note || ''; note.addEventListener('input', () => { state.choices[id] = { ...state.choices[id], note: note.value }; save(); }); }
  });
  // Files remain raw. Only playback gain changes. One clip at a time for comparisons.
  const players = [...document.querySelectorAll('audio')];
  const matched = document.getElementById('matched');
  const applyGain = () => players.forEach(player => { player.volume = matched?.checked === false ? 1 : Math.pow(10, Number(player.dataset.gain || -10) / 20); });
  applyGain(); matched?.addEventListener('change', applyGain);
  players.forEach(player => {
    player.addEventListener('play', () => players.forEach(other => { if (other !== player) other.pause(); }));
    player.addEventListener('error', () => message('An audio file could not load. Keep the report and its sample folders together.'));
  });
  document.querySelectorAll('[data-loop-target]').forEach(button => button.addEventListener('click', () => {
    const player = document.getElementById(button.dataset.loopTarget);
    player.loop = !player.loop;
    button.textContent = player.loop ? 'Repeat on — listen across 3 passes' : 'Repeat for seam listening';
    button.setAttribute('aria-pressed', String(player.loop));
  }));
  const escapeCell = value => String(value || '').replaceAll('|', '\\|').replace(/\r?\n/g, '<br>').replaceAll('<script', '&lt;script');
  const exportText = () => {
    const lines = ['## AU1 round 1 — owner triage', '', 'Only two proof samples were generated before the billing latch. Unrendered directions remain unjudged.', '', '| Theme / direction | Pick | Samples | Owner note |', '|---|---|---|---|'];
    document.querySelectorAll('[data-direction]').forEach(card => {
      const choice = state.choices[card.dataset.direction] || {};
      if (!choice.pick && !choice.note) return;
      lines.push(`| ${escapeCell(card.dataset.label)} | ${escapeCell(choice.pick || 'not picked')} | ${escapeCell(card.dataset.samples)} | ${escapeCell(choice.note)} |`);
    });
    if (lines.length === 6) lines.push('| No directions reviewed | not picked | | |');
    return lines.join('\n') + '\n';
  };
  document.getElementById('copy')?.addEventListener('click', async () => {
    const output = document.getElementById('export');
    output.value = exportText();
    output.focus(); output.select();
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(output.value); copied = true; } } catch {}
    if (!copied) { try { copied = document.execCommand('copy'); } catch {} }
    message(copied ? 'Markdown copied. Paste into docs/audio/CHOICES.md.' : 'Markdown is selected below. Press Ctrl+C or use your browser copy command.');
  });
  document.getElementById('refresh-export')?.addEventListener('click', () => { document.getElementById('export').value = exportText(); });
  if (!storageOk) message('Browser storage unavailable. Export your notes before closing.');
})();
