"""A root process exit must not lose its background image or double-charge it."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
import providers

class BackgroundResult(unittest.TestCase):
    def test_image_arriving_after_root_exit_is_archived_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'raw/job';folder.mkdir(parents=True)
            (root/'review/sources').mkdir(parents=True)
            class Exited:
                returncode=0
                def poll(self):return 0
            class Evidence:
                owned={'scoped-worker'}
                def __init__(self,request):self.polls=0
                def collect(self):
                    self.polls+=1
                    if self.polls==2:Image.new('RGB',(64,64),'blue').save(folder/'output.png')
                    return [{'name':'generate_image'}],[],[{'name':'generate_image'}]
                def completed_images(self):return []
            with patch.object(providers,'ART',root),patch.object(providers,'ROOT',root),patch.object(providers,'relative',lambda p:str(p.relative_to(root))),patch.object(providers,'AgyEvidence',Evidence),patch.object(providers.subprocess,'Popen',return_value=Exited()),patch.object(providers,'kill_tree'),patch.object(providers.time,'sleep'):
                result=providers.invoke('agy',{'prompt':'one image'},folder,{'id':'job','session_id':'test'})
            self.assertEqual(result['status'],'generated')
            self.assertEqual(result['charged_images'],1)
            self.assertEqual(result['unique_output_images'],1)
            self.assertTrue((root/result['archive']).is_file())

if __name__=='__main__':unittest.main()
