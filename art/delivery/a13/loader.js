/** A13 standalone Canvas reference consumer. No combat rules or timer ownership. */
export const groundSine = Math.sin(55 * Math.PI / 180);
export function sampleClip(clip, timeMs) {
  if (!Number.isFinite(timeMs)) throw Error('Finite animation time required');
  const duration = clip.frames.reduce((s, f) => s + f.durationMs, 0);
  if (!clip.loop && (timeMs < 0 || timeMs >= duration)) return null;
  let t = clip.loop ? ((timeMs % duration) + duration) % duration : timeMs;
  for (let i = 0; i < clip.frames.length; i++) {
    const f = clip.frames[i];
    if (t < f.durationMs) return {index:i, frame:f, fraction:t/f.durationMs, duration};
    t -= f.durationMs;
  }
  return null;
}
const canvas = (w,h=w) => { const c=document.createElement('canvas');c.width=w;c.height=h;return c; };
const clamp = x => Math.max(0,Math.min(1,x));

export async function loadSigils(root = new URL('../../../', import.meta.url)) {
  const response=await fetch(new URL('art/delivery/a13/sigils.json',root));
  if(!response.ok)throw Error('A13 manifest unavailable');
  const manifest=await response.json();
  if(manifest.schemaVersion!==1)throw Error('Unsupported A13 schema');
  const images=new Map(), pages=new Map(), masks=new Map(), frameCache=new Map();
  async function load(path){
    if(images.has(path))return images.get(path);
    const im=new Image();im.src=new URL(path,root).href;await im.decode();images.set(path,im);return im;
  }
  await Promise.all(manifest.pages.map(async p=>pages.set(p.id,await load(p.file))));
  for(const path of new Set(Object.values(manifest.clips).map(c=>c.progress?.mask).filter(Boolean))){
    const im=await load(path), c=canvas(im.width,im.height),ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(im,0,0);masks.set(path,ctx.getImageData(0,0,c.width,c.height).data);
  }
  function frameCanvas(id,index){
    const key=id+':'+index;if(frameCache.has(key))return frameCache.get(key);
    const clip=manifest.clips[id],f=clip.frames[index],c=canvas(f.rect[2],f.rect[3]);
    c.getContext('2d').drawImage(pages.get(clip.page),...f.rect,0,0,c.width,c.height);
    frameCache.set(key,c);return c;
  }
  const work=canvas(384), fill=canvas(384), mask=canvas(384);
  const wc=work.getContext('2d'),fc=fill.getContext('2d'),mc=mask.getContext('2d');
  const maskData=mc.createImageData(384,384);
  function texture(id,timeMs,progress,arcDegrees,perfectWindowActive,coneDegrees=90){
    const clip=manifest.clips[id];if(!clip)throw Error('Unknown A13 clip '+id);
    if(clip.kind==='perfect-window'&&!perfectWindowActive)return null;
    const sample=sampleClip(clip,timeMs);if(!sample)return null;
    wc.clearRect(0,0,384,384);wc.globalAlpha=1;wc.globalCompositeOperation='source-over';
    const source=frameCanvas(id,sample.index);
    wc.drawImage(source,0,0);
    // Short authored crossfade between painted keys. No extra generated frames.
    if(clip.loop && sample.fraction>.72){
      const next=frameCanvas(id,(sample.index+1)%clip.frameCount);
      wc.globalCompositeOperation='copy';wc.globalAlpha=1;
      wc.drawImage(source,0,0);wc.globalCompositeOperation='source-over';
      wc.globalAlpha=(sample.fraction-.72)/.28;wc.drawImage(next,0,0);wc.globalAlpha=1;
    }
    if(clip.progress && progress!==undefined){
      if(!Number.isFinite(progress))throw Error('Finite simulation progress required');
      const p=clamp(progress),ranks=masks.get(clip.progress.mask);
      for(let i=0;i<384*384;i++){
        const rank=ranks[i*4]/255;
        // 1/255 feather reduces quantization. Explicit endpoints are exact.
        const a=p===0?0:p===1?255:Math.round(255*clamp((p-rank)*255+1));
        maskData.data[i*4]=maskData.data[i*4+1]=maskData.data[i*4+2]=255;maskData.data[i*4+3]=a;
      }
      mc.putImageData(maskData,0,0);
      fc.clearRect(0,0,384,384);fc.globalCompositeOperation='source-over';fc.drawImage(work,0,0);
      fc.globalCompositeOperation='destination-in';fc.drawImage(mask,0,0);fc.globalCompositeOperation='source-over';
      wc.globalCompositeOperation='destination-in';wc.fillStyle=`rgba(255,255,255,${clip.progress.baseOpacity})`;wc.fillRect(0,0,384,384);
      wc.globalCompositeOperation='source-over';wc.drawImage(fill,0,0);
    }
    if(clip.kind==='ward' && arcDegrees!==undefined){
      if(!(arcDegrees>0&&arcDegrees<=180))throw Error('Ward arc must be (0,180] degrees');
      // Exact simulation-owned angular clipping; no visible procedural stroke.
      wc.save();wc.globalCompositeOperation='destination-in';wc.fillStyle='white';
      const a=arcDegrees*Math.PI/360;wc.beginPath();wc.moveTo(192,192);wc.arc(192,192,400,-a,a);wc.closePath();wc.fill();wc.restore();
    }
    if(clip.shape==='cone'&&coneDegrees!==90){
      if(!(coneDegrees>0&&coneDegrees<180))throw Error('Cone angle must be (0,180)');
      // Inverse polar UV warp: keeps radial range fixed while changing fan angle.
      // Production GPU equivalent is documented in README; nearest sampling here
      // is a readable reference implementation, not a performance recommendation.
      const input=wc.getImageData(0,0,384,384),output=wc.createImageData(384,384),factor=90/coneDegrees;
      for(let y=0;y<384;y++)for(let x=0;x<384;x++){
        const dx=x-128,dy=y-192,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx)*factor;
        if(Math.abs(a)>Math.PI/2)continue;
        const sx=Math.round(128+r*Math.cos(a)),sy=Math.round(192+r*Math.sin(a));
        if(sx<0||sx>=384||sy<0||sy>=384)continue;
        const si=(sy*384+sx)*4,di=(y*384+x)*4;
        output.data.set(input.data.subarray(si,si+4),di);
      }
      wc.putImageData(output,0,0);
    }
    return work;
  }
  function draw(ctx,id,options={}){
    const clip=manifest.clips[id];if(!clip)throw Error('Unknown A13 clip '+id);
    const {x=0,y=0,timeMs=0,progress,angle=0,opacity=1,viewportHeight=1080,perfectWindowActive=false}=options;
    const tex=texture(id,timeMs,progress,options.arcDegrees,perfectWindowActive,options.coneDegrees);if(!tex)return false;
    const scale=viewportHeight/1080;
    const size=options.frameSizePx || clip.designFrameSize1080.map(v=>v*scale);
    const ground=clip.plane==='unprojected ground';
    ctx.save();ctx.translate(x,y);if(ground)ctx.scale(1,groundSine);ctx.rotate(angle);
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=clamp(opacity);
    ctx.drawImage(tex,-size[0]*clip.anchor[0],-size[1]*clip.anchor[1],...size);ctx.restore();
    return true;
  }
  function drawThreat(ctx,{element='fire',shape='ring',x,y,progress,timeMs=0,angle=0,
                         radiusMetres=5,lengthMetres=12,widthMetres=3,coneDegrees=90,
                         viewportHeight=1080,unblockable=false,opacity=1}){
    const id=`threat.${element}.${shape}`,clip=manifest.clips[id];if(!clip)throw Error('Unknown threat');
    const px=22.5*viewportHeight/1080;
    let frameSizePx;
    if(shape==='ring')frameSizePx=[radiusMetres*px/.36,radiusMetres*px/.36];
    else if(shape==='cone'){
      if(!(coneDegrees>0&&coneDegrees<180))throw Error('Cone angle must be (0,180)');
      frameSizePx=[lengthMetres*px/clip.nominalRangeUV,lengthMetres*px/clip.nominalRangeUV];
    }else frameSizePx=[lengthMetres*px/.8,widthMetres*px/.286];
    draw(ctx,id,{x,y,progress,timeMs,angle,frameSizePx,viewportHeight,opacity,coneDegrees});
    // Unified cue is always visible, independent of fill, colour and shape.
    draw(ctx,unblockable?'warning.unblockable':'warning.normal',{
      x,y:y-26*viewportHeight/1080,timeMs,viewportHeight,opacity});
    return {id,frameSizePx,collisionAuthority:'game data',unblockable};
  }
  return {manifest,images,pages,masks,draw,drawThreat,texture,sampleClip,frameCanvas};
}
