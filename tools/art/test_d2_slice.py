"""D2S offline pieces: normal-map alignment and decoding. No provider calls."""
import tempfile
import unittest
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from d2_slice import alignment, decode_normal, derive_normal


def figure(offset=(0, 0), background=(255, 0, 255)):
    im = Image.new('RGB', (256, 256), background); d = ImageDraw.Draw(im)
    x, y = offset
    d.ellipse((90 + x, 40 + y, 150 + x, 100 + y), fill=(200, 180, 150))
    d.rectangle((80 + x, 100 + y, 170 + x, 220 + y), fill=(120, 140, 200))
    return im


class D2SliceTests(unittest.TestCase):
    def test_alignment_finds_the_shift_whatever_the_background(self):
        with tempfile.TemporaryDirectory() as tmp:
            body, normal = Path(tmp) / 'b.png', Path(tmp) / 'n.png'
            figure().save(body)
            figure((6, -4), background=(128, 128, 255)).save(normal)
            self.assertEqual(alignment(body, normal)['shiftPx'], [-6, 4])
            figure().save(normal)
            result = alignment(body, normal)
            self.assertEqual(result['shiftPx'], [0, 0])
            self.assertGreater(result['edgeAgreement'], 0.9)

    def test_decoded_normals_are_unit_and_flat_outside_the_body(self):
        rgb = np.full((4, 4, 3), (150.0, 140.0, 220.0)); alpha = np.zeros((4, 4)); alpha[1:3, 1:3] = 255
        n = decode_normal(rgb, alpha)
        np.testing.assert_allclose(np.linalg.norm(n, axis=-1), 1, atol=1e-9)
        np.testing.assert_array_equal(n[0, 0], (0, 0, 1))

    def test_derived_normal_is_flat_on_a_flat_page(self):
        rgba = np.zeros((16, 16, 4)); rgba[..., :3] = 120; rgba[..., 3] = 255
        np.testing.assert_allclose(derive_normal(rgba)[8, 8], (0, 0, 1), atol=1e-9)


if __name__ == '__main__':
    unittest.main()
