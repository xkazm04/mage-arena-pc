"""Raster math and failure gates; entirely offline, no provider calls."""
import unittest
import tempfile
from pathlib import Path
import numpy as np
from PIL import Image
from restoration_common import luminous_alpha,alpha_metrics,grid,pack_frames,adaptive_magenta,isolated_sheet
from restoration_arena import periodic,seam_metrics
from restoration_effects import exact_telegraph


class RestorationTests(unittest.TestCase):
    def test_magenta_key_preserves_neutral_and_rejects_wrong_matte(self):
        im=Image.fromarray(np.array([[[255,0,255],[80,80,80],[255,255,255]]],dtype='uint8'))
        got,_=adaptive_magenta(im,[255,0,255])
        self.assertEqual(got.getpixel((0,0))[3],0)
        self.assertEqual(got.getpixel((1,0)),(80,80,80,255))
        with self.assertRaises(ValueError):adaptive_magenta(im,[10,10,10])

    def test_periodic_edges_preserve_native_interior(self):
        rng=np.random.default_rng(5);a=rng.integers(0,256,(256,256,3),dtype='uint8')
        result=periodic(Image.fromarray(a),32)
        self.assertEqual(sum(seam_metrics(result).values()),0)
        np.testing.assert_array_equal(np.asarray(result)[32:-32,32:-32],a[32:-32,32:-32])

    def test_isolation_never_hides_global_clipping(self):
        from PIL import ImageDraw
        im=Image.new('RGB',(300,200),(255,0,255));d=ImageDraw.Draw(im)
        for y in range(2):
            for x in range(3):d.rectangle((x*100+30,y*100+20,x*100+70,y*100+80),fill=(80,80,80))
        self.assertEqual(len(isolated_sheet(im)),6)
        d.rectangle((30,0,70,30),fill=(80,80,80))
        with self.assertRaisesRegex(ValueError,'GLOBAL_SOURCE_CLIP'):isolated_sheet(im)

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
