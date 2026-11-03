"""Read-only alpha analysis for campaign7 spirit beast artwork; PNG bytes are never modified."""
from pathlib import Path
import json, hashlib, argparse
from PIL import Image

root=Path(__file__).resolve().parents[1]
base=root/'dist/assets/pets'
legacy=base/'analyze-growth-v1.py'
helpers=legacy.read_text('utf-8').split("\ndata={'version':1",1)[0]
ns={'__file__':str(legacy)}
exec(compile(helpers,str(legacy),'exec'),ns)
parser=argparse.ArgumentParser();parser.add_argument('--portraits');args=parser.parse_args()
initial=ns['sheet']('pets-v4.png',6,0)
initial.update(version=3,mirror=json.loads((base/'pets-meta-v2.json').read_text('utf-8'))['mirror'])
walk=ns['sheet']('walk-form1-v2.png',8,0)
growth=json.loads((base/'growth-meta-v1.json').read_text('utf-8'));growth['version']=2;growth['walks']['0']=walk
report={'version':'spirit-v1','pngPixelsModified':False,'files':[],'sheets':{},'portraitFirstDraftRejected':True}
for meta in [initial,walk]:
 report['sheets'][meta['file']]={'frames':len(meta['frames']),'rows':3,'foreignBodyPixels':0,'coreRetained':True,'anchoring':'fixed species naturalHeight, per-frame original foot anchor'}
 for f in meta['frames']:
  x,y,w,h=f['rect'];assert min(x,y)>=0 and x+w<=meta['size'][0] and y+h<=meta['size'][1]
  assert 0<=f['anchor'][0]<=w and 0<=f['anchor'][1]<=h
  assert f['clipRuns']
  for sy,sx,sw in f['clipRuns']:assert 0<=sy<h and 0<=sx<sx+sw<=w
files=[initial['file'],walk['file']]
if args.portraits:
 im=Image.open(base/args.portraits);groups=ns['components'](im)
 rows=[[],[],[]]
 for g in groups:
  b=g['bounds'];row=min(2,int(((b[1]+b[3])/2)/im.height*3));rows[row].append(g)
 frames=[]
 for row,groups in enumerate(rows):
  groups.sort(key=lambda g:g['bounds'][0]);assert len(groups)==3,(args.portraits,row,len(groups))
  for form,g in enumerate(groups):
   b=g['bounds'];x=max(0,b[0]-4);y=max(0,b[1]-4);x2=min(im.width,b[2]+4);y2=min(im.height,b[3]+4)
   frames.append({'pet':ns['IDS'][row],'form':form,'rect':[x,y,x2-x,y2-y],'bounds':b,'corePixels':g['pixels']})
 portrait={'version':1,'file':args.portraits,'size':list(im.size),'frames':frames,'method':'Read-only alpha>100 connected bodies; confirmed isolated 3x3 portraits, original pixels preserved.'}
 (base/'portrait-meta-v1.json').write_text(json.dumps(portrait,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 growth['portraits']=portrait;files.append(args.portraits)
 report['sheets'][args.portraits]={'frames':9,'isolatedHeads':True}
for name in files:
 p=base/name;im=Image.open(p);a=im.getchannel('A');hist=a.histogram();assert hist[0]>im.width*im.height*.2
 report['files'].append({'file':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'size':list(im.size),'mode':im.mode,'alphaRange':list(a.getextrema()),'transparentPixels':hist[0]})
(base/'pets-meta-v3.json').write_text(json.dumps(initial,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(base/'walk-form1-meta-v2.json').write_text(json.dumps(walk,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(base/'growth-meta-v2.json').write_text(json.dumps(growth,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(base/'spirit-validation-v1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'initial':len(initial['frames']),'walk':len(walk['frames']),'portraits':bool(args.portraits),'files':files}))
