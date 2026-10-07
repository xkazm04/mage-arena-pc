"""Offline r3 triage and current cumulative proof. Historical pages stay intact."""
import html,json,re,os
from collections import defaultdict
from pathlib import Path
import markdown
ROOT=Path(__file__).resolve().parents[2]; AUDIO=ROOT/'docs/audio'
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))
plan=read('tools/audio/audition-plan-r3.json')
plans=[read('tools/audio/'+f)['samples'] for f in ('audition-plan.json','audition-plan-r2.json','audition-plan-r3.json')]
meta={s['id']:s for group in plans for s in group}
ledger=[json.loads(x) for x in (ROOT/'tools/audio/ledger.jsonl').read_text().splitlines() if x]
actual={Path(e['out']).stem:e for e in ledger}
measure={m['id']:m for m in read('docs/audio/evidence/measurements.json')}
new=[e for e in ledger if e.get('wave')=='AU2b']; budget=read('tools/audio/budget.json'); summary=read('docs/audio/evidence/r3/summary.json')
esc=lambda x:html.escape(str(x),quote=True)
slug=lambda x:re.sub(r'[^a-z0-9]+','-',x.lower()).strip('-')
def rel(file,page): return os.path.relpath(file,page.parent).replace('\\','/')
def link(file,label,page):return f'<a href="{esc(rel(file,page))}">{esc(label)}</a>'
def table(head,rows):return '<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+esc(h)+'</th>' for h in head)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+str(v)+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table></div>'
def header(page,title,description):
 return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · Mage Arena</title><link rel="stylesheet" href="{rel(AUDIO/'report.css',page)}"></head><body data-round="r3"><main><header><div class="eyebrow">Mage Arena / AU2b + AU3 preparation / 03 October 2026</div><h1>{esc(title)}</h1><p>{description}</p><div class="toolbar">{link(AUDIO/'audition/r3/index.html','Round 3 triage',page)} {link(AUDIO/'PROOF-REPORT.html','Proof and investment',page)} {link(AUDIO/'AU3-FULL-TRACKS-PLAN.md','Full-track plan',page)} {link(AUDIO/'CHOICES.md','Owner choices',page)}<label>Theme <select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label><input type="checkbox" id="matched" checked> Matched playback level</label></div></header>'''
def notice():
 return f'''<div class="notice"><strong>{len(new)} new samples · {summary['conservativeDebit']:,} / 3,000 AU2b credits.</strong><br>Generation closed for owner review; {budget['unusedCredits']:,} unused. Final shared balance {summary['finalSharedBalance']:,}; stop below 13,000; reserve 8,000. {summary['httpRequests']} serialized requests, {summary['http429']} HTTP 429s. No full tracks, production set or Google calls.</div>'''
def footer(page):
 return f'''<footer><p>Raw originals preserved. Matched review playback attenuates toward −26 LUFS for SFX and −24 for music/voice, with a −3 dBTP ceiling and no boost; absorb partners match down to their quieter member. Short-cue LUFS is only approximate. One clip plays at a time. New votes are blank until owner review.</p><p>{link(AUDIO/'evidence/LOUDNESS.md','Loudness',page)} · {link(AUDIO/'evidence/r3/validation.json','Validation',page)} · {link(AUDIO/'audition/r2/index.html','Historical round 2 triage',page)} · {link(AUDIO/'PROOF-REPORT-r2.html','Historical round 2 proof before owner results',page)}</p><p id="status" class="status" role="status" aria-live="polite"></p></footer></main><script src="{rel(AUDIO/'report.js',page)}"></script></body></html>'''
def player(id,page):
 e,m=actual[id],measure[id]; file=rel(ROOT/e['out'],page)
 header=f"{e['measuredCredits']:g} credits in provider header" if e['measuredCredits'] is not None else 'No per-request credit header'
 warning='<p class="readiness">Raw decoded samples exceed full scale; review gain is attenuated. Production peak treatment remains.</p>' if m['samplesAboveFullScale'] else ''
 if id.startswith('title-') and e.get('wave')=='AU2b': warning+='<p class="muted">30 s requested; closing sketch, not an approved seamless loop.</p>'
 repeat=f'<button type="button" data-loop-target="audio-{id}" aria-pressed="false">Repeat for seam listening</button>' if e['kind']=='music' or e['request'].get('loop') else ''
 cost=f"Immediate delta {e['accountDelta']}; settled delta {e.get('settledDelta','not applicable')}; estimate {e['estimatedCredits']}; conservative debit {e['chargedCredits']}."
 return f'''<div class="sample"><h4>{esc(id)}</h4><audio id="audio-{id}" controls preload="none" src="{esc(file)}" data-gain="{m['auditionGainDb']}" aria-label="{esc(id)}"></audio><small>{m['decodedSeconds']:.3f} s decoded · {e['chargedCredits']:,} conservative credits<br>{header}<br>{m['integratedLufs']} LUFS-I / {m['truePeakDbTP']:+.1f} dBTP · review trim {m['auditionGainDb']:+.1f} dB</small>{warning}<details><summary>Prompt, cost and provenance</summary><p>{esc(e['text'])}</p><p>{esc(e.get('wave','AU1'))} · {e['seconds'] if e['seconds'] is not None else e['chars']} requested {'seconds' if e['seconds'] is not None else 'characters'} · {esc(e['model'])}.</p><p>{cost} These shared-account deltas can include delayed or other-project charges; they are not an attributable invoice. Flags: {esc(', '.join(e['flags']) or 'none')}.</p><p>Thresholded activity {m['headActiveSeconds']}–{m['lastActiveSeconds']} s; not a perceived-event count. Raw files unchanged.</p><a href="{esc(file)}.json">Sidecar: exact request, snapshots and hash</a></details>{repeat}</div>'''
def loudness(entries):return table(['Sample','Decoded s','LUFS-I','dBTP','Review trim'],[(esc(Path(e['out']).stem),measure[Path(e['out']).stem]['decodedSeconds'],measure[Path(e['out']).stem]['integratedLufs'],measure[Path(e['out']).stem]['truePeakDbTP'],measure[Path(e['out']).stem]['auditionGainDb']) for e in entries])
def triage(samples,category,page):
 groups=defaultdict(list)
 for s in samples:groups[s['direction']].append(s)
 text='<div class="cards">'
 for direction,group in groups.items():
  found=[s for s in group if s['id'] in actual]; did=slug(category+' '+direction)
  text+=f'<article class="card" data-direction="{did}" data-label="{esc(category+" / "+direction)}" data-samples="{esc(", ".join(s["id"] for s in found))}"><div class="tag">New · owner review pending</div><h3>{esc(direction)}</h3><p>{esc(group[0]["philosophy"])}</p>'
  for s in found:text+=player(s['id'],page)
  missing=[s['id'] for s in group if s['id'] not in actual]
  if missing:text+='<p class="readiness">Unrendered: '+esc(', '.join(missing))+'.</p>'
  text+='<fieldset><legend>Owner triage for this direction</legend><div class="picks">'+''.join(f'<label><input type="radio" name="pick-{did}" value="{v}"> {v.title()}</label>' for v in ('keep','maybe','reject'))+'</div></fieldset>'
  text+=f'<label for="note-{did}">Optional owner note</label><textarea id="note-{did}" placeholder="What works, what should change?"></textarea></article>'
 return text+'</div>'

page=AUDIO/'audition/r3/index.html';page.parent.mkdir(exist_ok=True)
p=header(page,'Force caught. Melody carried.','Round 3 targets only the rejected categories. Compare against the kept originals, mark keep/maybe/reject per direction, and export Markdown. Owner round-1 and round-2 results remain the authority.')+notice()
cats=list(dict.fromkeys(s['category'] for s in plan['samples']))
p+='<nav aria-label="Themes"><a href="#references">Kept references</a>'+''.join(f'<a href="#{slug(c)}">{esc(c)}</a>' for c in cats)+'<a href="#choices-export">Export choices</a></nav>'
p+='<section id="references"><h2>The kept family · original recordings</h2><p>The three arena keeps appear first. All kept samples below are references, not new purchases or votes. Camp A stays kept as a short direction with the owner’s long-form reservation. Both AIR B takes are retained within the kept family; no new file-level verdict is inferred.</p><div class="cards">'
for id in plan['references']:
 note='Owner keep · arena full-track direction' if id.startswith('arena-') else 'Owner keep · short direction; re-direct for long tracks' if id.startswith('camp-') else 'Owner-kept family · original and sustained revision' if id.startswith('air-') else 'Owner keep · reference'
 p+=f'<article class="card"><div class="tag">{esc(note)}</div><h3>{esc(meta[id]["category"]+" / "+meta[id]["direction"])}</h3>'+player(id,page)+'</article>'
p+='</div></section>'
for cat in cats:
 p+=f'<section id="{slug(cat)}"><h2>{esc(cat)}</h2>'+triage([s for s in plan['samples'] if s['category']==cat],cat,page)+'</section>'
p+='''<section id="choices-export" class="export"><h2>Export owner choices</h2><p>Votes are saved only in this browser and isolated from rounds 1 and 2. Export before moving the report. A keep selects a direction; it does not certify production readiness.</p><div class="toolbar"><button id="refresh-export" type="button">Build Markdown</button><button id="copy" type="button">Copy Markdown</button></div><label for="export">Markdown choices</label><textarea id="export" readonly></textarea></section>'''+footer(page)
page.write_text(p,encoding='utf-8')

page=AUDIO/'PROOF-REPORT.html'
p=header(page,'What is worth carrying forward','Round-2 owner results, AU2b source evidence, and a concrete plan for full arena scores after the reset. Technical measurements and owner judgments are shown separately.')+notice()
p+='<nav aria-label="Evidence"><a href="#owner">Owner results</a><a href="#au2b">AU2b response</a><a href="#cost">Cost and pacing</a><a href="#quality">Technical limits</a><a href="#investment">Investment</a><a href="#catalog">Every original</a><a href="#loudness">Loudness</a></nav>'
p+='<section id="owner"><h2>Round 2 · owner results are now recorded</h2><p>The prior proof’s “owner listening pending” and “zero confirmed fixes” statements describe its historical publication date. The owner has since kept the arena replacements and AIR B, while rejecting every new absorb direction. Those old statements do not describe the current result.</p>'
choices=(AUDIO/'CHOICES.md').read_text(encoding='utf-8')
p+=markdown.markdown(choices[choices.index('## Round 2'):].split('## Round 3')[0],extensions=['tables'])
p+='<p>Round 1 remains: arena A, fire A, water B, earth B and George kept. AIR C original is a maybe for another spell; C2 was not clear enough. Arena C/D and AIR B resolve the requested arena/AIR direction problems by owner judgment. Absorb remains unresolved; no AU2b result has been inferred from successful generation.</p></section>'
p+='<section id="au2b"><h2>AU2b · response to the rejected categories</h2>'+table(['Owner requirement','New direction(s)','Evidence / limit'],[
 ('Energy barrier stopping and slowing energy; natural, no notification/cartoon','Pressure wall, Undertow, Mineral drag — normal/perfect pairs','Six separate source renders; perfect requests stronger clean catch/release. Material identity and outcome clarity await listening.'),
 ('Calm title with arena melodicity, distinct from camp','Reed standard and Lyre vow','Two 30 s prompts; each decodes 29.989 s. A complete melodic arc is requested; no seamless-loop claim.'),
 ('One sand step; liked first roll-A contact, rejected second','Sand plant and Sand cut','Two one-shot briefs, 0.7/0.8 s requested. Exactly one perceived contact must be heard, not inferred from RMS.'),
 ('Raw bloodlust colosseum, not soccer','Hungry terraces and Stamping bowl','Two 3 s sources; menace, voices and stamping remain perceptual checks.'),
 ('Collar alternative only if money remains; B already kept','Stone latch','Generated last after all required files. Existing Stone Waking remains the selected reference.')])+'<p>'+link(AUDIO/'audition/r3/index.html','Listen and triage round 3',page)+'. No kept category was repurchased.</p></section>'
for anchor,title,file in [('cost','Measured cost and serialized pacing','COST-MODEL.md'),('quality','Technical screens, without invented listening results','QUALITY.md')]:
 text=(AUDIO/'evidence/r3'/file).read_text(encoding='utf-8')
 # Evidence Markdown links are relative to its folder, while this page is two levels above.
 text=text.replace('(music-balance-pairs.json)','(evidence/r3/music-balance-pairs.json)')
 p+=f'<section id="{anchor}"><h2>{title}</h2>'+markdown.markdown(text.split('\n',1)[1],extensions=['tables'])+'</section>'
p+='<section id="investment"><h2>Invest in a complete score first; combine with Google for camp</h2><p><strong>Recommendation: do not upgrade ElevenLabs merely to buy more short loops.</strong> After the verified reset and a new production budget, render one 150 s Reed oath score, judge its development, then proceed to Hide and iron and Lyre under iron. Keep ElevenLabs for the owner-selected effects. Compare two new camp approaches in the owner’s Google music interface before spending heavily on camp regeneration.</p>'
p+=table(['Scenario at observed v1 30/s','One track','Three tracks','Three + 50% repairs'],[('120 s','3,600','10,800','16,200'),('150 s preferred','4,500','13,500','20,250'),('180 s','5,400','16,200','24,300')])
p+='<p>The 15 s collar cells fit a requested 96 BPM / 4/4 grid: six bars per cell, sixty bars per 150 s score. All three tracks have exact entrance/theme/development/tension/climax/release prompts in the '+link(AUDIO/'AU3-FULL-TRACKS-PLAN.md','AU3 full-track plan',page)+'. Full scores play through; only their adaptive interior regions require loop seams. Tempo, stems and finished mixes are not yet measured.</p>'
p+='<p>Reset: 2026-10-04 19:31:41 UTC. Read the actual new balance; 90,000 is the observed account limit, not a promised fresh allowance. With 30,000 remaining, the 13,000 floor leaves 17,000: three first takes fit, but a full 4,500-credit retry does not. With 46,000, a proposed 20,250 music budget leaves 25,750. The 8,000 reserve stays inside the stronger floor. This plan does not schedule or authorize generation automatically.</p>'
p+='<p>Current documentation supports long prompt renders and structured composition plans. Newer music models also support stored-audio continuation; uploading old clips is billable, and their model pricing is not measured on this account. Budget the full returned duration plus upload rather than assuming free reuse. See <a href="https://elevenlabs.io/docs/api-reference/music/compose">Compose API</a>, <a href="https://elevenlabs.io/docs/eleven-api/guides/how-to/music/inpainting">inpainting</a>, and <a href="https://elevenlabs.io/docs/api-reference/music/upload">upload pricing contract</a>. No paid capability probe was needed.</p>'
p+='<p>Camp alternatives are a viola/cello chamber narrative and sparse wooden-key/bass statements with composed breathing spaces. Google’s help maps Ultra membership to Flow Music Member benefits and documents Extend/Replace; this owner’s actual entitlement and costs are uninspected. Compare identical 30 s briefs, then a 150 s development test, measuring rejected takes, editing time and cost per accepted minute. API billing is a separate question. <a href="https://support.google.com/flow/answer/17083870?hl=en">Membership help</a> and <a href="https://support.google.com/flow/answer/17084348?co=GENIE.Platform%3DDesktop&amp;hl=en">editing help</a> support the route; exact sample prompts and stopping criteria are in the AU3 plan. No Google call or plan purchase occurred.</p></section>'
p+='<section id="coverage"><h2>Cumulative coverage and conservative debit</h2>'+table(['Round','Files','Debit','Cap'],[(wave,len([e for e in ledger if e.get('wave','AU1')==wave]),f"{sum(e['chargedCredits'] for e in ledger if e.get('wave','AU1')==wave):,}",cap) for wave,cap in [('AU1','4,000'),('AU2','5,000'),('AU2b','3,000')]])+f'<p>{len(ledger)} original files, {sum(e["chargedCredits"] for e in ledger):,} cumulative conservative credits. Caps remain separate; the cumulative total is not an attributable invoice. Every original follows, including rejected takes.</p></section>'
p+='<section id="catalog"><h2>Every original · all three rounds</h2>'
for wave in ('AU1','AU2','AU2b'):
 p+=f'<h3>{wave}</h3><div class="cards">'
 for e in ledger:
  if e.get('wave','AU1')!=wave:continue
  id=Path(e['out']).stem
  p+=f'<article class="card"><div class="tag">{esc(meta[id]["category"])}</div><h3>{esc(meta[id]["direction"])}</h3>'+player(id,page)+'</article>'
 p+='</div>'
p+='</section><section id="loudness"><h2>Loudness · every raw original</h2><p>ffmpeg ebur128 true peak; these measurements do not certify the owner’s requested sound. Source hashes, full envelopes and seam screens remain in '+link(AUDIO/'evidence/measurements.json','measurements.json',page)+'.</p>'+loudness(ledger)+'</section>'+footer(page)
page.write_text(p,encoding='utf-8')
print(json.dumps({'reports':2,'newSamples':len(new),'referencePlayers':len(plan['references']),'cumulativeSamples':len(ledger),'debit':summary['conservativeDebit']}))
