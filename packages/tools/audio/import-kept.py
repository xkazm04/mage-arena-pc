"""Selective AU4 import. Read the audio worktree; never write it or call a provider."""
import hashlib
import array
import json
import math
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT.parent / "mage-arena-audio"
OUTPUT = ROOT / "packages/game/public/audio"
EVIDENCE = ROOT / "docs/waves/AU4-evidence"
PICKS = {
    "arena-a": ("r1", "arena-A-hide-and-iron", "music"),
    "arena-c": ("r2", "arena-C-reed-oath", "music"),
    "arena-d": ("r2", "arena-D-lyre-under-iron", "music"),
    **{f"camp-{p}": ("r2", f"camp-A-{p}", "music") for p in ["day", "dusk", "night"]},
    "fire-a": ("r1", "fire-A-wounded-matter", "effects"),
    "fire-variation": ("r2", "fire-kept-variation", "effects"),
    "water-b": ("r1", "water-B-bound-radiance", "effects"),
    "water-variation": ("r2", "water-kept-variation", "effects"),
    "earth-b": ("r1", "earth-B-bound-radiance", "effects"),
    "air-b": ("r2", "air-B-hollow-vortex", "effects"),
    "hit-a": ("r2", "hit-A-hide-and-slate", "effects"),
    "impact-a": ("r2", "impact-A-hide-and-slate", "effects"),
    "collar-b": ("r2", "collar-B-stone-waking", "effects"),
    **{f"ui-{p}": ("r2", f"ui-B-{p}", "ui") for p in ["click", "confirm", "deny", "slot", "tab"]},
    "voice-collar": ("r1", "voice-A-george", "voice"),
    "roll-step": ("r2", "roll-A-linen-and-grit", "effects"),
}
for directory in [OUTPUT, EVIDENCE / "sidecars", ROOT / "docs/audio"]:
    directory.mkdir(parents=True, exist_ok=True)
shutil.copy2(SOURCE / "docs/audio/CHOICES.md", ROOT / "docs/audio/CHOICES.md")
manifest = {"version": 1, "assets": {}}
records = []
for identifier, (round_name, name, bus) in PICKS.items():
    source = SOURCE / f"docs/audio/audition/{round_name}/{name}.mp3"
    sidecar = json.loads(source.with_suffix(".mp3.json").read_text(encoding="utf-8"))
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    assert digest == sidecar["sha256"], name
    shutil.copy2(source.with_suffix(".mp3.json"), EVIDENCE / f"sidecars/{identifier}.json")
    target = OUTPUT / f"{identifier}.{'wav' if identifier == 'roll-step' else 'mp3'}"
    if identifier == "roll-step":
        pcm = array.array("f", subprocess.check_output([
            "ffmpeg", "-v", "error", "-i", str(source), "-t", "1.2",
            "-ac", "1", "-ar", "24000", "-f", "f32le", "-"
        ]))
        windows = [{"startSeconds": round(i / 24000, 2),
                    "rmsDbfs": round(20 * math.log10(max(1e-9, math.sqrt(
                        sum(x*x for x in pcm[i:i+1200]) / len(pcm[i:i+1200])))), 2)}
                   for i in range(0, len(pcm), 1200)]
        (EVIDENCE / "roll-cut.json").write_text(json.dumps({
            "label": "measured source mono RMS in 50 ms windows; not listened",
            "sourceSha256": digest, "cutSeconds": .45, "fadeSeconds": .05,
            "command": "python packages/tools/audio/import-kept.py", "windows": windows
        }, indent=2) + "\n", encoding="utf-8")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(source), "-t", "0.45",
                        "-af", "afade=t=out:st=0.4:d=0.05", "-c:a", "pcm_s16le", str(target)], check=True)
    else:
        shutil.copy2(source, target)
    duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                              "-of", "default=nw=1:nk=1", str(target)], text=True).strip())
    measured = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(target), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True, check=True)
    peak = float(re.search(r"max_volume: ([-.0-9]+) dB", measured.stderr).group(1))
    target_peak = {"music": -15, "effects": -12, "ui": -20, "voice": -9}[bus]
    trim = round(min(-3, target_peak - peak), 1)
    entry = {"file": target.name, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
             "duration": duration, "trimDb": trim, "kind": "loop" if bus == "music" else "one-shot"}
    manifest["assets"][identifier] = entry
    records.append({"id": identifier, "source": str(source.relative_to(SOURCE)).replace("\\", "/"),
                    "sourceSha256": digest, "output": entry, "samplePeakDbfs": peak,
                    "trimBasis": "authored peak target, at least 3 dB attenuation; in-app gain only",
                    "edit": "first 0.45 seconds, final 50ms fade" if identifier == "roll-step" else "original bytes"})
(OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
revision = subprocess.check_output(["git", "-C", str(SOURCE), "rev-parse", "HEAD"], text=True).strip()
(EVIDENCE / "import.json").write_text(json.dumps({"label": "measured bytes/durations/sample peaks; trims authored, not listened",
    "sourceCommit": revision, "command": "python packages/tools/audio/import-kept.py", "records": records}, indent=2) + "\n", encoding="utf-8")
print(f"Imported {len(records)} owner-kept sources; no generation. Sample peaks measured, not true peaks.")
