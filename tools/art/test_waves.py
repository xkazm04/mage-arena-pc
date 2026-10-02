"""Offline checks for camera data, archived briefs and later-wave spend gates."""
import copy
import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from common import ART, digest, read, sha, write
from waves import brief, gate, require_proof, spec_for


class CameraDataTests(unittest.TestCase):
    def test_owner_fraction_projection_and_world_extent(self):
        c = read(ART / 'scale-contract-v1.json')
        self.assertEqual(c['character']['screen_height_fraction_range'], [.04, .06])
        self.assertEqual(c['absorb']['angle_degrees'], 140)
        self.assertEqual(c['absorb']['rear_open_degrees'], 220)
        for d in c['distances']:
            self.assertAlmostEqual(d['screen_height_fraction'], .05 * d['zoom'])
            heights = [h * d['screen_height_fraction'] for _, h in [c['reference_viewport_px'], c['second_viewport_px']]]
            self.assertAlmostEqual(heights[1] / heights[0], 4 / 3)
            px = c['camera']['standard_ground_pixels_per_metre_at_1080p'] * d['zoom']
            py = px * math.sin(math.radians(c['camera']['elevation_above_ground_degrees']))
            self.assertGreaterEqual(c['arena_metres'][0] / (1920 / px), 2.4)
            self.assertGreater(c['telegraph']['minimum_ground_diameter_metres'] * py, heights[0])

    def test_comparison_matrix_and_contract_hash(self):
        b = brief('A1b')
        self.assertEqual(len(b['items']), 24)
        self.assertEqual(len({(i['layout'], i['density'], i['distance']) for i in b['items']}), 24)
        self.assertEqual({i['target_fraction'] for i in b['items']}, {.04, .05, .06})
        self.assertEqual(b['scale_contract_sha256'], sha(ART / 'waves/A1b/scale-contract-at-generation.json'))
        historical = read(ART / 'waves/A1b/scale-contract-at-generation.json')
        current = read(ART / 'scale-contract-v1.json')
        # Owner confirmation changed status prose, not any numeric scale authority.
        for key in ('camera', 'character', 'distances', 'telegraph', 'absorb', 'formulas'):
            self.assertEqual(historical[key], current[key])

    def test_history_is_immutable_and_prompt_drift_fails(self):
        ledger = read(ART / 'usage.json')
        job = next(j for j in ledger['jobs'] if j.get('wave') == 'A1b')
        self.assertEqual(gate(job)['verdict'], 'technical-pass')
        bad = copy.deepcopy(job)
        bad['input_hash'] = 'planted drift'
        self.assertIn('STALE_INPUT', gate(bad)['codes'])


class LaterWaveProofTests(unittest.TestCase):
    def test_a3_requires_owner_file_before_any_brief(self):
        with tempfile.TemporaryDirectory() as tmp, patch('waves.ART', Path(tmp)):
            with self.assertRaisesRegex(RuntimeError, 'OWNER_CAMERA_REQUIRED'):
                require_proof({'wave': 'A3'})

    def test_batch_without_pilot_is_blocked(self):
        b = brief('A1b')
        spec = spec_for('A1b', next(i for i in b['items'] if i['id'] != b['proof_item']))
        with tempfile.TemporaryDirectory() as tmp, patch('waves.ART', Path(tmp)), patch('waves.brief', return_value=b):
            with self.assertRaisesRegex(RuntimeError, 'ONE_IMAGE_PROOF_REQUIRED'):
                require_proof(spec)

    def test_stale_brief_does_not_authorize_batch(self):
        b = brief('A1b')
        spec = spec_for('A1b', b['items'][0])
        spec['brief_hash'] = 'old hash'
        with self.assertRaisesRegex(RuntimeError, 'STALE_WAVE_BRIEF'):
            require_proof(spec)

    def test_rejected_or_ungraded_pilot_invalidates_continuation(self):
        b = brief('A1b')
        spec = spec_for('A1b', next(i for i in b['items'] if i['id'] != b['proof_item']))
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'source.jpg'
            source.write_bytes(b'proof fixture')
            job = {'id': 'pilot', 'scene': b['proof_item'], 'status': 'generated', 'sha256': sha(source)}
            write(root / 'proofs/A1b.json', {'job': 'pilot', 'brief_hash': digest(b), 'sha256': job['sha256'], 'verdict': 'technical-continuation', 'owner_accepted': False})
            write(root / 'waves/A1b/reviews/pilot.json', {'verdict': 'reject', 'sha256': job['sha256']})
            write(root / 'grades/pilot.json', {'status': 'ungraded', 'image_sha256': job['sha256']})
            with patch('waves.ART', root), patch('waves.brief', return_value=b), patch('waves.jobs', return_value=[job]), patch('waves.source_path', return_value=source):
                with self.assertRaisesRegex(RuntimeError, 'PROOF_REJECTED_OR_UNGRADED'):
                    require_proof(spec)
