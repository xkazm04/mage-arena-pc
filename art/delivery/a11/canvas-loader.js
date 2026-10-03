/** A11 art consumer. The game supplies day progress and phase transitions. */
export async function loadDailyArt(repositoryRoot) {
  const root = new URL(repositoryRoot, location.href);
  const response = await fetch(new URL('art/ui/kit.json', root));
  if (!response.ok) throw new Error('Missing Covenant UI manifest');
  const kit = await response.json();
  if (kit.schemaVersion !== 1) throw new Error('Unsupported UI schema');
  const page = kit.pages.find(p => p.id === 'daily-stats');
  if (!page) throw new Error('Missing daily-stats page');
  const data = await fetch(new URL(`art/ui/${page.file}`, root));
  if (!data.ok) throw new Error('Missing daily-stats texture');
  const bytes = await data.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(v => v.toString(16).padStart(2, '0')).join('');
  if (hash !== page.sha256) throw new Error('Daily atlas hash mismatch');
  const image = await createImageBitmap(new Blob([bytes], {type:'image/png'}));
  if (image.width !== page.size[0] || image.height !== page.size[1]) throw new Error('Daily atlas dimensions');
  return {kit, image};
}

export function clockState(progress, phaseFrom, phaseTo = phaseFrom, phaseMix = 0) {
  if (![progress, phaseMix].every(Number.isFinite)) throw new Error('Non-finite clock state');
  const phases = ['dawn','midday','dusk','night'];
  if (!phases.includes(phaseFrom) || !phases.includes(phaseTo)) throw new Error('Unknown clock phase');
  const fraction = Math.max(0, Math.min(1, progress));
  return {fraction, angle:fraction * Math.PI * 2, cut:307 + fraction * 104,
    meniscusScale:Math.max(.10, Math.sqrt(Math.max(0, 1-fraction*fraction))),
    phaseFrom, phaseTo, phaseMix:Math.max(0, Math.min(1, phaseMix))};
}

export function drawStat(ctx, art, stat, variant, x, y, size) {
  const id = `icon.stat.${stat}.${variant}`, r = art.kit.regions[id];
  if (!r || r.page !== 'daily-stats') throw new Error(`Missing stat region ${id}`);
  if (!Number.isFinite(size) || size <= 0) throw new Error('Invalid stat size');
  ctx.drawImage(art.image, ...r.rect, x-size*r.anchor[0], y-size*r.anchor[1], size, size);
}

export function drawDailyClock(ctx, art, state, x, y, size, options={}) {
  if (![x,y,size].every(Number.isFinite) || size <= 0) throw new Error('Invalid clock geometry');
  const s = clockState(state.fraction, state.phaseFrom, state.phaseTo, state.phaseMix);
  const layers=art.kit.components.dailyClock.layers;
  function draw(name) {
    if (options.hide?.includes(name)) return;
    const r=art.kit.regions[layers[name]];
    if (!r || r.page !== 'daily-stats') throw new Error(`Missing daily layer ${name}`);
    ctx.drawImage(art.image, ...r.rect, 0, 0, 512, 512);
  }
  ctx.save();
  try {
    ctx.translate(x-size/2,y-size/2);ctx.scale(size/512,size/512);
    ctx.globalCompositeOperation='source-over';
    draw('face.'+s.phaseFrom);
    if (s.phaseMix > 0) {ctx.save();ctx.globalAlpha*=s.phaseMix;draw('face.'+s.phaseTo);ctx.restore()}
    draw('basin');
    ctx.save();ctx.beginPath();ctx.rect(103,s.cut,306,Math.max(0,411-s.cut));ctx.clip();draw('water');ctx.restore();
    if (s.fraction < .995 && !options.hide?.includes('meniscus')) {
      const r=art.kit.regions[layers.meniscus], [rx,ry]=r.rect;
      const w=312*s.meniscusScale;
      ctx.drawImage(art.image,rx+100,ry+290,312,31,256-w/2,s.cut-17,w,31);
    }
    if (!options.reducedMotion) {ctx.save();ctx.globalAlpha*=.72 + .15*Math.sin((options.elapsedMs||0)/1300);draw('mist');ctx.restore()}
    draw('glass');draw('rim');draw('ticks');
    ctx.save();ctx.translate(256,256);ctx.rotate(s.angle);ctx.translate(-256,-256);draw('pointer');ctx.restore();
  } finally {ctx.restore()}
}
