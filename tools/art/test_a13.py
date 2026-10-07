import copy
import unittest
import numpy as np
from PIL import Image
from common import ART,read
from a13_build import rank_map,reveal,painted_fan
from check_a13 import coverage

class A13Contract(unittest.TestCase):
    def test_missing_school_or_status_is_not_complete(self):
        m=read(ART/'delivery/a13/sigils.json');coverage(m)
        for ident in ('cast.air.release','status.rooted','absorb.window','warning.unblockable'):
            bad=copy.deepcopy(m);del bad['clips'][ident]
            with self.assertRaisesRegex(ValueError,'MISSING_REQUIRED'):coverage(bad)
    def test_boundary_cannot_vanish_at_zero_charge(self):
        m=read(ART/'delivery/a13/sigils.json');m['clips']['threat.water.ring']['progress']['baseOpacity']=0
        with self.assertRaisesRegex(ValueError,'HIDDEN_EMPTY_BOUNDARY'):coverage(m)
    def test_warning_must_remain_separate(self):
        m=read(ART/'delivery/a13/sigils.json');m['clips']['threat.fire.cone']['warningOverlay']=None
        with self.assertRaisesRegex(ValueError,'WARNING_MISSING'):coverage(m)
    def test_reveal_is_monotonic_and_has_exact_endpoints(self):
        im=Image.new('RGBA',(384,384),(50,100,200,211));previous=np.zeros((384,384),dtype='uint8')
        for p in (0,.1,.25,.5,.75,.9,1):
            a=np.array(reveal(im,p).getchannel('A'));self.assertTrue(np.all(a>=previous));previous=a
        self.assertEqual(np.array(reveal(im,0).getchannel('A')).max(),0)
        self.assertEqual(np.array(reveal(im,1,True).getchannel('A')).max(),0)
        self.assertEqual(previous.min(),211)
    def test_rank_channels_have_expected_direction(self):
        linear=np.array(rank_map('linear'));fan=np.array(rank_map('fan'));angular=np.array(rank_map('angular'))
        self.assertLess(linear[192,50],linear[192,330]);self.assertEqual(fan[192,100],1);self.assertEqual(fan[192,300],255)
        self.assertLess(angular[20,192],angular[192,350]);self.assertLess(angular[192,350],angular[350,192])
    def test_window_is_not_the_success_flare(self):
        m=read(ART/'delivery/a13/sigils.json')['clips']
        self.assertTrue(m['absorb.window']['loop']);self.assertFalse(m['absorb.perfect']['loop'])
        self.assertEqual(m['absorb.window']['kind'],'perfect-window')

if __name__=='__main__':unittest.main()
