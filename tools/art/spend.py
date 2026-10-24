"""One spend authority: every cap, the session envelope and provider latch clearing.

Budget.reserve evaluates headroom() under art/.budget.lock and raises its first code, so no
caller needs a pre-check. Caps are only read here, never raised: art/budget.json and
art/providers/budget.json stay the single source of their numbers. A session is a start
record under art/waves/<name>/ (the A13/A14/D2S snapshot shape) named by art/spend-session.json;
with no session active the rules are exactly the project and provider ones.
"""
from __future__ import annotations
import shutil
from pathlib import Path
from common import digest, lock, now, read, sha, week, write

POINTER = 'spend-session.json'
LEDGERS = ('usage.json', 'budget.json', 'providers/history.json', 'providers/budget.json')
# Conservative words on top of the quota regex: any of them refuses a latch clear.
RATE_WORDS = ('quota', 'rate limit', '429', '402', 'exhausted')
LOCAL_FAILURE = ('cannot find the file', '[winerror 3]', '[winerror 2]')


def provider_of(job):
    return job.get('provider') or ('grok' if job.get('origin') == 'grok-cli' else 'historical-other')


def load_usage(art):
    path = Path(art) / 'usage.json'
    return read(path) if path.exists() else {'schema': 1, 'stop': None, 'jobs': [], 'events': []}


def session_dir(art, name):
    return Path(art) / 'waves' / name


def active_session(art):
    """The active start record, or None. A pointer to a missing record fails closed."""
    pointer = Path(art) / POINTER
    if not pointer.exists():
        return None
    name = read(pointer)['name']
    path = session_dir(art, name) / 'start.json'
    if not path.exists():
        raise RuntimeError('SESSION_START_MISSING: ' + name)
    return {**read(path), 'name': name}


def protected_hashes(art, items):
    root = Path(art).resolve().parent
    files = []
    for item in items:
        p = Path(art) / item
        files.extend(sorted(x for x in p.rglob('*') if x.is_file()) if p.is_dir() else [p])
    return {f.resolve().relative_to(root).as_posix(): sha(f) for f in files}


def open_session(art, name, cap, slot_attempt_cap=None, protected=(), authorization=''):
    """Idempotent: the first call snapshots the ledgers and writes start.json; later calls return it."""
    art = Path(art); folder = session_dir(art, name)
    with lock(art / '.budget.lock'):
        pointer = art / POINTER
        if pointer.exists() and read(pointer)['name'] != name:
            raise RuntimeError('SESSION_ACTIVE: close ' + read(pointer)['name'] + ' first')
        path = folder / 'start.json'
        if not path.exists():
            for ledger in LEDGERS:
                if (art / ledger).exists():
                    target = folder / 'before' / ledger; target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(art / ledger, target)
            jobs = load_usage(art)['jobs']
            record = {'at': now(), 'jobs': len(jobs), 'charged': sum(j['charged_images'] for j in jobs),
                      'jobsDigest': digest(jobs), 'protected': protected_hashes(art, protected),
                      'sessionImageCap': cap, 'authorization': authorization}
            if slot_attempt_cap is not None:
                record['slotAttemptCap'] = slot_attempt_cap
            write(path, record)  # written last: its existence marks the snapshot complete
        if not pointer.exists():
            write(pointer, {'name': name, 'at': now()})
        return read(path)


def activate(art, name):
    """Point reserve at an already prepared session (legacy D2S start.json included); never creates one."""
    art = Path(art)
    if not (session_dir(art, name) / 'start.json').exists():
        raise RuntimeError('SESSION_START_REQUIRED: prepare ' + name + ' first')
    with lock(art / '.budget.lock'):
        pointer = art / POINTER
        if pointer.exists() and read(pointer)['name'] != name:
            raise RuntimeError('SESSION_ACTIVE: close ' + read(pointer)['name'] + ' first')
        if not pointer.exists():
            write(pointer, {'name': name, 'at': now()})
    return active_session(art)


def close_session(art, name):
    art = Path(art)
    with lock(art / '.budget.lock'):
        pointer = art / POINTER
        if pointer.exists() and read(pointer)['name'] == name:
            pointer.unlink()


def provider_codes(art, provider, usage, week_fn=week):
    """Provider latch then provider weekly cap (with known external charges). An art dir without
    provider ledgers (pre-D20 tests) has no provider rules; an unknown provider fails closed."""
    art = Path(art)
    if not (art / 'providers/budget.json').exists() or not (art / 'providers/history.json').exists():
        return []
    state = read(art / 'providers/history.json')['providers'].get(provider)
    policy = read(art / 'providers/budget.json')['providers'].get(provider)
    if state is None or policy is None:
        return ['PROVIDER_UNCONFIGURED: ' + provider]
    if state['stop']:
        return ['PROVIDER_STOP: ' + state['stop']['reason']]
    spent = sum(j['charged_images'] for j in usage['jobs'] if provider_of(j) == provider and j['week'] == week_fn())
    prior = policy.get('external_known_charges', {}).get(week_fn(), 0)
    return ['PROVIDER_BUDGET_CAP'] if spent + prior >= policy['weekly_image_cap'] else []


def headroom(art, wave=None, provider=None, scene=None, style_id=None, job_id=None, usage=None, policy=None, week_fn=week):
    """Every blocking code for one more image, in the order reserve raises them. Read-only."""
    art = Path(art)
    usage = usage if usage is not None else load_usage(art)
    policy = policy if policy is not None else read(art / 'budget.json')
    jobs = usage['jobs']; codes = []
    if usage['stop']:
        codes.append('SPEND_STOP: ' + usage['stop']['reason'])
    if any(j['status'] in ('reserved', 'running') for j in jobs):
        codes.append('UNRESOLVED_RESERVATION: inspect prior session; no automatic retry')
    count = sum(j['charged_images'] for j in jobs)
    weekly = sum(j['charged_images'] for j in jobs if j['week'] == week_fn())
    if count >= policy['wave_hard_cap'] or weekly >= policy['weekly_image_cap']:
        codes.append('HARD_BUDGET_CAP')
    if count >= policy['target_images']:
        codes.append('TARGET_BUDGET_STOP: preserve shared subscription')
    if scene is not None and style_id is not None:
        same = [j for j in jobs if j.get('style_id') == style_id and j.get('scene') == scene]
        cap = policy.get('scene_attempt_caps', {}).get(style_id + ':' + scene, policy['max_attempts_per_scene'])
        if len(same) >= cap:
            codes.append('SCENE_ATTEMPT_CAP')
    if job_id is not None and any(j['id'] == job_id for j in jobs):
        codes.append('DUPLICATE_JOB')
    wave_cap = policy.get('wave_image_caps', {}).get(wave) if wave else None
    if wave_cap is not None and sum(j['charged_images'] for j in jobs if j.get('wave') == wave) >= wave_cap:
        codes.append('WAVE_IMAGE_CAP')
    if provider:
        codes += provider_codes(art, provider, usage, week_fn)
    session = active_session(art)
    if session:
        recent = jobs[session['jobs']:]
        if sum(j['charged_images'] for j in recent) >= session['sessionImageCap']:
            codes.append('SESSION_CAP: ' + session['name'])
        slot = session.get('slotAttemptCap')
        if slot is not None and scene is not None and sum(j.get('scene') == scene for j in recent) >= slot:
            codes.append('SESSION_SLOT_ATTEMPT_CAP: ' + session['name'] + ':' + scene)
    return codes


def verify_session(art, start, policy=None):
    """Post-hoc audit of one start record (new or legacy snapshot shape): [] when intact."""
    art = Path(art); root = art.resolve().parent
    jobs = load_usage(art)['jobs']; codes = []
    if digest(jobs[:start['jobs']]) != start['jobsDigest']:
        codes.append('HISTORY_CHANGED')
    for path, hash_ in start.get('protected', {}).items():
        if not (root / path).is_file() or sha(root / path) != hash_:
            codes.append('PROTECTED_CHANGED:' + path)
    recent = jobs[start['jobs']:]
    charged = sum(j['charged_images'] for j in recent)
    if charged > start['sessionImageCap']:
        codes.append('SESSION_CAP')
    policy = policy if policy is not None else read(art / 'budget.json')
    if start['charged'] + charged > policy['wave_hard_cap']:
        codes.append('HARD_CAP')
    if any(j['status'] in ('reserved', 'running') for j in recent):
        codes.append('UNRESOLVED_RESERVATION')
    return codes


def clear_latch(art, provider, job_id, diagnosis, reason=None, session=None):
    """Clear only the provider latch one job set by a diagnosed LOCAL failure. The charge and the
    ledger row stay; quota, rate or payment evidence anywhere in the job's output refuses."""
    from generate import quota_evidence
    art = Path(art); root = art.resolve().parent
    name = session or (active_session(art) or {}).get('name')
    if not name:
        raise RuntimeError('SESSION_REQUIRED: latch archives live in a session folder')
    job = next(j for j in load_usage(art)['jobs'] if j['id'] == job_id)
    evidence = Path(job['invocation_evidence'])
    evidence = evidence if evidence.is_absolute() else root / evidence
    log = (evidence / 'cli-output.txt').read_text(encoding='utf-8', errors='replace')
    text = (log + '\n' + str(job.get('error', ''))).lower()
    if any(w in text for w in RATE_WORDS) or quota_evidence(log) or quota_evidence(job.get('error', '')):
        raise RuntimeError('QUOTA_OR_RATE_SIGNAL')
    if job['status'] != 'error-unknown-spend' or not any(w in text for w in LOCAL_FAILURE):
        raise RuntimeError('NOT_A_LOCAL_FAILURE')
    folder = session_dir(art, name)
    with lock(art / 'providers/.lock'):
        history = read(art / 'providers/history.json'); state = history['providers'][provider]
        if not state['stop'] or state['stop']['job'] != job_id:
            raise RuntimeError('LATCH_NOT_SET_BY_JOB')
        write(folder / 'latches' / (provider + '-' + job_id + '.json'), state['stop'])
        write(folder / 'diagnoses' / (job_id + '.json'), {'job': job_id, 'at': now(), 'charged_images': job['charged_images'], 'diagnosis': diagnosis})
        state['events'].append({'at': now(), 'event': 'diagnosis', 'job': job_id, 'reason': diagnosis})
        state['stop'] = None
        state['events'].append({'at': now(), 'event': 'latch-cleared-local-failure', 'job': job_id,
                                'reason': reason or (name + ': local failure diagnosed; old latch in waves/' + name + '/latches; quota and rate errors still latch')})
        write(art / 'providers/history.json', history)
