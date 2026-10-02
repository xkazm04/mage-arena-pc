"""Offline integrity for current local UI diagnostics; no model or paid calls."""
import json
from common import ART, ROOT, read, sha, write


def main():
    errors=[];count=0
    for path in sorted((ART/'grades').glob('ui-*.json')):
        count+=1;grade=read(path);source=ROOT/grade['source']
        if not source.exists() or sha(source)!=grade['image_sha256']:errors.append('STALE_CAPTURE:'+path.name)
        if grade['status']!='graded' or grade['verdict']!='owner-review':errors.append('UNRESOLVED_UI:'+path.name)
        if grade['owner_accepted'] is not False:errors.append('OWNER_BOUNDARY:'+path.name)
    camp=ART/'waves/A4/ui-review.json'
    if camp.exists():
        direct=read(camp)
        for name,expected in direct['sources'].items():
            if sha(ART/'delivery/a4/screens'/name)!=expected:errors.append('STALE_CAMP_DIRECT:'+name)
        if direct['owner_accepted'] is not False:errors.append('CAMP_OWNER_BOUNDARY')
    icons=ART/'waves/A5/direct-review.json'
    if icons.exists():
        from icons import review_check
        review_check()
    a3=ART/'waves/A3/direct-review.json'
    if a3.exists():
        direct=read(a3)
        for name,expected in direct['sources'].items():
            if not (ROOT/name).exists() or sha(ROOT/name)!=expected:errors.append('STALE_A3_DIRECT:'+name)
        if direct['owner_accepted'] is not False or direct['a3_complete'] is not False:errors.append('A3_OWNER_OR_COMPLETION_BOUNDARY')
    report={'status':'fail' if errors else 'pass','errors':errors,'current_ui_grades':count,
            'owner_accepted':False,'model_calls':0,'image_generation_calls':0}
    write(ART/'reports/ui-integrity.json',report);print(json.dumps(report,indent=2))
    if errors:raise SystemExit(1)


if __name__=='__main__':main()
