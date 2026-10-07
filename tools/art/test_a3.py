"""Mutations for the A3 camera/derived-proof gate and transparent keying."""
import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from common import ART, read, write
from figures import extract
from waves import brief, require_proof, spec_for


class A3GuardTests(unittest.TestCase):
    def test_camera_change_cannot_reuse_proof(self):
        b=brief('A3');bad=copy.deepcopy(b);bad['camera_sha256']='changed-camera'
        with patch('waves.brief',return_value=bad):
            with self.assertRaisesRegex(RuntimeError,'STALE_A3_CAMERA_CONTRACT'):
                require_proof(spec_for('A3',bad['items'][0],bad))

    def test_source_proof_alone_does_not_authorize_siblings(self):
        b=brief('A3');p=read(ART/'proofs/A3.json');p.pop('composite_review')
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'proofs').mkdir();(root/'reports').mkdir()
            (root/'CAMERA-OK.md').write_bytes((ART/'CAMERA-OK.md').read_bytes())
            (root/'scale-contract-v1.json').write_bytes((ART/'scale-contract-v1.json').read_bytes())
            write(root/'proofs/A3.json',p);write(root/'reports/A1b-check.json',{'status':'pass'})
            with patch('waves.ART',root),patch('waves.brief',return_value=b):
                with self.assertRaisesRegex(RuntimeError,'A3_COMPOSITE_PROOF_REQUIRED'):
                    require_proof(spec_for('A3',b['items'][1],b))

    def test_magenta_removed_but_chalk_umber_and_net_hole_preserved(self):
        im=Image.new('RGB',(20,20),(255,0,255))
        for y in range(4,16):
            for x in range(4,16):im.putpixel((x,y),(238,224,189) if x<10 else (56,38,31))
        im.putpixel((9,9),(255,0,255))
        out,box,_=extract(im)
        self.assertEqual(box,(4,4,16,16))
        self.assertEqual(out.getpixel((0,0))[3],0)
        self.assertEqual(out.getpixel((9,9))[3],0)
        self.assertEqual(out.getpixel((5,5)),(238,224,189,255))
        self.assertEqual(out.getpixel((12,5)),(56,38,31,255))


if __name__=='__main__':unittest.main()
