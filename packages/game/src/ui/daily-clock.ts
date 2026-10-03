import { Graphics, type BitmapText, type Sprite } from "pixi.js";
import type { CanvasUI } from "./ui.ts";
import { colours } from "./kit.ts";

/** Presentation only: the core hour remains authoritative while this dial eases. */
export class DailyClock {
  private readonly runes = new Graphics();
  private readonly text: BitmapText;
  private readonly hand?: Sprite;
  constructor(ui: CanvasUI, private readonly wakingHours: number, private readonly x: number, private readonly y: number) {
    const g = new Graphics().circle(x,y,59).fill({color:colours.ink,alpha:0.95})
      .circle(x,y,57).stroke({color:colours.edge,width:2})
      .circle(x,y,39).stroke({color:colours.gold,width:1,alpha:0.6});
    ui.content.addChild(g);
    for (const kind of ['face','rim']) {
      const art=ui.kit.sprite(`daily-clock.${kind}`) ?? ui.kit.sprite(`clock.${kind}`);
      if (art) { art.anchor.set(0.5); art.position.set(x,y); art.width=art.height=118; art.alpha=0.6; ui.content.addChild(art); }
    }
    this.hand=ui.kit.sprite('daily-clock.hand');
    if(this.hand) { this.hand.anchor.set(0.5); this.hand.position.set(x,y); this.hand.width=this.hand.height=110; ui.content.addChild(this.hand); }
    ui.content.addChild(this.runes);
    this.text=ui.text('',x-36,y-18,28,colours.text,76);
  }
  draw(remaining: number, now: number) {
    if (this.runes.destroyed) return;
    const {x,y,wakingHours}=this, g=this.runes;
    const left=Math.max(0,Math.min(wakingHours,remaining)), fraction=left/wakingHours;
    const warning=left<=2, colour=warning?colours.danger:colours.water;
    g.clear();
    for(let i=0;i<wakingHours;i++) {
      const a=-Math.PI/2+i*Math.PI*2/wakingHours, b=a+Math.PI*2/wakingHours*0.64;
      const alpha=Math.max(0.12,Math.min(1,left-(wakingHours-1-i)));
      g.moveTo(x+Math.cos(a)*49,y+Math.sin(a)*49).arc(x,y,49,a,b).stroke({color:colour,width:5,alpha});
      const cx=x+Math.cos(a)*59,cy=y+Math.sin(a)*59;
      g.poly([cx-2,cy,cx,cy-3,cx+2,cy,cx,cy+3]).fill({color:colours.gold,alpha:0.65});
    }
    const angle=-Math.PI/2+(1-fraction)*Math.PI*2;
    const hx=x+Math.cos(angle)*48,hy=y+Math.sin(angle)*48;
    g.circle(hx,hy,7).fill({color:colour,alpha:0.13}).circle(hx,hy,3).fill(colour);
    g.moveTo(x+Math.cos(angle)*34,y+Math.sin(angle)*34).lineTo(hx,hy).stroke({color:colour,width:2});
    if(this.hand) this.hand.rotation=angle+Math.PI/2;
    if(warning && localStorage.getItem('mage-motion')!=='reduced') g.circle(x,y,63).stroke({color:colour,width:2,alpha:0.25+Math.sin(now/450)*0.15});
    this.text.text=`${Math.ceil(left)}h`;
    this.text.x=x-this.text.width/2;
  }
}
