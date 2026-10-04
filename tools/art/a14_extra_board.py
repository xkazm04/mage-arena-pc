"""Review only actual additional clips, never fill missing states with other poses."""
import html
from PIL import Image,ImageDraw
from common import ART,read,write
from covenant import font
from a14_board import key

def build():
    m=read(ART/'delivery/a14/characters.json');out=ART/'review/a14';cards=[];rows=[]
    for e,b in m['entities'].items():
        for state in ('idle','run','cast','absorb'):
            for d,c in b['clips'].get(state,{}).items():
                if d in ('nw','sw'):continue
                strip=Image.new('RGB',(1100,230),'#172437');draw=ImageDraw.Draw(strip)
                title=f'{e} / {state} / {d} / {c["uniqueGeneratedKeys"]} generated keys'
                draw.text((12,8),title,font=font(23),fill='#e8e4d8')
                for i in range(c['frameCount']):
                    im=key(m,e,state,d,i).resize((165,165),Image.Resampling.LANCZOS);strip.paste(im,(12+i*180,37),im)
                    draw.text((30+i*180,200),f'{c["sourceIndices"][i]} / {c["frames"][i]["durationMs"]}ms',font=font(14),fill='#aacdf2')
                filename=f'{e}-{d}-{state}.jpg';folder=out/'extra-strips';folder.mkdir(exist_ok=True);strip.save(folder/filename,quality=94)
                finding=next(s['limitations'] for s in b['sources'] if s['sha256']==c['sourceSha256'])
                cards.append(f'<article><h2>{html.escape(title)}</h2><img src="extra-strips/{filename}" alt="{html.escape(title)}"><p>{html.escape(c["selectionNote"])}</p><p>{html.escape(finding)}</p></article>')
                rows.append({'entity':e,'state':state,'direction':d,'keys':c['uniqueGeneratedKeys']})
    (out/'extra.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>A14 additional motion</title><style>body{background:#101923;color:#eee8d8;font:18px Georgia;margin:24px}a{color:#acd7e2}img{width:100%;height:auto}article{max-width:1100px;margin:24px auto}h2{font-size:22px}</style><h1>Additional motion candidates</h1><p>Generated poses, derived keying and packing. Left facings mirror these right views. Attack uses the A10 cast state; resistance uses absorb, without granting abilities. Owner motion review remains open.</p><nav><a href="index.html">Defeat board</a> · <a href="motion.html">Timed playback</a> · <a href="../../delivery/a14/session10/backlog.json">Exact remaining queue</a></nav>'+''.join(cards),encoding='utf-8')
    write(out/'extra-manifest.json',{'rows':rows,'owner_accepted':False})
    print('Additional motion board:',len(rows),'source clips')

if __name__=='__main__':build()
