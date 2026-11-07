"""Read-only connected-component audit of generated alpha pixels, no PNG writes."""
from pathlib import Path
from PIL import Image
from collections import deque
import json
root=Path(__file__).resolve().parent
out={}
for name in ['ornate-controls-v1.png','training-sentinel-v1.png']:
 im=Image.open(root/name);w,h=im.size;a=im.getchannel('A').tobytes();mask=bytearray(v>16 for v in a);cc=[]
 for i,v in enumerate(mask):
  if not v:continue
  mask[i]=0;stack=[i];xs=[];ys=[]
  while stack:
   p=stack.pop();y,x=divmod(p,w);xs.append(x);ys.append(y)
   for q in ([p-1] if x else [])+([p+1] if x+1<w else [])+([p-w] if y else [])+([p+w] if y+1<h else []):
    if mask[q]:mask[q]=0;stack.append(q)
  if len(xs)>=4:cc.append({'area':len(xs),'rect':[min(xs),min(ys),max(xs)-min(xs)+1,max(ys)-min(ys)+1]})
 cc.sort(key=lambda x:-x['area']);out[name]=cc
 print(name, json.dumps(cc[:30]))
(root/'components-audit.json').write_text(json.dumps(out,indent=2),encoding='utf-8')

