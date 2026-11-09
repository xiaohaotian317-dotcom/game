"""Copy selected original PNGs and their measured metadata; never edit pixels."""
from pathlib import Path
import hashlib,json,shutil,sys
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'美术概念/协作交付/T44'
ASSETS=ROOT/'dist/assets'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
def copy(src,dest,expected=None):
 data=src.read_bytes();sha=hashlib.sha256(data).hexdigest()
 if expected and expected!=sha:raise ValueError(f'Source hash mismatch: {src}')
 dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
 assert hashlib.sha256(dest.read_bytes()).hexdigest()==sha
 return sha
minions=read(SOURCE/'minion_art/minion-meta-v1.json')
bosses=read(SOURCE/'boss_art/boss-meta-v1.json')
units={}
audit=[]
for directory,group in [('minion_art',minions['units']),('boss_art',bosses['units'])]:
 for key,value in group.items():
  unit={k:value[k] for k in ['file','size','frames','portrait','socket','idleHeight','idleCenterX'] if k in value}
  sha=copy(SOURCE/directory/value['file'],ASSETS/'enemies/chapter2'/value['file'],value.get('sha256'))
  unit['file']='chapter2/'+value['file'];unit['sha256']=sha;units[key]=unit;audit.append({'id':key,'file':unit['file'],'sha256':sha})
if '--partial' not in sys.argv:assert len(units)==19,'All 10 minions and 9 bosses must be measured first'
write(ASSETS/'enemies/chapter2/bounds-v1.json',{'version':1,'units':units})
fxunits={}
for key,value in bosses['fx'].items():
 fx={k:value[k] for k in ['file','size','frames']};sha=copy(SOURCE/'boss_art'/value['file'],ASSETS/'boss-fx/chapter2'/value['file'],value.get('sha256'));fx['file']='chapter2/'+value['file'];fx['sha256']=sha;fxunits[key]=fx
write(ASSETS/'boss-fx/chapter2/bounds-v1.json',{'version':1,'units':fxunits})
families={};mapping={};images=[]
for kind,atlas in minions['fx'].items():
 copy(SOURCE/'minion_art'/atlas['file'],ASSETS/'minion-fx/chapter2'/atlas['file'],atlas['sha256']);images.append(atlas['file'])
 for key,family in atlas['families'].items():
  familyId=f'c2-{key}-{kind}'
  families[familyId]={'file':atlas['file'],'frames':[atlas['frames'][i] for i in family['frames']],'referenceSpanPixels':family['referenceCellWidth'],'ground':family['ground']}
  row=mapping.setdefault(key,{})
  if kind=='melee':row['melee']=familyId;row.setdefault('impact',familyId)
  else:row['projectile']=familyId;row['impact']=familyId;row['flightFrames']=[1,2];row['head']=True
write(ASSETS/'minion-fx/chapter2/manifest-v1.json',{'version':1,'families':families,'mapping':mapping,'images':images})
write(ROOT/'validation/campaign18-enemy-provenance.json',{'status':'source-copied-pending-runtime-QA','units':audit,'bossFx':len(fxunits),'minionFxFrames':sum(len(v['frames']) for v in families.values()),'pixelsEdited':False})
print(json.dumps({'units':len(units),'bossFx':len(fxunits),'minionFxFamilies':len(families)}))
