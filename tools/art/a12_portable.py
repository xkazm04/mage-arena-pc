"""Rebuild in a disposable minimal checkout with no raw, weights or credentials."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from common import ART,ROOT,read,sha,write

def run():
    files=set()
    def tree(relative):
        files.update(p.relative_to(ROOT) for p in (ROOT/relative).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
    for folder in ('tools/art','art/waves/A12','art/delivery/a12','art/review/a12'):tree(folder)
    for relative in ('art/usage.json','art/scale-contract-v2.json'):files.add(Path(relative))
    for wave,manifest in [('a10','characters.json'),('a8','effects.json')]:
        path=ART/f'delivery/{wave}/{manifest}';files.add(path.relative_to(ROOT))
        files.update(Path(p['file']) for p in read(path)['pages'])
    for name,p in read(ART/'delivery/a12/arena-plates.json')['palettes'].items():
        files.add(Path(p['provenance']['concept']));files.add(Path(p['provenance']['generated']))
        files.add(Path(f'art/delivery/a9/proofs/{name}-1920.png'))
    # No generation/model tools are run. Board creation reads archived attempts.
    for j in read(ART/'usage.json')['jobs']:
        if j.get('wave')=='A12' and j.get('archive'):files.add(Path(j['archive']))
    products=[p for p in files if p.as_posix().startswith('art/delivery/a12/') and (p.suffix=='.png' or p.name in ('arena-plates.json','proofs.json'))]
    before={p.as_posix():sha(ROOT/p) for p in products}
    commands=[]
    with tempfile.TemporaryDirectory(prefix='mage-a12-portable-') as directory:
        dest=Path(directory).resolve()
        for relative in files:
            target=dest/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/relative,target)
        assert not (dest/'art/raw').exists() and not (dest/'.venv-art6').exists()
        for name in ('arena_plates.py','check_a12.py','a12_board.py'):
            result=subprocess.run([sys.executable,'tools/art/'+name],cwd=dest,capture_output=True,text=True,encoding='utf-8',errors='replace')
            commands.append({'script':name,'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
            if result.returncode:raise RuntimeError(commands[-1])
        after={p.as_posix():sha(dest/p) for p in products}
        assert before==after,'PORTABLE_EXPORT_BYTES_DIFFER'
        assert sha(dest/'art/review/a12/index.html')==sha(ART/'review/a12/index.html'),'PORTABLE_BOARD_DIFFERS'
    report={'status':'pass','scope':'disposable minimal checkout; no ignored art/raw, provider credentials, GPU model weights or paid calls',
        'copiedFiles':len(files),'identicalProducts':len(products),'rawAbsent':True,'modelWeightsAbsent':True,
        'generationCalls':0,'commands':commands,'fontDependency':'Windows Segoe UI for proof labels; image masters do not depend on font rendering'}
    write(ART/'delivery/a12/portable-check.json',report);print('A12 portable rebuild passes:',len(products),'identical products')

if __name__=='__main__':run()
