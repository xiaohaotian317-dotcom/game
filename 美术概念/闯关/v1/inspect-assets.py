"""Read-only generated image QA: alpha/frame geometry and hashes. Never edits PNG pixels."""
from pathlib import Path
from PIL import Image
from collections import deque
import hashlib,json
root=Path(__file__).resolve().parents[3]/'arcane-duel-lab/dist/assets/campaign'
def main_box(mask):
 width,height=mask.size;data=bytearray(mask.tobytes());best=None
 for seed in range(len(data)):
  if not data[seed]:continue
  data[seed]=0;q=deque([seed]);n=0;left=right=seed%width;top=bottom=seed//width
  while q:
   pos=q.popleft();x=pos%width;y=pos//width;n+=1
   left=min(left,x);right=max(right,x);top=min(top,y);bottom=max(bottom,y)
   for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
    if 0<=nx<width and 0<=ny<height:
     idx=ny*width+nx
     if data[idx]:data[idx]=0;q.append(idx)
  if best is None or n>best[0]:best=(n,(left,top,right+1,bottom+1))
 return best[1] if best else (0,0,1,1)
validation=[];fx={}
for path in sorted(root.glob('*.png')):
 with Image.open(path) as im:
  im.load();width,height=im.size;alpha=im.getchannel('A') if 'A' in im.getbands() else None
  row={'file':path.name,'size':[width,height],'mode':im.mode,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
  if alpha is not None:row['alphaExtrema']=alpha.getextrema();row['cornerAlpha']=[alpha.getpixel(p) for p in [(0,0),(width-1,0),(0,height-1),(width-1,height-1)]]
  validation.append(row)
  key={'portal-v1.png':'portal','ice-v1.png':'ice','fire-v2.png':'fire'}.get(path.name)
  if not key:continue
  frames=[];cw=width/4;ch=height/4
  for i in range(16):
   col=i%4;r=i//4;x0,y0,x1,y1=round(col*cw),round(r*ch),round((col+1)*cw),round((r+1)*ch)
   mask=alpha.crop((x0,y0,x1,y1)).point(lambda a:255 if a>80 else 0)
   left,top,right,bottom=main_box(mask)
   frames.append({'index':i,'rect':[x0,y0,x1-x0,y1-y0],'bbox':[left,top,right-left,bottom-top],
    'spriteRect':[x0+max(0,left-2),y0+max(0,top-2),min(x1-x0,right+2)-max(0,left-2),min(y1-y0,bottom+2)-max(0,top-2)],
    'bottomNormalized':bottom/(y1-y0),'centerX':(left+right)/2,'bottom':bottom,
    'touchesCellEdge':left<=1 or top<=1 or right>=x1-x0-1 or bottom>=y1-y0-1})
  fx[key]={'file':path.name,'size':[width,height],'cellSize':[cw,ch],'frames':frames,'alphaExtrema':row['alphaExtrema'],'cornerAlpha':row['cornerAlpha']}
(root/'fx-meta-v1.json').write_text(json.dumps(fx,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'validation-v1.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'images':len(validation),'fx':{k:{'file':v['file'],'size':v['size'],'edgeFrames':[f['index'] for f in v['frames'] if f['touchesCellEdge']]} for k,v in fx.items()}},ensure_ascii=False))
import re
gallery=Path(__file__).parent/'画册.html'
links=re.findall(r'(?:src|href)="([^"]+)"',gallery.read_text(encoding='utf-8'))
missing=[v for v in links if not (gallery.parent/v).exists()]
assert not missing,missing
print(json.dumps({'galleryLinks':len(links),'missing':missing,'fxAlpha':{k:{'range':v['alphaExtrema'],'cornerAlpha':v['cornerAlpha']} for k,v in fx.items()}},ensure_ascii=False))

