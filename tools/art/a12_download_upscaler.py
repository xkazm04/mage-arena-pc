"""Owner-authorized model, licence/source recorded before download."""
import urllib.request
from common import ART,ROOT,read,write,sha
record=read(ART/'waves/A12/upscaling-tools.json');model=record['plannedModel']
target=ROOT/model['localPath'];target.parent.mkdir(parents=True,exist_ok=True)
license_file=ART/'waves/A12/licenses/Real-ESRGAN-BSD-3-Clause.txt';license_file.parent.mkdir(parents=True,exist_ok=True)
if not license_file.exists():
    urllib.request.urlretrieve('https://raw.githubusercontent.com/xinntao/Real-ESRGAN/master/LICENSE',license_file)
if not target.exists():urllib.request.urlretrieve(model['source'],target)
model['sha256']=sha(target);model['bytes']=target.stat().st_size
model['licenseLocal']=license_file.relative_to(ROOT).as_posix();model['licenseSha256']=sha(license_file)
write(ART/'waves/A12/upscaling-tools.json',record)
print({'model':model['name'],'bytes':model['bytes'],'sha256':model['sha256']})
