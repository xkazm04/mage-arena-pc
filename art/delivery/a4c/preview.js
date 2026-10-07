const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const kit=await(await fetch('../../ui/kit.json')).json(),data=await(await fetch('manifest.json')).json(),pages={},images={};
const image=src=>new Promise((resolve,reject)=>{let im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error(src));im.src=src;});
await Promise.all(kit.pages.map(async p=>pages[p.id]=await image('../../ui/'+p.file)));
await Promise.all([['Cinzel','Cinzel.ttf'],['Source Sans 3','SourceSans3.ttf']].map(async([n,f])=>{let face=await new FontFace(n,`url(../../ui/fonts/${f})`,{weight:'100 900'}).load();document.fonts.add(face);}));
await Promise.all([...data.maps.filter(r=>r.size[0]===1920),...data.backdrops,...data.stories].map(async r=>images[r.file]=await image('../../../'+r.file)));
let slot='day',selected=0,screen='map',storyPage=0,targets=[],focus=0;
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

function button(label,x,y,w,action,disabled=false){let i=targets.length;sprite('button.'+(disabled?'disabled':i===focus?'focus':'normal'),x,y,w,72);text(label,x+w/2,y+20,28,disabled?'#96a5aa':kit.tokens.text,'Source Sans 3','center',600);targets.push({x,y,w,h:72,action,disabled,label});}
function draw(){let d=devicePixelRatio||1;canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);let scale=Math.min(innerWidth/1920,innerHeight/1080),ox=(innerWidth-1920*scale)/2,oy=(innerHeight-1080*scale)/2;ctx.fillStyle='#070d15';ctx.fillRect(0,0,innerWidth,innerHeight);ctx.translate(ox,oy);ctx.scale(scale,scale);targets=[];
let place=data.places[selected],isOpen=place.open.includes(slot),map=data.maps.find(r=>r.slot===slot&&r.size[0]===1920),back=data.backdrops.find(r=>r.place===place.id);
ctx.drawImage(images[screen==='visit'?back.file:map.file],0,0,1920,1080);
let g=ctx.createLinearGradient(0,0,0,230);g.addColorStop(0,'#07101cee');g.addColorStop(1,'#07101c00');ctx.fillStyle=g;ctx.fillRect(0,0,1920,230);
if(screen==='map'){
 heading('CASTRA CLAUSA',72,45,40);text('Choose a place',74,100,28);
 data.slots.forEach((s,i)=>{let x=1120+i*240;sprite('tab.'+(s===slot?'selected':'normal'),x,44,218,72);if(i===focus)sprite('tab.focus',x,44,218,72);text(s[0].toUpperCase()+s.slice(1),x+109,64,28,kit.tokens.text,'Source Sans 3','center',600);targets.push({x,y:44,w:218,h:72,label:s,disabled:false,action:()=>{slot=s;draw();}});});
 data.places.forEach((r,i)=>{let x=Math.max(34,Math.min(1580,r.anchor[0]*1920-145)),y=Math.min(810,r.anchor[1]*1080);button(r.name,x,y,290,()=>{selected=i;draw();});if(!r.open.includes(slot))sprite('icon.lock',x+244,y+25,26,26);if(i===selected){ctx.strokeStyle=kit.tokens.selected;ctx.lineWidth=3;ctx.strokeRect(x+12,y+10,266,52);}});
 sprite('panel.body',64,914,1792,112);heading(place.name,106,946,30);text(isOpen?'Open this '+slot:'Closed this '+slot,550,951,28);button('Hollow Board',1070,934,320,()=>{screen='board';focus=0;draw();});button('Visit',1440,934,352,()=>{if(isOpen){screen='visit';focus=0;draw();}},!isOpen);
}else if(screen==='visit'){
 heading(place.name.toUpperCase(),72,50,48);text('Covenant camp',74,118,28);button('Return to camp',72,927,360,()=>{screen='map';focus=0;draw();});
}else{
 ctx.fillStyle='#07101cdc';ctx.fillRect(0,0,1920,1080);heading('THE HOLLOW BOARD',96,60,48);text('Camp stories',98,125,28);
 data.stories.slice(storyPage*3,storyPage*3+3).forEach((r,i)=>{let x=96+i*584;sprite('card.'+['unread','normal','warning'][i],x,208,560,665);ctx.drawImage(images[r.file],x+45,257,470,265);heading(r.title,x+47,553,30);wrapped(r.body,x+47,625,464,30);});
 button('Return to camp',96,925,380,()=>{screen='map';focus=0;draw();});button(storyPage===0?'More stories':'Earlier stories',1420,925,400,()=>{storyPage=1-storyPage;draw();});
}
window.campReview={ready:true,slot,screen,selected,place:place.id,open:isOpen,openIds:data.places.filter(r=>r.open.includes(slot)).map(r=>r.id),places:data.places.map(r=>r.id),targets:targets.map(({action,...r})=>r),scale,offset:[ox,oy],focus,storyPage};
}
window.setCampReview=(s='day',view='map',index=0,page=0)=>{slot=s;screen=view;selected=index;storyPage=page;focus=0;draw();};
addEventListener('resize',draw);addEventListener('keydown',e=>{if(['ArrowRight','ArrowDown','Tab'].includes(e.key)){focus=(focus+1)%targets.length;e.preventDefault();}else if(['ArrowLeft','ArrowUp'].includes(e.key)){focus=(focus+targets.length-1)%targets.length;e.preventDefault();}else if(e.key==='Enter'){let t=targets[focus];if(t&&!t.disabled)t.action();}else if(e.key==='Escape'){screen='map';focus=0;}draw();});
canvas.addEventListener('pointerdown',e=>{let s=window.campReview,x=(e.clientX-s.offset[0])/s.scale,y=(e.clientY-s.offset[1])/s.scale,i=targets.findIndex(t=>x>=t.x&&x<t.x+t.w&&y>=t.y&&y<t.y+t.h);if(i>=0){focus=i;let t=targets[i];if(!t.disabled)t.action();draw();}});draw();
