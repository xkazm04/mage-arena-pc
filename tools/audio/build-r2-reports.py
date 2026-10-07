"""Portable AU2 triage and cumulative investment evidence; offline only."""
import html,json,re,os
from collections import defaultdict
from pathlib import Path
import markdown

ROOT=Path(__file__).resolve().parents[2]
AUDIO=ROOT/'docs/audio'
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))
plan=read('tools/audio/audition-plan-r2.json')
old=read('tools/audio/audition-plan.json')['samples']
ledger=[json.loads(s) for s in (ROOT/'tools/audio/ledger.jsonl').read_text().splitlines() if s]
actual={Path(e['out']).stem:e for e in ledger}
meta={s['id']:s for s in old+plan['samples']}
measure={m['id']:m for m in read('docs/audio/evidence/measurements.json')}
budget=read('tools/audio/budget.json')
balances=[json.loads(s) for s in (ROOT/'tools/audio/balances.jsonl').read_text().splitlines() if s]
r2=[e for e in ledger if e.get('wave')=='AU2']
spent=sum(e['chargedCredits'] for e in r2)
esc=lambda s:html.escape(str(s),quote=True)
num=lambda n:f'{n:,.0f}'
slug=lambda s:re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
def rel(file,page): return os.path.relpath(file,page.parent).replace('\\','/')
def table(head,rows):
    return '<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+esc(h)+'</th>' for h in head)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+str(v)+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table></div>'
def link(file,label,page): return f'<a href="{esc(rel(file,page))}">{esc(label)}</a>'
def header(page,title,description):
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · Mage Arena</title><link rel="stylesheet" href="{rel(AUDIO/'report.css',page)}"></head><body data-round="r2"><main><header><div class="eyebrow">Mage Arena / AU2 / 03 October 2026</div><h1>{esc(title)}</h1><p>{description}</p><div class="toolbar">{link(AUDIO/'audition/r2/index.html','Round 2 triage',page)} {link(AUDIO/'PROOF-REPORT.html','Investment evidence',page)} {link(AUDIO/'CHOICES.md','Owner choices',page)}<label>Theme <select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label><input type="checkbox" id="matched" checked> Matched playback level</label></div></header>'''
def footer(page):
    return f'''<footer><p>Raw originals are preserved. Review gain changes playback only: −26 LUFS SFX, −24 music/voice, attenuation only and −3 dBTP ceiling. Quiet absorb pairs are matched down to their quieter member; other quiet takes remain below target. Short-cue matching is approximate. One clip plays at a time. New choices are unjudged until the owner listens. AU3 production and AU4 runtime audio remain deferred.</p><p>{link(AUDIO/'evidence/LOUDNESS.md','Loudness evidence',page)} · {link(AUDIO/'evidence/r2/validation.json','Validation evidence',page)} · {link(AUDIO/'audition/r1/index.html','Round 1 audition',page)} · {link(AUDIO/'PROOF-REPORT-r1.html','Historical round 1 proof',page)}</p><p id="status" class="status" role="status" aria-live="polite"></p></footer></main><script src="{rel(AUDIO/'report.js',page)}"></script></body></html>'''
def player(id,page):
    e,m=actual[id],measure[id]
    file=rel(ROOT/e['out'],page)
    billing=f'{num(e["measuredCredits"])} credits in provider header' if e['measuredCredits'] is not None else 'No per-request credit header'
    warning='<p class="readiness">Decoded raw peak exceeds full scale; playback is attenuated. Production peak treatment remains.</p>' if m['samplesAboveFullScale'] else ''
    settle=f'<p>Delayed balance read: {esc(e.get("accountSettled",{}).get("remaining","unavailable") if e.get("accountSettled") else "unavailable")}; settled interval delta {e.get("settledDelta","unavailable")}.</p>' if e['kind']=='music' and e.get('wave')=='AU2' else ''
    sustain=f'<p>AIR envelope screen: {"pass" if m["sustainScreen"]["pass"] else "needs review"}; quarter RMS {esc(m["quarterRmsDbFS"])} dBFS. This does not judge turbine timbre.</p>' if 'sustainScreen' in m else ''
    repeats=f'<button type="button" data-loop-target="audio-{id}" aria-pressed="false">Repeat for seam listening</button>' if e['kind']=='music' or e['request'].get('loop') else ''
    return f'''<div class="sample"><h4>{esc(id)}</h4><audio id="audio-{id}" controls preload="none" src="{esc(file)}" data-gain="{m['auditionGainDb']}" aria-label="{esc(id)}"></audio><small>{m['decodedSeconds']:.3f} s decoded · {num(e['chargedCredits'])} credits conservative debit<br>{billing}<br>{m['integratedLufs']} LUFS-I / {m['truePeakDbTP']:+.1f} dBTP · review trim {m['auditionGainDb']:+.1f} dB</small>{warning}{sustain}<details><summary>Prompt, cost and provenance</summary><p>{esc(e['text'])}</p><p>{e['seconds'] if e['seconds'] is not None else e['chars']} requested {'seconds' if e['seconds'] is not None else 'characters'}; model {esc(e['model'])}. {'AU2' if e.get('wave')=='AU2' else 'AU1'}.</p><p>Shared balance: {num(e['accountBefore']['remaining'])} → {num(e['accountAfter']['remaining']) if e['accountAfter'] else 'unavailable'}. Immediate delta {e['accountDelta']}; estimate {e['estimatedCredits']}; documented estimate {e['documentedEstimateCredits']}; debit {e['chargedCredits']}. Balance deltas include concurrent or delayed account spending and are not an exact invoice. Flags: {esc(', '.join(e['flags']) or 'none')}.</p>{settle}<p>Measured activity: {m['headActiveSeconds']}–{m['lastActiveSeconds']} s. Raw files unchanged.</p><a href="{esc(file)}.json">Sidecar with hash and request</a></details>{repeats}</div>'''
def notice():
    stop=read('tools/audio/STOP.json') if (ROOT/'tools/audio/STOP.json').exists() else None
    status=f'Stopped: {esc(stop["reason"])}.' if stop else 'Generation closed for owner review.' if budget['status']=='closed-owner-review' else f'Generation status: {esc(budget["status"])}.'
    return f'<div class="notice"><strong>{len(r2)} new samples · {num(spent)} / 5,000 AU2 credits conservatively debited.</strong><br>{status} Last shared balance {num(balances[-1]["remaining"])}; hard stop below 14,000; reserve 8,000. Round 1 remains a separate 1,852-credit history. No production set generated.</div>'
def loudness(entries):
    return table(['Sample','Decoded s','LUFS-I','dBTP','Review trim dB'],[(esc(Path(e['out']).stem),measure[Path(e['out']).stem]['decodedSeconds'],measure[Path(e['out']).stem]['integratedLufs'],measure[Path(e['out']).stem]['truePeakDbTP'],measure[Path(e['out']).stem]['auditionGainDb']) for e in entries])

page=AUDIO/'audition/r2/index.html'
p=header(page,'Wind held. Magic returned.','Round 2 · Compare new directions against the owner’s selected family. Mark keep, maybe or reject per direction, add notes, then export Markdown.')+notice()
categories=list(dict.fromkeys(s['category'] for s in plan['samples']))
p+='<nav aria-label="Themes"><a href="#references">Kept references</a>'+''.join(f'<a href="#{slug(c)}">{esc(c)}</a>' for c in categories)+'<a href="#choices-export">Export choices</a></nav>'
p+='<p class="muted">Review playback attenuates loud takes; it cannot boost very quiet ones. Absorb partners are matched down to the quieter member. Some UI takes are unusually quiet. Raw levels and playback trims are shown below each player; these are audition candidates, not mastered game assets.</p>'
p+='<section id="references"><h2>The kept round-1 family</h2><p>These five directions are already kept in CHOICES.md. Use them as references; the new round’s votes start blank.</p><div class="cards">'
notes=['Dramatic entrance and melody','More authentic sound to the cast','More mysterious and magical','Kept by the owner','George kept by the owner']
for id,note in zip(plan['references'],notes):
    p+=f'<article class="card"><div class="tag">Owner keep · round 1</div><h3>{esc(meta[id]["category"])}</h3><p>{esc(note)}</p>'+player(id,page)+'</article>'
p+='</div></section>'
for category in categories:
    p+=f'<section id="{slug(category)}"><h2>{esc(category)}</h2><div class="cards">'
    directions=defaultdict(list)
    for s in plan['samples']:
        if s['category']==category: directions[s['direction']].append(s)
    for direction,samples in directions.items():
        found=sorted([s for s in samples if s['id'] in actual],key=lambda s:0 if s.get('scope')=='AU2-envelope-repair' else 1)
        if not found: continue
        did=slug(category+' '+direction)
        p+=f'<article class="card" data-direction="{did}" data-label="{esc(category+" / "+direction)}" data-samples="{esc(", ".join(s["id"] for s in found))}"><div class="tag">New · owner review pending</div><h3>{esc(direction)}</h3><p>{esc(samples[0]["philosophy"])}</p>'
        for s in found: p+=player(s['id'],page)
        missing=[s['id'] for s in samples if s['id'] not in actual]
        if missing:p+='<p class="readiness">Incomplete direction: '+esc(', '.join(missing))+' unrendered.</p>'
        p+='<fieldset><legend>Owner triage for this direction</legend><div class="picks">'+''.join(f'<label><input type="radio" name="pick-{did}" value="{v}"> {v.title()}</label>' for v in ('keep','maybe','reject'))+'</div></fieldset>'
        p+=f'<label for="note-{did}">Optional owner note</label><textarea id="note-{did}" placeholder="What works, what should change?"></textarea></article>'
    p+='</div>'
    missing=[s for s in plan['samples'] if s['category']==category and s['id'] not in actual]
    if missing:p+='<p class="empty">Unrendered under the budget/stop: '+esc(', '.join(s['id'] for s in missing))+'. Unjudged, not a quality failure.</p>'
    p+='</section>'
p+='''<section id="choices-export" class="export"><h2>Take your choices with you</h2><p>Choices stay in this browser and file path. Export before moving folders or changing browsers, then paste into CHOICES.md. A keep selects a direction for further work.</p><div class="toolbar"><button id="copy" type="button">Copy Markdown choices</button><button id="refresh-export" type="button">Preview Markdown</button></div><label for="export">Markdown export</label><textarea id="export" readonly></textarea></section>'''
p+='<section><h2>Measured loudness · new samples</h2>'+loudness(r2)+'</section>'+footer(page)
page.parent.mkdir(parents=True,exist_ok=True)
page.write_text(p,encoding='utf-8')

page=AUDIO/'PROOF-REPORT.html'
p=header(page,'What round 2 bought','Cumulative investment evidence · every original from both rounds, measured costs, owner feedback, technical limits and a fair future comparison list.')+notice()
p+='<nav aria-label="Proof sections">'+''.join(f'<a href="#{i}">{label}</a>' for i,label in [('response','Owner rejections'),('cost','Corrected cost model'),('limits','429 diagnosis'),('quality','Strengths and weaknesses'),('investment','Production forecast'),('coverage','Coverage and cost'),('catalogue','Every original'),('loudness','Loudness'),('google','Google comparison')])+'</nav>'
for id,file in [('response','OWNER-RESPONSE.md'),('cost','COST-MODEL.md'),('limits','RATE-LIMIT.md'),('quality','QUALITY.md'),('investment','INVESTMENT.md')]:
    lines=(AUDIO/'evidence/r2'/file).read_text(encoding='utf-8').splitlines()
    title=lines.pop(0).lstrip('# ')
    body=markdown.markdown('\n'.join('### '+s[3:] if s.startswith('## ') else s for s in lines),extensions=['tables'])
    note_path=AUDIO/'evidence/r2'/file
    def rebase(match):
        href=html.unescape(match[1])
        if re.match(r'^[a-z]+:',href) or href.startswith('#'): return match[0]
        return f'href="{esc(rel((note_path.parent/href).resolve(),page))}"'
    body=re.sub(r'href="([^"]+)"',rebase,body)
    body=body.replace('<table>','<div class="table-wrap"><table>').replace('</table>','</table></div>')
    p+=f'<section id="{id}"><h2>{esc(title)}</h2>{body}</section>'
p+='<section id="coverage"><h2>Coverage and cost by round and category</h2>'
groups=defaultdict(list)
for e in ledger:groups[(e.get('wave','AU1'),meta[Path(e['out']).stem]['category'])].append(e)
rows=[]
for (wave,category),entries in groups.items():rows.append((wave,esc(category),len(entries),f'{sum(measure[Path(e["out"]).stem]["decodedSeconds"] for e in entries):.3f}',num(sum(e['chargedCredits'] for e in entries)),num(sum(e['measuredCredits'] or 0 for e in entries))))
rows.append(('Both','Total',len(ledger),f'{sum(m["decodedSeconds"] for m in measure.values()):.3f}',num(sum(e['chargedCredits'] for e in ledger)),num(sum(e['measuredCredits'] or 0 for e in ledger))))
p+=table(['Round','Category','Files','Decoded seconds','Conservative debit','Header-attributed subset'],rows)+'<p>Missing music headers are unavailable attribution, never free generation. Round 1 cap: 4,000; AU2 cap: 5,000. Adding the debits does not combine their caps.</p></section>'
p+='<section id="catalogue"><h2>Every generated original · both rounds</h2><p>No paid take is hidden. Owner keeps and rejections are documented in CHOICES.md; all AU2 takes await owner listening.</p>'
for (wave,category),entries in groups.items():
    p+=f'<h3>{wave} · {esc(category)}</h3><div class="cards">'
    for e in entries:
        id=Path(e['out']).stem
        p+=f'<article class="card"><h3>{esc(meta[id]["direction"])}</h3><p>{esc(meta[id]["philosophy"])}</p>'+player(id,page)+'</article>'
    p+='</div>'
p+='</section><section id="loudness"><h2>Raw loudness · every original</h2><p>ffmpeg ebur128=peak=true; integrated LUFS is descriptive for short cues, not a listening verdict. Detailed envelopes and repeat screens are in <a href="evidence/measurements.json">measurements.json</a>.</p>'+loudness(ledger)+'</section>'
p+='''<section id="google"><h2>Same-list Google comparison · proposed, no calls</h2><p>First check which Google interface the owner’s Ultra allowance actually covers for standalone instrumental music, short SFX and downloadable speech. Record unavailable modalities instead of substituting video audio or dropping categories. Verify the actual credit conversion, concurrency limits, export formats and game-use terms before spending.</p><p>Use the 39 original required AU2 briefs below, unchanged lengths, one first take each and the same playback trims. The two AIR follow-ups document an additional two-attempt repair allowance. Also compare the kept George line “The collar loosens. Stand ready.” (32 characters) in a comparable calm stock register. Three kept-cast variants are optional on both services. Count rejections, retries and editing time. Begin with Reed oath, AIR Silk rotor, Warm rune normal/perfect and the voice line as a small capability probe. Blind owner judging should compare sustained wind, audible melody, reward grammar, material family, loop continuity and repetition comfort. Test independent aligned adaptive stems separately; complete mixes cannot prove that capability.</p><p>Record exact prompt, interface/model, duration, latency, cost, failure, loudness, seam metrics and keep/maybe/reject. Calculate cost per owner-kept direction and later per accepted production asset. No Google service has been invoked.</p>'''
rows=[]
for s in plan['samples']:
    rows.append((esc(s['id']),f'{s["seconds"]} s', 'optional' if s['priority']==3 else 'repair allowance' if s.get('scope')=='AU2-envelope-repair' else 'required','Generated' if s['id'] in actual else 'Unrendered',f'<details><summary>Identical comparison brief</summary><p>{esc(s["prompt"])}</p></details>'))
p+=table(['Sample','Requested length','Comparison scope','ElevenLabs status','Prompt'],rows)+'</section>'+footer(page)
page.write_text(p,encoding='utf-8')
print(json.dumps({'reports':2,'newSamples':len(r2),'cumulativeSamples':len(ledger),'AU2Debit':spent,'cap':budget['capCredits']}))
