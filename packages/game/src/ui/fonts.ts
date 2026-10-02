import { BitmapFont } from 'pixi.js';
let installed: Promise<void> | undefined;
export function installFonts(): Promise<void> {
  return installed ??= (async () => {
    for (const [family,file] of [['CovenantBody','AlegreyaSans-Regular.ttf'],['CovenantTitle','Cinzel.ttf']]) {
      const face = new FontFace(family!, `url(/fonts/${file})`); await face.load(); document.fonts.add(face);
      BitmapFont.install({name:family,style:{fontFamily:family,fontSize:64,fill:0xffffff},chars:[[' ','~'],['\u00a0','\u017f'],'…—–‘’“”•→←↑↓✦'],resolution:2,padding:4});
    }
  })();
}
