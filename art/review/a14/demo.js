import {loadCharacters,drawCharacter,bodyFrameAt} from '../../delivery/a14/loader.js';
const root=new URL('../../../',import.meta.url),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const art=await loadCharacters(root);
const names=['cassia','brennic','garran','iskar','conscript','shieldman','slinger','netter','cinder_hound','mire_maw','thornback','hush_moth'];
const plates={};for(const p of ['moonlit','verdigris','rust-sand']){const r=await fetch(new URL(`art/delivery/a12/plates/${p}.png`,root));plates[p]=await createImageBitmap(await r.blob());}
let palette='moonlit',state='death',facing='se',paused=false,start=performance.now(),elapsed=0;
function renderAt(ms){
 elapsed=ms;const w=canvas.width,h=canvas.height,s=h/1080,plate=plates[palette];
 // Same 20% overscan as the accepted A12 compact arena proof.
 ctx.clearRect(0,0,w,h);ctx.drawImage(plate,-w*.1,-h*.1,w*1.2,h*1.2);
 const missing=[];let drawn=0;
 for(let i=0;i<names.length;i++){
   const e=names[i],x=w*(.26+(i%4)*.16),y=h*(.35+Math.floor(i/4)*.21);
   const clip=art.manifest.entities[e]?.clips[state]?.[facing];
   const duration=clip?.frames.reduce((n,f)=>n+f.durationMs,0)??0;
   const active=state==='death'&&ms>=duration&&art.manifest.entities[e]?.clips.corpse?.[facing]?'corpse':state;
   if(art.manifest.a14Coverage[e]?.[state]?.includes(facing)&&drawCharacter(ctx,art,e,active,facing,ms,x,y,s))drawn++;else missing.push(e);
   ctx.fillStyle='rgba(8,16,24,.8)';ctx.fillRect(x-65*s,y+20*s,130*s,27*s);
   ctx.fillStyle=missing.includes(e)?'#f9b2a3':'#e8e8dc';ctx.font=`${16*s}px Georgia`;ctx.textAlign='center';ctx.fillText(e.replaceAll('_',' '),x,y+39*s);
 }
 ctx.textAlign='left';ctx.fillStyle='#e6e4d7';ctx.font=`${24*s}px Georgia`;ctx.fillText(`${state} · ${facing} · ${Math.round(ms)} ms`,24*s,40*s);
 return {drawn,missing,state,facing,nominalBodyPx:60.75*s};
}
function tick(t){if(!paused)renderAt(t-start);requestAnimationFrame(tick)}requestAnimationFrame(tick);
document.querySelector('#palette').onchange=e=>{palette=e.target.value;renderAt(elapsed)};
document.querySelector('#state').onchange=e=>{state=e.target.value;start=performance.now();renderAt(0)};
document.querySelector('#facing').onchange=e=>{facing=e.target.value;renderAt(elapsed)};
document.querySelector('#replay').onclick=()=>{start=performance.now();renderAt(0)};
document.querySelector('#pause').onclick=e=>{paused=!paused;start=performance.now()-elapsed;e.target.textContent=paused?'Play':'Pause'};
window.a14Demo={ready:true,art,drawCharacter,bodyFrameAt,renderAt,pause:()=>paused=true,resize:(w,h)=>{canvas.width=w;canvas.height=h},setPalette:p=>palette=p,setState:s=>state=s,setFacing:f=>facing=f};
