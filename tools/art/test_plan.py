"""art plan: per-slot next legal action, the same decision providers.generate takes. Temp art dirs; zero provider calls."""
import tempfile
import unittest
from pathlib import Path
from unittest import mock
from common import digest, read, sha, week, write
import providers

WAVE = 'W1'


def spec(scene='s1', **extra):
    return {'wave': WAVE, 'id': scene, 'pilot': True, 'providers': ['agy'], 'prompt': 'paint ' + scene, **extra}


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name); self.art = self.root / 'art'
        write(self.art / 'budget.json', {'wave_hard_cap': 100, 'weekly_image_cap': 100, 'target_images': 100, 'max_attempts_per_scene': 3})
        write(self.art / 'usage.json', {'schema': 1, 'stop': None, 'jobs': [], 'events': []})
        write(self.art / 'providers/budget.json', {'providers': {'agy': {'weekly_image_cap': 50}, 'grok': {'weekly_image_cap': 50}}})
        write(self.art / 'providers/history.json', {'providers': {p: {'stop': None, 'events': []} for p in ('agy', 'grok')}})

    def tearDown(self):
        self.tmp.cleanup()

    def brief(self, value, name=None):
        path = self.art / 'briefs' / WAVE.lower() / ((name or value['id']) + '.json')
        write(path, value); return path

    def row(self, status, scene='s1', provider='agy', n=1, **extra):
        job = {'id': f'w1-{scene}-{provider}-a{n:02}', 'wave': WAVE, 'scene': scene, 'style_id': 'covenant', 'status': status,
               'provider': provider, 'week': week(), 'charged_images': 1, 'input_hash': 'other', 'prompt': 'old', **extra}
        if status == 'generated':
            image = self.art / 'review/sources' / (job['id'] + '.png'); image.parent.mkdir(parents=True, exist_ok=True)
            image.write_bytes(job['id'].encode())
            job.update(archive='art/review/sources/' + image.name, sha256=sha(image))
        usage = read(self.art / 'usage.json'); usage['jobs'].append(job); write(self.art / 'usage.json', usage)
        return job

    def plan(self):
        import plan
        return plan.plan(WAVE, art=self.art, root=self.root, cli=lambda p: Path('fake-' + p))

    def only(self):
        rows = self.plan()['rows']; self.assertEqual(len(rows), 1); return rows[0]

    def run_generate(self, brief_path):
        """providers.generate on the same temp art with invoke stubbed: what the real call would do."""
        calls = []
        def stub(provider, *_):
            calls.append(provider); raise AssertionError('INVOKED')
        with mock.patch.object(providers, 'ART', self.art), mock.patch.object(providers, 'ROOT', self.root), \
             mock.patch.object(providers, 'invoke', stub), mock.patch.object(providers, 'provider_cli', lambda p: Path('fake-' + p)), \
             mock.patch('builtins.print'):
            try:
                return {'returned': providers.generate(read(brief_path))['id'], 'invoked': calls}
            except AssertionError:
                return {'invoked': calls}
            except RuntimeError as exc:
                return {'raised': str(exc), 'invoked': calls}

    def assert_parity(self, row, brief_path):
        result = self.run_generate(brief_path)
        if row['state'] == 'resume':
            self.assertEqual(result, {'returned': row['job'], 'invoked': []})
        elif row['state'] == 'ready':
            self.assertEqual(result['invoked'], [row['provider']])
        else:
            self.assertEqual(result, {'raised': row['code'], 'invoked': []})

    # case 1
    def test_matching_generated_row_resumes_with_zero_calls(self):
        s = spec(); path = self.brief(s); self.row('generated', input_hash=digest(s))
        r = self.only()
        self.assertEqual((r['state'], r['new_calls'], r['next_command']), ('resume', 0, None))
        self.assert_parity(r, path)

    # case 2
    def test_unreviewed_generated_row_needs_hash_bound_review(self):
        path = self.brief(spec()); job = self.row('generated')
        r = self.only()
        self.assertEqual((r['state'], r['code']), ('needs-review', 'HASH_BOUND_REJECTION_REQUIRED'))
        self.assertIn('waves.py review W1 --job ' + job['id'], r['next_command'])
        self.assert_parity(r, path)

    # case 3
    def test_bound_rejection_needs_correction_then_is_ready(self):
        job = self.row('generated')
        write(self.art / 'waves' / WAVE / 'reviews' / (job['id'] + '.json'), {'verdict': 'reject', 'sha256': job['sha256']})
        path = self.brief(spec())
        r = self.only()
        self.assertEqual((r['state'], r['code']), ('needs-correction', 'HASH_BOUND_REJECTION_REQUIRED'))
        self.assertIn('provider-generate', r['next_command']); self.assertIn(job['id'], r['action'])
        self.assert_parity(r, path)
        path = self.brief(spec(correction_of=job['id'], prompt='paint s1 corrected'))
        r = self.only()
        self.assertEqual((r['state'], r['provider'], r['new_calls'], r['code']), ('ready', 'agy', 1, None))
        self.assert_parity(r, path)

    # case 4
    def test_latched_provider_is_skipped_with_its_reason(self):
        self.row('error-unknown-spend')
        history = read(self.art / 'providers/history.json')
        history['providers']['agy']['stop'] = {'at': 't', 'event': 'stop', 'job': 'w1-s1-agy-a01', 'reason': 'HTTP 429'}
        write(self.art / 'providers/history.json', history)
        path = self.brief(spec(providers=['agy', 'grok']))
        r = self.only()
        self.assertEqual((r['state'], r['provider']), ('ready', 'grok'))
        self.assertEqual(r['skipped'], [{'agy': 'PROVIDER_STOP: HTTP 429'}])
        self.assert_parity(r, path)

    def test_already_tried_provider_is_named_not_silent(self):
        self.row('error-unknown-spend'); path = self.brief(spec())
        r = self.only()
        self.assertEqual((r['state'], r['code']), ('blocked', 'NO_AVAILABLE_PROVIDER: backlog required'))
        self.assertEqual(r['skipped'], [{'agy': 'PROVIDER_ALREADY_TRIED: agy'}])
        self.assert_parity(r, path)

    # case 5
    def test_moderation_refusal_requires_one_explicit_rewrite(self):
        self.row('moderation-refused'); path = self.brief(spec())
        r = self.only()
        self.assertEqual((r['state'], r['code']), ('blocked', 'ONE_EXPLICIT_MODERATION_REWRITE_REQUIRED'))
        self.assert_parity(r, path)

    def test_spend_cap_blocks_the_ready_slot_with_reserves_code(self):
        policy = read(self.art / 'budget.json'); policy['wave_image_caps'] = {WAVE: 1}; write(self.art / 'budget.json', policy)
        self.row('generated', scene='other', input_hash='x')
        path = self.brief(spec())
        r = self.only()
        self.assertEqual((r['state'], r['code']), ('blocked', 'WAVE_IMAGE_CAP'))
        self.assertIn('WAVE_IMAGE_CAP', self.plan()['headroom']['blocking'])
        self.assert_parity(r, path)

    # case 6
    def test_generate_takes_its_decision_from_decide(self):
        path = self.brief(spec())
        with mock.patch.object(providers, 'decide', wraps=providers.decide) as spy:
            self.run_generate(path)
        self.assertEqual(spy.call_count, 1)

    # case 7
    def test_plan_writes_nothing_and_takes_no_lock(self):
        job = self.row('generated')
        write(self.art / 'waves' / WAVE / 'reviews' / (job['id'] + '.json'), {'verdict': 'reject', 'sha256': job['sha256']})
        write(self.art / 'grades' / (job['id'] + '.json'), {'status': 'graded'})
        self.brief(spec()); self.brief(spec('s2'))
        snapshot = lambda: {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        before = snapshot()
        out = self.plan()
        self.assertEqual(len(out['rows']), 2)
        self.assertEqual(snapshot(), before)


class D2SlicePlanTests(unittest.TestCase):
    def test_d2_plan_covers_every_slot_and_leaves_ledgers_untouched(self):
        import d2_slice
        from common import ART
        watched = [ART / 'usage.json', ART / 'providers/history.json', ART / 'budget.json']
        before = [p.read_bytes() for p in watched]; pointer = (ART / 'spend-session.json').exists()
        rows = d2_slice.plan_rows(cli=lambda p: Path('fake-' + p))
        self.assertEqual([p.read_bytes() for p in watched], before)
        self.assertEqual((ART / 'spend-session.json').exists(), pointer)  # plan never activates a session
        self.assertFalse((ART / '.run.lock').exists() or (ART / '.budget.lock').exists())
        slots = {r['slot'] for r in rows}
        self.assertTrue(set(d2_slice.scenes()) <= slots)
        for r in rows:
            self.assertIn(r['state'], ('kept', 'needs-review', 'needs-correction', 'ready', 'blocked'))
            if r['state'] == 'blocked': self.assertTrue(r['code'])


if __name__ == '__main__':
    unittest.main()
