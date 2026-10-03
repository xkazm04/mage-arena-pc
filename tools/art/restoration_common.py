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


def adaptive_magenta(image, matte_rgb=None,minimum_matte_chroma=50):
    """Key generated pink/magenta, preserving pale lilac and neutral paint."""
    rgb=np.asarray(image.convert('RGB'),dtype=np.float32)
    if matte_rgb is None:
        candidate=(rgb[:,:,0]-rgb[:,:,1]>80)&(rgb[:,:,2]-rgb[:,:,1]>55)
        patches=rgb[candidate] if candidate.mean()>.1 else np.concatenate([rgb[:8,:8].reshape(-1,3),rgb[:8,-8:].reshape(-1,3),rgb[-8:,:8].reshape(-1,3),rgb[-8:,-8:].reshape(-1,3)])
        matte_rgb=np.median(patches,axis=0)
    matte=np.asarray(matte_rgb,dtype=np.float32)
    if matte[0]-matte[1]<minimum_matte_chroma or matte[2]-matte[1]<minimum_matte_chroma:raise ValueError('NO_MAGENTA_MATTE')
    r=(rgb[:,:,0]-rgb[:,:,1])/(matte[0]-matte[1])
    b=(rgb[:,:,2]-rgb[:,:,1])/(matte[2]-matte[1])
    chroma=np.minimum(r,b)
    # A neutral edge composited over pink has chroma equal to matte coverage.
    # Preserve light lilac paint in interiors; unmix saturated edge spill.
    alpha=np.clip(1-chroma,0,1)
    alpha[(rgb[:,:,1]>110)&(chroma<.25)]=1
    alpha[chroma>.94]=0
    clean=np.clip((rgb-(1-alpha[:,:,None])*matte)/np.maximum(alpha[:,:,None],.04),0,255)
    spill=(alpha<.96)&(clean[:,:,0]>clean[:,:,1]+12)&(clean[:,:,2]>clean[:,:,1]+12)
    clean[:,:,0][spill]=clean[:,:,1][spill]+5
    clean[:,:,2][spill]=clean[:,:,1][spill]+5
    clean[alpha==0]=0
    return Image.fromarray(np.dstack((clean,np.round(alpha*255))).astype('uint8')),matte.tolist()


def separated_sheet(image, columns=3):
    """Find actual empty inter-object bands; two rows may split per column."""
    keyed,matte=adaptive_magenta(image);a=np.asarray(keyed.getchannel('A'))
    def split(weights,nominal,radius):
        lo=max(1,round(nominal-radius));hi=min(len(weights)-1,round(nominal+radius))
        good=np.where(weights[lo:hi]==0)[0]+lo
        if not len(good):return int(lo+np.argmin(weights[lo:hi]))
        runs=np.split(good,np.where(np.diff(good)>1)[0]+1)
        run=max(runs,key=lambda r:len(r)-abs(float(r.mean())-nominal)*.04)
        return int(round(float(run.mean())))
    edges=[0]+[split((a>24).sum(axis=0),image.width*i/columns,image.width*.055) for i in range(1,columns)]+[image.width]
    rows=[]
    for x in range(columns):
        col=a[:,edges[x]:edges[x+1]]
        middle=split((col>24).sum(axis=1),image.height*.5,image.height*.2)
        for y,(top,bottom) in enumerate([(0,middle),(middle,image.height)]):
            rect=[edges[x],top,edges[x+1],bottom]
            rows.append((x,y,rect,keyed.crop(rect),matte))
    return sorted(rows,key=lambda r:(r[1],r[0]))


def isolated_sheet(image,columns=3,excluded_indices=()):
    """Separate complete objects even when their row bounding boxes overlap.

    Pixels belong to the nearest opaque connected component. Component centroids
    assign the declared six sheet slots; no semantic acceptance is inferred.
    """
    from scipy import ndimage
    keyed,matte=adaptive_magenta(image);rgba=np.asarray(keyed).copy();alpha=rgba[:,:,3]
    labels,count=ndimage.label(alpha>=200)
    areas=np.bincount(labels.ravel());valid=areas>=8;valid[0]=False
    opaque=valid[labels]
    if not opaque.any():raise ValueError('NO_OPAQUE_SUBJECTS')
    distance,nearest=ndimage.distance_transform_edt(~opaque,return_indices=True)
    rgba[:,:,3]=np.round(alpha*np.clip((16-distance)/8,0,1)).astype('uint8')
    rgba[rgba[:,:,3]==0]=0
    groups=np.zeros(count+1,dtype='int16')
    for ident in np.flatnonzero(valid):
        yy,xx=np.where(labels==ident)
        col=min(columns-1,int(float(xx.mean())/image.width*columns))
        row=min(1,int(float(yy.mean())/image.height*2))
        groups[ident]=row*columns+col+1
    assignment=groups[labels[nearest[0],nearest[1]]]
    rows=[]
    for index in range(columns*2):
        if index in excluded_indices:continue
        own=rgba.copy();own[assignment!=index+1]=0
        full=Image.fromarray(own);metric=alpha_metrics(full)
        if metric['empty']:raise ValueError('MISSING_SHEET_SUBJECT:'+str(index))
        # A global edge violation cannot be hidden by subsequent padding.
        if metric['margin_px']<2:raise ValueError('GLOBAL_SOURCE_CLIP:'+str(index))
        box=full.getbbox();rect=[max(0,box[0]-6),max(0,box[1]-6),min(image.width,box[2]+6),min(image.height,box[3]+6)]
        rows.append((index%columns,index//columns,rect,full.crop(rect),matte))
    return rows


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
