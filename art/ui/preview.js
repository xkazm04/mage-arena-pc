// Art interchange consumer and review harness, independent of the game's framework.
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const kit=await (await fetch('kit.json')).json();
if(kit.schemaVersion!==1)throw new Error('Unsupported Covenant UI schema');
const pages={};
const image=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Missing image: '+src));im.src=src;});
await Promise.all(kit.pages.map(async p=>{pages[p.id]=await image(p.file);}));
await Promise.all([['Cinzel','fonts/Cinzel.ttf'],['Source Sans 3','fonts/SourceSans3.ttf']].map(async([name,file])=>{const font=await new FontFace(name,`url(${file})`,{weight:'100 900'}).load();document.fonts.add(font);}));
const bg=await image('../delivery/a3c/proofs/moonlit-1920.png');
const screens=['menu','arena','camp','board','journal','parley','composition','pause','results','saves','controls'];
let screen=new URLSearchParams(location.search).get('screen')||'menu',focus=0,hover=-1,pressed=false;
let pointer=null,targets=[];
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
function button(label,x,y,w=320,disabled=false){const index=targets.length,state=disabled?'disabled':pressed&&index===focus?'pressed':index===focus?'focus':index===hover?'hover':'normal';sprite('button.'+state,x,y,w,72);text(label,x+w/2,y+20,28,disabled?'#8d9b9e':kit.tokens.text,'Source Sans 3','center',600);targets.push({x,y,w,h:72,label,disabled});}
function panel(x,y,w,h,title){sprite('panel.body',x,y,w,h);if(title)heading(title,x+50,y+48);}
function icon(id,x,y,size=56){sprite('icon.'+id,x,y,size,size);}
function slot(id,x,y,state='normal',label=''){sprite('slot.'+state,x,y,96,96);icon(id,x+22,y+22,52);if(label)text(label,x+48,y+105,24,kit.tokens.text,'Source Sans 3','center');}
function bar(kind,x,y,w,value,label){sprite('bar.track',x,y,w,32);ctx.save();ctx.beginPath();ctx.rect(x+9,y+7,(w-18)*value,18);ctx.clip();sprite('bar.'+kind,x+9,y+7,w-18,18);ctx.restore();if(label)text(label,x,y-31,24);}
function clock(x,y){sprite('clock.face',x,y,152,152);sprite('clock.rim',x,y,152,152);ctx.save();ctx.translate(x+76,y+76);ctx.rotate(Math.PI*.8);sprite('clock.hand',-76,-76,152,152);ctx.restore();for(let i=0;i<4;i++)sprite('clock.pip.'+(i<2?'on':'off'),x+30+i*27,y+166,22,22);text('TIER II',x+76,y+204,24,kit.tokens.text,'Cinzel','center',600);}
function top(title,subtitle){heading(title,112,70,48);if(subtitle)text(subtitle,114,134,24,kit.tokens.mutedText);}
function draw(){
 const dpr=devicePixelRatio||1;canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.fillStyle='#070d15';ctx.fillRect(0,0,innerWidth,innerHeight);const scale=Math.min(innerWidth/1920,innerHeight/1080),ox=(innerWidth-1920*scale)/2,oy=(innerHeight-1080*scale)/2;
 ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.drawImage(bg,0,0,1920,1080);
 ctx.fillStyle=screen==='arena'?'rgba(5,12,20,.04)':'rgba(5,12,20,.58)';ctx.fillRect(0,0,1920,1080);targets=[];
 if(screen==='menu'){
  heading('MAGE ARENA',118,176,64);text('THE COVENANT',122,267,28,kit.tokens.selected,'Cinzel','left',600);
  wrapped('Four elements. One bond. A season beneath the wardstones.',122,333,530,32);
  button('Continue the season',116,505,430);button('Begin a new season',116,595,430);button('Chronicle',116,685,430);button('Settings',116,775,430);
  panel(1180,252,600,468,'Six weeks in the camp');wrapped('Prepare between the Games. Learn who will stand beside you when the collars break.',1230,354,494,32);
  icon('wardstone',1408,550,112);
 }else if(screen==='arena'){
  icon('water',106,67,64);heading('CASSIA',188,70,32);text('Water · Tide Orb',189,113,24,kit.tokens.mutedText);
  bar('hp',112,186,304,.78,'VITALITY');bar('mana',112,252,304,.64,'MANA');bar('stamina',112,318,304,.88,'STAMINA');
  clock(1618,70);sprite('panel.tooltip',712,881,498,145);slot('water-tide-orb',741,899,'selected','1');slot('water-lash',852,899,'normal','2');slot('water-mire',963,899,'locked','3');
  sprite('cursor.aim',1017,486,54,54);text('Hold right mouse · absorb',1310,930,28,kit.tokens.text);icon('absorb',1232,913,60);
  text('WASD  Move     Space  Roll     Shift  Sprint',112,961,28,kit.tokens.text);
 }else if(screen==='controls'){
  top('Covenant kit','Native atlas regions · state and stretch proof');
  ['normal','hover','focus','pressed','disabled'].forEach((s,i)=>{sprite('button.'+s,110+i*342,220,314,72);text(s,267+i*342,240,28,kit.tokens.text,'Source Sans 3','center');});
  ['normal','hover','focus','selected','locked','cooldown','borrowed'].forEach((s,i)=>slot(['fire','water','earth','air','lock','water-mire','water-mirror'][i],125+i*171,365,s,s));
  clock(1530,354);
  panel(110,573,310,285,'Panel');panel(452,573,530,285,'Nine slice');panel(1014,573,778,285,'Corners preserve their scale');
  const ids=['day','dusk','night','journal','parley','gold','food','trust','map','camp','save','load','warning','gamepad','mouse','keyboard'];ids.forEach((id,i)=>icon(id,120+i*102,919,58));
 }else if(screen==='composition'){
  top('Spell composition','Choose a line · tiers unlock on the collar clock');
  panel(110,210,1140,756,'Water');
  const ids=['water-tide-orb','water-lash','water-mire','water-mend','water-mirror'],names=['Tide Orb','Lash','Mire','Mend','Mirror'];
  ids.forEach((id,i)=>{slot(id,168+i*207,317,i===focus%5?'selected':'normal',names[i]);for(let tier=0;tier<4;tier++){sprite('clock.pip.'+(tier<2?'on':'off'),190+i*207,503+tier*76,24,24);text(['I','II','III','IV'][tier],230+i*207,499+tier*76,28);}});
  panel(1290,210,510,572,'Tide Orb');wrapped('A compact water core, carried in a bright liquid shell. The game supplies costs, tiers and branch details.',1340,310,410,30);button('Equip line',1340,660,410);
  button('Return',1340,824,410);
 }else if(screen==='board'){
  top('The Hollow Board','Day 12 · Dusk approaches');
  const titles=['A shared loaf','The watch changes','A quiet bargain'],body=['A portion waits beside your bowl. Someone has remembered you.','Bootsteps pass the Door earlier than yesterday. The camp has noticed.','Two voices fall silent when the tent flap opens.'];
  titles.forEach((title,i)=>{const x=112+i*572;sprite('card.'+['unread','normal','warning'][i],x,245,536,612);icon(['food','knowing','trust'][i],x+48,292,64);heading(title,x+50,407,32);wrapped(body[i],x+50,480,434,30);});
  button('Return to camp',112,909,400);
 }else if(screen==='camp'){
  top('Castra Clausa','Day 12 · Week two');
  ['Day','Dusk','Night'].forEach((s,i)=>{sprite('tab.'+(i===0?'selected':'normal'),112+i*304,211,280,72);text(s,252+i*304,232,28,kit.tokens.text,'Source Sans 3','center');});
  panel(1200,330,600,568,'The Yard');wrapped('Staff drills beneath the Vigil’s eye. Choose a place on the camp map.',1250,434,492,32);button('Visit',1250,755,492);
  ['The Yard','The Cistern','The Pit','The Exchange','The Commons','The Door','Your tent','The Edge'].forEach((s,i)=>button(s,112+(i%2)*478,354+Math.floor(i/2)*126,430,i===2||i===7));
 }else if(screen==='journal'){
  top('Chronicle','Knowings · bonds · the season');panel(112,235,518,709,'Entries');['The collar','The four tents','A debt remembered','Beyond the fog'].forEach((s,i)=>button(s,162,353+i*114,418));
  panel(666,235,1134,709,'The collar');wrapped('The metal stays cold even beside the fire. Each new tier arrives with a pulse beneath the throat. You have learned to count the moments between them.',720,359,1000,32);icon('knowing',1510,692,136);
 }else if(screen==='parley'){
  top('A quiet conversation','The Commons · Dusk');panel(112,253,1690,650,'A knowing opens the way');wrapped('“You were near the Door when the watch changed. Tell me what you saw.”',170,363,1460,40);sprite('panel.tooltip',162,539,1578,180);text('The camp remembers who keeps a promise.',212,600,32,kit.tokens.mutedText);button('Speak',1350,783,390);button('Leave',164,783,390);
 }else if(screen==='pause'){
  panel(596,180,728,770,'A moment of stillness');['Resume','Settings','Save season','Return to title'].forEach((s,i)=>button(s,672,331+i*123,576));
 }else if(screen==='results'){
  top('The Games are over','A place in the season chronicle');panel(350,236,1220,654,'The bond endures');icon('results',882,365,150);wrapped('The arena falls quiet. Return to the camp and discover what changed while you were away.',540,555,850,36);button('Return to camp',675,765,570);
 }else if(screen==='saves'){
  top('Your season','Save and load');panel(112,230,1688,688,'Seasons');['Day 12 · Dusk · Cassia','Day 8 · Day · Brennic','Empty slot'].forEach((s,i)=>{sprite('panel.tooltip',163,349+i*158,1080,134);text(s,213,393+i*158,32);button(i===2?'Save':'Load',1300,381+i*158,430);});
 }
 if(screen!=='arena')text('← →  Focus      Enter  Select      1–9  Review screens',112,995,28,kit.tokens.text);
 if(pointer){const r=kit.regions['cursor.pointer'];sprite('cursor.pointer',pointer[0]-r.anchor[0]*48,pointer[1]-r.anchor[1]*48,48,48);}
 window.covenantReview={ready:true,screen,targets,regions:Object.keys(kit.regions).length,scale,offset:[ox,oy],focus};
}
addEventListener('resize',draw);
addEventListener('keydown',e=>{if(['ArrowRight','ArrowDown','Tab'].includes(e.key)){focus=(focus+1)%Math.max(1,targets.length);e.preventDefault();}else if(['ArrowLeft','ArrowUp'].includes(e.key)){focus=(focus-1+targets.length)%Math.max(1,targets.length);e.preventDefault();}else if(/^[1-9]$/.test(e.key)){screen=screens[Number(e.key)-1];focus=0;}else if(e.key==='Enter'){pressed=true;setTimeout(()=>{pressed=false;draw();},kit.motion.pressMs);}draw();});
canvas.addEventListener('pointermove',e=>{const s=window.covenantReview;pointer=[(e.clientX-s.offset[0])/s.scale,(e.clientY-s.offset[1])/s.scale];hover=targets.findIndex(t=>pointer[0]>=t.x&&pointer[0]<=t.x+t.w&&pointer[1]>=t.y&&pointer[1]<=t.y+t.h);draw();});
canvas.addEventListener('pointerdown',()=>{if(hover>=0&&!targets[hover].disabled){focus=hover;pressed=true;draw();}});
canvas.addEventListener('pointerup',()=>{pressed=false;draw();});
window.setCovenantScreen=value=>{if(!screens.includes(value))throw new Error('Unknown review screen');screen=value;focus=0;draw();};
draw();
