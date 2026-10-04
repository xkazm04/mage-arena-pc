// Offline review only. No network, no generator, no automatic owner choices.
(() => {
  const round = document.body.dataset.round || 'r1';
  const key = `mage-arena.audio.${round === 'r4' ? 'au3.r4' : round === 'r3' ? 'au2b.r3' : round === 'r2' ? 'au2.r2' : 'au1.r1'}.v1`;
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
  // Review never edits referenced files. Only playback gain changes; one clip at a time.
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
    const title = round === 'r4' ? '## AU3 round 4 — owner full-track triage' : round === 'r3' ? '## AU2b round 3 — owner triage' : round === 'r2' ? '## AU2 round 2 — owner triage' : '## AU1 round 1 — owner triage';
    const description = round === 'r4' ? 'Full arena scores and offline edits; 10,000-credit job cap and 1,000-credit account floor. Round-1/2 keeps remain authoritative. Blank choices are unreviewed. Adaptive musical gates are separate from the file and loudness checks.' : round === 'r3' ? 'Rejected-category refinements; separate 3,000-credit cap, 13,000 shared-account floor and 8,000 reserve. References retain the owner’s round-1/2 choices. New picks judge directions, not production readiness.' : round === 'r2' ? 'Refinement of the owner’s round-1 choices; separate 5,000-credit cap. Reference keeps remain in CHOICES.md; these picks judge new directions only. Keep is a direction choice, not production approval.' : 'Smaller audition: 15 samples generated before a provider 429 stop; 4,000-credit cap. Unrendered directions remain unjudged.';
    const lines = [title, '', description, '', '| Theme / direction | Pick | Samples | Owner note |', '|---|---|---|---|'];
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
