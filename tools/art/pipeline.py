"""A1 art commands; run --help. Never selects an owner style."""
import argparse
import json
from common import ART, config, digest, input_record, read, styles, write
from generate import Budget, generate
from gates import check_job, review_proof


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    sub.add_parser('status')
    sub.add_parser('compile')
    sub.add_parser('build')
    sub.add_parser('validate')
    sub.add_parser('rank')
    provider = sub.add_parser('provider-generate', help='D20 guarded generation from an immutable Covenant brief')
    provider.add_argument('brief')
    g = sub.add_parser('generate')
    g.add_argument('--style', required=True, choices=[s['id'] for s in styles()])
    g.add_argument('--scene', required=True, choices=['arena', 'camp'])
    g.add_argument('--correction')
    r = sub.add_parser('review-proof')
    r.add_argument('--job', required=True)
    r.add_argument('--note', required=True)
    r = sub.add_parser('reject')
    r.add_argument('--job', required=True)
    r.add_argument('--note', required=True)
    r.add_argument('--correction', required=True)
    g = sub.add_parser('grade')
    g.add_argument('--job')
    a = p.parse_args()
    if a.command == 'status':
        print(json.dumps(Budget().summary(), indent=2))
    elif a.command == 'provider-generate':
        from providers import generate as provider_generate
        if provider_generate(read(a.brief))['status'] != 'generated':
            raise SystemExit(2)
    elif a.command == 'generate':
        result = generate(a.style, a.scene, a.correction)
        if result['status'] != 'generated':
            raise SystemExit(2)
    elif a.command in ('review-proof', 'reject'):
        job = next(j for j in Budget().load()['jobs'] if j['id'] == a.job)
        if a.command == 'review-proof':
            print(json.dumps(review_proof(job, a.note), indent=2))
        else:
            if job['status'] != 'generated':
                raise ValueError('Reject requires a generated source, never a transport retry')
            write(ART / 'rejections' / (job['id'] + '.json'), {'job': job['id'], 'sha256': job['sha256'],
                  'note': a.note, 'correction': a.correction, 'label': 'authored direct observation', 'owner_accepted': False})
    elif a.command == 'compile':
        rows = []
        for style in styles():
            for scene in ('arena', 'camp'):
                record = input_record(style, scene)
                row = {'id': style['id'] + '-' + scene, 'hash': digest(record), **record}
                rows.append(row)
        write(ART / 'compiled' / (config()['brief_version'] + '.json'), rows)
        print(f'Compiled {len(rows)} immutable comparison briefs; zero calls')
    elif a.command == 'grade':
        from grade import grade_jobs
        grade_jobs(a.job)
    elif a.command == 'rank':
        from rank import rank_board
        rank_board()
    elif a.command == 'build':
        from board import build
        build()
    elif a.command == 'validate':
        from board import validate
        validate()


if __name__ == '__main__':
    main()
