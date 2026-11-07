"""Read-only alpha components and byte provenance for generated T41 assets."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parent
sources={
'stage-title-plates-v1.png':'exec-483f567e-7cb0-457c-9ef6-0250165d4794.png',
'artifact-pet-controls-v1.png':'exec-bcd49774-9a4a-4d38-b0b0-160045ba541c.png',
'artifact-pet-controls-v2.png':'exec-f9980885-97a6-48d8-bead-8f6d18f1fca2.png',
'boss-warning-rings-v1.png':'exec-ca8d9453-c04c-4f07-9db4-344a87aaff2c.png'}
BASE=Path(r'C:/Users/xiaohaotian/.codex/generated_images/01a1b188-681a-76a2-8fa2-0106444de3ea')
out={}
for name,source in sources.items():
 p=ROOT/name;sp=BASE/source;im=Image.open(p);w,h=im.size;a=im.getchannel('A');raw=a.tobytes();hist=a.histogram();mask=bytearray(v>16 for v in raw);cc=[]
 for i,on in enumerate(mask):
  if not on:continue
  mask[i]=0;stack=[i];xs=[];ys=[]
  while stack:
   q=stack.pop();yy,xx=divmod(q,w);xs.append(xx);ys.append(yy)
   ns=[]
   if xx:ns.append(q-1)
   if xx+1<w:ns.append(q+1)
   if yy:ns.append(q-w)
   if yy+1<h:ns.append(q+w)
   for n in ns:
    if mask[n]:mask[n]=0;stack.append(n)
  if len(xs)>=4:cc.append({'area':len(xs),'rect':[min(xs),min(ys),max(xs)-min(xs)+1,max(ys)-min(ys)+1]})
 cc.sort(key=lambda c:-c['area'])
 rec={'file':name,'sourcePath':str(sp),'size':[w,h],'mode':im.mode,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(sp.read_bytes()).hexdigest(),'alphaExtrema':list(a.getextrema()),'alphaZero':hist[0],'alphaOneToEight':sum(hist[1:9]),'alphaOver16':sum(hist[17:]),'componentsOver16':cc}
 out[name]=rec
 print(name,json.dumps({k:v for k,v in rec.items() if k!='componentsOver16'}));print('components',json.dumps(cc[:18]))
(ROOT/'alpha-components-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')

