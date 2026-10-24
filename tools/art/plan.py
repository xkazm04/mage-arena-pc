"""art plan <wave>: per slot the next legal action and its blocker. Zero spend, zero writes, no lock.

Every slot is asked through providers.decide (the decision providers.generate takes before it
reserves) and spend.headroom (the caps Budget.reserve raises), so the preview and the real call
cannot disagree. Slots are the wave's briefs under art/briefs/<wave>/, or a wave adapter's rows
(D2S: d2_slice.plan_rows, which adds the family-proof and slot-attempt rules).

  python tools/art/pipeline.py plan <wave> [--json]
"""
from __future__ import annotations
import argparse
import json
from contextlib import contextmanager
from pathlib import Path
from common import ART, ROOT, read, week
import providers
import spend

ADAPTERS = {'D2S': 'd2_slice'}
GENERATE = 'python tools/art/pipeline.py provider-generate '


def provider_state(art, usage, cli):
    """providers.ProviderBudget.available's codes, plus a missing CLI (generate skips that provider)."""
    def state(provider):
        codes = spend.provider_codes(art, provider, usage)
        if codes:
            return codes[0]
        return None if cli(provider) else 'CLI_MISSING'
    return state


@contextmanager
def would_activate(art, name):
    """headroom as it will read once a wave script activates its session; patches nothing on disk."""
    pointer = Path(art) / spend.POINTER
    if pointer.exists():
        if read(pointer)['name'] != name:
            raise RuntimeError('SESSION_ACTIVE: close ' + read(pointer)['name'] + ' first')
        yield
        return
    start = spend.session_dir(art, name) / 'start.json'
    if not start.exists():
        raise RuntimeError('SESSION_START_REQUIRED: prepare ' + name + ' first')
    original = spend.active_session
    spend.active_session = lambda a: {**read(start), 'name': name} if Path(a) == Path(art) else original(a)
    try:
        yield
    finally:
        spend.active_session = original


def reserve_code(art, wave, scene, provider, attempt, usage):
    """The code generate would raise between choosing a provider and the first byte of spend."""
    job_id = f'{wave.lower()}-{scene}-{provider}-a{attempt:02}'
    if (Path(art) / 'raw' / job_id).exists():
        return 'EXISTING_ATTEMPT_FOLDER'
    codes = spend.headroom(art, wave=wave, provider=provider, scene=scene, style_id='covenant', job_id=job_id, usage=usage)
    return codes[0] if codes else None


def row(slot, **fields):
    return {'slot': slot, 'state': None, 'code': None, 'provider': None, 'skipped': [], 'job': None,
            'new_calls': 0, 'next_command': None, 'action': None, **fields}


def brief_row(art, root, path, spec, usage, cli):
    """One brief exactly as `pipeline.py provider-generate <brief>` would take it."""
    wave = spec['wave']; brief = Path(path).resolve().relative_to(Path(root).resolve()).as_posix()
    base = row(spec['id'], brief=brief)
    try:
        providers.validate_spec(spec, art, root)
        old = [j for j in usage['jobs'] if j.get('wave') == wave and j['scene'] == spec['id']]
        d = providers.decide(spec, old, providers.wave_reviews(art, wave), provider_state(art, usage, cli), root)
    except (RuntimeError, OSError, KeyError) as exc:
        return {**base, 'state': 'blocked', 'code': str(exc)}
    out = {**base, 'state': d['state'], 'code': d['code'], 'job': d['job'], 'skipped': d['skipped']}
    review = f"python tools/art/waves.py review {wave} --job {d['job']} --note '<direct observation>' [--reject]"
    if d['state'] == 'resume':
        return {**out, 'action': 'already generated from this exact brief; provider-generate returns it with zero calls'}
    if d['state'] == 'needs-review':
        return {**out, 'next_command': review, 'action': 'review ' + str(d['job']) + ' by direct inspection (hash-bound)'}
    if d['state'] == 'needs-correction':
        return {**out, 'next_command': GENERATE + brief,
                'action': 'set correction_of to ' + d['job'] + ' and correct the prompt in the brief, then generate'}
    if d['state'] == 'reviewed':
        return {**out, 'action': 'reviewed without a rejection; nothing to spend'}
    if d['state'] == 'blocked':
        return out
    code = reserve_code(art, wave, spec['id'], d['provider'], len(old) + 1, usage)
    if code:
        return {**out, 'state': 'blocked', 'code': code, 'provider': d['provider']}
    return {**out, 'provider': d['provider'], 'new_calls': 1, 'next_command': GENERATE + brief,
            'action': 'one ' + d['provider'] + ' call'}


def brief_rows(wave, art, root, usage, cli):
    folder = Path(art) / 'briefs' / wave.lower()
    out = []
    for path in sorted(folder.glob('*.json')) if folder.is_dir() else []:
        spec = read(path)
        if isinstance(spec, dict) and spec.get('wave') == wave and 'id' in spec:
            out.append(brief_row(art, root, path, spec, usage, cli))
    return out


def headroom(art, wave, usage):
    """Footer: every cap the next image of this wave meets, with the numbers behind it."""
    art = Path(art); policy = read(art / 'budget.json'); jobs = usage['jobs']; this_week = week()
    charged = sum(j['charged_images'] for j in jobs)
    weekly = sum(j['charged_images'] for j in jobs if j['week'] == this_week)
    out = {'project': {'charged': charged, 'hard_cap': policy['wave_hard_cap'], 'target': policy['target_images'],
                       'weekly': weekly, 'weekly_cap': policy['weekly_image_cap']},
           'wave': {'charged': sum(j['charged_images'] for j in jobs if j.get('wave') == wave),
                    'cap': policy.get('wave_image_caps', {}).get(wave)},
           'providers': {}, 'session': None, 'run_in_progress': (art / '.run.lock').exists(),
           'blocking': spend.headroom(art, wave=wave, usage=usage, policy=policy)}
    if (art / 'providers/history.json').exists() and (art / 'providers/budget.json').exists():
        history = read(art / 'providers/history.json')['providers']
        for name, cap in read(art / 'providers/budget.json')['providers'].items():
            stop = (history.get(name) or {}).get('stop')
            out['providers'][name] = {
                'charged_week': sum(j['charged_images'] for j in jobs if spend.provider_of(j) == name and j['week'] == this_week)
                + cap.get('external_known_charges', {}).get(this_week, 0),
                'weekly_cap': cap['weekly_image_cap'], 'stop': stop['reason'] if stop else None}
    session = spend.active_session(art)
    if session is None and (spend.session_dir(art, wave) / 'start.json').exists():
        session = {**read(spend.session_dir(art, wave) / 'start.json'), 'name': wave, 'pending_activation': True}
    if session:
        out['session'] = {'name': session['name'], 'charged': sum(j['charged_images'] for j in jobs[session['jobs']:]),
                          'cap': session['sessionImageCap'], 'slot_attempt_cap': session.get('slotAttemptCap'),
                          'active': not session.get('pending_activation')}
    return out


def plan(wave, art=ART, root=ROOT, cli=None):
    """{'wave', 'rows', 'headroom'}; reads the ledgers once, writes nothing."""
    cli = cli or providers.provider_cli
    usage = spend.load_usage(art)
    if wave in ADAPTERS and Path(art) == ART:
        rows = __import__(ADAPTERS[wave]).plan_rows(cli=cli)
    else:
        rows = brief_rows(wave, art, root, usage, cli)
    return {'wave': wave, 'rows': rows, 'headroom': headroom(art, wave, usage)}


def table(result):
    lines = [f"{'slot':34} {'state':16} {'provider':8} blocker / next"]
    for r in result['rows']:
        skipped = ' '.join(f'[{p} skipped: {why}]' for s in r['skipped'] for p, why in s.items())
        tail = r['code'] if r['state'] == 'blocked' else (r['next_command'] or r['action'] or '')
        lines.append(f"{r['slot'][:34]:34} {r['state']:16} {(r['provider'] or '-'):8} {tail} {skipped}".rstrip())
    h = result['headroom']; p = h['project']
    lines.append('')
    lines.append(f"project {p['charged']}/{p['hard_cap']} hard, target {p['target']}, week {p['weekly']}/{p['weekly_cap']}; "
                 f"wave {result['wave']} {h['wave']['charged']}" + (f"/{h['wave']['cap']}" if h['wave']['cap'] is not None else ''))
    for name, v in h['providers'].items():
        lines.append(f"provider {name} week {v['charged_week']}/{v['weekly_cap']}" + (f"; STOP: {v['stop']}" if v['stop'] else ''))
    if h['session']:
        s = h['session']
        lines.append(f"session {s['name']} {s['charged']}/{s['cap']}" + (f", {s['slot_attempt_cap']} per slot" if s['slot_attempt_cap'] else '')
                     + ('' if s['active'] else ' (activates on the first call)'))
    if h['run_in_progress']:
        lines.append('a run holds art/.run.lock')
    if h['blocking']:
        lines.append('blocking: ' + '; '.join(h['blocking']))
    ready = sum(r['state'] == 'ready' for r in result['rows'])
    lines.append(f"{ready} ready, {sum(r['new_calls'] for r in result['rows'])} calls if all run; zero spent by this plan")
    return '\n'.join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('wave'); ap.add_argument('--json', action='store_true')
    a = ap.parse_args(argv)
    result = plan(a.wave)
    print(json.dumps(result, indent=2) if a.json else table(result))


if __name__ == '__main__':
    main()
