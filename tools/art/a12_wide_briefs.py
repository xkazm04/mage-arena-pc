"""One coherent outpainted master, preserving the concept view in its centre."""
from PIL import Image
from common import ART, ROOT, read, write, sha
from covenant import review,jobs

def make():
    selected={'moonlit':'a12-moonlit-proof-agy-agy-a01','verdigris':'a12-verdigris-clean-agy-a03','rust-sand':'a12-rust-sand-clean-agy-a03'}
    lookup={j['id']:j for j in jobs('A12')}
    for palette,ident in selected.items():
        job=lookup[ident]
        review(job,'Coherent clean scene; no figures or personal magic visible. Architecture and material painting follow approved A6. Native 1376x768; fine surface differences remain. Candidate for single wide master, owner quality pending.')
        im=Image.open(ROOT/job['archive']).convert('RGB').resize((1440,810),Image.Resampling.LANCZOS)
        guide=Image.new('RGB',(1728,972),(112,112,112));guide.paste(im,(144,81))
        path=ART/'waves/A12/references'/f'{palette}-overscan-guide.png';path.parent.mkdir(parents=True,exist_ok=True);guide.save(path)
        write(ART/'briefs/a12'/f'{palette}-wide.json',{'wave':'A12','id':palette+'-wide','pilot':False,'providers':['agy','grok'],
          'style_hash':sha(ART/'style-covenant.json'),'aspect_ratio':'16:9',
          'references':[{'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'role':'outpaint target: clean approved-composition scene centered within blank grey overscan margins'}],
          'prompt':('Use case: precise-object-edit / environment outpainting. The reference is a complete CLEAN painted arena in the middle, '
            'with blank flat GREY bands at every outside edge. FILL ONLY those grey margins by naturally continuing this SAME single painting. '
            'The existing inner scene occupies exactly the central five-sixths of width and height; keep it at this exact position and scale. '
            'Do NOT crop away the grey border or zoom in: the final image must include the new wider view. '
            'Extend the same irregular stone/sand floor to left, right and bottom; extend the existing rear masonry, banners and darkness to the top. '
            'Connect surfaces and lighting across the former grey boundaries with no visible seam or abrupt edge. '
            'Keep all existing pylons, rune rings, cracks and broad colour regions at their original locations within the inner scene. '
            'Keep all FIVE pylons intact, including foreground ones; do not duplicate them in the new margins. '
            'Preserve the exact material painting, light direction, atmosphere, palette and floor detail of the reference. '
            'No creatures, figures, people, weapons, statues, combat effects, new inscriptions, text, UI or logos. Abstract existing rune marks stay. '
            'Absolutely no solid grey bands remain, no outer frame, no background border. One seamless coherent original hand-painted environment, '
            'not a collage. Same elevated 55-degree oblique camera, no additional perspective convergence. '
            'Largest available landscape output 16:9. Make EXACTLY ONE image and do not refine or retry it. Return that first result.')})

if __name__=='__main__':make()
