/** Additive A10 schema consumer. All drawing is at D32 scale v3 by default. */
import {bodyFrameAt, facingFromVelocity} from '../a10/canvas-loader.js';
export {bodyFrameAt, facingFromVelocity};

export function mergeCharacters(base, patch) {
  if(base.schemaVersion!==1 || patch.schemaVersion!==1) throw Error('Unsupported character schema');
  const merged=structuredClone(base);
  const pageIds=new Set(merged.pages.map(p=>p.id));
  for(const p of patch.pages) {
    if(pageIds.has(p.id)) throw Error(`Duplicate atlas id ${p.id}`);
    merged.pages.push(structuredClone(p));pageIds.add(p.id);
  }
  for(const body of Object.values(merged.entities)) {
    for(const dirs of Object.values(body.clips)) for(const clip of Object.values(dirs)) {
      clip.anchor??=body.anchor;
      clip.designSize1080??=body.designSize1080.map(v=>v*1.5);
    }
  }
  for(const [id, body] of Object.entries(patch.entities)) {
    const target=merged.entities[id]??={...structuredClone(body),clips:{}};
    for(const [state,dirs] of Object.entries(body.clips)) {
      target.clips[state]??={};
      for(const [direction,clip] of Object.entries(dirs)) {
        target.clips[state][direction]={...structuredClone(clip),anchor:clip.anchor??body.anchor,designSize1080:body.designSize1080};
      }
    }
    // Legacy 'hit' receives the short reaction; explicit heavy remains separate.
    target.clips.hit={...target.clips.hit,...target.clips['hit-light']};
  }
  merged.id='covenant-characters-a10-plus-a14';
  merged.backlog=base.backlog.filter(id=>{const [e,s,d]=id.split(':');return !merged.entities[e]?.clips[s]?.[d]});
  merged.a14Backlog=patch.backlog;
  merged.a14Coverage=Object.fromEntries(Object.entries(patch.entities).map(([e,b])=>[e,Object.fromEntries(Object.entries(b.clips).map(([s,d])=>[s,Object.keys(d)]))]));
  return merged;
}

export async function loadCharacters(repositoryRoot) {
  const root=new URL(repositoryRoot,location.href);
  const get=async path=>{const r=await fetch(new URL(path,root));if(!r.ok)throw Error(`Missing ${path}`);return r.json()};
  const [base,patch]=await Promise.all([get('art/delivery/a10/characters.json'),get('art/delivery/a14/characters.json')]);
  const manifest=mergeCharacters(base,patch),pages=new Map();
  for(const page of manifest.pages) {
    const r=await fetch(new URL(page.file,root));if(!r.ok)throw Error(`Missing ${page.file}`);
    const bytes=await r.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==page.sha256)throw Error(`Atlas hash mismatch ${page.id}`);
    pages.set(page.id,await createImageBitmap(new Blob([bytes],{type:'image/png'})));
  }
  return {manifest,pages};
}

export function drawCharacter(ctx,art,entity,state,facing,elapsedMs,x,y,scale=1) {
  const body=art.manifest.entities[entity],clip=body?.clips[state]?.[facing];
  const frame=bodyFrameAt(clip,elapsedMs);if(!frame)return false;
  const [w,h]=(clip.designSize1080??body.designSize1080).map(v=>v*scale);
  const anchor=frame.anchor??clip.anchor??body.anchor;
  ctx.save();ctx.translate(x,y);if(clip.mirrorX)ctx.scale(-1,1);
  ctx.globalCompositeOperation='source-over';
  ctx.drawImage(art.pages.get(clip.page),...frame.rect,-w*anchor[0],-h*anchor[1],w,h);
  ctx.restore();return true;
}
