import unittest
import math
import numpy as np
from PIL import Image
from covenant_battle import effect, key_magenta


class BattleTests(unittest.TestCase):
    def test_key_removes_matte_and_preserves_opaque_cloth(self):
        im=Image.new('RGB',(12,12),'#ff00ff');im.putpixel((6,6),(215,220,200))
        keyed=key_magenta(im)
        self.assertEqual(keyed.getpixel((0,0)),(0,0,0,0))
        self.assertEqual(keyed.getpixel((6,6)),(215,220,200,255))

    def test_absorb_rear_is_open(self):
        im=effect('absorb','water');a=np.asarray(im.getchannel('A'))
        self.assertEqual(np.count_nonzero(a[:,:128]),0)
        ys,xs=np.nonzero(a)
        angles=np.degrees(np.arctan2((ys-128)/math.sin(math.radians(55)),xs-128))
        self.assertLessEqual(max(abs(angles)),76) # stroke thickness extends centreline, never to rear
        self.assertGreater(np.count_nonzero(a),500)

    def test_lilac_is_not_keyed_to_green(self):
        im=Image.new('RGB',(12,12),'#ff00ff');im.putpixel((6,6),(185,125,210))
        self.assertEqual(key_magenta(im).getpixel((6,6)),(185,125,210,255))

    def test_bolt_core_has_four_pixels(self):
        im=effect('bolt','water');rgb=np.asarray(im)
        self.assertGreaterEqual(np.count_nonzero(np.all(rgb[:,128,:3]==[255,255,239],axis=1)),4)


if __name__=='__main__':unittest.main()
