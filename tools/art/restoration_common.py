"""Deterministic raster packaging authorized for ART session 6; no paid calls."""
import math
import html
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from common import ART, ROOT, read, write, relative, sha
from covenant import font


def luminous_alpha(image, black_floor=3, matte_rgb=None):
    """Extract black-matte emitted light. RGB*A reconstructs source above floor."""
    rgb=np.asarray(image.convert('RGB'),dtype=np.float32)
    if matte_rgb is not None:
        matte=np.asarray(matte_rgb,dtype=np.float32)
        rgb=np.clip((rgb-matte)*255/np.maximum(255-matte,1),0,255)
    value=rgb.max(axis=2)
    alpha=np.where(value>black_floor,value/255,0)
    color=np.clip(rgb/np.maximum(alpha[:,:,None],1/255),0,255)
    color[alpha==0]=0
    return Image.fromarray(np.dstack((color,np.round(alpha*255))).astype('uint8'))


def grid(image, cols, rows):
    for y in range(rows):
        for x in range(cols):
            rect=[round(x*image.width/cols),round(y*image.height/rows),round((x+1)*image.width/cols),round((y+1)*image.height/rows)]
            yield x,y,rect,image.crop(rect)


def alpha_metrics(image, threshold=24):
    a=np.asarray(image.getchannel('A'))
    yy,xx=np.where(a>threshold)
    if not len(xx):return {'empty':True}
    box=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
    return {'empty':False,'bbox':box,'margin_px':min(box[0],box[1],image.width-box[2],image.height-box[3]),
            'coverage':round(float((a>threshold).mean()),5),'mass':round(float(a.sum()/255),2)}


def pack_frames(frames, file, cols=6, cell=256, gutter=2):
    pitch=cell+2*gutter
    atlas=Image.new('RGBA',(cols*pitch,math.ceil(len(frames)/cols)*pitch))
    rects=[]
    for i,im in enumerate(frames):
        if im.size!=(cell,cell):raise ValueError('FRAME_SIZE')
        x=i%cols*pitch+gutter;y=i//cols*pitch+gutter
        atlas.alpha_composite(im,(x,y));rects.append([x,y,cell,cell])
    file.parent.mkdir(parents=True,exist_ok=True);atlas.save(file)
    return {'file':relative(file),'sha256':sha(file),'size':list(atlas.size),'gutter':gutter},rects


def saved(image,path):
    path.parent.mkdir(parents=True,exist_ok=True);image.save(path)
    return {'file':relative(path),'sha256':sha(path),'size':list(image.size)}


def extras(path,ident,note):
    return {'id':ident,'file':relative(path),'sha256':sha(path),'note':note,'owner_accepted':False}


def contact(rows, out, title, columns=4, tile=(380,320)):
    sheet=Image.new('RGB',(columns*tile[0],70+math.ceil(len(rows)/columns)*tile[1]),'#102029')
    d=ImageDraw.Draw(sheet);d.text((24,18),title,font=font(26),fill='#ede6d5')
    for i,(name,im) in enumerate(rows):
        x=i%columns*tile[0];y=70+i//columns*tile[1]
        im=ImageOps.contain(im,(tile[0]-20,tile[1]-55))
        if im.mode=='RGBA':sheet.paste(im,(x+(tile[0]-im.width)//2,y),im)
        else:sheet.paste(im,(x+(tile[0]-im.width)//2,y))
        d.text((x+12,y+tile[1]-44),name,font=font(19),fill='#d6e5e6')
    saved(sheet,out)
    return sheet


def append_wave(wave,status,body):
    path=ROOT/'docs/MAGE-ARENA-PLAN.md';text=path.read_text(encoding='utf-8')
    lines=text.splitlines()
    for i,line in enumerate(lines):
        if line.startswith('| Art | '+wave+' |'):
            cells=line.split('|');cells[-2]=' '+status+' ';lines[i]='|'.join(cells)
    text='\n'.join(lines)+'\n'
    text+=f'\n**ART session 6 / {wave} / 2026-10-03:** {body}\n'
    path.write_text(text,encoding='utf-8')
    path=ROOT/'docs/OWNER-CHECKS.md'
    with path.open('a',encoding='utf-8') as f:
        f.write(f'\n## Session 6 / {wave}\n\n[{wave} owner board](../art/review/{wave.lower()}/index.html). {body}\n\nOwner feel and approval remain unmeasured; the local grader may only reject or route.\n')
