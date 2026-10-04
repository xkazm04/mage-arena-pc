"""U6c: read-only sibling deliveries, hash-verified additive imports and lossless A14 packing."""
import copy, hashlib, json, math, shutil, subprocess
from pathlib import Path
from PIL import Image
root=Path('assets/accepted/covenant'); art=Path('../mage-arena-art'); out=Path('docs/waves/U6c-evidence');out.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(p.read_text(encoding='utf8'))
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n',encoding='utf8',newline='\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def head(p):return subprocess.check_output(['git','-C',str(p),'rev-parse','HEAD'],text=True).strip()
art_commit=head(art)
assert read(art/'art/delivery/a14/checks.json')['status']=='pass'
assert read(art/'art/delivery/a14/portable-check.json')['status']=='pass'
assert read(art/'art/delivery/a14/tests.json')['status']=='pass'
for file,expected in read(art/'art/delivery/a14/portable-check.json')['productHashes'].items():
 assert file.startswith('art/delivery/a14/') and '..' not in file
 assert sha(art/file)==expected
manifest=read(root/'manifest.json');base=read(root/'a10/packed/characters.json');patch=read(art/'art/delivery/a14/characters.json');imported=[];packing=[]
def take(src,rel,key=None,expected=None):
 dest=root/rel;dest.parent.mkdir(parents=True,exist_ok=True)
 assert not expected or sha(src)==expected
 shutil.copyfile(src,dest);entry={'file':str(rel).replace('\\','/'),'sha256':sha(dest)}
 if key:manifest['entries'][key]=entry
 imported.append({'source':str(src),'file':str(dest),'sha256':entry['sha256']})
# Copy only the delivery boundary; never resolve source/raw paths in provenance.
for src in sorted((art/'art/delivery/a14').rglob('*')):
 if src.is_file():take(src,Path('a14')/src.relative_to(art/'art/delivery/a14'))
for name in ['manifest.json','extra-manifest.json']:
 src=art/'art/review/a14'/name;dest=out/('review-'+name);shutil.copyfile(src,dest)
write(out/'review-hashes.json',{name:sha(art/'art/review/a14'/name) for name in ['manifest.json','extra-manifest.json','index.html','extra.html','motion.html','contact-sheet.jpg']})
for page in patch['pages']:
 assert not any(p['id']==page['id'] for p in base['pages'])
 src=art/page['file'];assert sha(src)==page['sha256']
 image=Image.open(src).convert('RGBA')
 frames=[f for b in patch['entities'].values() for ds in b['clips'].values() for c in ds.values() if c['page']==page['id'] for f in c['frames']]
 rects=sorted(set(tuple(f['rect']) for f in frames));cells={r:image.crop((r[0],r[1],r[0]+r[2],r[1]+r[3])) for r in rects};bounds=[c.getchannel('A').getbbox() for c in cells.values()];assert all(bounds)
 l,t=min(b[0] for b in bounds),min(b[1] for b in bounds);r,b=max(x[2] for x in bounds),max(x[3] for x in bounds);w,h=r-l,b-t
 cols=min(8,len(rects));size=(cols*(w+4),math.ceil(len(rects)/cols)*(h+4));atlas=Image.new('RGBA',size);mapping={}
 for i,rect in enumerate(rects):
  x,y=i%cols*(w+4)+2,i//cols*(h+4)+2;crop=cells[rect].crop((l,t,r,b));atlas.paste(crop,(x,y));assert atlas.crop((x,y,x+w,y+h)).tobytes()==crop.tobytes();mapping[rect]=[x,y,w,h]
 for f in frames:
  rect=tuple(f['rect']);f.update(rect=mapping[rect],orig=[rect[2],rect[3]],trim=[l,t,w,h],sourceRect=list(rect))
 file=f"a14/packed/{page['id']}.png";dest=root/file;dest.parent.mkdir(parents=True,exist_ok=True);atlas.save(dest)
 spec={**page,'file':file,'size':list(size),'sha256':sha(dest)};base['pages'].append(spec);manifest['entries']['a10.packed.'+page['id']]={'file':file,'size':list(size),'sha256':spec['sha256']}
 packing.append({'page':page['id'],'sourceSha256':page['sha256'],'originalBytes':image.width*image.height*4,'packedBytes':size[0]*size[1]*4,'keys':len(rects),'pixelEquality':True,'nonzeroAlphaDiscarded':0})
for entity,b in patch['entities'].items():
 target=base['entities'].setdefault(entity,{**copy.deepcopy(b),'clips':{}})
 for state,dirs in b['clips'].items():
  target['clips'].setdefault(state,{})
  for direction,clip in dirs.items():
   target['clips'][state][direction]={**copy.deepcopy(clip),'anchor':clip.get('anchor',b['anchor']),'designSize1080':b['designSize1080'],'designBodyHeight1080':b['designBodyHeight1080'],'delivery':'A14'}
 target['clips']['hit']={**target['clips'].get('hit',{}),**target['clips'].get('hit-light',{})}
base['id']='covenant-a10-a14-game-packed';base['a14Backlog']=patch['backlog'];base['backlog']=[k for k in base['backlog'] if not base['entities'].get(k.split(':')[0],{}).get('clips',{}).get(k.split(':')[1],{}).get(k.split(':')[2])]
base['a14Integration']={'sourceCommit':art_commit,'ownerAccepted':False,'scalePolicy':'legacy body sizes unchanged; A14 per-clip v3 size and nominal height applied once','packing':'lossless common alpha bounds, orig/trim, no resampling'}
# Same loader key, additive output file; preserve the original A10 manifest for reproduction.
write(root/'a14/packed/characters.json',base);manifest['entries']['a10.packed.manifest']={'file':'a14/packed/characters.json','sha256':sha(root/'a14/packed/characters.json')}
manifest['integration']='U2 + U4 + U5 + U6 + U6b + U6c';write(root/'manifest.json',manifest)
write(out/'import.json',{'artCommit':art_commit,'artImported':imported,'packing':packing,'packedBytes':sum(p['packedBytes'] for p in packing),'originalBytes':sum(p['originalBytes'] for p in packing),'a14Backlog':patch['backlog'],'currentQueue':read(art/'art/delivery/a14/session10/backlog.json'),'ownerAccepted':False})
print(json.dumps({'a14Pages':len(packing),'packedMiB':sum(p['packedBytes'] for p in packing)/1048576,'importedFiles':len(imported)},indent=2))
