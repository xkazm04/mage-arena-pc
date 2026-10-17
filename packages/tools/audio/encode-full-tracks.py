"""P2: ship the 150 s arena masters as MP3. Offline; never calls a provider.

The U6b masters are 28.8 MB PCM16 WAVs. Fetching, hashing and moving that many bytes during a bout
stalled the Fire TV for 0.3-0.5 s (docs/waves/P2-tv-bout-start.md). MP3 CBR 256 kbps keeps the
measured loudness of the master (192 kbps lost 0.28 LU to its lower lowpass) at a sixth of the size.

Each master is read from Git LFS at the commit that pinned it and checked against its sidecar hash,
so the encode is reproducible without keeping the WAV in the served folder.
"""
import hashlib, json, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
AUDIO = ROOT / "packages/game/public/audio"
MASTERS = ROOT / "docs/audio/audition/r4"
PINNED = "78cd0ed"  # last commit serving the WAV masters
TRACKS = [("arena-c", "arena-C-reed-oath"), ("arena-d", "arena-D-lyre-under-iron")]
BITRATE = "256k"
RATE, SAMPLES = 48000, 7200000


def run(args, data=None):
    return subprocess.run([str(a) for a in args], input=data, check=True, capture_output=True).stdout


def sha(data):
    return hashlib.sha256(data).hexdigest()


def master(key, source_id):
    side = json.loads((MASTERS / source_id / "master-48k.wav.json").read_text(encoding="utf-8"))
    local = MASTERS / source_id / "master-48k.wav"
    data = local.read_bytes() if local.exists() else run(
        ["git", "-C", ROOT, "lfs", "smudge"],
        run(["git", "-C", ROOT, "show", f"{PINNED}:packages/game/public/audio/{key}-full.wav"]),
    )
    assert sha(data) == side["sha256"] == side["measurement"]["sha256"], f"{key}: master hash"
    return data, side


def measure(path):
    pcm = run(["ffmpeg", "-hide_banner", "-nostdin", "-i", path, "-f", "f32le", "-ac", 2, "-ar", RATE, "-"])
    log = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-i", str(path), "-af", "loudnorm=I=-26:TP=-1:LRA=50:print_format=json", "-f", "null", "-"],
        check=True, capture_output=True,
    ).stderr.decode(errors="replace")
    m = json.loads(re.findall(r"\{[^{}]+\}", log, re.S)[-1])
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path]))
    stream = probe["streams"][0]
    return dict(
        file=path.name, sha256=sha(path.read_bytes()), bytes=path.stat().st_size,
        sampleRate=int(stream["sample_rate"]), channels=int(stream["channels"]),
        sampleCount=len(pcm) // 8, decodedSeconds=len(pcm) / 8 / RATE,
        containerSeconds=float(probe["format"]["duration"]), codec=stream["codec_name"],
        bitRate=int(stream["bit_rate"]), integratedLufs=float(m["input_i"]),
        truePeakDbTP=float(m["input_tp"]), loudnessRangeLU=float(m["input_lra"]), loudnorm=m,
    )


manifest = json.loads((AUDIO / "manifest.json").read_text(encoding="utf-8"))
report = []
for key, source_id in TRACKS:
    data, side = master(key, source_id)
    wav = AUDIO / f"{key}-master.tmp.wav"
    wav.write_bytes(data)
    out = AUDIO / f"{key}-full.mp3"
    try:
        # -map_metadata -1 and no ID3 keep the bytes a function of the master and the encoder only.
        run(["ffmpeg", "-hide_banner", "-nostdin", "-y", "-i", wav, "-map_metadata", "-1", "-id3v2_version", 0,
             "-write_xing", 1, "-c:a", "libmp3lame", "-b:a", BITRATE, "-ar", RATE, out])
    finally:
        wav.unlink()
    got = measure(out)
    master_m = side["measurement"]
    # The game pins duration within 0.2 s; the sidecar contract pins samples, loudness and peak.
    assert got["sampleCount"] == SAMPLES and got["channels"] == 2, f"{key}: {got['sampleCount']} samples"
    assert abs(got["integratedLufs"] - master_m["integratedLufs"]) <= 0.05, f"{key}: loudness {got['integratedLufs']}"
    assert got["truePeakDbTP"] <= -1, f"{key}: true peak {got['truePeakDbTP']}"
    sidecar = {
        "kind": "offline-audio-derivative",
        "wave": "P2",
        "file": out.name,
        "sha256": got["sha256"],
        "source": side["file"],
        "sourceSha256": side["sha256"],
        "sourceSidecar": f"audition/r4/{source_id}/master-48k.wav.json",
        "sourceRetrieval": f"git lfs: {PINNED}:packages/game/public/audio/{key}-full.wav",
        "additionalPaidCalls": 0,
        "additionalCredits": 0,
        "tool": "ffmpeg libmp3lame",
        "encoder": run(["ffmpeg", "-hide_banner", "-version"]).decode().splitlines()[0],
        "reproduce": "python packages/tools/audio/encode-full-tracks.py",
        "processing": {
            "method": f"MP3 CBR {BITRATE}, {RATE} Hz, LAME gapless header; no gain, trim, resample or time change.",
            "reason": "A 28.8 MB WAV loaded mid-bout stalled the Fire TV main thread; see docs/waves/P2-tv-bout-start.md.",
        },
        "measurement": got,
        "masterMeasurement": master_m,
    }
    (AUDIO / f"{out.name}.json").write_text(json.dumps(sidecar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    manifest["assets"][key].update(file=out.name, sha256=got["sha256"])
    for t in manifest["u6b"]["tracks"]:
        if t["id"] == key:
            t.update(file=out.name, sha256=got["sha256"])
    for stale in [AUDIO / f"{key}-full.wav", AUDIO / f"{key}-full.wav.json"]:
        stale.unlink(missing_ok=True)
    report.append({k: got[k] for k in ["file", "bytes", "sampleCount", "integratedLufs", "truePeakDbTP"]} | {"masterLufs": master_m["integratedLufs"]})
(AUDIO / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
print(json.dumps(report, indent=2))
