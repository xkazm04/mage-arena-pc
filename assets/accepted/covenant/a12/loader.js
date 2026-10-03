/** Standalone A12 art consumer. Preprojected plates; no texture tiling or Y squash. */
export async function loadArenaPlates(root = new URL('../../../', import.meta.url)) {
  const json = async path => { const r = await fetch(new URL(path, root)); if (!r.ok) throw Error(path); return r.json(); };
  const manifest = await json('art/delivery/a12/arena-plates.json');
  const geometry = await json(manifest.geometry);
  const characters = await json('art/delivery/a10/characters.json');
  const effects = await json('art/delivery/a8/effects.json');
  const images = new Map();
  const loadImage = async path => {
    if (images.has(path)) return;
    const im = new Image(); im.src = new URL(path, root).href; await im.decode(); images.set(path, im);
  };
  await Promise.all([
    ...Object.values(manifest.palettes).flatMap(p => [p.file, ...p.occluders.map(o => o.file)]),
    ...characters.pages.map(p => p.file), ...effects.pages.map(p => p.file)
  ].map(loadImage));
  const charPages = Object.fromEntries(characters.pages.map(p => [p.id, images.get(p.file)]));
  const effectPages = Object.fromEntries(effects.pages.map(p => [p.id, images.get(p.file)]));
  const sine = Math.sin(55 * Math.PI / 180);
  const uvToWorld = uv => uv.map((v,i) => geometry.plate.worldTopLeftMetres[i] + v * geometry.plate.worldSizeMetres[i]);
  function clampCamera(centre) {
    return centre.map((v,i) => Math.max(geometry.camera.clamp_centre_metres[0][i], Math.min(geometry.camera.clamp_centre_metres[1][i], v)));
  }
  function followCamera(centre, player, dt, width, height) {
    const pp = 22.5 * height / 1080;
    const zone = geometry.camera.dead_zone_normalized;
    const excess = (d,lo,hi) => d < lo ? d-lo : d > hi ? d-hi : 0;
    const blend = 1-Math.exp(-Math.min(.05,dt)/geometry.camera.edge_follow_time_constant_seconds);
    return clampCamera([
      centre[0]+excess(player[0]-centre[0],(zone[0]-.5)*width/pp,(zone[2]-.5)*width/pp)*blend,
      centre[1]+excess(player[1]-centre[1],(zone[1]-.5)*height/(pp*sine),(zone[3]-.5)*height/(pp*sine))*blend
    ]);
  }
  function key(clip, timeMs) {
    const duration = clip.frames.reduce((a,f) => a+f.durationMs,0);
    let t = clip.loop ? Math.max(0,timeMs)%duration : Math.min(Math.max(0,timeMs),duration-1);
    for (const frame of clip.frames) { if (t < frame.durationMs) return frame; t -= frame.durationMs; }
    return clip.frames.at(-1);
  }
  function render(ctx, palette, camera, actors=[], fx=[], timeMs=0) {
    const p = manifest.palettes[palette]; if (!p) throw Error('Unknown palette');
    const {width,height} = camera;
    if (Math.abs(width/height-16/9)>.001) throw Error('A12 geometry currently specifies a 16:9 viewport');
    const centre=clampCamera(camera.centre), s=height/1080, pixelScale=height/1440;
    const screen = pos => [width/2+(pos[0]-centre[0])*22.5*s,height/2+(pos[1]-centre[1])*22.5*s*sine];
    const corner=screen(p.offsetWorldMetres), plateSize=p.size.map(v=>v*pixelScale);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    ctx.drawImage(images.get(p.file),corner[0],corner[1],...plateSize);
    const layers=[], missingClips=[];let drawnActors=0;
    for (const actor of actors) {
      const ent=characters.entities[actor.entity], clip=ent?.clips[actor.state]?.[actor.facing];
      if (!clip) { missingClips.push(`${actor.entity}:${actor.state}:${actor.facing}`);continue; }
      const pos=actor.positionMetres || uvToWorld(actor.footUV), foot=screen(pos), size=ent.designSize1080.map(v=>v*s);
      const frame=actor.frame === undefined ? key(clip,timeMs) : clip.frames[actor.frame%clip.frames.length];
      ctx.fillStyle='rgba(3,6,9,.35)';ctx.beginPath();ctx.ellipse(foot[0],foot[1],12*s,3*s,0,0,Math.PI*2);ctx.fill();
      layers.push({y:pos[1],draw(){
        ctx.save();ctx.translate(...foot);if(clip.mirrorX)ctx.scale(-1,1);
        ctx.drawImage(charPages[clip.page],...frame.rect,-size[0]*ent.anchor[0],-size[1]*ent.anchor[1],...size);ctx.restore();
      }});drawnActors++;
    }
    for (const o of p.occluders) {
      const foot=screen(o.baseWorldMetres);
      layers.push({y:o.baseWorldMetres[1],draw(){ctx.drawImage(images.get(o.file),foot[0]-o.anchorPx[0]*pixelScale,foot[1]-o.anchorPx[1]*pixelScale,o.size[0]*pixelScale,o.size[1]*pixelScale);}});
    }
    layers.sort((a,b)=>a.y-b.y).forEach(item=>item.draw());
    for (const item of fx) {
      const clip=effects.clips[item.clip];if(!clip)throw Error('Unknown effect '+item.clip);
      const frame=item.frame===undefined?key(clip,timeMs%700):clip.frames[item.frame%clip.frames.length];
      const size=clip.designSize1080.map(v=>v*s),foot=screen(item.positionMetres||uvToWorld(item.footUV));
      const anchor=clip.anchor||[.5,.5];ctx.globalCompositeOperation=clip.blend==='lighter'?'lighter':'source-over';
      ctx.drawImage(effectPages[clip.page],...frame.rect,foot[0]-size[0]*anchor[0],foot[1]-size[1]*anchor[1],...size);
    }
    ctx.restore();
    return {drawnActors,missingClips,centre,plateBounds:[...corner,...plateSize],characterNominalPx:40.5*s,ownerAccepted:false};
  }
  return {manifest,geometry,characters,effects,images,uvToWorld,clampCamera,followCamera,render};
}
