"""Build portable reports from the actual ledger and authored evidence notes. No API calls."""
import html, json, re
from collections import defaultdict
from pathlib import Path
import markdown

ROOT = Path(__file__).resolve().parents[2]
AUDIO = ROOT / 'docs/audio'
read = lambda p: json.loads((ROOT/p).read_text(encoding='utf-8'))
plan = read('tools/audio/audition-plan.json')['samples']
budget = read('tools/audio/budget.json')
stop = read('tools/audio/STOP.json')
ledger = [json.loads(x) for x in (ROOT/'tools/audio/ledger.jsonl').read_text().splitlines() if x]
actual = {Path(e['out']).stem:e for e in ledger}
measure = {m['id']:m for m in read('docs/audio/evidence/measurements.json')}
categories = list(dict.fromkeys(s['category'] for s in plan))
priority = [s for s in plan if s['scope']=='smaller-audition']
spent = sum(e['chargedCredits'] for e in ledger)
exact = sum(e['measuredCredits'] or 0 for e in ledger)
latest = ledger[-1]['accountAfter']
esc = lambda s: html.escape(str(s),quote=True)
slug = lambda s: re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
num = lambda n: f'{n:,.0f}'

def table(headings, rows):
    return '<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+esc(h)+'</th>' for h in headings)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+str(v)+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table></div>'

def header(title, subtitle, proof=False):
    prefix = '' if proof else '../../'
    link = '<a href="audition/r1/index.html">Open direction triage</a>' if proof else '<a href="../../PROOF-REPORT.html">Cost and investment evidence</a>'
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · Mage Arena</title><link rel="stylesheet" href="{prefix}report.css"></head><body><main><header><div class="eyebrow">Mage Arena / Audio / AU1 / 02 October 2026</div><h1>{esc(title)}</h1><p>{subtitle}</p><div class="toolbar">{link}<a href="{prefix}AUDIO-BIBLE.md">Audio philosophy</a><label>Theme <select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label><input id="matched" type="checkbox" checked> Matched playback level</label></div></header>'''

notice = f'''<div class="notice"><strong>Smaller audition: {len(actual)} of {len(priority)} priority samples generated. Stopped on a real HTTP 429.</strong><br>The owner reduced the total cap to {num(budget['capCredits'])} credits. The shared subscription check after the last absorb sample was rate-limited at {esc(stop['ts'])}. Read-only backoff recovered the balance; the persistent latch still ends all generation. Cap not reached: {num(spent)} conservatively debited, {num(budget['capCredits']-spent)} unused. This limits breadth; it does not show that Starter lacks credits or that an upgrade fixes the request limit.</div>'''

def missing_reason(s):
    return 'Deferred by the smaller scope' if s['scope']=='deferred-smaller-audition' else 'Optional loop probe not reached before 429' if s['scope']=='optional-loop-evidence' else 'Not generated before the 429 stop'

def player(s, proof=False):
    e,m = actual[s['id']],measure[s['id']]
    file = ('audition/r1/' if proof else '')+Path(e['out']).name
    billing = f"{num(e['measuredCredits'])} credits (provider header)" if e['measuredCredits'] is not None else 'Per-request provider charge unavailable'
    warning = '<p class="readiness">Raw decoded peak exceeds full scale; playback is attenuated. Requires production peak treatment.</p>' if m['samplesAboveFullScale'] else ''
    length = f"{e['seconds']} requested seconds" if e['seconds'] else f"{e['chars']} text characters"
    return f'''<div class="sample"><h4>{esc(s['id'])}</h4><audio id="audio-{esc(s['id'])}" controls preload="none" src="{esc(file)}" data-gain="{m['auditionGainDb']}" aria-label="{esc(s['id'])}"></audio><small>{m['decodedSeconds']:.3f} s decoded · {num(e['chargedCredits'])} credits budget debit<br>{billing}<br>Raw {m['integratedLufs']} LUFS-I / {m['truePeakDbTP']:+.1f} dBTP · trim {m['auditionGainDb']:+.1f} dB</small>{warning}<details><summary>Prompt, billing and provenance</summary><p>{esc(e['text'])}</p><p>{length}; model {esc(e['model'])}. {esc(s.get('performanceIntent',''))}</p><p>Shared balance {num(e['accountBefore']['remaining'])} → {num(e['accountAfter']['remaining']) if e['accountAfter'] else 'unavailable'}; delta upper-bound proxy {e['accountDelta']}. Documented estimate {num(e['documentedEstimateCredits'])}; conservative estimate {num(e['estimatedCredits'])}; cap debit {num(e['chargedCredits'])} = maximum of delta, conservative estimate and available header. Flags: {esc(', '.join(e['flags']) or 'none')}.</p><p>Activity starts {m['headActiveSeconds']} s, ends {m['lastActiveSeconds']} s (10 ms RMS threshold; not a listening or event-count test).</p><a href="{esc(file)}.json">Asset sidecar</a></details>{f'<button type="button" data-loop-target="audio-{esc(s["id"])}" aria-pressed="false">Repeat for seam listening</button>' if s['kind']=='music' or s.get('loop') else ''}</div>'''

def footer(proof=False):
    prefix = '' if proof else '../../'
    return f'''<footer><p>All directions are proposals; no owner choices are inferred. Raw files remain unchanged. Matching changes playback only. No service calls occur from this report. AU2–AU4 and production have not started.</p><p><a href="{prefix}evidence/LOUDNESS.md">Loudness evidence</a> · <a href="{prefix}evidence/COST-MODEL.md">Cost assumptions and sources</a> · <a href="{prefix}evidence/validation.json">Validation evidence</a></p><p id="status" class="status" role="status" aria-live="polite"></p></footer></main><script src="{prefix}report.js"></script></body></html>'''

def loudness_table():
    return table(['Sample','Decoded s','LUFS-I','dBTP','LRA LU','Trim dB'],[(esc(m['id']),f"{m['decodedSeconds']:.3f}",m['integratedLufs'],m['truePeakDbTP'],m['loudnessRangeLu'],m['auditionGainDb']) for m in measure.values()])

def note_section(id, filename):
    lines = (AUDIO/'evidence'/filename).read_text(encoding='utf-8').splitlines()
    title = lines.pop(0).lstrip('# ')
    body = '\n'.join('### '+s[3:] if s.startswith('## ') else s for s in lines)
    rendered = markdown.markdown(body,extensions=['tables'])
    rendered = rendered.replace('<table>','<div class="table-wrap"><table>').replace('</table>','</table></div>')
    return f'<section id="{id}"><h2>{esc(title)}</h2>{rendered}</section>'

r1 = header('Pressure, matter, returning light','Round 1 · smaller audition. Compare directions within a theme, mark keep / maybe / reject, and export notes to CHOICES.md.')+notice
r1 += '<nav aria-label="Themes">'+''.join(f'<a href="#{slug(c)}">{esc(c)}</a>' for c in categories)+'</nav>'
r1 += '<p class="muted">Available: physical/radiant casts for all four elements, two normal/perfect absorb pairs, and two arena directions. One narrator is a register probe only. SFX play at −26 LUFS; music/voice at −24, with a −3 dBTP ceiling. Short-cue LUFS matching is approximate. Only one player runs at once.</p>'
for c in categories:
    group = [s for s in plan if s['category']==c]
    r1 += f'<section id="{slug(c)}"><h2>{esc(c)}</h2><div class="cards">'
    dirs = defaultdict(list)
    for s in group: dirs[s['direction']].append(s)
    for direction,samples in dirs.items():
        rendered = [s for s in samples if s['id'] in actual]
        if not rendered: continue
        did = slug(c+' '+direction)
        r1 += f'<article class="card" data-direction="{did}" data-label="{esc(c+" / "+direction)}" data-samples="{esc(", ".join(s["id"] for s in rendered))}"><div class="tag">Proposal · {esc(c)}</div><h3>{esc(direction)}</h3><p>{esc(samples[0]["philosophy"])}</p>'
        r1 += ''.join(player(s) for s in rendered)
        r1 += '<fieldset><legend>Direction choice</legend><div class="picks">'+''.join(f'<label><input type="radio" name="{did}" value="{v}"> {v.title()}</label>' for v in ['keep','maybe','reject'])+'</div></fieldset>'
        r1 += f'<label for="note-{did}">Optional owner note</label><textarea id="note-{did}" placeholder="What works, what should change?"></textarea></article>'
    r1 += '</div>'
    missing = [s for s in group if s['id'] not in actual]
    if missing: r1 += '<details class="empty"><summary>Unheard directions / scope limits</summary><ul>'+''.join(f'<li>{esc(s["id"])} — {missing_reason(s)}</li>' for s in missing)+'</ul></details>'
    r1 += '</section>'
r1 += '''<section class="export"><h2>Take your choices with you</h2><p>Choices stay in localStorage for this browser and file path. Export before moving folders or switching browsers. Paste into <a href="../../CHOICES.md">CHOICES.md</a>. Keep means explore this direction, not accept the raw asset for production.</p><div class="toolbar"><button id="copy" type="button">Copy Markdown choices</button><button id="refresh-export" type="button">Preview Markdown</button></div><label for="export">Markdown export</label><textarea id="export" readonly></textarea></section><section><h2>Measured raw loudness</h2>'''+loudness_table()+'</section>'+footer()
(AUDIO/'audition/r1/index.html').write_text(r1,encoding='utf-8')

p = header('What this smaller audition proves','Investment evidence · every generated take, original prompt, duration, billing evidence and limitations. Nothing has been selected for production.',True)+notice
p += f'<div class="facts"><div class="metric"><strong>{len(actual)} / {len(priority)}</strong>priority samples delivered</div><div class="metric"><strong>{num(exact)}</strong>credits attributed by headers<br>SFX and voice only</div><div class="metric"><strong>{num(spent)} / {num(budget["capCredits"])}</strong>conservative budget debit</div><div class="metric"><strong>{num(latest["remaining"])}</strong>last shared balance<br>8,000 reserve</div></div>'
p += '<nav aria-label="Proof sections">'+''.join(f'<a href="#{i}">{t}</a>' for i,t in [('bought','What the budget bought'),('catalogue','Every sample'),('cost','Cost model'),('quality','Quality and seams'),('loudness','Loudness'),('investment','Production forecast / investment'),('matrix','Fair comparison list')])+'</nav>'
p += '<section id="bought"><h2>What the budget bought</h2><p>13 new samples plus two retained proofs. The reduced plan prioritized 27 short SFX, three 20 s music clips and at most two voices; two ambience probes were optional. The 429 stop came before the remaining categories.</p>'
rows=[]
for c in categories:
    found=[s for s in plan if s['category']==c and s['id'] in actual]
    rows.append((esc(c),len(found),f"{sum(measure[s['id']]['decodedSeconds'] for s in found):.3f}",num(sum(actual[s['id']]['chargedCredits'] for s in found)),num(sum(actual[s['id']]['measuredCredits'] or 0 for s in found))))
rows.append(('<strong>Total</strong>',len(actual),f"{sum(m['decodedSeconds'] for m in measure.values()):.3f}",f'<strong>{num(spent)}</strong>',num(exact)))
p += table(['Category','Count','Decoded seconds','Budget debit credits','Header-attributed subset credits'],rows)
p += '<p>Zero header-attributed music credits means unavailable billing, not free music. Debits are conservative accounting, not an exact provider invoice.</p></section><section id="catalogue"><h2>Everything generated</h2><p>One player per original. Every prompt and both cost estimates are in its card. No discarded or hidden paid takes.</p>'
for c in categories:
    found=[s for s in plan if s['category']==c and s['id'] in actual]
    if not found: continue
    p+=f'<h3>{esc(c)}</h3><div class="cards">'
    for s in found: p+='<article class="card"><h3>'+esc(s['direction'])+'</h3><p>'+esc(s['philosophy'])+'</p>'+player(s,True)+'</article>'
    p+='</div>'
p+='</section>'+note_section('cost','COST-MODEL.md')+note_section('quality','QUALITY.md')
p+='<section id="loudness"><h2>Loudness: every raw sample</h2><p>ffmpeg ebur128=peak=true on the original files. LUFS-I covers the whole clip; short SFX values are descriptive. dBTP is oversampled true peak. Review trim is playback gain, not mastering.</p>'+loudness_table()+'<p><a href="evidence/measurements.json">Full meter, envelope, seam and hash evidence</a>. Individual ebur128 logs are alongside that file.</p></section>'
p+=note_section('investment','INVESTMENT.md')
p+='<section id="matrix"><h2>Same-list comparison: 32 priorities, two optional beds, six deferred briefs</h2><p>The original 40 briefs remain visible to explain the scope reduction. Unsupported or ungenerated requests cannot count as quality failures.</p>'
rows=[]
for s in plan:
    length=f"{s['seconds']} s" if s['seconds'] else f"{len(s['prompt'])} chars"
    rows.append((esc(s['id'])+'<br><small>'+esc(s['category'])+'</small>',length,esc(s['scope']),('Generated' if s['id'] in actual else missing_reason(s))+f'<details><summary>Original brief</summary><p>{esc(s["philosophy"])}</p><p>{esc(s["prompt"])}</p></details>'))
p+=table(['Sample / category','Length','Scope','Status / prompt'],rows)+'</section>'+footer(True)
(AUDIO/'PROOF-REPORT.html').write_text(p,encoding='utf-8')
print(json.dumps({'reports':2,'generated':len(actual),'priorityTarget':len(priority),'budgetDebit':spent,'cap':budget['capCredits']}))
