/** Upright, direction-aware body consumer. Mechanics and movement stay external. */
export async function loadCharacters(repositoryRoot) {
  const root = new URL(repositoryRoot, location.href);
  const response = await fetch(new URL('art/delivery/a10/characters.json', root));
  if (!response.ok) throw new Error('Missing character manifest');
  const manifest = await response.json();
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported character schema');
  const pages = new Map();
  for (const page of manifest.pages) {
    const response = await fetch(new URL(page.file, root));
    if (!response.ok) throw new Error(`Missing body atlas ${page.id}`);
    const bytes = await response.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(x => x.toString(16).padStart(2, '0')).join('');
    if (hash !== page.sha256) throw new Error(`Body atlas hash mismatch: ${page.id}`);
    pages.set(page.id, await createImageBitmap(new Blob([bytes], {type: 'image/png'})));
  }
  return {manifest, pages};
}

export function facingFromVelocity(dx, dy, previous = 'se') {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('Non-finite velocity');
  if (Math.abs(dx) + Math.abs(dy) < 1e-6) return previous;
  const horizontal=Math.abs(dx)<1e-6?previous[1]:(dx>0?'e':'w');
  const vertical=Math.abs(dy)<1e-6?previous[0]:(dy>0?'s':'n');
  return vertical+horizontal;
}

export function bodyFrameAt(clip, elapsedMs) {
  if (!clip || !Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const total = clip.frames.reduce((sum, f) => sum + f.durationMs, 0);
  if (!total) return null;
  // Non-looping poses hold their final key; the engine owns state transitions.
  let t = clip.loop ? elapsedMs % total : Math.min(elapsedMs, total - 0.001);
  for (const frame of clip.frames) {
    if (t < frame.durationMs) return frame;
    t -= frame.durationMs;
  }
  return null;
}

export function drawCharacter(ctx, art, entity, state, facing, elapsedMs, x, y, scale = 1) {
  const body = art.manifest.entities[entity];
  const clip = body?.clips[state]?.[facing];
  const frame = bodyFrameAt(clip, elapsedMs);
  if (!frame) return false; // Explicit missing clip; never invent a rotated still.
  const [w, h] = body.designSize1080.map(v => v * scale);
  ctx.save();ctx.translate(x, y);
  if (clip.mirrorX) ctx.scale(-1, 1);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(art.pages.get(clip.page), ...frame.rect, -w * body.anchor[0], -h * body.anchor[1], w, h);
  ctx.restore();return true;
}
