"""A6 spending regressions use mock transport, never an image subscription."""
import tempfile
import unittest
import contextlib
import io
from pathlib import Path
from unittest.mock import Mock, patch
from common import ART, read, write
from generate import Budget, generate, moderation_evidence, quota_evidence
from waves import brief, spec_for, require_proof
from grade import prompt_for

class IdentityTests(unittest.TestCase):
    def test_same_skeleton_six_distinct_pairs(self):
        b=brief('A6')
        self.assertGreaterEqual(len(b['directions']),6)
        self.assertEqual(len(b['items']),len(b['directions'])*2)
        for kind in ('arena','portrait'):
            skeletons=[]
            for item in b['items']:
                if item['kind']!=kind: continue
                s=spec_for('A6',item,b)
                skeletons.append(s['prompt'].replace(s['style']['style_block'],'{DIRECTION}'))
            self.assertEqual(len(set(skeletons)),1)
        self.assertEqual(len({d['line'] for d in b['directions']}),len(b['directions']))
        self.assertEqual(len({d['shading'] for d in b['directions']}),len(b['directions']))

    def test_old_choice_cannot_unlock_new_production(self):
        for wave in ('A2b','A3b','A4b'):
            with self.assertRaisesRegex(RuntimeError,'A6_OWNER_CHOICE_REQUIRED'):
                require_proof({'wave':wave})

    def test_grader_uses_new_direction(self):
        p=prompt_for({'wave':'A6','prompt':'a direction'})
        self.assertNotIn('style_match checks Tessera',p)
        self.assertIn('Never approve',p)

    def test_only_explicit_moderation_is_retryable(self):
        self.assertFalse(moderation_evidence(['HTTP 400 invalid request']))
        self.assertTrue(moderation_evidence(['HTTP 400 imagine:content-moderated']))
        self.assertFalse(quota_evidence(['HTTP 400 imagine:content-moderated']))

    def test_moderation_charged_once_rewritten_retry_and_quota_priority(self):
        b=brief('A6'); spec=spec_for('A6',b['items'][0],b)
        spec.pop('reference',None)  # test response policy independently of edit input validation
        spec.pop('backend',None)
        for error,expected in [('HTTP 400 imagine:content-moderated','moderation-refused'),
                               ('HTTP 429 imagine:content-moderated','quota-stopped'),
                               ('HTTP 400 invalid request','error-unknown-spend')]:
            with self.subTest(error=error), tempfile.TemporaryDirectory() as tmp:
                art=Path(tmp); write(art/'budget.json',read(ART/'budget.json')); budget=Budget(art)
                child=Mock(); child.poll.return_value=0; child.returncode=1
                calls=[dict(name='image_gen',arguments=dict(prompt=spec['prompt'],aspect_ratio='16:9'))]
                with patch('generate.ART',art), patch('generate.Budget',return_value=budget), patch('waves.require_proof'), patch('generate.shutil.which',return_value='mock'), patch('generate.subprocess.Popen',return_value=child) as popen, patch('generate.session_evidence',return_value=(calls,[error],[],[])) as evidence:
                    result=generate(spec['style']['id'],spec['scene'],spec=spec)
                    self.assertEqual(result['status'],expected)
                    self.assertEqual(budget.summary()['wave_reserved'],1)
                    self.assertEqual(bool(budget.summary()['stop']),expected!='moderation-refused')
                    if expected=='moderation-refused':
                        rewrite='An intact water magician demonstrates harmless coloured lights in a quiet arena.'
                        write(art/'rejections'/(result['id']+'.json'),dict(sha256=result['input_hash'],correction=rewrite))
                        evidence.return_value=([dict(name='image_gen',arguments=dict(prompt=rewrite,aspect_ratio='16:9'))],[error],[],[])
                        second=generate(spec['style']['id'],spec['scene'],rewrite,spec)
                        self.assertEqual(second['status'],'moderation-refused')
                        self.assertFalse(second['moderation_retry_available'])
                        with self.assertRaisesRegex(RuntimeError,'MODERATION_RETRY_EXHAUSTED'):
                            generate(spec['style']['id'],spec['scene'],rewrite,spec)
                        self.assertEqual(popen.call_count,2)
                    else:
                        with self.assertRaisesRegex(RuntimeError,'SPEND_STOP'):
                            generate('different',spec['scene'],spec=spec)
                        self.assertEqual(popen.call_count,1)

    def test_changed_camera_reference_blocks_before_reservation(self):
        b=read(ART/'briefs/a6-v8.json'); spec=spec_for('A6',b['items'][0],b)
        spec.pop('backend',None)
        spec['reference']={**spec['reference'],'sha256':'changed'}
        with patch('generate.Budget') as budget, patch('generate.subprocess.Popen') as popen:
            with self.assertRaisesRegex(RuntimeError,'REFERENCE_HASH_MISMATCH_BEFORE_SPEND'):
                generate(spec['style']['id'],spec['scene'],spec=spec)
            budget.assert_not_called(); popen.assert_not_called()

    def test_builtin_moderation_retry_is_once_and_quota_wins(self):
        import a6_builtin
        b=brief('A6'); item=b['items'][0]['id']
        for error,stopped in [('HTTP 400 imagine:content-moderated',False),('HTTP 429 content-moderated',True)]:
            with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
                art=Path(tmp); write(art/'budget.json',read(ART/'budget.json')); budget=Budget(art)
                with patch('a6_builtin.ART',art),patch('a6_builtin.Budget',return_value=budget),patch('a6_builtin.require_proof'):
                    a6_builtin.reserve(item)
                    job=budget.load()['jobs'][-1]
                    a6_builtin.ingest(job['id'],error=error)
                    self.assertEqual(bool(budget.load()['stop']),stopped)
                    self.assertEqual(budget.summary()['wave_reserved'],1)
                    if not stopped:
                        rewrite='An intact mage demonstrates harmless lights.'
                        write(art/'rejections'/(job['id']+'.json'),dict(sha256=job['input_hash'],correction=rewrite))
                        a6_builtin.reserve(item,rewrite)
                        job2=budget.load()['jobs'][-1]
                        a6_builtin.ingest(job2['id'],error=error)
                        self.assertFalse(budget.load()['jobs'][-1]['moderation_retry_available'])
                        with self.assertRaisesRegex(RuntimeError,'MODERATION_RETRY_EXHAUSTED'):
                            a6_builtin.reserve(item,rewrite)
                        self.assertEqual(budget.summary()['wave_reserved'],2)

    def test_new_backend_cannot_silently_use_old_transport(self):
        b=brief('A6'); spec=spec_for('A6',b['items'][0],b)
        with patch('generate.Budget') as budget:
            with self.assertRaisesRegex(RuntimeError,'BUILTIN_TOOL_REQUIRED'):
                generate(spec['style']['id'],spec['scene'],spec=spec)
            budget.assert_not_called()

if __name__=='__main__': unittest.main()
