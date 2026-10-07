from PIL import Image,ImageDraw
from common import ART,ROOT,read
from covenant import font
m=read(ART/'delivery/a12/arena-plates.json');sheet=Image.new('RGB',(1400,800),'#ecd7cb');d=ImageDraw.Draw(sheet)
index=0
for palette,p in m['palettes'].items():
    master=Image.open(ROOT/p['file']).convert('RGB')
    for obj in p['occluders']:
        x,y,w,h=obj['cropMasterPx'];a=master.crop((x-15,y-15,x+w+15,y+h+15)).convert('RGBA')
        im=Image.open(ROOT/obj['file']);b=Image.new('RGBA',(w+30,h+30),'#cf7789');b.alpha_composite(im,(15,15))
        a.thumbnail((160,340));b.thumbnail((160,340))
        xx=(index%4)*350;yy=(index//4)*400
        sheet.paste(a,(xx,yy+30));sheet.paste(b,(xx+175,yy+30))
        d.text((xx+4,yy+4),palette+' '+obj['id'],font=font(15),fill='black');index+=1
sheet.save(ART/'waves/A12/occluder-mask-review.png')
