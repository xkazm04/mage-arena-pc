const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const kit=await(await fetch('../../ui/kit.json')).json(),data=await(await fetch('manifest.json')).json(),pages={},portraits={};
const image=src=>new Promise((resolve,reject)=>{let im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error(src));im.src=src;});
await Promise.all(kit.pages.map(async p=>pages[p.id]=await image('../../ui/'+p.file)));
await Promise.all([['Cinzel','Cinzel.ttf'],['Source Sans 3','SourceSans3.ttf']].map(async([n,f])=>{let face=await new FontFace(n,`url(../../ui/fonts/${f})`,{weight:'100 900'}).load();document.fonts.add(face);}));
await Promise.all(data.portraits.map(async r=>portraits[r.id]=await image('../../../'+r.file)));
const bg=await image('../a4c/backdrops/commons.png');let who=0,mood='neutral',focus=0,targets=[];
function sprite(id,x,y,w,h){
 const r=kit.regions[id];if(!r)throw new Error('Missing region: '+id);
 const [sx,sy,sw,sh]=r.rect;w??=sw;h??=sh;
 if(r.nineSlice){
  if(w<r.minSize[0]||h<r.minSize[1])throw new Error(`Below minSize: ${id}`);
  const [l,t,rr,b]=r.nineSlice,xs=[sx,sx+l,sx+sw-rr,sx+sw],ys=[sy,sy+t,sy+sh-b,sy+sh];
  const xd=[x,x+l,x+w-rr,x+w],yd=[y,y+t,y+h-b,y+h];
  for(let j=0;j<3;j++)for(let i=0;i<3;i++)ctx.drawImage(pages[r.page],xs[i],ys[j],xs[i+1]-xs[i],ys[j+1]-ys[j],xd[i],yd[j],xd[i+1]-xd[i],yd[j+1]-yd[j]);
 }else ctx.drawImage(pages[r.page],sx,sy,sw,sh,x,y,w,h);
}
function text(s,x,y,size=28,color=kit.tokens.text,family='Source Sans 3',align='left',weight=400){ctx.font=`${weight} ${size}px "${family}"`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='top';ctx.fillText(s,x,y);}
function heading(s,x,y,size=40){text(s,x,y,size,kit.tokens.text,'Cinzel','left',600);}
function wrapped(s,x,y,width,size=28){let line='',yy=y;ctx.font=`400 ${size}px "Source Sans 3"`;for(const word of s.split(' ')){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){text(line,x,yy,size);yy+=size*1.38;line=word;}else line=next;}if(line)text(line,x,yy,size);return yy+size*1.38;}

function button(label,x,y,w,action){let i=targets.length;sprite('button.'+(i===focus?'focus':'normal'),x,y,w,72);text(label,x+w/2,y+20,28,kit.tokens.text,'Source Sans 3','center',600);targets.push({x,y,w,h:72,label,action});}
function draw(){let d=devicePixelRatio||1;canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);let scale=Math.min(innerWidth/1920,innerHeight/1080),ox=(innerWidth-1920*scale)/2,oy=(innerHeight-1080*scale)/2;ctx.fillStyle='#070d15';ctx.fillRect(0,0,innerWidth,innerHeight);ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.drawImage(bg,0,0,1920,1080);ctx.fillStyle='#07101cbf';ctx.fillRect(0,0,1920,1080);targets=[];
let c=data.characters[who],key=c.id+'.'+mood,im=portraits[key]||portraits[c.id+'.neutral'];heading(c.name,90,65,48);text('The Commons',94,137,28,kit.tokens.mutedText);
let fit=Math.min(560/im.width,770/im.height);ctx.drawImage(im,90+(560-im.width*fit)/2,221+(770-im.height*fit)/2,im.width*fit,im.height*fit);
sprite('panel.body',704,220,1120,780);heading('A quiet conversation',756,272,38);text(mood.toUpperCase(),756,339,24,kit.tokens.selected);
const lines={cassia:'Every promise has a price. I would rather know it before I answer.',brennic:'The yard is quiet now. It will not stay that way.',garran:'Sit a while. There is enough bread for one more.',iskar:'They have names for every road except the one that leads out.'};wrapped(lines[c.id]||'There is time to speak before the watch changes. What brings you here?',756,410,1000,38);
button('Ask about the camp',756,666,1008,()=>{});button('Listen a little longer',756,770,1008,()=>{});button('Take your leave',756,874,1008,()=>{});
window.portraitReview={ready:true,character:c.id,mood,portraitKey:key,focus,scale,offset:[ox,oy],targets:targets.map(({action,...t})=>t),loaded:Object.keys(portraits).length};
}
window.setPortraitReview=(id,m='neutral')=>{let index=data.characters.findIndex(c=>c.id===id);if(index<0||!portraits[id+'.'+m])throw new Error('Unknown portrait');who=index;mood=m;draw();};
addEventListener('resize',draw);addEventListener('keydown',e=>{if(e.key==='ArrowRight'){who=(who+1)%data.characters.length;}else if(e.key==='ArrowLeft'){who=(who+data.characters.length-1)%data.characters.length;}else if(e.key==='ArrowDown'||e.key==='Tab'){focus=(focus+1)%3;e.preventDefault();}else if(e.key==='ArrowUp'){focus=(focus+2)%3;e.preventDefault();}else if(e.key==='m'){let all=['neutral',...data.expressions],i=all.indexOf(mood);mood=all[(i+1)%all.length];}draw();});
canvas.addEventListener('pointerdown',e=>{let s=window.portraitReview,x=(e.clientX-s.offset[0])/s.scale,y=(e.clientY-s.offset[1])/s.scale,i=targets.findIndex(t=>x>=t.x&&x<t.x+t.w&&y>=t.y&&y<t.y+t.h);if(i>=0){focus=i;targets[i].action();draw();}});draw();
