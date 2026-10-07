"""Serial sibling generation with a session guard; no automatic review or resets."""
import sys
from common import ART,read
from providers import generate

start=read(ART/'waves/A13/start-snapshot.json')
for name in sys.argv[1:]:
    usage=read(ART/'usage.json')
    if sum(j['charged_images'] for j in usage['jobs'])-start['charged']>=start['sessionImageCap']:
        raise SystemExit('A13_SESSION_CAP')
    spec=read(ART/'briefs/a13'/f'{name}.json')
    result=generate(spec)
    if result['status']!='generated':raise SystemExit('A13_FINDING_REQUIRES_REVIEW:'+result['status'])
