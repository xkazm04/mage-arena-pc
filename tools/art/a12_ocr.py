"""CPU OCR using already installed local weights. Downloads explicitly disabled.

Run with the system Python (existing torch), isolated packages under .venv-art6.
OCR output is deterministic advice with hash-bound human review, not a text proof.
"""
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.venv-art6/ocr-libs'))
import json
import hashlib
import random
import numpy as np
import torch
import easyocr
from PIL import Image,ImageDraw,ImageFont

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run():
    torch.set_num_threads(4);torch.manual_seed(47);np.random.seed(47);random.seed(47)
    torch.use_deterministic_algorithms(True)
    model=Path.home()/'.EasyOCR/model'
    reader=easyocr.Reader(['en'],gpu=False,model_storage_directory=str(model),download_enabled=False,verbose=False)
    manifest=json.loads((ROOT/'art/delivery/a12/arena-plates.json').read_text())
    for palette,p in manifest['palettes'].items():
        path=ROOT/p['file'];out=ROOT/'art/delivery/a12/ocr'/f'{palette}.json'
        out.parent.mkdir(parents=True,exist_ok=True)
        if out.exists() and json.loads(out.read_text()).get('imageSha256')==sha(path):continue
        detections=reader.readtext(np.asarray(Image.open(path).convert('RGB')),detail=1,paragraph=False,
            batch_size=1,workers=0,canvas_size=1920,text_threshold=.7,low_text=.4,link_threshold=.4)
        rows=[{'box':np.asarray(box).astype(float).tolist(),'text':text,'confidence':float(conf)} for box,text,conf in detections]
        flags=[r for r in rows if r['confidence']>=.70 and len(''.join(c for c in r['text'] if c.isalnum()))>=2]
        rec={'imageSha256':sha(path),'engine':'EasyOCR 1.7.2, CPU, deterministic algorithms, threads=4, seed=47',
            'modelWeights':{p.name:sha(p) for p in [model/'craft_mlt_25k.pth',model/'english_g2.pth']},
            'modelOrigin':'pre-existing local .EasyOCR/model; no model download','detections':rows,'flagged':flags,
            'verdict':'owner-review','scope':'thresholded text detector, not a proof that no letters exist; abstract runes may give false positives'}
        out.write_text(json.dumps(rec,indent=2)+'\n',encoding='utf-8');print(palette,len(rows),'detections',len(flags),'flags',flush=True)
    # Positive control verifies that the installed detector actually sees lettering.
    control=Image.new('RGB',(800,300),'#172437');ImageDraw.Draw(control).text((55,90),'ARENA 123',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',70),fill='white')
    answer=reader.readtext(np.asarray(control),detail=0)
    result={'input':'synthetic ARENA 123; never a game asset','read':answer,'pass':any('ARENA' in t.upper() for t in answer)}
    (ROOT/'art/delivery/a12/ocr/positive-control.json').write_text(json.dumps(result,indent=2)+'\n')
    if not result['pass']:raise RuntimeError('OCR_POSITIVE_CONTROL_FAILED')

if __name__=='__main__':run()
