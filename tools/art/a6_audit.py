"""Offline disposable-copy audit, including the preserved historical failures."""
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from common import ART, ROOT, read, sha, write


def main():
    records=[]
    before={p.name:sha(p) for p in (ART/'review/a6').glob('*') if p.suffix in ('.html','.jpg','.json')}
    with tempfile.TemporaryDirectory(prefix='mage-a6-portable-') as directory:
        target=Path(directory)
        for name in ('art','tools/art','docs'):
            shutil.copytree(ROOT/name,target/name,ignore=shutil.ignore_patterns('raw','browser','__pycache__','*.pyc','*.tmp','*.lock'))
        assert not (target/'art/raw').exists()
        commands=[['tools/art/a6_spec.py'],['tools/art/a6.py','check'],
                  ['tools/art/check.py'],['tools/art/verify_ui.py']]
        for command in commands:
            start=time.monotonic()
            result=subprocess.run([sys.executable,*command],cwd=target,capture_output=True,text=True,encoding='utf-8',errors='replace')
            records.append(dict(command=['python',*command],exit_code=result.returncode,
                                elapsed_seconds=round(time.monotonic()-start,3),stdout=result.stdout,stderr=result.stderr))
            print(('PASS' if result.returncode==0 else 'FAIL')+' '+' '.join(command),flush=True)
        after={p.name:sha(p) for p in (target/'art/review/a6').glob('*') if p.suffix in ('.html','.jpg','.json')}
        current=read(target/'art/reports/A6-check.json')
        legacy=read(target/'art/reports/checks.json')
        ui=read(target/'art/reports/ui-integrity.json')
        # Structural gates intentionally stay visible; no rewriting their verdicts.
        report=dict(status='pass' if current['status']=='pass' and before==after else 'fail',
                    scope='A6 portable evidence with ignored raw absent; global historical failures reported separately',
                    a6=current,review_hashes_identical=before==after,review_files=len(after),
                    commands=records,historical_global=legacy,historical_ui=ui,
                    all_project_gates_green=legacy['status']=='pass' and ui['status']=='pass',
                    image_generation_calls=0,model_calls=0)
        write(ART/'reports/A6-portable-check.json',report)
    print(json.dumps({k:v for k,v in report.items() if k not in ('commands','historical_global','a6')},indent=2))
    if report['status']!='pass': raise SystemExit(1)


if __name__=='__main__': main()
