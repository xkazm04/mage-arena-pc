"""A native-asset proof must not become a bypass around local review or ownership."""
import copy
import unittest
from unittest.mock import patch
import icons
from common import ART, read, sha


class NativeProofTests(unittest.TestCase):
    def test_reject_ungraded_stale_and_owner_accepted_grade_block_batch(self):
        original=read(ART/'grades/ui-a5-proof.json')
        for edit in [{'verdict':'reject'}, {'status':'ungraded'},
                     {'image_sha256':'stale'}, {'owner_accepted':True}]:
            modified={**original,**edit}
            def edited(path):
                return modified if path==ART/'grades/ui-a5-proof.json' else read(path)
            with self.subTest(edit=edit),patch('icons.read',side_effect=edited):
                with self.assertRaisesRegex(ValueError,'NATIVE_PROOF_GATE'):icons.require_proof()

    def test_changed_brief_does_not_reuse_previous_native_proof(self):
        changed={**icons.proof_inputs(),'brief_sha256':'modified'}
        with patch('icons.proof_inputs',return_value=changed):
            with self.assertRaisesRegex(ValueError,'STALE_NATIVE_PROOF'):icons.require_proof()


if __name__=='__main__':unittest.main()
