from PIL import Image,ImageDraw
from common import ART,ROOT,read
from covenant import font
occ=read(ART/'waves/A12/occluders.json')
for palette,rows in occ['palettes'].items():
    src=Image.open(ART/'review/sources'/f'a12-{palette}-wide-agy-a01.png').convert('RGB')
    sheet=Image.new('RGB',(len(rows)*460,630),'#102029');d=ImageDraw.Draw(sheet)
    for i,obj in enumerate(rows):
        xy=[(x*src.width,y*src.height) for x,y in obj['polygonUV']]
        left=int(min(x for x,y in xy))-28;top=int(min(y for x,y in xy))-25
        right=int(max(x for x,y in xy))+28;bottom=int(max(y for x,y in xy))+25
        crop=src.crop((left,top,right,bottom));crop=crop.resize((crop.width*3,crop.height*3))
        sheet.paste(crop,(i*460,50))
        d.text((i*460+4,10),palette+' '+obj['id'],font=font(17),fill='white')
        for x in range((left//10+1)*10,right,10):
            xx=i*460+(x-left)*3;d.line((xx,50,xx,50+crop.height),fill='#637375',width=1);d.text((xx-10,50+crop.height+3),str(x),font=font(12),fill='white')
        for y in range((top//10+1)*10,bottom,10):
            yy=50+(y-top)*3;d.line((i*460,yy,i*460+crop.width,yy),fill='#637375',width=1);d.text((i*460+crop.width+3,yy-8),str(y),font=font(12),fill='white')
    sheet.save(ART/'waves/A12'/f'{palette}-mask-guide.png')
