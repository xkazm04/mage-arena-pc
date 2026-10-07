"""Project-local art IO and immutable input compilation; no game dependencies."""
from __future__ import annotations
import csv
import hashlib
import json
import os
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art'


def now():
    return datetime.now(timezone.utc).isoformat()


def week():
    return datetime.now(timezone.utc).strftime('%G-W%V')


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    with temp.open('w', encoding='utf-8', newline='\n') as f:
        json.dump(value, f, indent=2, ensure_ascii=False)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp, path)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def relative(path):
    return Path(path).resolve().relative_to(ROOT).as_posix()


def source_path(job):
    """Raw is optional after checkout: the exact-byte review archive is portable."""
    raw = ROOT / job['source']
    if raw.exists():
        return raw
    return ART / 'review/sources' / (job.get('id', job.get('job')) + raw.suffix)


def config():
    return read(ART / 'config-v1.json')


def styles():
    return read(ART / 'styles/a1-v1.json')['directions']


def get_style(style_id):
    return next(s for s in styles() if s['id'] == style_id)


def compile_prompt(style, scene):
    b = read(ART / config()['brief_file'])
    return style['style_block'].strip() + '\n\nACTION: ' + b['scenes'][scene].strip() + '\n\nCONSTRAINTS: ' + b['common'].strip()


def input_record(style, scene):
    return {'version': config()['brief_version'], 'style': style, 'scene': scene,
            'prompt': compile_prompt(style, scene), 'aspect_ratio': config()['aspect_ratio']}


def input_matches_current(job):
    """Version metadata alone does not invalidate an unchanged scene's exact prompt."""
    expected = input_record(get_style(job['style_id']), job['scene'])
    recorded = job['input']
    return digest(recorded) == job['input_hash'] and all(recorded[k] == expected[k] for k in ('style', 'scene', 'prompt', 'aspect_ratio'))


def camp_data():
    cfg = config()
    with (ROOT / cfg['sources']['locations']).open(encoding='utf-8-sig', newline='') as f:
        locations = list(csv.DictReader(f))
    slots = read(ROOT / cfg['sources']['slots'])['daySlots']
    return locations, slots


@contextmanager
def lock(path, timeout=2):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + timeout
    while True:
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            break
        except (FileExistsError, PermissionError):
            if time.monotonic() >= deadline:
                raise RuntimeError(f'LOCK_HELD: {path}; inspect PID, never auto-steal')
            time.sleep(.05)
    try:
        yield
    finally:
        path.unlink()
