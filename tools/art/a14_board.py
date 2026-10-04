"""Death strips, ground poses and local review board from actual atlas pixels."""
import html
from PIL import Image,ImageDraw,ImageOps
from common import ART,ROOT,read,write,sha,relative
from covenant import font

OUT=ART/'review/a14'

def key(m,entity,state,direction,index):
    clip=m['entities'][entity]['clips'][state][direction];p=next(p for p in m['pages'] if p['id']==clip['page']);x,y,w,h=clip['frames'][index]['rect']
    im=Image.open(ROOT/p['file']).crop((x,y,x+w,y+h))
    return ImageOps.mirror(im) if clip['mirrorX'] else im

def build():
    OUT.mkdir(parents=True,exist_ok=True);m=read(ART/'delivery/a14/characters.json');roster=read(ART/'covenant-battle-roster.json')['entities'];rows=[];cards=[]
    for entity in roster:
        strip=Image.new('RGB',(1440,760),'#172437');d=ImageDraw.Draw(strip)
        d.text((20,12),entity+' / generated collapse keys -> persistent lying pose',font=font(25),fill='#e9e4d7')
        for row,direction in enumerate(['ne','se','nw','sw']):
            y=65+row*170;d.text((10,y+40),direction,font=font(24),fill='#aacdf2')
            death=m['entities'].get(entity,{}).get('clips',{}).get('death',{}).get(direction)
            if not death:d.text((100,y+45),'MISSING — not substituted',font=font(23),fill='#de9b86');continue
            n=death['frameCount'];pitch=int(1360/(n+1));size=min(180,pitch)
            for i in range(n+1):
                im=key(m,entity,'death' if i<n else 'corpse',direction,i if i<n else 0).resize((size,size),Image.Resampling.LANCZOS)
                strip.paste(im,(70+i*pitch,y-35),im)
                d.text((90+i*pitch,y+125),str(i+1) if i<n else 'STAYS',font=font(17),fill='#d0e0dc')
        path=OUT/'strips'/f'{entity}.jpg';path.parent.mkdir(parents=True,exist_ok=True);strip.save(path,quality=94)
        rows.append({'entity':entity,'file':relative(path),'sha256':sha(path)})
        sources=m['entities'].get(entity,{}).get('sources',[])
        notes=' '.join(s['facing']+': '+s['limitations'] for s in sources)
        cards.append(f'<article><h2>{html.escape(entity)}</h2><a href="strips/{entity}.jpg"><img src="strips/{entity}.jpg" loading="lazy" alt="{entity} collapse strips and final ground poses"></a><p>{html.escape(notes)}</p></article>')
    contact=Image.new('RGB',(1440,60+380*len(rows)),'#101d1b');d=ImageDraw.Draw(contact)
    d.text((20,12),'A14 / all entities, all four directions / generated collapse and derived final pose',font=font(25),fill='#eae4d7')
    for i,r in enumerate(rows):
        im=Image.open(ROOT/r['file']).resize((720,380),Image.Resampling.LANCZOS)
        # two-column sheet preserves 90px preview frames and is easy to scan.
        contact.paste(im,((i%2)*720,60+(i//2)*380))
    contact=contact.crop((0,0,1440,60+((len(rows)+1)//2)*380));contact.save(OUT/'contact-sheet.jpg',quality=94)
    counts={e:sum(len(v) for s,v in m['entities'].get(e,{}).get('clips',{}).items() if s in ('hit-light','hit-heavy','death','corpse')) for e in roster}
    page='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>A14 hit and defeat</title><style>body{margin:24px;background:#101923;color:#ede7d9;font:18px Georgia}a{color:#acd7e2}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,660px),1fr));gap:20px}article{background:#182633;padding:16px}img{width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}nav{display:flex;gap:24px;flex-wrap:wrap}h2{font-size:23px}</style><h1>A14 · Hit reactions and persistent defeat</h1><p>Generated painted keys, local keying and anchor alignment. Left directions mirror right directions. Static ground poses reuse the final collapse key. Owner review candidates; technical gates and local vision advice do not approve art.</p><nav><a href="motion.html">Actual timed playback on arena plates</a><a href="contact-sheet.jpg">Combined contact sheet</a><a href="extra.html">Additional motion candidates</a><a href="../../delivery/a14/README.md">Loader contract</a><a href="../../delivery/a14/characters.json">Metadata</a><a href="attempts.html">All source attempts</a></nav>'''
    page+=f'<p>Exported {sum(counts.values())}/192 requested state-direction slots. Missing: {len(m["backlog"])}. Separate flinch, stagger, collapse and lying poses.</p><main>'+''.join(cards)+'</main>'
    (OUT/'index.html').write_text(page,encoding='utf-8');write(OUT/'manifest.json',{'rows':rows,'coverage':counts,'owner_accepted':False})
    attempts=[]
    for j in read(ART/'usage.json')['jobs']:
        if j.get('wave')!='A14':continue
        rp=ART/'waves/A14/reviews'/(j['id']+'.json');r=read(rp) if rp.exists() else {'verdict':'unreviewed' if j['status']=='generated' else j['status'],'note':j.get('error','Pending')}
        img=f'<img src="../../{j["archive"].removeprefix("art/")}" loading="lazy">' if j.get('archive') else ''
        attempts.append(f'<article><h2>{j["id"]}</h2>{img}<p>{html.escape(str(r))}</p><details><summary>Prompt</summary><pre>{html.escape(j["prompt"])}</pre></details></article>')
    (OUT/'attempts.html').write_text(page[:page.index('<h1>')]+'<h1>All charged attempts</h1><a href="index.html">Delivery board</a><main>'+''.join(attempts)+'</main>',encoding='utf-8')
    print('A14 board and all death strips built')

if __name__=='__main__':build()
