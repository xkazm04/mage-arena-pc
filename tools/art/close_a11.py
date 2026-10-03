"""One-shot A11 record. No new provider jobs were submitted."""
from common import ART,ROOT,read,write
from restoration_common import append_wave
body=('A11 PARTIAL / generation blocked: Tideglass daily clock with four light states and independent '
      'water, meniscus, rim, glass, marks, mist and rotating bead; gold/reputation/fatigue design symbols '
      'at header and large sizes. Eighteen new UI regions on one separate page preserve all 90 A5b '
      'regions and both original pages. Zero new generated images: A5b rim/A8 mist reused, other '
      'geometry and shading authored. Local review flags the regular icon bevels and geometric sky '
      'below the painted Covenant bar. Prepared briefs remain unsubmitted. Both provider latches '
      'retained at 285/300; 15 local reservations do not establish provider availability. Owner '
      'board and session-6 combined contact sheet delivered; new painting, owner acceptance and '
      'game integration remain open.')
append_wave('A11','PARTIAL design / generation blocked; 18 added regions; owner review pending',body)
with (ROOT/'docs/waves/A11-stats-daily-clock.md').open('a',encoding='utf-8') as f:
    f.write('\n## Result and evidence\n\n'+body+'\n\n'
      'Hash, alpha, bounds, gutters, native density and original-region/page preservation pass. '
      'The local grader only routed to owner review; it did not accept anything. Actual canvas '
      'checks cover full/empty water, four distinct phase renders, independent rim visibility, '
      'pause and invalid state handling at 1080p/1440p. Owner board loads at 1080p, 1440p and '
      '390px. The pre-existing UI consumer still loads all 11 screens, fonts and keyboard focus '
      'at both native resolutions with 108 regions. Portable rebuild reproduces 34 file hashes '
      'with raw access forbidden. No gameplay/performance or sofa-distance claim.\n')
p=ART/'ACCEPTANCE.md';p.write_text('# Session 6 / A11 partial design\n\n'+body+'\n\n'+p.read_text(encoding='utf-8'),encoding='utf-8')
with (ROOT/'docs/PROVIDER-LEDGER.md').open('a',encoding='utf-8') as f:
    f.write('\n### Session 6 / A11 / 2026-10-03\n\nNo provider call. agy remains stopped on duplicate '
      'output anomaly and Grok remains stopped on HTTP 429. The stat proof, painted clock states '
      'and independent-layer briefs are staged under art/briefs/a11 but not submitted. No third '
      'provider or untracked generation bypass was used. A11 assets explicitly distinguish old '
      'generated material from authored geometry; the requested new generated paintings are '
      'not complete. Cumulative 285 charged; session charges A8 7, A9 11, A10 44, A11 0.\n')
with (ART/'OWNER-CHOICE.md').open('a',encoding='utf-8') as f:
    f.write('\n## Owner verdict / session 6 / 2026-10-03\n\n'
      'Owner likes the camp and portraits and considers them production quality; preserve them. '
      'Arena structure, surface and objects lost fidelity versus the approved concepts. '
      'Character fidelity and one-axis movement are the most painful remaining problem; '
      'spells/effects are a key gap. Requested work is A8 effects, A9 arena restoration, '
      'A10 real directional animation, A11 stat icons and creative daily clock. '
      'This verdict does not approve the new session-6 candidates. The session audit confirms '
      'all 156 tracked camp/portrait delivery files are unchanged.\n')
write(ART/'reports/a11-session-result.json',{'status':'partial-generation-blocked','newProviderCalls':0,'newGeneratedImages':0,
 'newRegions':18,'preservedRegions':90,'cumulativeCharged':285,'providerLatches':['agy','grok'],
 'paintedFidelityComplete':False,'owner_accepted':False})
