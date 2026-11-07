from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parent;d=json.loads((root/'frame-measurements.json').read_text())
for n in ['stage-title-plates-v1.png','boss-warning-rings-v1.png']:
 a=Image.open(root/n).getchannel('A')
 for f in d[n]['frames']:
  r=f.get('safeRect',f.get('innerSafeRect'));x,y,w,h=r
  p=[(xx,yy,a.getpixel((xx,yy))) for yy in range(y,y+h) for xx in range(x,x+w) if a.getpixel((xx,yy))>16]
  if p:print(n,f['stage'],'hits',len(p),'bbox',[min(v[0] for v in p),min(v[1] for v in p),max(v[0] for v in p),max(v[1] for v in p)],'sample',p[:15])

