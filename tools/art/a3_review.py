"""Inspection sheets only; reviews must be authored after viewing actual pixels."""
from PIL import Image, ImageDraw
import argparse
from common import ART, read, source_path, write
from waves import generated, review
from board import font


def main():
    p=argparse.ArgumentParser();p.add_argument('--record',action='store_true');a=p.parse_args()
    if a.record:
        for job_id,note in read(ART/'waves/A3/inspection-notes-v1.json').items():
            job=next(j for j in generated('A3') if j['id']==job_id)
            review('A3',job_id,note['note'],reject=note.get('reject',False))
            if note.get('correction'):
                write(ART/'rejections'/(job_id+'.json'),{'job':job_id,'sha256':job['sha256'],'note':note['note'],
                    'correction':note['correction'],'label':'authored direct pixel observation; scoped pose failure','owner_accepted':False})
    out=ART/'review/a3/inspection';out.mkdir(parents=True,exist_ok=True)
    for entity in read(ART/'a3-roster-v1.json')['entities']:
        jobs=[]
        for pair in ('stance','run','action','injury'):
            candidates=[j for j in generated('A3') if j['scene']=='figure-'+entity['id']+'-'+pair]
            if candidates:jobs.append(candidates[-1])
        if not jobs:continue
        sheet=Image.new('RGB',(1920,1160),'#eee0bd');d=ImageDraw.Draw(sheet)
        for n,j in enumerate(jobs):
            im=Image.open(source_path(j)).convert('RGB');im.thumbnail((960,540))
            x=n%2*960;y=n//2*580;sheet.paste(im,(x,y))
            d.text((x+12,y+545),j['id'],font=font(19),fill='#38261f')
        sheet.save(out/(entity['id']+'.jpg'),quality=94)


if __name__=='__main__':main()
