"""Mutations for persistence/coverage contracts, beyond atlas byte checks."""
import copy,unittest
from common import ART,read
from check_a14 import check

class A14Contract(unittest.TestCase):
    def setUp(self):self.manifest=read(ART/'delivery/a14/characters.json')
    def test_corpse_cannot_loop(self):
        m=copy.deepcopy(self.manifest);m['entities']['cassia']['clips']['corpse']['se']['loop']=True
        with self.assertRaisesRegex(AssertionError,'UNEXPECTED_LOOP'):check(m,save=False)
    def test_corpse_cannot_jump_anchor(self):
        m=copy.deepcopy(self.manifest);m['entities']['cassia']['clips']['corpse']['se']['anchor']=[.5,.5]
        with self.assertRaisesRegex(AssertionError,'CORPSE_JUMP'):check(m,save=False)
    def test_deleting_direction_cannot_hide_missing_coverage(self):
        m=copy.deepcopy(self.manifest);del m['entities']['cassia']['clips']['hit-light']['se']
        with self.assertRaisesRegex(AssertionError,'HIDDEN_MISSING_CLIPS'):check(m,save=False)
    def test_quick_hit_must_fit_under_200ms(self):
        m=copy.deepcopy(self.manifest);m['entities']['cassia']['clips']['hit-light']['se']['frames'][0]['durationMs']=250
        with self.assertRaisesRegex(AssertionError,'LIGHT_TOO_LONG'):check(m,save=False)

if __name__=='__main__':unittest.main()
