import copy
import unittest
from PIL import Image
from common import read
from covenant_ui import UI, validate, nine_slice


class UIContractTests(unittest.TestCase):
    def test_missing_page_is_error(self):
        kit=read(UI/'kit.json');kit['pages'][0]['file']='missing-test-page.png'
        self.assertIn('MISSING_PAGE:frames',validate(kit))

    def test_unknown_schema_fails(self):
        kit=read(UI/'kit.json');kit['schemaVersion']=2
        self.assertEqual(validate(kit),['SCHEMA_VERSION'])

    def test_missing_required_region_fails(self):
        kit=read(UI/'kit.json');del kit['regions']['slot.locked']
        self.assertIn('MISSING_REGION:slot.locked',validate(kit))

    def test_out_of_bounds_fails(self):
        kit=read(UI/'kit.json');kit['regions']['cursor.pointer']['rect']=[2040,2040,64,64]
        self.assertIn('BOUNDS:cursor.pointer',validate(kit))

    def test_nine_slice_rejects_impossible_size(self):
        with self.assertRaisesRegex(ValueError,'NINE_SLICE_TOO_SMALL'):
            nine_slice(Image.new('RGBA',(100,100)),(30,30),[20]*4)


if __name__=='__main__':unittest.main()
