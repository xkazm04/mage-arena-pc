"""One CLI image call per reservation, sequential; no automatic retries or latch reset."""
from __future__ import annotations
import json
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from common import ART, ROOT, config, digest, get_style, input_matches_current, input_record, lock, now, read, relative, sha, source_path, week, write

# Match errors, not bare token counts, prompt text or image dimensions.
QUOTA = re.compile(r'(?i)(rate[ _-]?limit(?:ed| exceeded| reached| error)|quota.{0,60}(?:exceed|exhaust|reach|deplet)|too many requests|(?:HTTP(?:/\d(?:\.\d)?)?\s*|status(?:_code| code)?["\s:=]*|error["\s:=]*)429\b|\b429\s+(?:too many|rate limit)|usage limit.{0,40}(?:exceed|reach)|insufficient.{0,15}credits|resource_exhausted)')


def quota_evidence(value, error_context=False):
    if isinstance(value, dict):
        context = error_context or value.get('type') == 'error'
        for k, v in value.items():
            key = k.lower()
            if str(v) == '429' and (key in ('status', 'status_code', 'statuscode', 'http_status') or context and key == 'code'):
                return 'structured HTTP 429'
            # Never search an echoed request or generated tool-call prompt for errors.
            if key in ('prompt', 'arguments', 'input', 'rawinput'):
                continue
            found = quota_evidence(v, context or key in ('error', 'errors', 'exception'))
            if found:
                return found
    elif isinstance(value, list):
        for v in value:
            found = quota_evidence(v, error_context)
            if found:
                return found
    elif isinstance(value, str):
        try:
            decoded = json.loads(value)
        except (ValueError, TypeError):
            decoded = None
        if isinstance(decoded, (dict, list)):
            return quota_evidence(decoded, error_context)
        if error_context and value.strip() == '429':
            return 'structured error 429'
        match = QUOTA.search(value)
        return match.group(0) if match else None
    return None


class Budget:
    """One atomically replaced ledger owns both reservations and stop state."""
    def __init__(self, art=ART, week_fn=week):
        self.art = Path(art)
        self.policy = read(self.art / 'budget.json')
        self.week_fn = week_fn

    def load(self):
        path = self.art / 'usage.json'
        return read(path) if path.exists() else {'schema': 1, 'stop': None, 'jobs': [], 'events': []}

    def save(self, value):
        write(self.art / 'usage.json', value)

    def reserve(self, job):
        with lock(self.art / '.budget.lock'):
            value = self.load()
            if value['stop']:
                raise RuntimeError('SPEND_STOP: ' + value['stop']['reason'])
            if any(j['status'] in ('reserved', 'running') for j in value['jobs']):
                raise RuntimeError('UNRESOLVED_RESERVATION: inspect prior session; no automatic retry')
            count = sum(j['charged_images'] for j in value['jobs'])
            weekly = sum(j['charged_images'] for j in value['jobs'] if j['week'] == self.week_fn())
            if count >= self.policy['wave_hard_cap'] or weekly >= self.policy['weekly_image_cap']:
                raise RuntimeError('HARD_BUDGET_CAP')
            if count >= self.policy['target_images']:
                raise RuntimeError('TARGET_BUDGET_STOP: preserve shared subscription')
            same = [j for j in value['jobs'] if j['style_id'] == job['style_id'] and j['scene'] == job['scene']]
            scene_key = job['style_id'] + ':' + job['scene']
            attempt_cap = self.policy.get('scene_attempt_caps', {}).get(scene_key, self.policy['max_attempts_per_scene'])
            if len(same) >= attempt_cap:
                raise RuntimeError('SCENE_ATTEMPT_CAP')
            if any(j['id'] == job['id'] for j in value['jobs']):
                raise RuntimeError('DUPLICATE_JOB')
            record = {**job, 'at': now(), 'week': self.week_fn(), 'charged_images': 1, 'status': 'reserved'}
            value['jobs'].append(record)
            value['events'].append({'event': 'reserved', 'id': record['id'], 'at': record['at']})
            self.save(value)
            return record

    def update(self, job_id, fields):
        with lock(self.art / '.budget.lock'):
            value = self.load()
            job = next(j for j in value['jobs'] if j['id'] == job_id)
            if 'charged_images' in fields and fields['charged_images'] < job['charged_images']:
                raise ValueError('NO_REFUNDS')
            job.update(fields)
            value['events'].append({'event': job['status'], 'id': job_id, 'at': now()})
            self.save(value)
            return job

    def stop(self, reason):
        with lock(self.art / '.budget.lock'):
            value = self.load()
            if not value['stop']:
                value['stop'] = {'at': now(), 'reason': reason}
                value['events'].append({'event': 'spend-stop', **value['stop']})
                self.save(value)

    def summary(self):
        value = self.load()
        spent = sum(j['charged_images'] for j in value['jobs'])
        weekly = sum(j['charged_images'] for j in value['jobs'] if j['week'] == self.week_fn())
        return {'week': self.week_fn(), 'wave_reserved': spent, 'weekly_reserved': weekly,
                'target_remaining': max(0, self.policy['target_images'] - spent),
                'hard_remaining': max(0, min(self.policy['wave_hard_cap'] - spent, self.policy['weekly_image_cap'] - weekly)),
                'generated': sum(j['status'] == 'generated' for j in value['jobs']),
                'observed_image_tool_calls': sum(len(j.get('tool_calls', [])) for j in value['jobs']),
                'videos': 0, 'stop': value['stop'], 'shared_account_remaining': 'not measured'}


def session_evidence(session_id):
    calls, results, images, histories = [], [], [], []
    # Only this explicitly allocated UUID; never inspect another project's session.
    for path in (Path.home() / '.grok/sessions').glob('*/' + session_id + '/chat_history.jsonl'):
        histories.append(path)
        for line in path.read_text(encoding='utf-8').splitlines():
            try:
                event = json.loads(line)
            except ValueError:
                continue
            for call in event.get('tool_calls', []):
                args = call['arguments']
                calls.append({'name': call['name'], 'arguments': json.loads(args) if isinstance(args, str) else args})
            if event.get('type') == 'tool_result':
                results.append(event.get('content', ''))
        images.extend(p for p in (path.parent / 'images').glob('*') if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'))
    return calls, results, images, histories


def output_quota(path, results):
    for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
        try:
            value = json.loads(line)
        except ValueError:
            value = line
        found = quota_evidence(value)
        if found:
            return found
    return quota_evidence(results)


def kill_tree(process):
    if process.poll() is None:
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
        process.wait(timeout=20)


def proof_valid(style):
    path = ART / 'proofs' / (style['id'] + '.json')
    if not path.exists():
        return False
    p = read(path)
    source = source_path(p)
    return (p['verdict'] == 'exploration-sibling-ready' and p['style_hash'] == digest(style)
            and p['pair_input_hash'] == digest([input_record(style, s) for s in ('arena', 'camp')])
            and source.is_file() and sha(source) == p['sha256'])


def generate(style_id, scene, correction=None, spec=None):
    # Later waves supply an immutable, proof-gated input; transport and budget stay shared.
    style = get_style(style_id) if spec is None else spec['style']
    cfg = config()
    source_input = input_record(style, scene) if spec is None else spec
    with lock(ART / '.run.lock'):
        budget = Budget()
        old = [j for j in budget.load()['jobs'] if j['style_id'] == style_id and j['scene'] == scene]
        if old and not correction:
            if not (input_matches_current(old[-1]) if spec is None else old[-1]['input_hash'] == digest(spec)):
                raise RuntimeError('BRIEF_CHANGED: mint a version before spending')
            record = old[-1]
            if record['status'] == 'generated' and (not source_path(record).is_file() or sha(source_path(record)) != record['sha256']):
                raise RuntimeError('ARTIFACT_INVALID: recover exact bytes; no automatic regeneration')
            print(json.dumps({'resume': record['id'], 'status': record['status'], 'new_calls': 0}), flush=True)
            return record
        if old and correction:
            if old[-1]['status'] != 'generated':
                raise RuntimeError('NO_TRANSPORT_RETRY')
            rejection = read(ART / 'rejections' / (old[-1]['id'] + '.json'))
            if rejection['sha256'] != old[-1]['sha256'] or rejection['correction'] != correction:
                raise RuntimeError('HASH_BOUND_REJECTION_REQUIRED')
        elif correction:
            raise RuntimeError('CORRECTION_NEEDS_EXISTING_IMAGE')
        if spec is not None:
            from waves import require_proof
            require_proof(spec)
        if spec is None and scene == 'camp' and not proof_valid(style):
            raise RuntimeError('ARENA_PROOF_REVIEW_REQUIRED')
        exe = shutil.which('grok')
        if not exe:
            raise RuntimeError('CLI_MISSING_BEFORE_SPEND')
        attempt = len(old) + 1
        job_id = f'{style_id}-{scene}-a{attempt:02}'
        folder = ART / 'raw' / job_id
        if folder.exists():
            raise RuntimeError('EXISTING_ATTEMPT_FOLDER')
        prompt = source_input['prompt']
        if correction:
            prompt += '\n\nCORRECTION FROM DIRECT PIXEL REVIEW: ' + correction.strip()
        session_id = str(uuid.uuid4())
        record = budget.reserve({'id': job_id, 'style_id': style_id, 'scene': scene,
                                 'attempt': attempt, 'input_hash': digest(source_input),
                                 'input': source_input, 'prompt': prompt, 'session_id': session_id,
                                 'origin': 'grok-cli', 'model': cfg['cli_model'], 'seed': None,
                                 'correction': correction, **({'wave': spec['wave']} if spec else {})})
        folder.mkdir(parents=True)
        request = ('Call image_gen exactly ONCE, using aspect_ratio ' + cfg['aspect_ratio'] + '. '
                   'Use the image prompt below verbatim, without changing any words. '
                   'Generate only one image. Do not retry if any error occurs. Do not call any other tool, '
                   'make variants, edit, use video or delegate. After the tool returns, finish with its saved file path.\n\nIMAGE PROMPT:\n' + prompt)
        (folder / 'request.txt').write_text(request, encoding='utf-8')
        command = [exe, '-m', cfg['cli_model'], '--effort', cfg['cli_effort'], '--always-approve',
                   '--permission-mode', 'bypassPermissions', '--no-subagents', '--disable-web-search',
                   '--tools', 'image_gen', '--max-turns', '2', '--session-id', session_id,
                   '--prompt-file', str((folder / 'request.txt').resolve()), '--output-format', 'streaming-json']
        record = budget.update(job_id, {'status': 'running', 'command': command})
        write(folder / 'sidecar.json', record)
        started = time.monotonic()
        log = folder / 'cli-output.txt'
        process = None
        quota = None
        violation = None
        fields = {}
        try:
            with log.open('w', encoding='utf-8') as out:
                process = subprocess.Popen(command, cwd=folder, stdout=out, stderr=subprocess.STDOUT,
                                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                while process.poll() is None:
                    calls, results, _, _ = session_evidence(session_id)
                    quota = output_quota(log, results)
                    if quota:
                        budget.stop(job_id + ': ' + quota)
                        kill_tree(process)
                        break
                    if len(calls) > 1 or any(c['name'] != 'image_gen' for c in calls):
                        violation = 'CLI_ONE_IMAGE_CONTRACT_VIOLATION'
                        budget.stop(job_id + ': ' + violation)
                        kill_tree(process)
                        break
                    if time.monotonic() - started > cfg['generation_timeout_seconds']:
                        budget.stop(job_id + ': TIMEOUT_UNKNOWN_SPEND')
                        kill_tree(process)
                        raise TimeoutError('CLI deadline; charged, no retry')
                    time.sleep(cfg['poll_seconds'])
            calls, results, files, histories = session_evidence(session_id)
            quota = quota or output_quota(log, results)
            if quota:
                budget.stop(job_id + ': ' + quota)
            exact = len(calls) == 1 and calls[0]['name'] == 'image_gen' and calls[0]['arguments'].get('prompt') == prompt and calls[0]['arguments'].get('aspect_ratio') == cfg['aspect_ratio']
            fields.update(tool_calls=calls, tool_results=results, prompt_verbatim_verified=exact,
                          charged_images=max(1, len(calls)), returncode=process.returncode)
            for history in histories:
                shutil.copy2(history, folder / 'chat_history.jsonl')
            if quota:
                fields.update(status='quota-stopped', error=quota)
            elif violation or len(calls) > 1:
                budget.stop(job_id + ': CLI_ONE_IMAGE_CONTRACT_VIOLATION')
                fields.update(status='contract-stopped', error=violation or 'extra tool calls')
            elif len(files) == 1 and exact and process.returncode == 0:
                from PIL import Image
                target = folder / ('source' + files[0].suffix.lower())
                shutil.copy2(files[0], target)
                with Image.open(target) as im:
                    im.verify()
                fields.update(status='generated', source=relative(target), sha256=sha(target))
            else:
                budget.stop(job_id + ': UNCERTAIN_RESULT; inspect evidence, no automatic retry')
                fields.update(status='error-unknown-spend', error=f'exit={process.returncode}; files={len(files)}; verbatim={exact}')
        except Exception as exc:
            if process is not None:
                kill_tree(process)
            budget.stop(job_id + ': ' + type(exc).__name__ + '; unknown spend')
            fields.update(status='error-unknown-spend', error=str(exc))
        fields['elapsed_seconds'] = round(time.monotonic() - started, 3)
        record = budget.update(job_id, fields)
        write(folder / 'sidecar.json', record)
        write(ART / 'attempts' / (job_id + '.json'), record)
        print(json.dumps({'id': job_id, 'status': record['status'], 'seconds': fields['elapsed_seconds'], 'budget': budget.summary()}), flush=True)
        return record
