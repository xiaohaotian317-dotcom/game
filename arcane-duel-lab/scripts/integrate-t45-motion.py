"""Measure/copy image_gen originals, no pixel editing or derived raster outputs."""
from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT.parent/'美术概念/协作交付/T45/motion_art'
DEST.mkdir(parents=True,exist_ok=True)
source=Path('C:/Users/xiaohaotian/.codex/generated_images/01a18113-4702-7a33-9e1d-a7e53ad5324e')
groups=[('movement-fire-nature-frost-v1.png','exec-b8ffd632-4717-4652-a700-cf1ae3a62bf8.png',['fire','nature','frost']),('movement-lightning-shadow-star-v1.png','exec-aa76ebf4-6d73-4bf2-80d7-ed6be7d0be4d.png',['lightning','shadow','star'])]
runtime=ROOT/'dist/assets/movement-fx';runtime.mkdir(parents=True,exist_ok=True)
meta={'version':1,'sheets':{},'units':{}}
for name,src,heroes in groups:
 path=source/src;im=Image.open(path);w,h=im.size;a=np.asarray(im.getchannel('A'));frames=[]
 assert sum(np.count_nonzero(v>32) for v in [a[0],a[-1],a[:,0],a[:,-1]])==0
 for row in range(6):
  for col in range(4):
   x0,x1=round(col*w/4),round((col+1)*w/4);y0,y1=round(row*h/6),round((row+1)*h/6)
   ys,xs=np.where(a[y0:y1,x0:x1]>16)
   assert len(xs)>0
   pad=2;sx=max(x0,x0+int(xs.min())-pad);sy=max(y0,y0+int(ys.min())-pad);ex=min(x1,x0+int(xs.max())+pad+1);ey=min(y1,y0+int(ys.max())+pad+1)
   frames.append({'rect':[x0,y0,x1-x0,y1-y0],'spriteRect':[sx,sy,ex-sx,ey-sy],'pivot':[(x1-x0)*.5,(y1-y0)*.78],'groundContactY':(y1-y0)*.78})
  hero=heroes[row//2];meta['units'].setdefault(hero,{})['jump' if row%2==0 else 'teleport']={'file':name,'frames':frames[row*4:row*4+4],'reference':w/4}
 sha=hashlib.sha256(path.read_bytes()).hexdigest();meta['sheets'][name]={'size':[w,h],'source':str(path),'sha256':sha,'frames':len(frames),'pixelsEdited':False}
 shutil.copy2(path,DEST/name);shutil.copy2(path,runtime/name)
for p in [DEST/'motion-meta-v1.json',runtime/'motion-meta-v1.json']:p.write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print('6 heroes, 48 original VFX phases copied/measured')
