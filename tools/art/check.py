"""Reproducible offline art gate; does not generate images or call a model."""
import argparse
import json
import subprocess
import sys
import time
from common import ART, ROOT, now, write


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-browser', action='store_true', help='only for hosts without an installed browser')
    args = parser.parse_args()
    commands = [
        [sys.executable, '-m', 'unittest', 'discover', '-s', 'tools/art', '-p', 'test_*.py'],
        [sys.executable, '-m', 'compileall', '-q', 'tools/art'],
        [sys.executable, 'tools/art/pipeline.py', 'compile'],
        [sys.executable, 'tools/art/pipeline.py', 'build'],
        [sys.executable, 'tools/art/pipeline.py', 'validate'],
        [sys.executable, 'tools/art/verify_ui.py']
    ]
    if not args.skip_browser:
        commands.append([sys.executable, 'tools/art/browser_check.py'])
    if (ART / 'delivery/a3/figures.json').exists():
        commands.insert(5, [sys.executable, 'tools/art/check_a3.py'] + (['--skip-browser'] if args.skip_browser else []))
    results = []
    for command in commands:
        start = time.monotonic()
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
        record = {'command': command, 'exit_code': result.returncode, 'elapsed_seconds': round(time.monotonic() - start, 3),
                  'stdout': result.stdout, 'stderr': result.stderr}
        results.append(record)
        print('PASS' if result.returncode == 0 else 'FAIL', ' '.join(command[1:]), flush=True)
        if result.returncode:
            break
    write(ART / 'reports/checks.json', {'at': now(), 'label': 'measured local art gate; quota incidents inside unit tests are simulated',
          'status': 'pass' if len(results) == len(commands) and all(r['exit_code'] == 0 for r in results) else 'fail',
          'browser': 'not measured' if args.skip_browser else 'included',
          'game_build': 'not applicable: no package manifest or code packages on the art baseline; none modified',
          'commands': results})
    if any(r['exit_code'] != 0 for r in results):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
