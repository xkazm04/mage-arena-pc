"""Raster math and failure gates; entirely offline, no provider calls."""
import unittest
import tempfile
from pathlib import Path
import numpy as np
from PIL import Image
from restoration_common import luminous_alpha,alpha_metrics,grid,pack_frames
from restoration_effects import exact_telegraph


class RestorationTests(unittest.TestCase):
    def test_emission_extraction_reconstructs_source(self):
        rgb=np.array([[[0,0,0],[40,80,180],[255,180,80],[4,7,10]]],dtype='uint8')
        got=np.asarray(luminous_alpha(Image.fromarray(rgb))).astype(float)
        rebuilt=got[:,:,:3]*got[:,:,3:4]/255
        self.assertLessEqual(float(abs(rebuilt-rgb).max()),1)
        self.assertEqual(got[0,0,3],0)

    def test_grid_covers_odd_dimensions_without_overlap(self):
        im=Image.new('RGB',(1201,897));cells=list(grid(im,6,5))
        self.assertEqual(sum((r[2]-r[0])*(r[3]-r[1]) for _,_,r,_ in cells),1201*897)
        self.assertEqual(cells[-1][2][2:],[1201,897])

    def test_charcoal_panel_is_removed_without_erasing_highlight(self):
        im=Image.fromarray(np.array([[[25,25,25],[26,26,26],[255,180,80]]],dtype='uint8'))
        got=np.asarray(luminous_alpha(im,6,[25,25,25]))
        self.assertEqual(list(got[0,:2,3]),[0,0])
        self.assertEqual(int(got[0,2,3]),255)

    def test_empty_and_clipped_silhouette_detectable(self):
        im=Image.new('RGBA',(32,32));self.assertTrue(alpha_metrics(im)['empty'])
        im.putpixel((0,16),(255,255,255,255))
        self.assertEqual(alpha_metrics(im)['margin_px'],0)

    def test_telegraph_is_open_inside_and_shape_distinct(self):
        ring=exact_telegraph('water',0);cone=exact_telegraph('water',0,'cone')
        self.assertEqual(ring.getpixel((128,128))[3],0)
        self.assertNotEqual(ring.tobytes(),cone.tobytes())
        self.assertGreater(alpha_metrics(ring)['margin_px'],5)

    def test_loop_geometry_does_not_change_at_end(self):
        first=np.asarray(exact_telegraph('fire',0))[:,:,3]>0
        last=np.asarray(exact_telegraph('fire',7))[:,:,3]>0
        np.testing.assert_array_equal(first,last)


if __name__=='__main__':unittest.main()
