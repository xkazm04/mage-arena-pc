"""Record an executing agent's direct image review, never an automatic accept."""
import argparse
from common import ART,read,write
from covenant import review

def observe(entity,direction,note,height=220,reject=False,exclude=(),light=None,heavy=None,mirror=False,pivots=None,kind='reaction'):
    jobs=[j for j in read(ART/'usage.json')['jobs'] if j.get('wave')=='A14' and j['scene']==f'{entity}-{direction}-{kind}' and j['status']=='generated'];j=jobs[-1]
    pivot={str(i):[.45,1] for i in range(13)}
    pivot.update({'13':[.5,.80],'14':[.5,.45],'15':[.5,.45]})
    if kind=='collapse':pivot={'0':[.4,1],'1':[.4,1],'2':[.45,1],'3':[.5,.80],'4':[.5,.45],'5':[.5,.45]}
    if pivots:pivot.update(pivots)
    grid=j['input']['grid'];obs={'sha256':j['sha256'],'grid':grid,'facings':[direction if i not in exclude else 'unverified' for i in range(grid[0]*grid[1])],'bodyHeightSourcePx':height,'excluded':list(exclude),'selections':{},'pivotFractions':pivot,'mirrorSource':mirror,'verdict':'reject' if reject else 'owner-review','note':note,'owner_accepted':False,'authority':'direct image inspection; approximate source head-to-sole measurement and authored ground anchors'}
    if light:obs['selections']['hit-light']=light
    if heavy:obs['selections']['hit-heavy']=heavy
    write(ART/'waves/A14/observations'/(j['id']+'.json'),obs);review(j,note,verdict=obs['verdict'])
    return j,obs

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('entity');p.add_argument('direction');p.add_argument('note');p.add_argument('--height',type=float,default=220);p.add_argument('--reject',action='store_true');a=p.parse_args()
    observe(a.entity,a.direction,a.note,a.height,a.reject)
