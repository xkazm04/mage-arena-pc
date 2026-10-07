"""Local measured restoration using existing ComfyUI runtime, no paid image call.

Run: C:/Users/kazda/comfyui/venv/Scripts/python.exe tools/art/a12_upscale.py moonlit
Model source/licence and SHA are recorded before loading. Infer in padded tiles
solely for memory use; they are not generated arena floor tiles.
"""
import argparse
import time
import hashlib
import json
from pathlib import Path
import numpy as np
import torch
import spandrel
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[2];WAVE=ROOT/'art/waves/A12'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def run(palette):
    record=json.loads((WAVE/'upscaling-tools.json').read_text());info=record['plannedModel'];weight=ROOT/info['localPath']
    if sha(weight)!=info['sha256']:raise ValueError('MODEL_HASH_MISMATCH')
    source=ROOT/'art/review/sources'/f'a12-{palette}-wide-agy-a01.png'
    out=WAVE/'upscaled'/f'{palette}.png';side=out.with_suffix('.json');out.parent.mkdir(parents=True,exist_ok=True)
    if side.exists() and json.loads(side.read_text())['sourceSha256']==sha(source) and sha(out)==json.loads(side.read_text())['outputSha256']:
        print(palette,'cached');return
    torch.manual_seed(47);torch.backends.cudnn.benchmark=False;torch.backends.cudnn.deterministic=True
    model=spandrel.ModelLoader().load_from_file(weight).eval().to('cuda').half()
    im=Image.open(source).convert('RGB');a=np.asarray(im,dtype=np.float32)/255
    h,w=a.shape[:2];scale=int(model.scale);tile=224;pad=32
    result=np.zeros((h*scale,w*scale,3),dtype=np.uint8);start=time.monotonic()
    with torch.inference_mode():
        for y in range(0,h,tile):
            for x in range(0,w,tile):
                x1=min(x+tile,w);y1=min(y+tile,h)
                left=max(x-pad,0);top=max(y-pad,0);right=min(x1+pad,w);bottom=min(y1+pad,h)
                tensor=torch.from_numpy(a[top:bottom,left:right].transpose(2,0,1).copy()).unsqueeze(0).cuda().half()
                patch=model(tensor).float().clamp(0,1)[0].permute(1,2,0).cpu().numpy()
                patch=patch[(y-top)*scale:(y1-top)*scale,(x-left)*scale:(x1-left)*scale]
                result[y*scale:y1*scale,x*scale:x1*scale]=np.round(patch*255).astype('uint8')
            print(palette,'row',y,flush=True)
    learned=Image.fromarray(result).resize((3072,1728),Image.Resampling.LANCZOS)
    baseline=im.resize((3072,1728),Image.Resampling.LANCZOS)
    # Preserve most of the original paint; learned pass is a restrained contribution.
    blend=Image.blend(baseline,learned,.35);blend.save(out)
    samples=[baseline,learned,blend];labels=['Lanczos interpolation','Learned restoration 100%','Candidate: 35% learned / 65% Lanczos']
    board=Image.new('RGB',(1920,2*424),'#111b23');d=ImageDraw.Draw(board);f=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',20)
    for row,(cx,cy) in enumerate(((1536,470),(1670,1110))):
        for col,(image,label) in enumerate(zip(samples,labels)):
            board.paste(image.crop((cx-320,cy-192,cx+320,cy+192)),(col*640,row*424+40))
            d.text((col*640+12,row*424+10),label,font=f,fill='white')
    comparison=WAVE/'upscaled'/f'{palette}-upscale-comparison.png';board.save(comparison)
    rec={'source':source.relative_to(ROOT).as_posix(),'sourceSha256':sha(source),'sourceSizePx':[w,h],
      'output':out.relative_to(ROOT).as_posix(),'outputSha256':sha(out),'outputSizePx':[3072,1728],
      'model':info,'runtime':{'torch':torch.__version__,'spandrel':spandrel.__version__,'device':torch.cuda.get_device_name(),'precision':'float16'},
      'settings':{'inferenceScale':scale,'tileInputPx':tile,'contextPadPx':pad,'seed':47,'learnedBlend':.35,'resampling':'Lanczos'},
      'elapsedSeconds':round(time.monotonic()-start,3),'comparison':comparison.relative_to(ROOT).as_posix(),
      'honesty':'Learned sharpening/denoising can invent texture; this is not recovered/native 3072px detail. 65% Lanczos retains source paint. No diffusion detail generation.',
      'selection':'pending direct comparison; owner acceptance unmeasured'}
    side.write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps({'palette':palette,'seconds':rec['elapsedSeconds']}),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('palette');run(p.parse_args().palette)
