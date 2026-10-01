"""Rebuild a disposable checkout-shaped copy without ignored raw evidence."""
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from common import ART, ROOT, now, read, sha, write


def main():
    results = []
    originals = {p.name: sha(p) for p in (ART / 'review/screens').glob('*.png')}
    with tempfile.TemporaryDirectory(prefix='mage-a1-portable-') as directory:
        target = Path(directory)
        for relative in ('art', 'tools/art', 'docs/design/baseline-fourteen-nights'):
            shutil.copytree(ROOT / relative, target / relative,
                            ignore=shutil.ignore_patterns('raw', 'browser', '__pycache__', '*.pyc', '*.tmp', '*.lock'))
        assert not (target / 'art/raw').exists()
        for command in ([sys.executable, 'tools/art/pipeline.py', 'build'],
                        [sys.executable, 'tools/art/pipeline.py', 'validate']):
            start = time.monotonic()
            result = subprocess.run(command, cwd=target, capture_output=True, text=True, encoding='utf-8', errors='replace')
            results.append({'command': command[1:], 'exit_code': result.returncode,
                            'elapsed_seconds': round(time.monotonic() - start, 3),
                            'stdout': result.stdout, 'stderr': result.stderr})
            if result.returncode:
                break
        rebuilt = {p.name: sha(p) for p in (target / 'art/review/screens').glob('*.png')}
        validation = read(target / 'art/reports/validation.json')
    passed = len(results) == 2 and all(r['exit_code'] == 0 for r in results) and originals == rebuilt
    report = {'at': now(), 'label': 'measured disposable copy; ignored raw evidence absent',
              'status': 'pass' if passed else 'fail', 'commands': results,
              'screen_hashes_identical': originals == rebuilt, 'screens': len(rebuilt),
              'validation': validation, 'image_generation_calls': 0}
    write(ART / 'reports/portable-check.json', report)
    print(json.dumps({k: v for k, v in report.items() if k != 'commands'}, indent=2))
    if not passed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
