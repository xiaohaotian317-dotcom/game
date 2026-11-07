"""Read-only final hash, element geometry, material coverage and hollow-safe checks."""
from PIL import Image
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parent
m=json.loads((ROOT/'archive-meta-v1.json').read_text());p=ROOT/m['file'];src=Path(m['sourcePath']);im=Image.open(p);w,h=im.size;a=im.getchannel('A');raw=a.tobytes();cover=bytearray(w*h)
report={'passed':True,'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'savedSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceBytesUnchanged':src.read_bytes()==p.read_bytes(),'sizeMatches':[w,h]==[m['width'],m['height']],'elements':{}}
for key,e in m['elements'].items():
 x,y,rw,rh=e['sourceRect'];sx,sy,sw,sh=e['safeRect'];l,t,r,b=e['slice']
 ok=0<=x and 0<=y and x+rw<=w and y+rh<=h and sx>=x and sy>=y and sx+sw<=x+rw and sy+sh<=y+rh and l+r<rw and t+b<rh
 for extra in ['crestRect','lowerCrestRect','emblemRect','headRoomRect','feetRoomRect','fillRect','leftCapRect','rightCapRect']:
  if extra in e:
   ex,ey,ew,eh=e[extra];ok=ok and ex>=x and ey>=y and ex+ew<=x+rw and ey+eh<=y+rh
 for band,yy,hh in [('topCenterSegments',y,t),('bottomCenterSegments',y+rh-b,b)]:
  if band in e:
   seg=e[band];ok=ok and seg[0]['rect'][0]==x+l and sum(s['rect'][2] for s in seg)==rw-l-r and seg[-1]['rect'][0]+seg[-1]['rect'][2]==x+rw-r
   ok=ok and all(s['rect'][1]==yy and s['rect'][3]==hh for s in seg)
 safe=a.crop((sx,sy,sx+sw,sy+sh));hist=safe.histogram();mat=sum(hist[17:])
 hollowOk=not e['centerOpening'] or mat==0
 report['elements'][key]={'geometryValid':bool(ok),'safeAlphaExtrema':list(safe.getextrema()),'safeMaterialOver16Pixels':mat,'hollowSafeValid':hollowOk}
 report['passed']=report['passed'] and ok and hollowOk
 for py in range(y,y+rh):
  for px in range(x,x+rw):cover[py*w+px]+=1
report['uncoveredMaterialOver16Pixels']=sum(v>16 and cover[i]==0 for i,v in enumerate(raw))
report['multiplyCoveredMaterialOver16Pixels']=sum(v>16 and cover[i]>1 for i,v in enumerate(raw))
report['passed']=bool(report['passed'] and report['sourceBytesUnchanged'] and report['sizeMatches'] and report['savedSha256']==m['sha256'] and report['uncoveredMaterialOver16Pixels']==0 and report['multiplyCoveredMaterialOver16Pixels']==0)
(ROOT/'provenance-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2));assert report['passed']

