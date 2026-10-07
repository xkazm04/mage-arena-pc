import unittest
from PIL import Image, ImageDraw
from restoration_common import isolated_sheet

class IrregularSheet(unittest.TestCase):
    def test_authored_centres_preserve_disjoint_pixels_with_overlapping_boxes(self):
        im=Image.new('RGBA',(100,100));d=ImageDraw.Draw(im)
        d.polygon([(10,10),(50,10),(10,50)],fill=(80,90,100,255))
        d.polygon([(55,20),(55,60),(15,60)],fill=(150,160,170,255))
        pieces=isolated_sheet(im,columns=2,row_count=1,keyer=lambda x:(x,[255,0,255]),slot_centers=[[23,23],[42,47]])
        self.assertEqual(len(pieces),2)
        self.assertEqual(sum(sum(p[3].getchannel('A').getdata()) for p in pieces),sum(im.getchannel('A').getdata()))
        self.assertEqual(set(pieces[0][3].getdata())-{(0,0,0,0)},{(80,90,100,255)})
        self.assertEqual(set(pieces[1][3].getdata())-{(0,0,0,0)},{(150,160,170,255)})

if __name__=='__main__':unittest.main()
