"""Byte-identical A14 rebuild without raw files, providers or network."""
import shutil,subprocess,sys,tempfile
from pathlib import Path
from common import ART,ROOT,read,sha,write

def run():
    inputs=set()
    for folder in ('tools/art','art/waves/A14/observations','art/grades'):
        inputs.update(p.relative_to(ROOT) for p in (ROOT/folder).glob('*.py' if folder=='tools/art' else '*.json'))
    inputs.update(Path(p) for p in ('art/usage.json','art/covenant-battle-roster.json'))
    inputs.update(Path(j['archive']) for j in read(ART/'usage.json')['jobs'] if j.get('wave')=='A14' and j['status']=='generated')
    inputs.update(Path(r['path']) for j in read(ART/'usage.json')['jobs'] if j.get('wave')=='A14' and j['status']=='generated' for r in j['input']['references'])
    manifest=read(ART/'delivery/a14/characters.json')
    products=[Path(p['file']) for p in manifest['pages']]+[Path(c['standalone']['file']) for b in manifest['entities'].values() for c in b['clips'].get('corpse',{}).values()]+[Path('art/delivery/a14')/p for p in ('characters.json','source-gates.json')]
    before={p.as_posix():sha(ROOT/p) for p in products}
    with tempfile.TemporaryDirectory(prefix='mage-a14-portable-') as tmp:
        dest=Path(tmp).resolve()
        for path in inputs:
            target=dest/path;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/path,target)
        bootstrap="""import builtins,io,runpy,socket,sys
from pathlib import Path
root=Path.cwd().resolve()
def guard(fn):
 def checked(p,*a,**k):
  if isinstance(p,(str,bytes,Path)):
   q=Path(p).resolve()
   if q.is_relative_to(root/'art/raw') or q.is_relative_to(root/'art/providers'):raise RuntimeError('FORBIDDEN_RAW_PROVIDER')
  return fn(p,*a,**k)
 return checked
builtins.open=guard(builtins.open);io.open=guard(io.open)
def denied(*a,**k):raise RuntimeError('NETWORK_FORBIDDEN')
class BlockedSocket(socket.socket):
 __init__=denied
socket.socket=BlockedSocket;socket.create_connection=denied
sys.path.insert(0,str(root/'tools/art'))
runpy.run_path('tools/art/a14_build.py',run_name='__main__')
"""
        result=subprocess.run([sys.executable,'-c',bootstrap],cwd=dest,capture_output=True,text=True,encoding='utf-8',errors='replace')
        if result.returncode:raise RuntimeError(result.stderr)
        after={p.as_posix():sha(dest/p) for p in products};assert before==after,'PORTABLE_BYTES_DIFFER'
    write(ART/'delivery/a14/portable-check.json',{'status':'pass','identicalProducts':len(products),'productHashes':before,'copiedInputs':len(inputs),'rawAbsentAndForbidden':True,'providerDirectoryAbsentAndForbidden':True,'networkBlocked':True,'generationCalls':0,'commandOutput':result.stdout})
    print('A14 portable rebuild:',len(products),'byte-identical products')

if __name__=='__main__':run()
