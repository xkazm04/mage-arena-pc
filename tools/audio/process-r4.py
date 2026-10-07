"""Offline AU3 mastering and numerical screens. Never calls a paid service."""
from pathlib import Path
import hashlib, json, re, subprocess, sys
import numpy as np
from scipy import signal
ROOT=Path(__file__).resolve().parents[2]
E=ROOT/'docs/audio/evidence/r4'; E.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'docs/audio/audition/r4'
RATE=48000
def run(args):
    return subprocess.run([str(a) for a in args],check=True,capture_output=True)
def ff(args): return run(['ffmpeg','-hide_banner','-nostdin','-y',*args])
def save(path,obj): path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def write_log(path,text):
    path.write_text('\n'.join(line.rstrip() for line in text.splitlines()).rstrip()+'\n',encoding='utf-8',newline='\n')
def rel(path): return path.relative_to(ROOT/'docs/audio').as_posix()
def db(x): return round(float(20*np.log10(max(float(x),1e-12))),3)
def pcm(path,rate=RATE,channels=2):
    return np.frombuffer(ff(['-i',path,'-ar',rate,'-ac',channels,'-f','f32le','-']).stdout,dtype='<f4').reshape(-1,channels)
def meter(path, label):
    probe=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',path]).stdout)
    stream=probe['streams'][0]; rate=int(stream['sample_rate']); channels=int(stream['channels'])
    x=pcm(path,rate,channels)
    result=ff(['-i',path,'-af','loudnorm=I=-26:TP=-1:LRA=50:print_format=json','-f','null','-']).stderr.decode(errors='replace')
    write_log(E/f'{label}-loudnorm.log',result)
    m=json.loads(re.findall(r'\{[^{}]+\}',result,re.S)[-1])
    return dict(file=rel(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),sampleRate=rate,channels=channels,sampleCount=len(x),decodedSeconds=len(x)/rate,containerSeconds=float(probe['format']['duration']),codec=stream['codec_name'],integratedLufs=float(m['input_i']),truePeakDbTP=float(m['input_tp']),loudnessRangeLU=float(m['input_lra']),samplePeakDbFS=db(np.max(np.abs(x))),samplesAtOrAboveFullScale=int(np.sum(np.abs(x)>=1)),loudnorm=m)
def analysis(source,identity):
    y=pcm(source,16000,1)[:,0]; sr=16000; hop=160
    def features(wave):
        freq,times,z=signal.stft(wave,fs=sr,nperseg=2048,noverlap=2048-hop)
        mag=np.abs(z); log=np.log1p(mag*1000)
        onset=np.maximum(np.diff(log,axis=1,prepend=log[:,:1]),0).mean(axis=0)
        return freq,mag,onset
    def tempo(env):
        ac=signal.correlate(env-env.mean(),env-env.mean(),mode='full',method='fft')[len(env)-1:]
        candidates,_=signal.find_peaks(ac[30:101]); candidates=candidates+30
        if not len(candidates): return None
        # Broad 60–200 BPM search; no forced 96 BPM label.
        lag=int(candidates[np.argmax(ac[candidates])])
        # Parabolic interpolation avoids rounding 0.625 s to a 0.62 s lag.
        denominator=ac[lag-1]-2*ac[lag]+ac[lag+1]
        fractional=.5*(ac[lag-1]-ac[lag+1])/denominator if denominator else 0
        return 6000/(lag+float(np.clip(fractional,-.5,.5)))
    freq,mag,onset=features(y)
    indices,_=signal.find_peaks(onset,distance=10,prominence=max(float(np.std(onset))*.3,1e-6))
    peaks=indices/100; bpm=tempo(onset)
    cells=[]
    for t in range(0,151,15):
        near=peaks[np.abs(peaks-t)<1]
        nearest=float(near[np.argmin(np.abs(near-t))]) if len(near) else None
        cells.append(dict(requestedSeconds=t,nearestDetectedOnsetSeconds=nearest,errorMs=round((nearest-t)*1000,2) if nearest is not None else None,verifiedDownbeat=False))
    windows=[]
    for start in range(0,150,15):
        local=onset[start*100:min((start+15)*100,len(onset))]
        local_bpm=tempo(local)
        windows.append(dict(start=start,estimatedBpm=local_bpm,rmsDbFS=db(np.sqrt(np.mean(y[start*sr:min((start+15)*sr,len(y))]**2)))))
    n=min(len(y)//(15*sr),10); blocks=y[:n*15*sr].reshape(n,-1).astype(np.float64)
    corr=np.corrcoef(blocks); pairs=[dict(a=i*15,b=j*15,correlation=float(corr[i,j])) for i in range(n) for j in range(i+1,n)]
    # Five-second blocks at exact file offsets screen literal short-block tiling.
    n5=len(y)//(5*sr); c5=np.corrcoef(y[:n5*5*sr].reshape(n5,-1)); np.fill_diagonal(c5,0)
    tail={str(t):db(np.sqrt(np.mean(y[-int(t*sr):]**2))) for t in [5,2.5,1,.5,.1,.02]}
    ref=ROOT/'docs/audio/audition/r2'/f'{identity}.mp3'
    def chroma_of(freq,mag):
        sel=(freq>=65)&(freq<=2000); notes=np.rint(69+12*np.log2(freq[sel]/440)).astype(int)%12
        return np.bincount(notes,weights=np.mean(mag[sel]**2,axis=1),minlength=12)
    chroma=chroma_of(freq,mag)
    ry=pcm(ref,16000,1)[:,0]; rf,rm,_=features(ry); rc=chroma_of(rf,rm)
    similarity=float(np.dot(chroma,rc)/(np.linalg.norm(chroma)*np.linalg.norm(rc)))
    return dict(method='scipy STFT positive log spectral flux at 10 ms resolution; strongest autocorrelation peak in 60–200 BPM range, not a downbeat or melody transcription. Tempo aliases and missed/extra attacks possible.',estimatedBpm=bpm,requestedBpm=96,firstDetectedOnsetSeconds=float(peaks[0]) if len(peaks) else None,firstTrueDownbeatSeconds=None,boundaries=cells,windows=windows,gridVerified=False,gridStatus='not certified: detected attacks are not identified downbeats; no warp applied',literalRepeatScreen=dict(max15SecondBlockCorrelation=max(p['correlation'] for p in pairs),max5SecondBlockCorrelation=float(np.max(c5)),pairs=pairs,scope='Aligned waveform blocks only; excludes neither shifted reuse nor repeated musical phrases. No source audio was tiled by this pipeline.'),referenceChromaCosine=similarity,referenceChromaCaveat='Pitch-class distribution similarity is not melodic identity; exact kept motif was not transcribed or used as an audio reference.',tailRmsDbFS=tail,vocals='not assessed by listening; empty lyric lines and instrumental styles are requests, not evidence',release='tail envelope measured; musical resolution requires listening',listening='not performed by this execution environment; no auditory quality verdict claimed')
def process(identity):
    source=OUT/f'{identity}.mp3'; side=json.loads(source.with_suffix('.mp3.json').read_text(encoding='utf-8'))
    assert hashlib.sha256(source.read_bytes()).hexdigest()==side['sha256']
    dest=OUT/identity; dest.mkdir(exist_ok=True)
    raw=meter(source,identity+'-raw'); m=raw['loudnorm']
    filt=f"loudnorm=I=-26:TP=-1:LRA=50:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true:print_format=json"
    master=dest/'master-48k.wav'
    # Only trim a provider overrun after confirming it is already near silence.
    overrun=raw['decodedSeconds']-150
    trim=''
    if 0<overrun<=.1:
        end=pcm(source)[150*RATE:]
        if len(end) and db(np.max(np.abs(end)))<=-60: trim=',atrim=end=150'
    log=ff(['-i',source,'-af',filt+trim,'-ar',RATE,'-c:a','pcm_s16le',master]).stderr.decode(errors='replace')
    write_log(E/f'{identity}-master-render.log',log)
    normalized=meter(master,identity+'-master'); assert abs(normalized['integratedLufs']+26)<=.3 and normalized['truePeakDbTP']<=-1 and normalized['samplesAtOrAboveFullScale']==0
    # Fixed-grid *indices*, no copied/tiled score or claimed time correction.
    sections=[]; start=0
    for i,s in enumerate(side['request']['composition_plan']['sections']):
        end=start+s['duration_ms']/1000; p=dest/f"section-{i+1}-{s['section_name'].lower().replace(' ','-')}.wav"
        stop=min(round(end*RATE),normalized['sampleCount'])
        ff(['-i',master,'-af',f'atrim=start_sample={round(start*RATE)}:end_sample={stop},asetpts=PTS-STARTPTS','-c:a','pcm_s16le',p])
        sections.append(dict(name=s['section_name'],startSeconds=start,endSeconds=end,startSample=round(start*RATE),endSample=stop,file=rel(p),boundaryStatus='requested composition timing, not verified musical boundary'))
        start=end
    a=analysis(source,identity)
    # Sustain: continuous middle plus one-bar overlap of neighbouring material.
    loop=dest/'sustain-candidate.wav'
    graph='[0:a]asplit=3[x][y][z];[x]atrim=start=120:end=132.5,asetpts=PTS-STARTPTS[mid];[y]atrim=start=132.5:end=135,asetpts=PTS-STARTPTS[tail];[z]atrim=start=117.5:end=120,asetpts=PTS-STARTPTS[head];[tail]afade=t=out:d=2.5:curve=qsin[tf];[head]afade=t=in:d=2.5:curve=qsin[hf];[tf][hf]amix=inputs=2:duration=shortest:normalize=0[blend];[mid][blend]concat=n=2:v=0:a=1[out]'
    ff(['-i',master,'-filter_complex',graph,'-map','[out]','-c:a','pcm_s16le',loop])
    lx=pcm(loop); assert len(lx)==15*RATE
    # Rotate at a quiet stereo slope, avoiding the overlap, to reduce discontinuity.
    slopes=np.max(np.abs(np.diff(lx,axis=0)),axis=1); cut=int(np.argmin(slopes[RATE:10*RATE]))+RATE+1
    rotated=dest/'sustain.wav'
    ff(['-i',loop,'-filter_complex',f'[0:a]asplit=2[a][b];[a]atrim=start_sample={cut},asetpts=PTS-STARTPTS[a1];[b]atrim=end_sample={cut},asetpts=PTS-STARTPTS[b1];[a1][b1]concat=n=2:v=0:a=1[out]','-map','[out]','-c:a','pcm_s16le',rotated])
    loop.unlink() # Our disposable derivative only; raw is never overwritten.
    lx=pcm(rotated); repeat=np.tile(lx,(3,1)); half=RATE//2
    jump=db(np.max(np.abs(lx[0]-lx[-1]))); rmsdiff=abs(db(np.sqrt(np.mean(lx[:half]**2)))-db(np.sqrt(np.mean(lx[-half:]**2))))
    lm=meter(rotated,identity+'-sustain')
    loopmeta=dict(file=rel(rotated),startSample=0,endSample=len(lx),startSeconds=0,endSeconds=len(lx)/RATE,sourceRangeSeconds=[117.5,135],crossfadeSeconds=2.5,crossfadeCurves='equal-power sine',rotationSamples=cut,sourceEntrySeconds=120+cut/RATE,threeRepeatJoinJumpsDbFS=[db(np.max(np.abs(repeat[i*len(lx)]-repeat[i*len(lx)-1]))) for i in [1,2]],adjacentHalfSecondRmsDifferenceDb=round(rmsdiff,3),numericalScreenPass=bool(jump<=-60 and rmsdiff<=3),approved=False,enabled=False,reason='Unverified harmonic/beat seam and conspicuous fill; rotation removes mathematical click but is not a beat alignment. Three-repeat listening pending.',measurement=lm)
    # Wave-end candidate combines a release theme fragment with original decay.
    sting=dest/'sting-5s.wav'
    graph='[0:a]asplit=2[a][b];[a]atrim=start=135:end=138,asetpts=PTS-STARTPTS[a1];[b]atrim=start=147.5:end=150,asetpts=PTS-STARTPTS[b1];[a1][b1]acrossfade=d=0.5:c1=qsin:c2=qsin,afade=t=in:d=0.01,afade=t=out:st=4.97:d=0.03[out]'
    ff(['-i',master,'-filter_complex',graph,'-map','[out]','-c:a','pcm_s16le',sting])
    sm=meter(sting,identity+'-sting')
    cells=[]
    tier=[1,2,3,4,4,3,4,4,4,None]
    for i in range(10):
        section=next(s['name'] for s in sections if s['startSeconds']<=i*15<s['endSeconds'])
        cells.append(dict(index=i,startSeconds=i*15,endSeconds=min((i+1)*15,normalized['decodedSeconds']),startSample=i*15*RATE,endSample=min((i+1)*15*RATE,normalized['sampleCount']),section=section,arrangementTier=tier[i],musicalBoundaryVerified=False))
    track=dict(id=identity,title=next(t['title'] for t in json.loads((ROOT/'tools/audio/composition-plan-r4.json').read_text(encoding='utf-8'))['tracks'] if t['id']==identity),rawFile=rel(source),sidecar=rel(source)+'.json',file=rel(master),provenance='48 kHz PCM decoded/resampled from original lossy MP3; not a native lossless provider master',sampleRate=RATE,sampleCount=normalized['sampleCount'],durationSeconds=normalized['decodedSeconds'],ownerChoice=None,linearPlaybackReady=True,adaptiveReady=False,requestedBpm=96,verifiedBpm=None,downbeatOffsetSeconds=None,gridMode='unverified; use linear playback until approved',sectionMap=sections,cells=cells,tierMap={'1':[0],'2':[1],'3':[2,5],'4':[3,4,6,7,8]},tierMapNote='Arrangement vocabulary only; later sparse material never lowers confirmed gameplay tier. No transitions approved.',allowedTransitions=[],sustainLoop=loopmeta,sting=dict(file=rel(sting),durationSeconds=sm['decodedSeconds'],sourceRangesSeconds=[[135,138],[147.5,150]],crossfadeSeconds=.5,approved=False,note='Release-fragment plus source decay; musical continuity and theme recognition pending listening.',measurement=sm),releaseTail=dict(file=rel(master),startSeconds=147.5,endSeconds=normalized['decodedSeconds'],loop=False),mastering=dict(targetLufs=-26,truePeakLimitDbTP=-1,method='ffmpeg two-pass loudnorm, linear gain if possible; PCM16 dither/quantization; no time warp, padding or repeated audio block',nominalGainDb=round(-26-raw['integratedLufs'],2),measurement=normalized),rawMeasurement=raw,analysis=a,cost=dict(requestedSeconds=side['seconds'],chargedCredits=side['chargedCredits'],sharedImmediateDelta=side['accountDelta'],sharedSettledDelta=side['settledDelta'],creditsPerRequestedSecond=side['chargedCredits']/side['seconds']))
    internal=[v for v in a['boundaries'] if 0<v['requestedSeconds']<150]
    a['internalBoundaryScreen']=dict(toleranceMs=20,passed=sum(v['errorMs'] is not None and abs(v['errorMs'])<=20 for v in internal),total=len(internal),caveat='Nearby attacks, not identified bar downbeats; does not certify beat drift or musical phrase completion.')
    track['mastering']['tailTrimSeconds']=overrun if trim else 0
    track['mastering']['method']='ffmpeg two-pass loudnorm, linear gain; PCM16 lossy-source derivative. No time warp, padding or repeated block. Near-silent provider overrun trimmed only where measured peak <= -60 dBFS.'
    save(E/f'{identity}-analysis.json',track)
    save(dest/'segments.json',dict(file=rel(master),sampleRate=RATE,cells=cells,sectionMap=sections,tierMap=track['tierMap'],adaptiveReady=False,loop=loopmeta))
    manifestpath=ROOT/'docs/audio/manifest-au3.json'
    manifest=json.loads(manifestpath.read_text(encoding='utf-8')) if manifestpath.exists() else dict(schemaVersion=1,wave='AU3',baseUrl='./',pathResolution='All files relative to this manifest in docs/audio/',status='technical delivery; owner listening pending',runtimeContract=dict(mode='linear until adaptiveReady and transitions approved',fullScoreLoop=False,musicVoicesMax=8,totalVoicesMax=32,nominalTierUnlockSeconds=[0,15,30,45],perfectAdvanceSeconds=2,minUnlockGapSeconds=6,pause='freeze transport and gameplay',waveReset='entrance',criticalFeedback='immediate, unquantized',mixTargetLufs=-20,mixTruePeakDbTP=-1,crossfadeHeadroomDb=6),tracks=[])
    manifest['tracks']=[t for t in manifest['tracks'] if t['id']!=identity]+[track]
    save(manifestpath,manifest)
    print(json.dumps(dict(id=identity,duration=normalized['decodedSeconds'],rawLufs=raw['integratedLufs'],masterLufs=normalized['integratedLufs'],estimatedBpm=a['estimatedBpm'],boundaryErrorsMs=[v['errorMs'] for v in a['boundaries']],tail=a['tailRmsDbFS'],loopNumericalPass=loopmeta['numericalScreenPass'],stingSeconds=sm['decodedSeconds'])))
if __name__=='__main__': process(sys.argv[1])
