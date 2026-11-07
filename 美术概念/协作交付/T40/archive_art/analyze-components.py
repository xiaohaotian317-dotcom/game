"""Read-only connected material components, no PNG write."""
from PIL import Image
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
im=Image.open(ROOT/'archive-controls-v1.png');w,h=im.size;a=im.getchannel('A');raw=a.tobytes();mask=bytearray(v>16 for v in raw);cc=[]
for i,on in enumerate(mask):
 if not on:continue
 mask[i]=0;stack=[i];xs=[];ys=[]
 while stack:
  p=stack.pop();y,x=divmod(p,w);xs.append(x);ys.append(y)
  ns=[]
  if x:ns.append(p-1)
  if x+1<w:ns.append(p+1)
  if y:ns.append(p-w)
  if y+1<h:ns.append(p+w)
  for q in ns:
   if mask[q]:mask[q]=0;stack.append(q)
 if len(xs)>=4:cc.append({'area':len(xs),'rect':[min(xs),min(ys),max(xs)-min(xs)+1,max(ys)-min(ys)+1]})
cc.sort(key=lambda v:-v['area']);print(json.dumps(cc[:15]));(ROOT/'components-audit.json').write_text(json.dumps(cc,indent=2),encoding='utf-8')
safe=[110,145,545,715];xx,yy,ww,hh=safe;hits=[(x,y,raw[y*w+x]) for y in range(yy,yy+hh) for x in range(xx,xx+ww) if raw[y*w+x]>16];print('safe hits',hits)

