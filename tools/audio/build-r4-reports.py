"""Build factual r4 review/proof pages from the measured manifest. No generation."""
from pathlib import Path
import html, json, os, re, hashlib
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parents[2]; AUDIO=ROOT/'docs/audio'; E=AUDIO/'evidence/r4'
M=json.loads((AUDIO/'manifest-au3.json').read_text(encoding='utf-8')); tracks=M['tracks']
ledger=[json.loads(s) for s in (ROOT/'tools/audio/ledger.jsonl').read_text(encoding='utf-8').splitlines() if s]
entries=[s for s in ledger if s.get('wave')=='AU3']; spent=sum(s['chargedCredits'] for s in entries)
balances=[json.loads(s) for s in (ROOT/'tools/audio/balances.jsonl').read_text(encoding='utf-8').splitlines() if s]; balance=balances[-1]
H=html.escape
def url(file,base): return os.path.relpath(AUDIO/file,base).replace('\\','/')
def link(file,label,base): return f'<a href="{H(url(file,base))}">{H(label)}</a>'
def player(file,label,base,gain=0):
    id='audio-'+hashlib.sha256(file.encode()).hexdigest()[:12]
    repeat=f'<button data-loop-target="{id}" aria-pressed="false">Repeat for seam listening</button>' if file.endswith('/sustain.wav') else ''
    return f'<div class="sample"><h4>{H(label)}</h4><audio id="{id}" controls preload="none" data-gain="{gain}" aria-label="{H(label)}" src="{H(url(file,base))}"></audio>{repeat}</div>'
def triage(id,label,file,base,body):
    choices=''.join(f'<label><input type="radio" name="{id}" value="{v}"> {v.title()}</label>' for v in ['keep','maybe','reject'])
    return f'<article class="card" data-direction="{id}" data-label="{H(label)}" data-samples="{H(file)}"><h3>{H(label)}</h3>{body}<fieldset><legend>Owner pick</legend><div class="picks">{choices}</div></fieldset><label for="note-{id}">Notes</label><textarea id="note-{id}" placeholder="Melody, development, fatigue, space for combat, ending…"></textarea></article>'
def table(headers,rows):return '<div class="table-wrap"><table><thead><tr>'+''.join(f'<th>{H(str(h))}</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{H(str(c))}</td>' for c in row)+'</tr>' for row in rows)+'</tbody></table></div>'
def chart(t):
    a=t['analysis']; fig,axes=plt.subplots(3,1,figsize=(10,7),layout='constrained'); fig.suptitle(t['title']+' — numerical screens, not listening')
    axes[0].plot([s['start']+7.5 for s in a['windows']],[s['rmsDbFS'] for s in a['windows']],marker='o');axes[0].set(ylabel='Cell RMS (dBFS)',xlabel='Source time (s)',xticks=list(range(0,151,15)))
    internal=[s for s in a['boundaries'] if 0<s['requestedSeconds']<150 and s['errorMs'] is not None]
    axes[1].bar([s['requestedSeconds'] for s in internal],[s['errorMs'] for s in internal],width=5);axes[1].axhspan(-20,20,alpha=.15,color='green');axes[1].set(ylabel='Nearest attack error (ms)',xlabel='Requested cell boundary (s)',xticks=list(range(15,150,15)));axes[1].set_ylim(min(-25,min(s['errorMs'] for s in internal)-5),max(25,max(s['errorMs'] for s in internal)+5))
    pairs=list(a['tailRmsDbFS'].items());axes[2].plot(range(len(pairs)),[v for _,v in pairs],marker='o');axes[2].set(xticks=list(range(len(pairs))),xticklabels=[k for k,_ in pairs],ylabel='RMS (dBFS)',xlabel='Final window length (s; progressively shorter)')
    for ax in axes:ax.grid(alpha=.2)
    p=E/f"{t['id']}-screens.svg";fig.savefig(p);plt.close(fig)
    p.write_text('\n'.join(line.rstrip() for line in p.read_text(encoding='utf-8').splitlines())+'\n',encoding='utf-8',newline='\n')
for t in tracks:chart(t)
def assessment(t,base):
    a=t['analysis']; internal=a['internalBoundaryScreen']; raw=t['rawMeasurement']; master=t['mastering']['measurement']
    return f'''<p><strong>Technical delivery; owner listening pending.</strong> No new owner choice has been assigned. Linear files are available; adaptive scheduling, sustain and sting approval remain disabled.</p>
    <p>Requested six phases at 0/15/45/75/105/135 s. The generator returned {raw['decodedSeconds']:.6f} s; the working master is {t['durationSeconds']:.3f} s. The derivative trims {t['mastering']['tailTrimSeconds']*1000:.2f} ms of near-silent overrun. Raw audio is untouched.</p>
    <p><strong>Grid:</strong> strongest interpolated onset periodicity {a['estimatedBpm']:.3f} BPM versus requested 96; {internal['passed']}/{internal['total']} internal cell boundaries have a detected attack within 20 ms. This estimator can follow subdivisions. First true downbeat, six-bar phrase completion and cumulative beat drift are not verified. No time warp was applied, and the manifest does not claim a verified BPM.</p>
    <p><strong>Long form:</strong> no aligned identical 15 s block was detected (maximum waveform correlation {a['literalRepeatScreen']['max15SecondBlockCorrelation']:.4f}; 5 s screen {a['literalRepeatScreen']['max5SecondBlockCorrelation']:.4f}). These screens cannot exclude shifted reuse or establish melodic development. The timed sections and changing cell energy are measurable; instrument leadership, memorable identity and the six-part emotional arc require listening. The exact audition melody was not transcribed or audio-conditioned.</p>
    <p><strong>Ending and vocals:</strong> final 2.5 s RMS {a['tailRmsDbFS']['2.5']} dBFS; final 20 ms {a['tailRmsDbFS']['0.02']} dBFS. A decaying ending is present numerically; a real harmonic release versus an early fade is unverified. No lyrics were supplied, but absence of accidental vocals has not been certified. This environment did not perform an auditory review.</p>
    <p><strong>Mastering:</strong> {master['integratedLufs']:.2f} LUFS / {master['truePeakDbTP']:.2f} dBTP; {master['samplesAtOrAboveFullScale']} full-scale samples. 48 kHz PCM decoded from a lossy MP3, not a native lossless master. Section edits and stings inherit the score’s working gain; they are not independently boosted to full-mix loudness.</p>
    <p><strong>Sustain:</strong> three-repeat numerical seam {'passes' if t['sustainLoop']['numericalScreenPass'] else 'fails'}; adjacent 0.5 s level difference {t['sustainLoop']['adjacentHalfSecondRmsDifferenceDb']:.3f} dB. It is an interior 15 s hold edit, separate from the loop-free full score. Harmonic/rhythmic seam and all tier transitions await listening. The 5 s sting joins a release fragment and source decay; thematic recognition and the join await review.</p>
    <p>{link('evidence/r4/'+t['id']+'-decision.md','Written take / retry decision',base)} · {link('evidence/r4/'+t['id']+'-analysis.json','Measurements and analysis',base)} · {link(t['sidecar'],'Paid-call sidecar',base)}</p>
    <img style="max-width:100%;height:auto" src="{url('evidence/r4/'+t['id']+'-screens.svg',base)}" alt="Cell energy, nearest-boundary attack error, and ending decay numerical charts for {H(t['title'])}">'''
def page(base,proof=False):
    title='AU3 · full arena scores' if not proof else 'Audio proof · AU3 full-length trial'
    body=f'''<header><p class="eyebrow">Mage Arena · Audio · Round 4</p><h1>{title}</h1><p>Two complete scores from the kept arena directions. Generation facts and measured engineering evidence are separate from owner taste and musical approval.</p></header>
    <nav>{link('audition/r4/index.html','Round 4 triage',base)} {link('PROOF-REPORT.html','Current proof',base)} {link('manifest-au3.json','Engine manifest',base)} {link('CHOICES.md','Owner choices',base)} {link('PROOF-REPORT-r3.html','Previous cumulative proof',base)} {link('audition/r3/index.html','Round 3 — still awaiting picks',base)}</nav>
    <div class="toolbar"><label>Theme <select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div>
    <div class="facts"><div class="metric"><strong>{spent:,}</strong>of 10,000 job credits</div><div class="metric"><strong>{balance['remaining']:,}</strong>last observed account balance</div><div class="metric"><strong>30 / s</strong>conservative / observed shared cost</div><div class="metric"><strong>{len(tracks)*150} s</strong>complete normalized scores</div></div>
    <p>Balance observed {H(balance['observedAt'])}. Floor 1,000. Reset {H(balance['resetsAt'])}. Eight-second serialized pacing; no automatic paid retries. All AU3 provider requests succeeded; no 429 or quota error.</p>
    <div class="notice"><strong>Hide and iron deferred.</strong> A 150 s take needs about 4,500 credits; the authorized 90 s fallback needs about 2,700. After C and D, only {10000-spent:,} job credits remain, and the last balance leaves {balance['remaining']-1000:,} above the floor. Neither cut fits. A reset does not renew the job cap. No retry, A, camp, Google or round-3 generation was purchased.</div>'''
    if proof:
        body+='''<section><h2>What this long-form test establishes</h2><p>One structured request per direction produced the complete requested duration. Both use six section prompts in a single composition, empty lyrics and strict durations. That demonstrates a usable long-output route, while acceptance of the actual composition remains pending. The file length and cuts do not prove all six musical phases, a retained audition melody or vocal-free output.</p><p><strong>Strengths:</strong> coherent file delivery without stitching paid miniatures; exact budget estimates matched the immediate and settled shared deltas; no clipping in these sources; workable full-score mastering and decaying tails; inexpensive offline section and sustain edits. <strong>Weaknesses:</strong> style prompts do not carry the exact kept melody; no verified instrument isolation; no musical downbeat certification or guaranteed grid-accurate phrase ends; no auditory evidence yet for long-form development, fatigue, vocals or release. The engine must not treat these full mixes as synchronized stems.</p><h2>Investment recommendation</h2><p>Do not upgrade solely on this technical success. The trial cost 9,000 credits for five requested minutes: 1,800 credits per generated minute, and 13,500 for all three 150 s first takes at this rate. A 50% revision allowance would bring that three-track plan to 20,250. Cost per <em>accepted</em> minute is not yet known because the owner has not heard these takes.</p><p>Keep ElevenLabs for the owner-kept effects and review these arena scores before buying revisions. Continue the planned, separately funded Google comparison for camp and long-form editing only when authorized. No Google audio was generated or evaluated here; the owner’s Ultra membership is not evidence of API credits or of equivalent quality. Compare the same briefs, accepted minutes, motif retention, edit effort and export terms. The current evidence supports combining routes experimentally, not replacing one based on an unrun comparison.</p><p>API capability source: <a href="https://elevenlabs.io/docs/api-reference/music/compose">ElevenLabs Compose API</a>; the fetched 2026-10-04 contract is archived with this run. The measured 30 credits/s is this shared account’s working rate, not a universal provider price or an exclusive invoice attribution.</p></section>'''
    body+='<h2>Cost and loudness</h2>'+table(['Track','Requested / raw seconds','Credits','Immediate / settled delta','Raw LUFS / dBTP','Master LUFS / dBTP'],[[t['title'],f"150 / {t['rawMeasurement']['decodedSeconds']:.6f}",t['cost']['chargedCredits'],f"{t['cost']['sharedImmediateDelta']} / {t['cost']['sharedSettledDelta']}",f"{t['rawMeasurement']['integratedLufs']} / {t['rawMeasurement']['truePeakDbTP']}",f"{t['mastering']['measurement']['integratedLufs']} / {t['mastering']['measurement']['truePeakDbTP']}"] for t in tracks])
    for t in tracks:
        id=t['id']; body+=f'<section id="{id}"><h2>{H(t["title"])}</h2>'
        reference=f'audition/r2/{id}.mp3'; refgain=-26-(-12.8 if 'reed' in id else -15.1)
        body+='<details><summary>Kept audition reference and untouched full raw</summary>'+player(reference,'Owner-kept short reference (matched down toward −26 LUFS)',base,refgain)+player(t['rawFile'],'Untouched full raw (review attenuation)',base,t['mastering']['nominalGainDb'])+'</details>'
        mainplayer=player(t['file'],'Complete 150 s score · −26 LUFS working copy',base)
        body+=mainplayer if proof else triage(id,t['title']+' · full score',t['file'],base,mainplayer)
        body+=assessment(t,base)
        body+='<h3>Section map and players</h3>'+table(['Section','Seconds','Cells (zero-based)','Arrangement tiers'],[[s['name'],f"{s['startSeconds']:g}–{s['endSeconds']:g}",', '.join(str(c['index']) for c in t['cells'] if c['section']==s['name']),', '.join(str(c['arrangementTier'] or 'release') for c in t['cells'] if c['section']==s['name'])] for s in t['sectionMap']])
        body+='<p>Section names describe the authored request. Later thin sections do not downgrade the gameplay tier. The segment index supplies ten 15 s cells; approved transitions remain empty until musical checks pass.</p><div class="cards">'
        for i,s in enumerate(t['sectionMap']):
            p=player(s['file'],s['name'],base)
            body+=f'<article class="card">{p}</article>' if proof else triage(f'{id}-section-{i+1}',t['title']+' · '+s['name'],s['file'],base,p)
        body+='</div><h3>Wave-end and extended-fight candidates</h3><div class="cards">'
        for kind,file,label in [('sting',t['sting']['file'],'5 s release-fragment sting'),('sustain',t['sustainLoop']['file'],'15 s interior sustain loop')]:
            p=player(file,label,base)
            body+=f'<article class="card">{p}</article>' if proof else triage(id+'-'+kind,t['title']+' · '+label,file,base,p)
        body+='</div><p>'+link(f'audition/r4/{id}/segments.json','Sample-exact segment index and loop points',base)+'</p></section>'
    if not proof:body+='''<section class="export"><h2>Export owner notes</h2><p>Choices start blank and are saved only in this browser’s round-4 storage. They do not update CHOICES.md automatically.</p><div class="toolbar"><button id="copy">Copy Markdown</button><button id="refresh-export">Show Markdown</button></div><textarea id="export" aria-label="Markdown export" readonly></textarea></section>'''
    body+=f'''<footer><p>Owner checks: two complete listens, one quietly with combat cues; judge melodic recall, development, fatigue and gameplay space separately. Check vocals, all six phases, real release, reference identity, mono/small speakers, three loop repeats and every proposed transition. AU4 still owns event replay, pause/reset, accelerated perfects, ducking and app-side effect calming.</p><p>{link('evidence/r4/validation.json','Validation evidence',base)} · {link('evidence/r4/COST-MODEL.md','Full-track cost model',base)} · {link('AU3-FULL-TRACKS-PLAN.md','Exact authoring plan',base)}</p><p id="status" class="status" role="status" aria-live="polite"></p></footer>'''
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><link rel="stylesheet" href="{url("report.css",base)}"></head><body data-round="r4"><main>{body}</main><script src="{url("report.js",base)}"></script></body></html>'
(AUDIO/'audition/r4/index.html').write_text(page(AUDIO/'audition/r4'),encoding='utf-8')
(AUDIO/'PROOF-REPORT.html').write_text(page(AUDIO,True),encoding='utf-8')
print(json.dumps(dict(tracks=len(tracks),credits=spent,balance=balance['remaining'],triageCards=len(tracks)*9)))
