"""Read-only frame/safe-area and warning-ellipse measurements. No PNG writes."""
from pathlib import Path
from PIL import Image
from statistics import median
import math,json
ROOT=Path(__file__).resolve().parent
audit=json.loads((ROOT/'alpha-components-audit.json').read_text())
def pad(b,w,h,n=4):
 x,y,rw,rh=b;x0=max(0,x-n);y0=max(0,y-n);x1=min(w,x+rw+n);y1=min(h,y+rh+n);return [x0,y0,x1-x0,y1-y0]
def alphaStats(a,r):
 x,y,w,h=r;hist=a.crop((x,y,x+w,y+h)).histogram();return {'min':next(i for i,v in enumerate(hist) if v),'max':max(i for i,v in enumerate(hist) if v),'zero':hist[0],'over16':sum(hist[17:]),'pixels':w*h}
def order(cc):
 return sorted([c for c in cc if c['area']>10000],key=lambda c:(int((c['rect'][1]+c['rect'][3]/2)//170),c['rect'][0]))
out={}
for name in ['stage-title-plates-v1.png','boss-warning-rings-v1.png']:
 im=Image.open(ROOT/name);a=im.getchannel('A');w,h=im.size;rows=[]
 for i,c in enumerate(order(audit[name]['componentsOver16'])):
  b=c['rect'];r=pad(b,w,h);row=i//2;col=i%2
  sf=[200+768*col,75+170*row,365,45] if name.startswith('stage') else None
  item={'stage':i+1,'materialBounds16':b,'sourceRect':r}
  if sf:item.update({'safeRect':sf,'safeAlpha':alphaStats(a,sf)})
  rows.append(item)
 out[name]={'frames':rows,'emptyTwelfthRegion':[768,853,768,171],'emptyTwelfthAlpha':alphaStats(a,[768,853,768,171])}
 if name.startswith('boss'):
  pix=a.load()
  for item in rows:
   x,y,rw,rh=item['materialBounds16'];cx=x+(rw-1)/2;cy=y+(rh-1)/2;rx=rw*.46
   # Fit the midline of the physically painted perimeter, excluding center crests
   # and endcap ornaments. Weighted material centers, not outer alpha bbox.
   details={}
   for iteration in range(3):
    left=[];right=[]
    for yy in range(max(y,round(cy)-3),min(y+rh,round(cy)+4)):
     for xx in range(x,x+rw):
      v=pix[xx,yy]
      if v>128:
       if xx<cx-rw*.3:left.append((xx,v))
       if xx>cx+rw*.3:right.append((xx,v))
    if left and right:
     lx=sum(xx*v for xx,v in left)/sum(v for xx,v in left);rr=sum(xx*v for xx,v in right)/sum(v for xx,v in right);cx=(lx+rr)/2;rx=(rr-lx)/2
    samples=[]
    for xx in range(round(cx-rx*.72),round(cx+rx*.72)+1,3):
     if abs(xx-cx)<rx*.20:continue
     top=[];bottom=[]
     for yy in range(y,y+rh):
      v=pix[xx,yy]
      if v>128:(top if yy<cy else bottom).append((yy,v))
     if not top or not bottom:continue
     ty=sum(yy*v for yy,v in top)/sum(v for yy,v in top);by=sum(yy*v for yy,v in bottom)/sum(v for yy,v in bottom)
     samples.append((xx,(ty+by)/2,(by-ty)/2))
    cy=median(v[1] for v in samples)
    ry=median(d/math.sqrt(max(.01,1-((xx-cx)/rx)**2)) for xx,mid,d in samples)
    details={'horizontalMidlineRadiusX':rx,'verticalSampleCount':len(samples),'sampleCenterYSpread':[min(s[1] for s in samples),max(s[1] for s in samples)]}
   inner=[round(cx)-180,round(cy)-15,360,30]
   item.update({'center':[round(cx,2),round(cy,2)],'groundContactY':round(cy,2),'radiusX':round(rx,2),'radiusY':round(ry,2),'innerSafeRect':inner,'innerSafeAlpha':alphaStats(a,inner),'measurement':details})
 print(name,'measured',len(rows),'frames')
name='artifact-pet-controls-v2.png';im=Image.open(ROOT/name);a=im.getchannel('A');w,h=im.size
cs=sorted([c for c in audit[name]['componentsOver16'] if c['area']>10000],key=lambda c:c['rect'][1])
safe=[[390,108,650,46],[405,345,650,55],[420,590,650,80],[450,837,610,83],[415,1089,650,80]]
circles=[[247,133,54],[247,374,52],[243,625,76],[247,882,76],[246,1120,64]]
items=[]
for i,c in enumerate(cs):
 sf=safe[i];cx,cy,rr=circles[i];pts=[a.getpixel((xx,yy)) for yy in range(cy-rr,cy+rr+1) for xx in range(cx-rr,cx+rr+1) if (xx-cx)**2+(yy-cy)**2<=rr*rr]
 f={'id':['mirrorHud','swordHud','deerEntry','griffinEntry','foxEntry'][i],'materialBounds16':c['rect'],'sourceRect':pad(c['rect'],w,h),'safeRect':sf,'safeAlpha':alphaStats(a,sf),'avatarCircle':circles[i],'avatarAlpha':{'max':max(pts),'over16':sum(v>16 for v in pts),'pixels':len(pts)}}
 items.append(f)
out[name]={'frames':items};print(name,'measured',len(items),'frames; safe areas/avatars',[(f['id'],f['safeAlpha']['max'],f['avatarAlpha']['max'],f['avatarAlpha']['over16']) for f in items])
(ROOT/'frame-measurements.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')

