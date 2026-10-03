"""Offline raw-file evidence. No generation and no perceptual pass claims."""
import hashlib, json, math, re, subprocess
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/audio/evidence'
EVIDENCE.mkdir(parents=True, exist_ok=True)
ledger = [json.loads(line) for line in (ROOT / 'tools/audio/ledger.jsonl').read_text().splitlines() if line]
results = []
cached = {m['source']:m for m in json.loads((EVIDENCE/'measurements.json').read_text())} if (EVIDENCE/'measurements.json').exists() else {}
def db(value): return round(20 * math.log10(max(float(value), 1e-12)), 2)
for entry in ledger:
    source = ROOT / entry['out']
    if entry['out'] in cached and cached[entry['out']]['sourceSha256'] == hashlib.sha256(source.read_bytes()).hexdigest():
        results.append(cached[entry['out']])
        continue
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(source)]))
    stream = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    rate, channels = int(stream['sample_rate']), int(stream['channels'])
    cmd = ['ffmpeg', '-hide_banner', '-i', str(source), '-af', 'ebur128=peak=true', '-f', 'null', '-']
    measured = subprocess.run(cmd, capture_output=True, text=True, check=True).stderr
    meter_log = EVIDENCE / (source.stem + '.ebur128.txt')
    if not meter_log.exists():
        stable_log = re.sub(r'\[Parsed_ebur128_\d+ @ [0-9a-fA-F]+\]', '[Parsed_ebur128 @ ADDRESS]', measured)
        meter_log.write_text('\n'.join(line.rstrip() for line in stable_log.splitlines())+'\n', encoding='utf-8')
    summary = measured.rsplit('Summary:', 1)[1]
    lufs = float(re.search(r'I:\s+([-\d.]+) LUFS', summary)[1])
    peak = float(re.search(r'Peak:\s+([-\d.]+) dBFS', summary)[1])
    lra = float(re.search(r'LRA:\s+([-\d.]+) LU', summary)[1])
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source), '-f', 'f32le', '-acodec', 'pcm_f32le', '-'])
    pcm = np.frombuffer(raw, dtype='<f4').reshape(-1, channels)
    mono = pcm.mean(axis=1)
    frame = max(1, rate // 100)
    blocks = mono[:len(mono)//frame*frame].reshape(-1, frame)
    rms = np.sqrt(np.mean(blocks**2, axis=1))
    active = np.where(rms >= max(float(rms.max()) * 0.01, 1e-5))[0]
    rms_db = [db(v) for v in rms]
    n = min(rate//2, len(pcm)//4)
    head_rms, tail_rms = np.sqrt(np.mean(pcm[:n]**2)), np.sqrt(np.mean(pcm[-n:]**2))
    def centroid(segment):
        spectrum = abs(np.fft.rfft(segment * np.hanning(len(segment))))
        frequencies = np.fft.rfftfreq(len(segment), 1/rate)
        return float(np.sum(frequencies*spectrum) / max(np.sum(spectrum), 1e-12))
    seam = {
        'diagnosticOnly': True,
        'boundaryJumpDbFS': db(np.max(np.abs(pcm[0]-pcm[-1]))),
        'headHalfSecondRmsDbFS': db(head_rms), 'tailHalfSecondRmsDbFS': db(tail_rms),
        'edgeLevelDifferenceDb': round(abs(db(head_rms)-db(tail_rms)), 2),
        'headCentroidHz': round(centroid(mono[:n])), 'tailCentroidHz': round(centroid(mono[-n:])),
        'clickCriterionDbFS': -60, 'levelStepCriterionDb': 3,
        'numericScreen': 'pass' if db(np.max(np.abs(pcm[0]-pcm[-1]))) <= -60 and abs(db(head_rms)-db(tail_rms)) <= 3 else 'needs-repair',
        'repeatsAnalyzed': 3, 'jointsAnalyzed': 2,
        'method': 'Decoded PCM concatenated conceptually three times; identical end/start samples and 0.5 s windows at both joins. No repair or resampling. This is a discontinuity screen, not a listening or tempo test.',
        'perceptualSeam': 'not measured', 'tempoGrid': 'not measured', 'phaseCompatibleStems': 'not delivered'
    }
    # Check both actual joins of a three-repeat PCM sequence without writing a derivative asset.
    repeated = np.tile(pcm, (3, 1))
    seam['jointJumpsDbFS'] = [db(np.max(np.abs(repeated[j*len(pcm)]-repeated[j*len(pcm)-1]))) for j in (1, 2)]
    gain = min(0, (-26 if entry['kind'] == 'sfx' else -24) - lufs, -3 - peak)
    result = {
        'id': source.stem, 'wave': entry.get('wave','AU1'), 'source': entry['out'], 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'codec': stream['codec_name'], 'sampleRate': rate, 'channels': channels,
        'requestedSeconds': entry['seconds'], 'containerSeconds': float(probe['format']['duration']),
        'decodedSeconds': round(len(pcm)/rate, 6), 'decodedSamplesPerChannel': len(pcm),
        'integratedLufs': lufs, 'truePeakDbTP': peak, 'loudnessRangeLu': lra,
        'samplePeakDbFS': db(np.max(np.abs(pcm))), 'samplesAboveFullScale': int(np.sum(np.abs(pcm)>1)),
        'headActiveSeconds': round(active[0]*frame/rate, 3) if len(active) else None,
        'lastActiveSeconds': round((active[-1]+1)*frame/rate, 3) if len(active) else None,
        'activityThreshold': '-40 dB relative to maximum 10 ms RMS, floor -100 dBFS',
        'auditionGainDb': round(gain, 2), 'seam': seam if entry['kind']=='music' or entry['request'].get('loop') else None,
        'envelope10msRmsDbFS': rms_db,
        'command': 'ffmpeg -hide_banner -i <source> -af ebur128=peak=true -f null -',
        'status': 'measured raw provider output; owner listening pending'
    }
    continuity_pcm = pcm[:2*rate] if entry.get('wave')=='AU2' and source.stem.startswith('air-') else pcm
    quarter_levels = [db(np.sqrt(np.mean(q**2))) for q in np.array_split(continuity_pcm,4)]
    result['quarterRmsDbFS'] = quarter_levels
    result['quarterWindowSeconds'] = len(continuity_pcm)/rate/4
    result['quarterLevelRangeDb'] = round(max(quarter_levels)-min(quarter_levels),2)
    result['wholeClipRmsDbFS'] = db(np.sqrt(np.mean(pcm**2)))
    if entry.get('wave')=='AU2' and source.stem.startswith('air-'):
        result['sustainScreen'] = {
            'criterion':'All four half-second quarters within 12 dB, activity through >=1.95 s, onset <=0.05 s; envelope only, not turbine timbre or listening.',
            'pass': bool(max(quarter_levels)-min(quarter_levels)<=12 and result['lastActiveSeconds']>=1.95 and result['headActiveSeconds']<=0.05)
        }
    results.append(result)
# Keep normal/perfect comparisons level-matched even when one raw take is too
# quiet to reach the usual target with browser attenuation alone.
for family in ['absorb-A-warm-rune','absorb-B-liquid-prism','absorb-C-hushed-orbit']:
    pair=[r for r in results if r['wave']=='AU2' and r['id'].startswith(family+'-')]
    if len(pair)==2:
        target=min(-26,*(r['integratedLufs'] for r in pair))
        for r in pair:
            r['auditionTargetLufs']=target
            r['auditionGainDb']=round(min(0,target-r['integratedLufs'],-3-r['truePeakDbTP']),2)
# AU2b pairs: match to the quieter member; do not create a fake perfect reward
# merely by auditioning the louder raw file at a higher level.
for family in ['absorb-A-pressure-wall','absorb-B-undertow','absorb-C-mineral-drag']:
    pair=[r for r in results if r['wave']=='AU2b' and r['id'].startswith(family+'-')]
    if len(pair)==2:
        target=min(-26,*(r['integratedLufs'] for r in pair))
        for r in pair:
            r['auditionTargetLufs']=target
            r['auditionGainDb']=round(min(0,target-r['integratedLufs'],-3-r['truePeakDbTP']),2)
(EVIDENCE / 'measurements.json').write_text(json.dumps(results, indent=2)+'\n', encoding='utf-8')
lines = ['# AU1 + AU2 + AU2b raw audio measurements', '', 'Measured with ffmpeg ebur128 true-peak mode. Brief SFX LUFS is descriptive, not a quality score. Audition trim is browser gain; raw files are unchanged.', '', '| Sample | Decoded seconds | LUFS-I | dBTP | LRA LU | Audition trim dB |', '|---|---:|---:|---:|---:|---:|']
for m in results: lines.append(f"| {m['id']} | {m['decodedSeconds']} | {m['integratedLufs']} | {m['truePeakDbTP']} | {m['loudnessRangeLu']} | {m['auditionGainDb']} |")
(EVIDENCE / 'LOUDNESS.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
print(json.dumps({'measuredSamples':len(results),'output':'docs/audio/evidence/measurements.json'}))
