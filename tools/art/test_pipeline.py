"""Safety/content tests use synthetic images and a temporary ledger; zero remote calls."""
import copy
import json
import tempfile
import unittest
from unittest.mock import Mock, patch
from pathlib import Path
from PIL import Image, ImageDraw
from common import ART, ROOT, camp_data, compile_prompt, config, digest, input_matches_current, input_record, read, sha, source_path, styles, write
from generate import Budget, generate, proof_valid, quota_evidence
from gates import pixel_gate
from grade import route, validate_answer
from rank import valid as valid_ranking, comparison_signature


class BudgetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.art = Path(self.tmp.name)
        self.policy = read(ART / 'budget.json')
        write(self.art / 'budget.json', self.policy)
        self.week = '2026-W40'
        self.b = Budget(self.art, lambda: self.week)

    def tearDown(self):
        self.tmp.cleanup()

    def job(self, n):
        return {'id': str(n), 'style_id': str(n), 'scene': 'arena'}

    def test_latch_survives_process_and_week(self):
        self.b.reserve(self.job(1))
        self.b.stop('HTTP 429')
        self.b.update('1', {'status': 'quota-stopped'})
        self.week = '2026-W41'
        with self.assertRaisesRegex(RuntimeError, 'SPEND_STOP'):
            Budget(self.art, lambda: self.week).reserve(self.job(2))
        self.assertEqual(self.b.summary()['wave_reserved'], 1)

    def test_crash_reservation_blocks_new_spend(self):
        self.b.reserve(self.job(1))
        with self.assertRaisesRegex(RuntimeError, 'UNRESOLVED'):
            Budget(self.art).reserve(self.job(2))
        self.assertEqual(self.b.summary()['wave_reserved'], 1)

    def test_failed_attempt_stays_charged(self):
        self.b.reserve(self.job(1))
        self.b.update('1', {'status': 'error-unknown-spend'})
        self.assertEqual(self.b.summary()['wave_reserved'], 1)
        with self.assertRaisesRegex(ValueError, 'NO_REFUNDS'):
            self.b.update('1', {'charged_images': 0})

    def test_target_and_wave_caps(self):
        self.policy.update(target_images=2, wave_hard_cap=3)
        write(self.art / 'budget.json', self.policy)
        b = Budget(self.art)
        for n in range(2):
            b.reserve(self.job(n))
            b.update(str(n), {'status': 'generated'})
        with self.assertRaisesRegex(RuntimeError, 'TARGET_BUDGET_STOP'):
            b.reserve(self.job(2))
        self.policy['target_images'] = 4
        write(self.art / 'budget.json', self.policy)
        b = Budget(self.art)
        b.reserve(self.job(2))
        b.update('2', {'status': 'generated'})
        with self.assertRaisesRegex(RuntimeError, 'HARD_BUDGET_CAP'):
            b.reserve(self.job(3))

    def test_weekly_cap(self):
        self.policy.update(weekly_image_cap=1)
        write(self.art / 'budget.json', self.policy)
        b = Budget(self.art, lambda: self.week)
        b.reserve(self.job(1))
        b.update('1', {'status': 'generated'})
        with self.assertRaisesRegex(RuntimeError, 'HARD_BUDGET_CAP'):
            b.reserve(self.job(2))
        self.week = '2026-W41'
        b.reserve(self.job(2))
        self.assertEqual(b.summary()['wave_reserved'], 2)

    def test_attempt_cap_across_revisions(self):
        for n in range(self.policy['max_attempts_per_scene']):
            b = self.job(n)
            b['style_id'] = 'same'
            self.b.reserve(b)
            self.b.update(str(n), {'status': 'generated'})
        with self.assertRaisesRegex(RuntimeError, 'SCENE_ATTEMPT_CAP'):
            self.b.reserve({'id': 'new-revision', 'style_id': 'same', 'scene': 'arena'})


class QuotaTests(unittest.TestCase):
    def test_true_errors(self):
        for value in ['HTTP 429', '429 Too Many Requests', 'rate limit exceeded', 'quota exhausted',
                      {'error': {'code': 429}}, {'status_code': 429}, {'error': '429'},
                      {'content': '{"error":{"code":429}}'}, 'RESOURCE_EXHAUSTED', 'insufficient credits']:
            with self.subTest(value=value):
                self.assertTrue(quota_evidence(value))

    def test_numeric_and_prompt_false_positives(self):
        for value in ['429 tokens', {'usage': {'input_tokens': 429}}, {'width': 429},
                      {'arguments': {'prompt': 'paint words rate limit exceeded'}},
                      {'prompt': 'HTTP 429'}, 'image 1429.png']:
            with self.subTest(value=value):
                self.assertIsNone(quota_evidence(value))


class ContentTests(unittest.TestCase):
    def test_fair_skeleton_and_diverse_style_axes(self):
        directions = styles()
        self.assertGreaterEqual(len(directions), 8)
        self.assertEqual(len({s['id'] for s in directions}), len(directions))
        for axis in ('line', 'palette', 'shading', 'density', 'mood'):
            self.assertEqual(len({s[axis] for s in directions}), len(directions))
        for scene in ('arena', 'camp'):
            tails = {compile_prompt(s, scene).split('\n\nACTION: ')[1] for s in directions}
            self.assertEqual(len(tails), 1)
            for s in directions:
                self.assertTrue(compile_prompt(s, scene).startswith(s['style_block']))

    def test_input_hash_invalidates_any_scene_or_style_change(self):
        style = styles()[0]
        before = digest([input_record(style, s) for s in ('arena', 'camp')])
        mutated = copy.deepcopy(style)
        mutated['style_block'] += ' different'
        self.assertNotEqual(before, digest([input_record(mutated, s) for s in ('arena', 'camp')]))

    def test_unchanged_scene_survives_metadata_version_only(self):
        record = input_record(styles()[0], 'camp')
        record['version'] = 'historical-version'
        job = {'input': record, 'input_hash': digest(record), 'style_id': styles()[0]['id'], 'scene': 'camp'}
        self.assertTrue(input_matches_current(job))
        record['prompt'] += ' planted contradiction'
        job['input_hash'] = digest(record)
        self.assertFalse(input_matches_current(job))

    def test_camp_ui_uses_actual_data_and_no_missing_well(self):
        locations, slots = camp_data()
        self.assertEqual(set(config()['camp']['positions']), {p['id'] for p in locations})
        self.assertNotIn('well', {p['id'] for p in locations})
        self.assertEqual(next(p for p in locations if p['id'] == 'pit')['open'], 'dusk')
        self.assertEqual(next(p for p in locations if p['id'] == 'edge')['open'], 'night')
        self.assertTrue(set(slots).issuperset(s for p in locations for s in p['open'].split(';')))

    def test_bad_images_fail_without_aesthetic_claim(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'test.png'
            Image.new('RGB', (1600, 900), 'white').save(path)
            self.assertIn('BLANK_OR_NEAR_BLANK', pixel_gate(path)['codes'])
            Image.new('RGB', (100, 200), 'black').save(path)
            self.assertIn('WRONG_ASPECT', pixel_gate(path)['codes'])
            self.assertIn('TOO_SMALL', pixel_gate(path)['codes'])
            path.write_bytes(b'not an image')
            self.assertIn('UNREADABLE_IMAGE', pixel_gate(path)['codes'])

    def test_valid_pixels_do_not_grant_owner_acceptance(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'test.png'
            im = Image.new('RGB', (1600, 900), 'white')
            ImageDraw.Draw(im).rectangle((300, 200, 1000, 700), fill='black')
            im.save(path)
            self.assertEqual(pixel_gate(path)['verdict'], 'technical-pass')
            self.assertIn('HASH_MISMATCH', pixel_gate(path, 'wrong')['codes'])


class GraderTests(unittest.TestCase):
    def test_comparative_ranking_is_complete_unique_and_hash_bound(self):
        ids = [s['id'] for s in styles()]
        value = {'ranking': ids, 'reasons': [{'style_id': i, 'strength': 'Clear silhouettes', 'concern': 'Small details'} for i in ids], 'limitation': 'Still images cannot prove motion feel.'}
        self.assertTrue(valid_ranking(value, ids))
        bad = copy.deepcopy(value)
        bad['ranking'][1] = bad['ranking'][0]
        self.assertFalse(valid_ranking(bad, ids))
        bad = copy.deepcopy(value)
        bad['reasons'].pop()
        self.assertFalse(valid_ranking(bad, ids))
        rows = [{'style_id': ids[0], 'scene': 'arena', 'verdict': 'owner-review', 'export': {'export_sha256': 'before'}}]
        before = comparison_signature(rows)
        rows[0]['export']['export_sha256'] = 'changed'
        self.assertNotEqual(before, comparison_signature(rows))

    def answer(self):
        return {'forbidden_rendering': False, 'overhead_view': 'yes', 'required_content': 'yes',
                'style_match': 'yes', 'readability': 3, 'confidence': .75, 'observation': 'Visible pencil outlines and open paths.'}

    def test_full_compliance_still_routes_owner(self):
        value = self.answer()
        self.assertTrue(validate_answer(value))
        self.assertEqual(route({'status': 'graded', 'answers': value})[0], 'owner-review')

    def test_schema_fails_closed(self):
        for key, value in [('confidence', 100), ('readability', True), ('forbidden_rendering', 'false'), ('observation', ''), ('overhead_view', 'probably')]:
            mutated = self.answer()
            mutated[key] = value
            self.assertFalse(validate_answer(mutated))
            self.assertIn('GRADING_NOT_MEASURED', route({'status': 'graded', 'answers': mutated})[1])
        mutated = self.answer()
        mutated['owner_approved'] = True
        self.assertFalse(validate_answer(mutated))

    def test_uncertain_or_missing_never_passes(self):
        value = self.answer()
        value['required_content'] = 'uncertain'
        self.assertEqual(route({'status': 'graded', 'answers': value}), ('owner-review', ['GRADER_UNCERTAIN']))
        self.assertEqual(route({'status': 'ungraded'})[1], ['GRADING_NOT_MEASURED'])

    def test_veto_is_not_averaged_away(self):
        value = self.answer()
        value['forbidden_rendering'] = True
        self.assertEqual(route({'status': 'graded', 'answers': value})[0], 'reject')
        value['forbidden_rendering'] = False
        value['required_content'] = 'no'
        self.assertEqual(route({'status': 'graded', 'answers': value})[0], 'reject')


class WorkflowTests(unittest.TestCase):
    def test_first_quota_result_latches_and_prevents_next_cli(self):
        with tempfile.TemporaryDirectory() as tmp:
            art = Path(tmp)
            write(art / 'budget.json', read(ART / 'budget.json'))
            budget = Budget(art)
            child = Mock()
            child.poll.return_value = 0
            child.returncode = 1
            with patch('generate.ART', art), patch('generate.Budget', return_value=budget), patch('generate.shutil.which', return_value='mock-grok'), patch('generate.subprocess.Popen', return_value=child) as popen, patch('generate.session_evidence', return_value=([], [{'error': {'code': 429}}], [], [])):
                result = generate(styles()[0]['id'], 'arena')
                self.assertEqual(result['status'], 'quota-stopped')
                self.assertEqual(budget.summary()['wave_reserved'], 1)
                self.assertIsNotNone(budget.summary()['stop'])
                with self.assertRaisesRegex(RuntimeError, 'SPEND_STOP'):
                    generate(styles()[1]['id'], 'arena')
                self.assertEqual(popen.call_count, 1)

    def test_camp_without_proof_never_reserves_or_calls(self):
        with tempfile.TemporaryDirectory() as tmp, patch('generate.ART', Path(tmp)), patch('generate.Budget') as budget, patch('generate.subprocess.Popen') as popen, patch('generate.proof_valid', return_value=False):
            budget.return_value.load.return_value = {'jobs': []}
            with self.assertRaisesRegex(RuntimeError, 'ARENA_PROOF_REVIEW_REQUIRED'):
                generate(styles()[0]['id'], 'camp')
            budget.return_value.reserve.assert_not_called()
            popen.assert_not_called()

    def test_resume_returns_existing_without_new_spend(self):
        inp = input_record(styles()[0], 'arena')
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'source.png'
            path.write_bytes(b'fixture-bytes')
            job = {'id': 'old', 'style_id': styles()[0]['id'], 'scene': 'arena', 'status': 'generated',
                   'input': inp, 'input_hash': digest(inp), 'source': str(path), 'sha256': sha(path)}
            with patch('generate.ART', Path(tmp)), patch('generate.Budget') as budget, patch('generate.subprocess.Popen') as popen:
                budget.return_value.load.return_value = {'jobs': [job]}
                self.assertEqual(generate(job['style_id'], 'arena')['id'], 'old')
                budget.return_value.reserve.assert_not_called()
                popen.assert_not_called()
                path.write_bytes(b'changed')
                with self.assertRaisesRegex(RuntimeError, 'ARTIFACT_INVALID'):
                    generate(job['style_id'], 'arena')
                budget.return_value.reserve.assert_not_called()

    def test_failed_result_is_not_retried(self):
        inp = input_record(styles()[0], 'arena')
        job = {'id': 'old', 'style_id': styles()[0]['id'], 'scene': 'arena', 'status': 'quota-stopped',
               'input': inp, 'input_hash': digest(inp)}
        with tempfile.TemporaryDirectory() as tmp, patch('generate.ART', Path(tmp)), patch('generate.Budget') as budget, patch('generate.subprocess.Popen') as popen:
            budget.return_value.load.return_value = {'jobs': [job]}
            self.assertEqual(generate(job['style_id'], 'arena')['status'], 'quota-stopped')
            with self.assertRaisesRegex(RuntimeError, 'NO_TRANSPORT_RETRY'):
                generate(job['style_id'], 'arena', 'try again')
            budget.return_value.reserve.assert_not_called()
            popen.assert_not_called()

    def test_portable_source_fallback_preserves_hash(self):
        with tempfile.TemporaryDirectory() as tmp, patch('common.ROOT', Path(tmp)), patch('common.ART', Path(tmp) / 'art'):
            path = Path(tmp) / 'art/review/sources/fixture.jpg'
            path.parent.mkdir(parents=True)
            path.write_bytes(b'exact source')
            job = {'id': 'fixture', 'source': 'art/raw/fixture/source.jpg'}
            self.assertEqual(source_path(job), path)

    def test_proof_is_invalidated_by_source_or_inputs(self):
        style = styles()[0]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'source.png'
            path.write_bytes(b'fixture-source')
            record = {'job': 'fixture', 'source': str(path), 'sha256': sha(path), 'style_hash': digest(style),
                      'pair_input_hash': digest([input_record(style, s) for s in ('arena', 'camp')]), 'verdict': 'exploration-sibling-ready'}
            write(Path(tmp) / 'proofs' / (style['id'] + '.json'), record)
            with patch('generate.ART', Path(tmp)):
                self.assertTrue(proof_valid(style))
                changed = copy.deepcopy(style)
                changed['style_block'] += ' planted drift'
                self.assertFalse(proof_valid(changed))
                path.write_bytes(b'changed pixels')
                self.assertFalse(proof_valid(style))


if __name__ == '__main__':
    unittest.main()
