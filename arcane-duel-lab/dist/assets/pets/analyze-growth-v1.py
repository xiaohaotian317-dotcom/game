"""Read-only atlas analysis. Writes JSON metadata/reports; never modifies PNG pixels."""
from PIL import Image
from pathlib import Path
import collections,json,hashlib,statistics,array
BASE=Path(__file__).resolve().parent
IDS=['frostfox','emberwing','mossdeer']
STATES=['idle-a','idle-b','walk-a','walk-b','attack','hurt']
def components(im):
 w,h=im.size;a=im.getchannel('A');mask=bytearray(v>100 for v in a.tobytes());n=w*h;groups=[];q=collections.deque()
 for p in range(n):
  if not mask[p]:continue
  mask[p]=0;q.append(p);count=0;x0=y0=99999;x1=y1=0;points=[]
  while q:
   z=q.popleft();points.append(z);y,x=divmod(z,w);count+=1;x0=min(x0,x);y0=min(y0,y);x1=max(x1,x);y1=max(y1,y)
   for k in (z-1,z+1,z-w,z+w):
    if 0<=k<n and abs((k%w)-x)<=1 and mask[k]:mask[k]=0;q.append(k)
  if count>300:groups.append({'pixels':count,'bounds':[x0,y0,x1+1,y1+1],'points':points})
 return groups
def clip_runs(group,owner,width,rect):
 """Alpha component plus two original source pixels of AA; exclude all other bodies."""
 x0,y0,rw,rh=rect;lines=collections.defaultdict(list);own=group['gid']
 for p in group['points']:
  y,x=divmod(p,width);lines[y].append(x)
 dilated=collections.defaultdict(list)
 for y,xs in lines.items():
  xs.sort();start=last=xs[0];runs=[]
  for x in xs[1:]:
   if x==last+1:last=x
   else:runs.append((start,last+1));start=last=x
  runs.append((start,last+1))
  for ya in range(max(y0,y-2),min(y0+rh,y+3)):
   for a,b in runs:dilated[ya].append((max(x0,a-2),min(x0+rw,b+2)))
 result=[];retained=0
 for y,intervals in sorted(dilated.items()):
  intervals.sort();merged=[]
  for a,b in intervals:
   if merged and a<=merged[-1][1]:merged[-1]=(merged[-1][0],max(b,merged[-1][1]))
   else:merged.append((a,b))
  for a,b in merged:
   run=None
   for x in range(a,b):
    allowed=owner[y*width+x] in (-1,own)
    if allowed:
     if run is None:run=x
     if owner[y*width+x]==own:retained+=1
    elif run is not None:result.append([y-y0,run-x0,x-run]);run=None
   if run is not None:result.append([y-y0,run-x0,b-run])
 assert retained==group['pixels'],(retained,group['pixels'])
 return result
def sheet(file,cols,form):
 im=Image.open(BASE/file);assert im.mode=='RGBA'
 groups=components(im);rows=[[],[],[]];owner=array.array('h',[-1])*(im.width*im.height)
 for gid,g in enumerate(groups):
  g['gid']=gid
  for p in g['points']:owner[p]=gid
 for g in groups:
  b=g['bounds'];cy=(b[1]+b[3])/2;r=0 if cy<360 else 1 if cy<665 else 2;rows[r].append(g)
 frames=[]
 for r,row in enumerate(rows):
  row.sort(key=lambda g:g['bounds'][0]);assert len(row)==cols,(file,r,len(row))
  natural=round(statistics.median(g['bounds'][3]-g['bounds'][1] for g in row)) if cols==8 else max(g['bounds'][3]-g['bounds'][1] for g in row[:4])
  for index,g in enumerate(row):
   b=g['bounds'];x=max(0,b[0]-2);y=max(0,b[1]-2);x2=min(im.width,b[2]+2);y2=min(im.height,b[3]+2);rect=[x,y,x2-x,y2-y]
   # Torso-biased anchor ignores long left-swept tails and forward stretching feet.
   ax=round(b[0]+(b[2]-b[0])*[.63,.53,.50][r])-x;ay=b[3]-y
   frames.append({'pet':IDS[r],'index':index,'form':form,'state':'walk-'+str(index) if cols==8 else STATES[index],'rect':rect,'spriteRect':rect,'bounds':b,'anchor':[ax,ay],'anchorNormalized':[ax/rect[2],ay/rect[3]],'standingX':ax/rect[2],'standingY':ay/rect[3],'naturalHeight':natural,'clipRuns':clip_runs(g,owner,im.width,rect)})
 return {'file':file,'size':list(im.size),'frames':frames}
data={'version':1,'forms':{'1':sheet('evolved-form2-v1.png',6,1),'2':sheet('evolved-form3-v1.png',6,2)},'walks':{'0':sheet('walk-form1-v1.png',8,0),'1':sheet('walk-form2-v3.png',8,1),'2':sheet('walk-form3-v3.png',8,2)}}
# Hand-calibrated original source areas; icon sheet is genuinely 1254 x 1254.
ix=[15,433,851];iy=[15,408,809]
data['icons']={'file':'pet-skills-v1.png','size':[1254,1254],'frames':[{'pet':IDS[r],'skill':c,'rect':[ix[c],iy[r],389,369 if r<2 else 389]}for r in range(3)for c in range(3)]}
# Each FX has a distinct source area; no ideal equal grid assumption.
fxrects=[[29,78,477,190],[546,61,477,231],[1092,10,386,313],[37,329,466,310],[539,340,485,278],[1048,327,462,307],[19,708,506,217],[557,637,429,369],[1048,635,470,371]]
ground={1,2,5,7,8}
data['fx']={'file':'pet-skills-fx-v1.png','size':[1536,1024],'frames':[{'pet':IDS[i//3],'skill':i%3,'rect':r,'anchor':[r[2]/2,r[3]*.92 if i in ground else r[3]/2],'naturalHeight':r[3]}for i,r in enumerate(fxrects)]}
data['analysis']={'method':'Original PNG preserved. Read-only alpha>100 connected components and manually calibrated icon/FX source areas. Consumers use explicit rect/anchor; no source pixel edits.','clipRunsFormat':'[y,x,width], source pixel coordinates RELATIVE to this frame rect, one-pixel-high horizontal strips. Main connected body plus two-pixel AA margin, other main bodies excluded. Cache Path2D once per frame; translate/scale with same rect anchor before clip and drawImage.','warning':'Generated artwork has small inter-frame anatomy/feather variations. In-place eight-pose walk frames are distinct; smooth timing/blending and final human visual acceptance remain separate.'}
report={'passed':True,'files':[],'sheets':{},'warnings':[],'method':data['analysis']['method']}
for category in ['forms','walks']:
 for k,s in data[category].items():
  im=Image.open(BASE/s['file']);a=im.getchannel('A');rows=[]
  for f in s['frames']:
   x,y,w,h=f['rect'];assert x>=0 and y>=0 and w>0 and h>0 and x+w<=im.width and y+h<=im.height
   bbox=a.crop((x,y,x+w,y+h)).point(lambda p:255 if p>100 else 0).getbbox();assert bbox
   pad=[bbox[0],bbox[1],w-bbox[2],h-bbox[3]]
   if min(pad)<1:report['warnings'].append({'file':s['file'],'pet':f['pet'],'pose':f['index'],'message':'Source sprite or adjacent isolated tip approaches calibrated rectangle edge; inspect at actual game size.','padding':pad})
   for ya,xa,length in f['clipRuns']:assert 0<=ya<h and 0<=xa<xa+length<=w
   rows.append({'pet':f['pet'],'state':f['state'],'rect':f['rect'],'anchor':f['anchor'],'naturalHeight':f['naturalHeight'],'alphaCorePadding':pad,'clipRunCount':len(f['clipRuns']),'ownCoreRetained':True,'foreignMainCorePixelsIncluded':0})
  report['sheets'][s['file']]={'frameCount':len(s['frames']),'frames':rows}
files=[s['file']for cat in ['forms','walks']for s in data[cat].values()]+[data['icons']['file'],data['fx']['file']]
for file in files:
 path=BASE/file;im=Image.open(path);im.load()
 rec={'file':file,'size':list(im.size),'mode':im.mode,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 if im.mode=='RGBA':
  a=im.getchannel('A');h=a.histogram();rec.update(alphaExtrema=list(a.getextrema()),fullyTransparentPixels=h[0],alphaOver100=sum(h[101:]))
 report['files'].append(rec)
for section in ['icons','fx']:
 s=data[section]
 for f in s['frames']:
  x,y,w,h=f['rect'];assert 0<=x<x+w<=s['size'][0] and 0<=y<y+h<=s['size'][1]
(BASE/'growth-meta-v1.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(BASE/'growth-validation-v1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':True,'selectedFiles':len(files),'formsFrames':36,'walkFrames':72,'icons':9,'fx':9,'warnings':report['warnings']},ensure_ascii=False))

