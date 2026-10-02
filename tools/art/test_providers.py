"""Meaningful spend guards; simulated only, never invoke paid providers."""
import tempfile
import unittest
from pathlib import Path
from common import write, week
from generate import Budget
from providers import ProviderBudget


class ProviderGuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.art=Path(self.tmp.name)
        write(self.art/'budget.json',{'wave_hard_cap':240,'weekly_image_cap':240,'target_images':240,'max_attempts_per_scene':3})
        write(self.art/'usage.json',{'schema':1,'stop':None,'jobs':[],'events':[]})
        write(self.art/'providers/budget.json',{'providers':{'agy':{'weekly_image_cap':150,'external_known_charges':{week():4}},'grok':{'weekly_image_cap':240}}})
        write(self.art/'providers/history.json',{'providers':{p:{'stop':None,'events':[]} for p in ['agy','grok']}})

    def tearDown(self): self.tmp.cleanup()

    def test_provider_quota_does_not_stop_other_or_refund(self):
        b=Budget(self.art);p=ProviderBudget(self.art)
        b.reserve({'id':'one','style_id':'covenant','scene':'one','provider':'agy'})
        b.update('one',{'status':'quota-stopped'})
        p.event('agy','stop','one','HTTP 429')
        self.assertFalse(p.available('agy')[0]);self.assertTrue(p.available('grok')[0])
        self.assertEqual(b.summary()['wave_reserved'],1)
        self.assertIsNone(b.load()['stop'])
        b.reserve({'id':'two','style_id':'covenant','scene':'two','provider':'grok'})
        self.assertEqual(b.summary()['wave_reserved'],2)

    def test_provider_cap_includes_known_external_probe_spend(self):
        p=ProviderBudget(self.art)
        usage={'jobs':[{'provider':'agy','week':week(),'charged_images':146}]}
        self.assertFalse(p.available('agy',usage)[0]);self.assertTrue(p.available('grok',usage)[0])

    def test_project_cap_still_spans_providers(self):
        b=Budget(self.art);v=b.load()
        v['jobs']=[{'id':'history','week':week(),'charged_images':240,'status':'generated','provider':'grok'}];b.save(v)
        with self.assertRaisesRegex(RuntimeError,'HARD_BUDGET_CAP'):
            b.reserve({'id':'agy-one','style_id':'covenant','scene':'one','provider':'agy'})

    def test_stop_survives_new_instance(self):
        ProviderBudget(self.art).event('agy','stop','x','quota exhausted')
        self.assertFalse(ProviderBudget(self.art).available('agy')[0])

    def test_unresolved_project_reservation_blocks_every_provider(self):
        b=Budget(self.art);b.reserve({'id':'one','style_id':'covenant','scene':'one','provider':'agy'})
        with self.assertRaisesRegex(RuntimeError,'UNRESOLVED_RESERVATION'):
            b.reserve({'id':'two','style_id':'covenant','scene':'two','provider':'grok'})


if __name__=='__main__':unittest.main()
