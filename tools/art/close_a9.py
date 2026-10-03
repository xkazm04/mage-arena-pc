"""One-shot A9 record, run after delivery verification."""
from common import ROOT,ART,read,write
from restoration_common import append_wave
body=('A9 delivery candidate: three native-density periodic grounds, 36 keyed structures/props, '
      '15 decals and explicit core-preserving layout. Six 1080p/1440p composites and three A6 '
      'side-by-side comparisons are on art/review/a9/index.html. Eleven serial Grok reservations; '
      'cumulative 241/300. Clipped rust banner replaced; generated letter-like decal cells and '
      'unrequested figure excluded. Rim mapping, rune stencils, matte extraction and damage '
      'feathering are labeled derived. Material detail improved; repeated stands, derived rim '
      'and less integrated atmospheric lighting mean concept equivalence remains unproven. '
      'Owner review and game integration remain open.')
append_wave('A9','DELIVERED candidate; fidelity differences named; owner review pending',body)
p=ROOT/'docs/waves/A9-arena-restoration.md'
with p.open('a',encoding='utf-8') as f:
    f.write('\n## Delivery and evidence\n\n'+body+'\n\n'
      'Delivery: `art/delivery/a9/{arena,layout,decals}.json` and README. Ground tiles retain '
      '1280x720 native source detail at 32px/metre, with opposite 64px bands conditioned. '
      'Source RGB edges, alpha, source/export hashes, baselines and density gates pass. '
      'Owner board browser checks pass at 1080p, 1440p and 390px. Portable rebuild forbids '
      'raw access and reproduces delivery hashes. Offline suite: 68 tests pass. These '
      'checks do not measure gameplay, FPS or owner feel.\n\n'
      'The isolated build environment pins NumPy 2.4.6 and SciPy 1.15.3 for component '
      'labeling; global Python packages were not replaced. The first layout proof is retained '
      'under art/waves/A9 as a rejected assembly study, not the selected delivery.\n')
p=ART/'ACCEPTANCE.md';text=p.read_text(encoding='utf-8');p.write_text('# Session 6 / A9 candidate\n\n'+body+'\n\n'+text,encoding='utf-8')
p=ROOT/'docs/PROVIDER-LEDGER.md'
with p.open('a',encoding='utf-8') as f:
    f.write('\n### Session 6 / A9 / 2026-10-03\n\nEleven serial Grok calls, no retry/refund or latch reset. '
      'Rich masonry and floor painting was usable; requested resolution/aspect was not reliable '
      '(most outputs 1280x720). Rust banner clipped; corrected by a separate reserved image. '
      'Decal sheet introduced letter-like marks and an unwanted figure; those cells are excluded. '
      'Individual physical materials outperform the earlier simplified A7 export, but generated '
      'front/back wall prompts did not produce trustworthy opposite facings. Source variants '
      'are treated as materials, with authored geometry disclosed. Cumulative 241/300; remaining '
      '59 under the conservative shared ceiling. agy actual weekly allowance remains unknown.\n')
write(ART/'waves/A9/source-rejections.json',{'excluded':[{'source':'a9-rust-sand-props-grok-a01','cells':[0],'reason':'global top finial clipping; separately generated correction'},
 {'source':'a9-verdigris-decals-grok-a01','cells':[0,1,5],'reason':'letter-like glyphs and unwanted figure; not consumed'}],
 'rejectedAssembly':'art/waves/A9/first-layout.png','owner_accepted':False})
