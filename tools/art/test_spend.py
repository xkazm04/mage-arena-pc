"""One locked spend authority: sessions, caps and latch clears. Temp art dirs only, zero provider calls."""
import tempfile
import unittest
from pathlib import Path
from common import digest, read, sha, week, write
from generate import Budget


def job(n, scene='x', **extra):
    return {'id': f'j{n}', 'style_id': 'covenant', 'scene': scene, **extra}


class SpendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.art = Path(self.tmp.name) / 'art'
        write(self.art / 'budget.json', {'wave_hard_cap': 100, 'weekly_image_cap': 100, 'target_images': 100,
                                         'max_attempts_per_scene': 9, 'wave_image_caps': {'W': 1}})
        write(self.art / 'usage.json', {'schema': 1, 'stop': None, 'jobs': [], 'events': []})
        write(self.art / 'providers/budget.json', {'providers': {'agy': {'weekly_image_cap': 5, 'external_known_charges': {week(): 4}},
                                                                 'grok': {'weekly_image_cap': 50}}})
        write(self.art / 'providers/history.json', {'providers': {p: {'stop': None, 'events': []} for p in ('agy', 'grok')}})
        (self.art / 'delivery/x').mkdir(parents=True)
        (self.art / 'delivery/x/a.png').write_bytes(b'kept')

    def tearDown(self):
        self.tmp.cleanup()

    def charge(self, *jobs):
        b = Budget(self.art)
        for j in jobs:
            b.reserve(j); b.update(j['id'], {'status': 'generated'})

    def test_open_session_is_idempotent_and_copies_ledgers_once(self):
        import spend
        self.charge(job(1))
        first = spend.open_session(self.art, 'S', cap=2, slot_attempt_cap=1, protected=['delivery/x'], authorization='t')
        before = self.art / 'waves/S/before/usage.json'
        self.assertEqual(read(before)['jobs'][0]['id'], 'j1')
        self.charge(job(2, 'y'))
        second = spend.open_session(self.art, 'S', cap=2, slot_attempt_cap=1, protected=['delivery/x'], authorization='t')
        self.assertEqual(first, second)
        self.assertEqual(len(read(before)['jobs']), 1)
        start = read(self.art / 'waves/S/start.json')
        self.assertEqual((start['jobs'], start['charged'], start['sessionImageCap'], start['slotAttemptCap']), (1, 1, 2, 1))
        self.assertEqual(start['jobsDigest'], digest(read(before)['jobs']))
        self.assertEqual(list(start['protected'].values()), [sha(self.art / 'delivery/x/a.png')])
        for name in ('budget.json', 'providers/history.json', 'providers/budget.json'):
            self.assertTrue((self.art / 'waves/S/before' / name).is_file())

    def test_session_cap_is_enforced_by_reserve_for_any_caller(self):
        import spend
        spend.open_session(self.art, 'S', cap=2, slot_attempt_cap=5, authorization='t')
        self.charge(job(1, 'a'), job(2, 'b'))
        raw = (self.art / 'usage.json').read_bytes()
        with self.assertRaisesRegex(RuntimeError, '^SESSION_CAP'):
            Budget(self.art).reserve(job(3, 'c'))
        self.assertEqual((self.art / 'usage.json').read_bytes(), raw)
        self.assertFalse((self.art / '.budget.lock').exists())

    def test_activate_reuses_a_legacy_start_record_and_never_creates_one(self):
        import spend
        with self.assertRaisesRegex(RuntimeError, '^SESSION_START_REQUIRED'):
            spend.activate(self.art, 'D2S')
        self.assertEqual(spend.headroom(self.art), [])
        write(self.art / 'waves/D2S/start.json', {'at': 'then', 'jobs': 0, 'charged': 0, 'jobsDigest': digest([]),
                                                  'sessionImageCap': 1, 'slotAttemptCap': 2, 'authorization': 'old'})
        spend.activate(self.art, 'D2S')
        self.charge(job(1))
        self.assertEqual(spend.headroom(self.art), ['SESSION_CAP: D2S'])

    def test_session_slot_attempt_cap_is_per_scene(self):
        import spend
        self.charge(job(0, 'x'))  # inherited rows do not count against the session slot
        spend.open_session(self.art, 'S', cap=10, slot_attempt_cap=1, authorization='t')
        self.charge(job(1, 'x'))
        with self.assertRaisesRegex(RuntimeError, '^SESSION_SLOT_ATTEMPT_CAP'):
            Budget(self.art).reserve(job(2, 'x'))
        Budget(self.art).reserve(job(3, 'y'))

    def test_headroom_lists_every_blocker_and_reserve_raises_the_first(self):
        import spend
        self.charge(job(1, 'a', wave='W', provider='agy'))
        codes = spend.headroom(self.art, wave='W', provider='agy')
        self.assertEqual(codes, ['WAVE_IMAGE_CAP', 'PROVIDER_BUDGET_CAP'])
        with self.assertRaisesRegex(RuntimeError, '^WAVE_IMAGE_CAP$'):
            Budget(self.art).reserve(job(2, 'b', wave='W', provider='agy'))
        self.assertEqual(spend.headroom(self.art, wave='V', provider='grok'), [])

    def test_verify_session_reads_legacy_snapshots(self):
        import spend
        self.charge(job(1), job(2, 'y'))
        usage = read(self.art / 'usage.json')
        rel = 'art/delivery/x/a.png'
        legacy = {'at': 'then', 'jobs': 2, 'charged': 2, 'jobsDigest': digest(usage['jobs']),
                  'protected': {rel: sha(self.art / 'delivery/x/a.png')}, 'sessionImageCap': 40, 'authorization': 'old'}
        write(self.art / 'waves/A13/start-snapshot.json', legacy)
        start = read(self.art / 'waves/A13/start-snapshot.json')
        self.assertEqual(spend.verify_session(self.art, start), [])
        usage['jobs'][0]['charged_images'] = 0; write(self.art / 'usage.json', usage)
        self.assertEqual(spend.verify_session(self.art, start), ['HISTORY_CHANGED'])
        usage['jobs'][0]['charged_images'] = 1; write(self.art / 'usage.json', usage)
        (self.art / 'delivery/x/a.png').write_bytes(b'changed')
        self.assertEqual(spend.verify_session(self.art, start), ['PROTECTED_CHANGED:' + rel])

    def latched(self, log):
        evidence = self.art / 'providers/runs/j1'
        evidence.mkdir(parents=True); (evidence / 'cli-output.txt').write_text(log, encoding='utf-8')
        b = Budget(self.art); b.reserve(job(1, provider='agy'))
        b.update('j1', {'status': 'error-unknown-spend', 'error': 'exit=1; files=0', 'unique_output_images': 0,
                        'invocation_evidence': str(evidence)})
        from providers import ProviderBudget
        ProviderBudget(self.art).event('agy', 'stop', 'j1', 'exit=1; files=0')

    def test_clear_latch_refuses_quota_evidence(self):
        import spend
        self.latched('error: HTTP 429 Too Many Requests')
        spend.open_session(self.art, 'S', cap=5, authorization='t')
        raw = (self.art / 'providers/history.json').read_bytes()
        with self.assertRaisesRegex(RuntimeError, '^QUOTA_OR_RATE_SIGNAL'):
            spend.clear_latch(self.art, 'agy', 'j1', 'looked local')
        self.assertEqual((self.art / 'providers/history.json').read_bytes(), raw)

    def test_clear_latch_archives_and_clears_a_local_failure_under_the_provider_lock(self):
        import spend
        self.latched('failed to read image file: The system cannot find the file specified.')
        spend.open_session(self.art, 'S', cap=5, authorization='t')
        stop = read(self.art / 'providers/history.json')['providers']['agy']['stop']
        (self.art / 'providers/.lock').write_text('other', encoding='utf-8')
        with self.assertRaisesRegex(RuntimeError, 'LOCK_HELD'):
            spend.clear_latch(self.art, 'agy', 'j1', 'reference path missing')
        self.assertEqual(read(self.art / 'providers/history.json')['providers']['agy']['stop'], stop)
        (self.art / 'providers/.lock').unlink()
        spend.clear_latch(self.art, 'agy', 'j1', 'reference path missing')
        history = read(self.art / 'providers/history.json')['providers']['agy']
        self.assertIsNone(history['stop'])
        self.assertEqual(history['events'][-1]['event'], 'latch-cleared-local-failure')
        self.assertEqual(read(self.art / 'waves/S/latches/agy-j1.json'), stop)
        self.assertEqual(read(self.art / 'usage.json')['jobs'][0]['charged_images'], 1)


if __name__ == '__main__':
    unittest.main()
