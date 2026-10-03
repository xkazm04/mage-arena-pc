"""One-shot A10 session record, after technical verification."""
from common import ART,ROOT,read,write
from restoration_common import append_wave
r=read(ART/'reports/a10-delivery-check.json')
assert not r['errors']
body=(f"A10 PARTIAL candidate: {r['deliveredClips']}/288 state-direction clips in 11 atlases; "
      f"{len(r['missingClips'])} missing clips explicitly enumerated. Two generated diagonal views "
      "where available, two declared mirrored left views, six states, shared pivots and scale, "
      "canvas loader and native A9/A8 context proofs. Repeated leading-leg poses and identity "
      "differences remain; technical gates do not certify production animation. Cinder hound "
      "and Iskar front-gait repair rejected. 43 serial attempts, 44 charges: 41 generated jobs, "
      "one agy duplicate-output anomaly charged twice, one Grok HTTP 429. Both provider latches "
      "retained; cumulative 285/300. Owner review, missing animation and game integration remain open.")
append_wave('A10','PARTIAL candidate; 198/288 clips; both providers stopped',body)
with (ROOT/'docs/waves/A10-character-direction.md').open('a',encoding='utf-8') as f:
    f.write('\n## Delivered result\n\n'+body+'\n\nSource/reference/page integrity, native density, margins, atlas bounds and timing pass. '
      'Owner board passes at 1080p, 1440p and 390px; actual canvas motion, pause, four velocity quadrants and '
      'missing-clip behavior pass at 1080p/1440p. Portable A8/A9/A10 rebuilds reproduce hashes with raw access '
      'forbidden. Offline suite: 69 tests pass. These are standalone art tests, not gameplay/FPS/feel evidence.\n')
p=ART/'ACCEPTANCE.md';p.write_text('# Session 6 / A10 partial candidate\n\n'+body+'\n\n'+p.read_text(encoding='utf-8'),encoding='utf-8')
with (ROOT/'docs/PROVIDER-LEDGER.md').open('a',encoding='utf-8') as f:
    f.write('\n### Session 6 / A10 / 2026-10-03\n\n'+body+'\n\n'
      'agy first: multi-direction grids drifted; its front-right Cassia keys were usable. Brennic emitted '
      'two byte-identical files (finding and hash archived in art/waves/A10/agy-duplicate-finding.json). '
      'The conservative two charges and anomaly latch are retained. Grok consumes only the first reference, '
      'and output aspect follows that image; square single-body inputs reduced copied collage layouts. '
      'Direction flips, missing weapons, repeated leading legs and pink-cloth matte collision still occurred. '
      'The generic humanoid wording contaminated the hound prompt; animal-only correction was prepared but '
      'received HTTP 429 “temporarily at capacity”. Per policy it remains latched, even with 15 local '
      'reservations left. No more image calls. The shieldman reference-path collision was recovered from '
      'exact archived request bytes without changing original hashes; see reference-relocations.json.\n')
write(ART/'reports/a10-session-result.json',{'status':'partial','deliveredClips':r['deliveredClips'],
 'requiredClips':288,'missingClips':r['missingClips'],'chargedThisWave':44,'cumulativeCharged':285,
 'providerLatches':['agy','grok'],'offlineTests':69,'owner_accepted':False})
