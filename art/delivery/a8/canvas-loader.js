/** Reference Canvas 2D consumer; game state, geometry and timing stay external. */
export async function loadEffects(repositoryRoot) {
  const root = new URL(repositoryRoot, location.href);
  const manifest = await (await fetch(new URL('art/delivery/a8/effects.json', root))).json();
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported effects schema');
  const pages = new Map();
  for (const page of manifest.pages) {
    const response = await fetch(new URL(page.file, root));
    if (!response.ok) throw new Error(`Missing atlas ${page.id}`);
    const bytes = await response.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(x => x.toString(16).padStart(2, '0')).join('');
    if (hash !== page.sha256) throw new Error(`Atlas hash mismatch: ${page.id}`);
    pages.set(page.id, await createImageBitmap(new Blob([bytes], { type: 'image/png' })));
  }
  return { manifest, pages };
}

export function frameAt(clip, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const total = clip.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
  if (!clip.loop && elapsedMs >= total) return null;
  let time = clip.loop ? elapsedMs % total : elapsedMs;
  for (const frame of clip.frames) {
    if (time < frame.durationMs) return frame;
    time -= frame.durationMs;
  }
  return null;
}

export function drawEffect(ctx, art, id, elapsedMs, x, y, scale = 1, opacity = 1) {
  const clip = art.manifest.clips[id];
  if (!clip) throw new Error(`Missing effect clip ${id}`);
  const frame = frameAt(clip, elapsedMs);
  if (!frame) return false;
  const [width, height] = clip.designSize1080.map(value => value * scale);
  ctx.save();
  ctx.globalCompositeOperation = clip.blend;
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.drawImage(art.pages.get(clip.page), ...frame.rect,
    x - width * clip.anchor[0], y - height * clip.anchor[1], width, height);
  ctx.restore();
  return true;
}

/** Apply before drawEffect(..., x=0,y=0). Balanced restore is the caller's job.
 * Only for already projected ground effects, never upright actor bodies. */
export function orientGroundEffect(ctx, x, y, worldAimRadians, elevationDegrees = 55) {
  const squash = Math.sin(elevationDegrees * Math.PI / 180);
  ctx.translate(x, y);
  ctx.scale(1, squash);
  ctx.rotate(worldAimRadians);
  ctx.scale(1, 1 / squash);
}
