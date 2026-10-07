import {loadSigils,groundSine,sampleClip} from '../../delivery/a13/loader.js';
const root=new URL('../../../',import.meta.url),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const json=async p=>{const r=await fetch(new URL(p,root));if(!r.ok)throw Error(p);return r.json()};
const images=new Map();async function image(p){if(images.has(p))return images.get(p);const im=new Image();im.src=new URL(p,root);await im.decode();images.set(p,im);return im}
const [sigils,arena,chars,floor,a8]=await Promise.all([loadSigils(root),json('art/delivery/a12/arena-plates.json'),json('art/delivery/a10/characters.json'),json('art/delivery/a13/floor-placement.json'),json('art/delivery/a8/effects.json')]);
await Promise.all([...Object.values(arena.palettes).flatMap(p=>[p.file,...p.occluders.map(o=>o.file)]),...chars.pages.map(p=>p.file),...Object.values(floor.palettes).map(p=>p.overlay.file),...a8.pages.map(p=>p.file)].map(image));
const charPages=Object.fromEntries(chars.pages.map(p=>[p.id,images.get(p.file)]));
const a8Pages=Object.fromEntries(a8.pages.map(p=>[p.id,images.get(p.file)]));
let palette='moonlit',mode='arena',paused=false,progress=.62,perfect=true,cleanup=true,lastTime=1200;
const actors=[
 {id:'brennic',element:'fire',uv:[.30,.45],state:'cast',facing:'ne'},
 {id:'cassia',element:'water',uv:[.47,.60],state:'absorb',facing:'ne'},
 {id:'garran',element:'earth',uv:[.65,.49],state:'cast',facing:'ne'},
 {id:'iskar',element:'air',uv:[.77,.62],state:'cast',facing:'ne'},
 {id:'shieldman',uv:[.40,.30],state:'idle',facing:'se'},
 {id:'conscript',uv:[.60,.32],state:'idle',facing:'se'},
 {id:'netter',uv:[.60,.72],state:'idle',facing:'ne'}];
function label(text,x,y,size=18,color='#e2e5de'){ctx.fillStyle=color;ctx.font=`${size*canvas.height/1080}px Georgia`;ctx.fillText(text,x,y)}
function a8draw(id,x,y,size,time){const c=a8.clips[id];if(!c)return;const f=sampleClip(c,time);if(!f)return;ctx.save();ctx.globalCompositeOperation=c.blend==='lighter'?'lighter':'source-over';ctx.drawImage(a8Pages[c.page],...f.frame.rect,x-size/2,y-size/2,size,size);ctx.restore()}
function geometric(shape,x,y,size,colour,amount,angle=0,width=60){
 ctx.save();ctx.translate(x,y);ctx.scale(1,groundSine);ctx.rotate(angle);ctx.strokeStyle=colour;ctx.fillStyle=colour;ctx.lineWidth=3*canvas.height/1080;
 ctx.beginPath();if(shape==='ring')ctx.arc(0,0,size,0,Math.PI*2);
 if(shape==='cone'){ctx.moveTo(0,0);ctx.arc(0,0,size,-Math.PI/4,Math.PI/4);ctx.closePath()}
 if(shape==='line')ctx.rect(0,-width/2,size,width);
 ctx.globalAlpha=.13;ctx.fill();ctx.globalAlpha=1;ctx.stroke();
 if(shape==='ring'){ctx.beginPath();ctx.arc(0,0,size*amount,0,Math.PI*2);ctx.globalAlpha=.13;ctx.fill();ctx.globalAlpha=1}
 if(shape!=='line')for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo((size+3)*Math.cos(a),(size+3)*Math.sin(a));ctx.lineTo((size+8)*Math.cos(a),(size+8)*Math.sin(a));ctx.stroke()}
 if(shape==='line')for(let x=22;x<size-20;x+=34){ctx.globalAlpha=.6;ctx.beginPath();ctx.moveTo(x,-width/2);ctx.lineTo(x+14,width/2);ctx.stroke()}
 ctx.restore();
}
function arenaRender(t,before=false){
 const w=canvas.width,h=canvas.height,s=h/1080,plate=arena.palettes[palette],scale=h/1440;
 const offset=[w/2-1536*scale,h/2-864*scale],screen=uv=>[offset[0]+uv[0]*3072*scale,offset[1]+uv[1]*1728*scale];
 ctx.drawImage(images.get(plate.file),...offset,3072*scale,1728*scale);
 if(!before&&cleanup){
  ctx.drawImage(images.get(floor.palettes[palette].overlay.file),...offset,3072*scale,1728*scale);
  for(const d of floor.palettes[palette].decals){
   const tex=sigils.texture(d.clip,t,undefined,undefined,false);const p=screen(d.centreUV),size=d.frameSizeMasterPx.map(v=>v*scale);
   ctx.save();ctx.globalAlpha=d.opacity;ctx.drawImage(tex,p[0]-size[0]/2,p[1]-size[1]/2,...size);ctx.restore();
  }
 }
 let phaseMs=t%2800,phase=phaseMs<600?'start':phaseMs<2200?'hold':'release',local=phase==='start'?phaseMs:phase==='hold'?phaseMs-600:phaseMs-2200;
 for(const [i,a] of actors.entries()){
  const [x,y]=screen(a.uv);ctx.fillStyle='rgba(4,7,10,.45)';ctx.beginPath();ctx.ellipse(x,y,18*s,5*s,0,0,Math.PI*2);ctx.fill();
  if(before){geometric('ring',x,y,a.element?18*s:13*s,a.element?'#75d9f4':'#e9a777',progress);continue}
  if(a.element)sigils.draw(ctx,`cast.${a.element}.${phase}`,{x,y,timeMs:local,viewportHeight:h,opacity:.9});
  if(i===1)sigils.draw(ctx,'selection',{x,y,timeMs:t,viewportHeight:h});
  if(i===4)sigils.draw(ctx,'target',{x,y,timeMs:t,viewportHeight:h});
 }
 const threats=[
 {element:'fire',shape:'ring',uv:[.31,.69],radiusMetres:4.1},
 {element:'earth',shape:'cone',uv:[.57,.47],lengthMetres:7,angle:.55,coneDegrees:90},
 {element:'water',shape:'line',uv:[.46,.34],lengthMetres:11,widthMetres:2.6,angle:.45},
 {element:'air',shape:'ring',uv:[.71,.72],radiusMetres:3.6,unblockable:true}];
 for(const item of threats){const [x,y]=screen(item.uv);
  if(before)geometric(item.shape,x,y,(item.radiusMetres||item.lengthMetres)*22.5*s,item.unblockable?'#e786a1':sigils.manifest.elementTints[item.element],progress,item.angle||0,(item.widthMetres||3)*22.5*s);
  else sigils.drawThreat(ctx,{...item,x,y,progress,timeMs:t,viewportHeight:h,opacity:.86});
 }
 const ward=screen(actors[1].uv);
 if(before){
  ctx.save();ctx.translate(...ward);ctx.scale(1,groundSine);ctx.rotate(-.4);ctx.beginPath();ctx.arc(0,0,54*s,-70*Math.PI/180,70*Math.PI/180);ctx.strokeStyle='#205f78';ctx.lineWidth=7.8*s;ctx.stroke();ctx.strokeStyle='#9de9df';ctx.lineWidth=3.9*s;ctx.stroke();ctx.restore();
 }else{
  sigils.draw(ctx,'ward.hold',{x:ward[0],y:ward[1],timeMs:t,progress,angle:-.4,arcDegrees:140,viewportHeight:h});
  sigils.draw(ctx,'absorb.window',{x:ward[0],y:ward[1],timeMs:t,perfectWindowActive:perfect,viewportHeight:h});
 }
 // A12 occluders and upright A10 actors share the same depth ordering.
 const layers=plate.occluders.map(o=>({y:o.baseLineMasterPx,draw(){const p=screen([o.cropMasterPx[0]/3072,o.cropMasterPx[1]/1728]);ctx.drawImage(images.get(o.file),...p,o.size[0]*scale,o.size[1]*scale)}}));
 const missing=[];
 actors.forEach(a=>{const e=chars.entities[a.id],c=e.clips[a.state]?.[a.facing];if(!c){missing.push(a.id);return}
  const f=sampleClip(c,t%c.frames.reduce((sum,f)=>sum+f.durationMs,0));if(!f)return;const foot=screen(a.uv),size=e.designSize1080.map(v=>v*1.5*s);
  layers.push({y:a.uv[1]*1728,draw(){ctx.save();ctx.translate(...foot);if(c.mirrorX)ctx.scale(-1,1);ctx.drawImage(charPages[c.page],...f.frame.rect,-size[0]*e.anchor[0],-size[1]*e.anchor[1],...size);ctx.restore()}});
 });layers.sort((a,b)=>a.y-b.y).forEach(l=>l.draw());
 if(!before)actors.slice(0,5).forEach((a,i)=>{const foot=screen(a.uv);sigils.draw(ctx,'status.'+['burning','wet','rooted','slowed','shielded'][i],{x:foot[0]+36*s,y:foot[1]-61*s,timeMs:t,viewportHeight:h})});
 // Existing A8 elemental motion remains compatible, deliberately restrained.
 const flame=screen([.37,.43]);a8draw('fire.travel',...flame,80*s,t);
 ctx.fillStyle='rgba(6,12,18,.78)';ctx.fillRect(25*s,22*s,795*s,86*s);
 label(before?'BEFORE / current geometric treatment reproduced':'A13 / THE BROKEN OATH',45*s,54*s,24);
 label(`${palette} / A10 1.5x / nominal body ${(60.75*s).toFixed(2)} px / ${before?'authored renderer witness':'painted decals + authored masks'}`,45*s,84*s,17);
 return {actors:actors.length,missing,nominalBodyPx:60.75*s,plateScale:scale,phase,progress,perfectWindow:perfect,before};
}
function catalogue(t){
 const w=canvas.width,h=canvas.height,s=h/1080;ctx.fillStyle='#111c25';ctx.fillRect(0,0,w,h);
 const ids=['cast.fire.hold','cast.water.hold','cast.earth.hold','cast.air.hold',
  'threat.fire.ring','threat.water.cone','threat.earth.line','warning.unblockable',
  'ward.hold','absorb.window','selection','target',
  'status.burning','status.wet','status.rooted','status.slowed','status.shielded','inscription.collar','inscription.wardstone','floor.moonlit'];
 const cols=4,rows=5,cw=w/cols,ch=(h-70*s)/rows;
 ids.forEach((id,i)=>{const x=(i%cols+.5)*cw,y=70*s+(Math.floor(i/cols)+.40)*ch;
   sigils.draw(ctx,id,{x,y,timeMs:t,progress,perfectWindowActive:perfect,arcDegrees:id==='ward.hold'?140:undefined,
    frameSizePx:[145*s,145*s],viewportHeight:h});label(id,x-cw*.40,y+ch*.44,18)});
 label('A13 / shared glyphs, live painted keys and authored fill masks',28*s,36*s,24);
 return {clips:ids.length,progress,perfectWindow:perfect};
}
function progressRender(t){
 const w=canvas.width,h=canvas.height,s=h/1080;ctx.fillStyle='#15212a';ctx.fillRect(0,0,w,h);
 label('CHARGE / full perimeter remains visible; only painted pixels fill',30*s,42*s,25);
 for(const [row,shape] of ['ring','cone','line'].entries())for(let i=0;i<5;i++){
  const x=(i+.5)*w/5,y=(190+row*260)*s,amount=i/4;
  sigils.drawThreat(ctx,{element:['fire','water','earth'][row],shape,x:shape==='ring'?x:x-95*s,y,progress:amount,timeMs:t,
   radiusMetres:3,lengthMetres:6,widthMetres:2.5,coneDegrees:90,viewportHeight:h,unblockable:i===4});
  label(`${shape} ${Math.round(amount*100)}%${i===4?' / UNBLOCKABLE':''}`,x-115*s,y+110*s,19);
 }
 label('Same warning radical on every element; UNBLOCKABLE adds torn binding + paired teeth.',30*s,1020*s,22);
 return {progressValues:[0,.25,.5,.75,1],shapes:['ring','cone','line'],unblockableColumn:4};
}
function renderAt(t){lastTime=t;ctx.clearRect(0,0,canvas.width,canvas.height);return mode==='arena'||mode==='before'?arenaRender(t,mode==='before'):mode==='catalogue'?catalogue(t):progressRender(t)}
window.a13Demo={ready:true,sigils,arena,chars,floor,renderAt,setPalette(p){if(!arena.palettes[p])throw Error(p);palette=p},setMode(m){mode=m},setProgress(p){progress=p},setPerfect(v){perfect=v},setCleanup(v){cleanup=v},resize(w,h){canvas.width=w;canvas.height=h},pause(v=true){paused=v},get state(){return{palette,mode,progress,perfect,cleanup,time:lastTime}}};
document.querySelector('#palette').onchange=e=>{palette=e.target.value};document.querySelector('#mode').onchange=e=>{mode=e.target.value};
document.querySelector('#progress').oninput=e=>{progress=Number(e.target.value)};document.querySelector('#window').onchange=e=>{perfect=e.target.checked};document.querySelector('#cleanup').onchange=e=>{cleanup=e.target.checked};
function pause(){paused=!paused;document.querySelector('#pause').textContent=paused?'Play':'Pause'}document.querySelector('#pause').onclick=pause;
document.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();pause()}});
function animate(t){if(!paused)renderAt(t);requestAnimationFrame(animate)}renderAt(1200);requestAnimationFrame(animate);
