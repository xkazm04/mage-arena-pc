"""Rebuild A13 masters from the selected archives in an isolated minimal tree."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from common import ART, ROOT, read, sha, write


def run():
    inputs=set()
    for folder in ('tools/art','art/waves/A13/reviews'):
        inputs.update(p.relative_to(ROOT) for p in (ROOT/folder).rglob('*')
                      if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
    inputs.update(Path(p) for p in ('art/usage.json','art/style-covenant.json','art/scale-contract-v2.json'))
    inputs.update(Path(s['source']) for s in read(ART/'delivery/a13/source-gates.json')['sources'])
    inputs.update(Path('art/delivery/a12/plates')/(p+'.png') for p in ('moonlit','verdigris','rust-sand'))
    products=[]
    for folder in ('atlases','glyphs','masks','floor-cleanup'):
        products.extend(p.relative_to(ROOT) for p in (ART/'delivery/a13'/folder).glob('*.png'))
    products.extend(Path('art/delivery/a13')/p for p in
                    ('sigils.json','glyphs.json','source-gates.json','glyph-sheet.png','atlas-contact.jpg',
                     'floor-placement.json','floor-cleanup-contact.jpg'))
    products.append(Path('art/scale-contract-v3.json'))
    before={p.as_posix():sha(ROOT/p) for p in products}
    commands=[]
    with tempfile.TemporaryDirectory(prefix='mage-a13-portable-') as directory:
        dest=Path(directory).resolve()
        for relative in inputs:
            target=dest/relative;target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(ROOT/relative,target)
        assert not (dest/'art/raw').exists() and not (dest/'art/providers').exists()
        # Block network and raw/provider paths inside each subprocess as well.
        bootstrap="""import builtins,io,runpy,socket,sys
from pathlib import Path
root=Path.cwd().resolve()
original=builtins.open
original_io=io.open
def guard(fn):
 def checked(path,*args,**kwargs):
  if isinstance(path,(str,bytes,Path)):
   resolved=Path(path).resolve()
   if resolved.is_relative_to(root/'art/raw') or resolved.is_relative_to(root/'art/providers'):
    raise RuntimeError('PORTABLE_FORBIDDEN_PATH:'+str(resolved))
  return fn(path,*args,**kwargs)
 return checked
builtins.open=guard(original);io.open=guard(original_io)
def denied(*args,**kwargs):raise RuntimeError('PORTABLE_NETWORK_FORBIDDEN')
class BlockedSocket(socket.socket):
 __init__=denied
socket.socket=BlockedSocket;socket.create_connection=denied
sys.path.insert(0,str(root/'tools/art'))
runpy.run_path(sys.argv[1],run_name='__main__')
"""
        for script in ('a13_build.py','a13_floor.py'):
            result=subprocess.run([sys.executable,'-c',bootstrap,'tools/art/'+script],cwd=dest,
                                  capture_output=True,text=True,encoding='utf-8',errors='replace')
            commands.append({'script':script,'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
            if result.returncode:raise RuntimeError(commands[-1])
        after={p.as_posix():sha(dest/p) for p in products}
        assert before==after,'PORTABLE_EXPORT_BYTES_DIFFER'
    write(ART/'delivery/a13/portable-check.json',{
        'status':'pass','scope':'engine masters and floor overlays rebuilt from selected archived paintings',
        'copiedInputs':len(inputs),'identicalProducts':len(products),'productHashes':before,
        'rawAbsentAndForbidden':True,'providerDirectoryAbsentAndForbidden':True,'networkBlocked':True,
        'generationCalls':0,'commands':commands,
        'dependencies':'existing Python, Pillow, NumPy, SciPy, OpenCV; Windows Segoe UI only for labelled sheets',
        'notIncluded':'browser captures, owner HTML and game integration; browser validation is a separate report'})
    print('A13 portable rebuild passes:',len(products),'byte-identical products')


if __name__=='__main__':run()
