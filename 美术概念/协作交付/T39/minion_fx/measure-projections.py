"""Measure row-specific column extents from existing alpha, never writes PNG pixels."""
from PIL import Image
from pathlib import Path
import json
root=Path(__file__).resolve().parent
rows={'melee-v1.png':[(125,263),(341,474),(558,705),(769,930),(991,1150),(1209,1360),(1440,1573)],'ranged-v1.png':[(86,157),(240,363),(429,531),(616,745),(819,914),(986,1118),(1175,1298),(1368,1492)]}
out={}
for name,bands in rows.items():
 a=Image.open(root/name).getchannel('A');w,h=a.size;m=a.point(lambda v:255 if v>16 else 0);r=[]
 for i,(y0,y1) in enumerate(bands):
  runs=[];s=None;counts=[]
  for x in range(w):
   n=m.crop((x,y0,x+1,y1)).histogram()[255];counts.append(n)
   if n and s is None:s=x
   if not n and s is not None:runs.append([s,x-1]);s=None
  if s is not None:runs.append([s,w-1])
  r.append({'row':i,'yBand':[y0,y1],'columnRuns16':runs,'lowValleys':[[x,counts[x]] for x in range(w) if x%10==0]})
  print(name,i,runs)
 out[name]=r
(root/'projection-audit.json').write_text(json.dumps(out,indent=2),encoding='utf-8')

