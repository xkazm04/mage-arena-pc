"""Produce legible witnesses of existing run loops, with no inferred gait fix."""
from PIL import Image,ImageDraw,ImageOps
from common import ART,ROOT,read,write,sha,relative
from covenant import font
from collections import Counter, defaultdict
import hashlib, html, subprocess

def prepare():
    base=read(ART/'delivery/a10/characters.json');patch=read(ART/'delivery/a14/characters.json');out=ART/'review/a14/gaits';out.mkdir(parents=True,exist_ok=True)
    pages={p['id']:p for p in base['pages']};rows=[]
    for entity,body in base['entities'].items():
        for direction in ['ne','se']:
            clip=body['clips'].get('run',{}).get(direction)
            if not clip:continue
            im=Image.open(ROOT/pages[clip['page']]['file']);keys=[]
            for f in clip['frames']:
                x,y,w,h=f['rect'];key=im.crop((x,y,x+w,y+h));keys.append(ImageOps.mirror(key) if clip['mirrorX'] else key)
            boxes=[k.getbbox() for k in keys];box=[min(b[0] for b in boxes)-5,min(b[1] for b in boxes)-5,max(b[2] for b in boxes)+5,max(b[3] for b in boxes)+5]
            board=Image.new('RGB',(1440,400),'#16212b');d=ImageDraw.Draw(board);d.text((20,12),f'{entity} / {direction} / inherited A10 run keys',font=font(25),fill='#e6e1d6')
            for i,key in enumerate(keys):
                key=ImageOps.contain(key.crop(box),(230,300),Image.Resampling.LANCZOS);board.paste(key,(i*240+(240-key.width)//2,55),key)
                d.text((i*240+25,360),f'key {i} / source {clip["sourceIndices"][i]}',font=font(17),fill='#abc9d1')
            path=out/f'{entity}-{direction}.jpg';board.save(path,quality=96)
            rows.append({'entity':entity,'direction':direction,'file':relative(path),'sha256':sha(path),'clip':clip,'sourcePage':pages[clip['page']]})
    missing=[]
    for old in base['backlog']:
        e,state,d,*_=old.split(':');newstate='hit-light' if state=='hit' else state
        if d not in patch['entities'].get(e,{}).get('clips',{}).get(newstate,{}):missing.append(old)
    write(ART/'waves/A14/gait-inputs.json',{'rows':rows,'legacyMissingAfterStage1':missing,'priorityStage1StillMissing':patch['backlog'],'newImageCalls':0,'owner_accepted':False})
    print(len(rows),'actual run strips;',len(missing),'legacy A10 slots still missing')

def finish():
    data=read(ART/'waves/A14/gait-inputs.json')
    notes={
      'cassia-ne':'Same forward foot throughout; source 4 also loses staff-head continuity. Reordering cannot supply an opposite stride.',
      'cassia-se':'Same leading leg; crouch and body-scale changes do not form an opposite stride.',
      'brennic-ne':'Same forward foot; deep knee bends replace travel in intermediate poses.',
      'brennic-se':'Same forward foot; crouch alone does not alternate the support leg.',
      'garran-ne':'Five exported keys, same leading foot, only small trailing-leg changes.',
      'garran-se':'Same leading leg; isolated knee lift lacks the matching opposite contact.',
      'iskar-ne':'Same leading leg; raised-knee keys and staff-angle changes do not provide an opposite contact.',
      'conscript-ne':'Only three exported keys, all with the same forward leg.',
      'conscript-se':'Same leading leg; one crouch and large spear-angle changes cannot make an alternating gait.',
      'shieldman-ne':'Five exported keys; same visible trailing leg and planted forward foot behind shield.',
      'shieldman-se':'Same leading leg; foot-angle changes lack opposite support.',
      'slinger-ne':'Five exported keys; same leading leg with two deep crouches and vertical torso changes.',
      'slinger-se':'Same leading leg; crouching and foot flex do not create the opposite stride.',
      'netter-ne':'Same leading leg; source 4 floats higher and source 7 narrows stance without opposite contact.',
      'netter-se':'Same leading leg; one crouch, no opposite support pose.',
      'mire_maw-ne':'Crouched hind legs persist; toe changes lack clear extended launch and landing keys for a hop.',
      'thornback-ne':'Small foot changes and body-heading drift; no clearly paired opposite support phase suitable for cheap reselection.',
      'hush_moth-ne':'Raised and lowered wing keys already exist. Leading-leg concern is inapplicable; retaining order avoids an unsupported flight-cycle claim.',
    }
    records=[]
    for r in data['rows']:
        key=r['entity']+'-'+r['direction'];assert key in notes
        records.append({'entity':r['entity'],'direction':r['direction'],'frameCount':len(r['clip']['frames']),
          'sourceIndices':r['clip']['sourceIndices'],'witness':r['file'],'sha256':r['sha256'],
          'finding':notes[key],'action':'retain-existing-clip','newPixels':False,'owner_accepted':False})
    remaining=[x for x in data['legacyMissingAfterStage1'] if x.split(':')[1] not in ('hit','death')]
    grouped=defaultdict(lambda:defaultdict(list))
    for x in remaining:
        e,s,d,*_=x.split(':');grouped[e][s].append(d)
    priority=read(ART/'waves/A14/generation-backlog.json')
    queue={'status':'blocked-providers','newImageCalls':0,'newClips':0,'gaitCorrections':0,
      'priority1':priority,'priority2NonReactionLegacySlots':remaining,
      'legacyA10MissingAfterMerge':data['legacyMissingAfterStage1'],
      'legacyCounts':dict(Counter(x.split(':')[1] for x in data['legacyMissingAfterStage1'])),
      'missingByEntity':dict(grouped),'missingCreatureGeneratedViews':{'cinder_hound':['ne','se'],'mire_maw':['se'],'thornback':['se'],'hush_moth':['se']},
      'rules':['Finish missing A14 reactions before spending on priority 2.',
        'A10 cast means attack for enemies; absorb means brace and grants no new gameplay ability.',
        'Generate ne/se anatomy; derive nw/sw by whole-body mirroring only.',
        'Use Moonchalk and A10 identity references, or approved A3c identity when no A10 body exists.',
        'Use a proof sheet first, serial calls and unchanged deterministic gates; no latch bypass.',
        'Humanoid gait needs opposite support and passing phases; creature movement needs species-specific anatomy.',
        'Garran rear collapse has reached its existing three-attempt guard; rebuilding is not renewed generation authority.'],
      'overlapNote':'84 missing legacy slots include 26 hit/death slots already represented in the 68-slot A14 priority queue; do not add the counts. Priority 2 contains 58 other slots.',
      'owner_accepted':False}
    target=ART/'delivery/a14/stage2';target.mkdir(parents=True,exist_ok=True)
    write(target/'backlog.json',queue);write(target/'gait-audit.json',{'records':records,'newImageCalls':0,'gaitCorrections':0,'owner_accepted':False})
    sections=[]
    for r in records:
        sections.append(f'<section><h2>{r["entity"]} / {r["direction"]} — {r["frameCount"]} keys</h2><p>{html.escape(r["finding"])}</p><img src="gaits/{r["entity"]}-{r["direction"]}.jpg" alt="Actual inherited run keys"></section>')
    rows=''.join('<tr><th>'+e+'</th><td>'+html.escape('; '.join(s+': '+', '.join(ds) for s,ds in states.items()))+'</td></tr>' for e,states in grouped.items())
    board='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A14 stage 2 — inherited gait audit</title>
    <style>body{background:#16212b;color:#e6e1d6;font:18px/1.5 system-ui;margin:0 auto;padding:24px;max-width:1440px}a{color:#abc9d1}img{width:100%;height:auto}section{border-top:1px solid #61727b;margin-top:30px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #61727b;overflow-wrap:anywhere}th{width:22%}p{max-width:1000px}h1{line-height:1.15}</style>
    <h1>A14 stage 2 · inherited gait audit</h1><p><strong>Generation blocked; zero new images, clips or gait corrections.</strong> These are enlarged A10 keys, not new artwork. Fourteen strips contain six keys; four have only three or five exported keys. No safe reordering supplies the absent opposite support phase. Hush moth already has wing movement. This audit does not accept animation quality.</p>
    <p>Stage 1 remains 124/192 slots. The 68 missing priority reaction/collapse/corpse slots come first. There are 84 missing legacy A10 slots, including 26 overlapping hit/death slots: priority 2 has 58 other slots. Enemy cast means attack; absorb means brace. Creature front anatomy remains missing.</p>
    <p>agy remains latched after repeated HTTP 503; Grok after exhausted Build balance (HTTP 402). Local totals remain 342/450, including 24 charges this session. Remaining local reservations do not establish provider availability.</p>
    <p><a href="index.html">Stage-1 owner board and death strips</a> · <a href="motion.html">Actual hit/death playback</a> · <a href="../../delivery/a14/stage2/backlog.json">Exact prioritized queue</a> · <a href="../../delivery/a14/stage2/gait-audit.json">Frame provenance and findings</a></p>
    <h2>Remaining non-reaction clips</h2><table><tr><th>Entity</th><th>Missing A10 state and directions</th></tr>'''+rows+'</table>'+''.join(sections)+'</html>'
    (ART/'review/a14/stage2.html').write_text(board,encoding='utf-8')
    # Compare raw workspace hashes with Git blob hashes without newline normalization.
    paths=subprocess.check_output(['git','ls-tree','-r','--name-only','3c4f4a9','art/delivery/a14','art/usage.json','art/providers/history.json'],cwd=ROOT,text=True).splitlines()
    protected=[]
    for p in paths:
        old=subprocess.check_output(['git','show','3c4f4a9:'+p],cwd=ROOT)
        assert (ROOT/p).read_bytes()==old,'STAGE1_CHANGED:'+p
        protected.append({'file':p,'sha256':hashlib.sha256(old).hexdigest()})
    assert len(records)==18 and len(remaining)==58 and len(data['legacyMissingAfterStage1'])==84
    write(target/'stage2-result.json',{'status':'audit-complete-generation-blocked','stage1Commit':'3c4f4a9',
      'stage1FilesAndLedgersUnchanged':protected,'runLoopsInspected':18,'newImageCalls':0,'newClips':0,'gaitCorrections':0,
      'stage1MissingSlots':68,'remainingNonReactionSlots':58,'legacyMissingSlots':84,'owner_accepted':False})
    print('Stage 2:',len(protected),'stage-1 files/ledgers unchanged; 18 strips, 58 non-reaction slots, zero calls')

if __name__=='__main__':
    prepare();finish()
