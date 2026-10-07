"""Regression tests for the expensive delivery's actual failure modes."""
import unittest
import numpy as np
from PIL import Image
from arena_plates import autocorrelation,crop_view
from check_a12 import semantic_gate
from common import ART,read

class PlateTests(unittest.TestCase):
    def test_repeated_floor_is_flagged(self):
        rng=np.random.default_rng(47)
        tile=rng.integers(0,256,(72,128),dtype=np.uint8)
        self.assertTrue(autocorrelation(Image.fromarray(np.tile(tile,(6,6))))['repetitionFlag'])

    def test_camera_cannot_expose_empty_pixels(self):
        geo=read(ART/'delivery/a12/geometry.json')
        with self.assertRaisesRegex(ValueError,'CAMERA_EXPOSES_UNPAINTED_EDGE'):
            crop_view(Image.new('RGB',(3072,1728)),1920,1080,geo,[-100,62])

    def test_local_pass_never_accepts_art_and_reject_blocks(self):
        review={'figuresObserved':False,'combatEffectsObserved':False,'readableTextObserved':False,'owner_accepted':False}
        self.assertEqual(semantic_gate(review,{'verdict':'owner-review'},{'flagged':[]}), 'owner-review')
        with self.assertRaisesRegex(ValueError,'LOCAL_VISION_REJECTED'):
            semantic_gate(review,{'verdict':'reject'},{'flagged':[]})
        with self.assertRaisesRegex(ValueError,'DIRECT_REVIEW_REJECTED'):
            semantic_gate({**review,'figuresObserved':True},{'verdict':'owner-review'},{'flagged':[]})

if __name__=='__main__':unittest.main()
