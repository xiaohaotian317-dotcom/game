"""Read-only original PNG alpha audit. No PNG pixels are written or changed."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parent
sources={'melee-v1.png':r'C:/Users/xiaohaotian/.codex/generated_images/01a1b188-681a-76a2-8fa2-0106444de3ea/exec-b77973af-b0ef-477f-9e97-72da5369fcbc.png','ranged-v1.png':r'C:/Users/xiaohaotian/.codex/generated_images/01a1b188-681a-76a2-8fa2-0106444de3ea/exec-c4975660-299a-420a-a805-ace1680354a1.png'}
report={}
for name,src in sources.items():
 p=ROOT/name;im=Image.open(p);a=im.getchannel('A');h=a.histogram()
 r={'sourcePath':src,'size':list(im.size),'mode':im.mode,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(Path(src).read_bytes()).hexdigest(),'alphaExtrema':list(a.getextrema()),'alphaZero':h[0],'alphaOneToEight':sum(h[1:9]),'alphaOver16':sum(h[17:]),'opaque255':h[255],'rowBands':{}}
 for threshold in [16,32,64,128]:
  mask=a.point(lambda v:255 if v>threshold else 0)
  bands=[];start=None
  for y in range(im.height):
   n=mask.crop((0,y,im.width,y+1)).histogram()[255]
   if n and start is None:start=y
   if not n and start is not None:bands.append([start,y-1]);start=None
  if start is not None:bands.append([start,im.height-1])
  r['rowBands'][str(threshold)]=bands
 report[name]=r
 print(name,json.dumps(r))
(ROOT/'alpha-overview.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

