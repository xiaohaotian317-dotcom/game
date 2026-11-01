"""Analyze source PNGs only; never changes any image pixel."""
from pathlib import Path
from PIL import Image
from collections import deque
import json,hashlib
root=Path(__file__).resolve().parents[3]/'arcane-duel-lab/dist/assets/boss-fx'
def box_of_main(mask):
 width,height=mask.size;data=bytearray(mask.tobytes());best=None
 for seed in range(len(data)):
  if not data[seed]:continue
  data[seed]=0;q=deque([seed]);area=0;left=right=seed%width;top=bottom=seed//width
  while q:
   pos=q.popleft();x=pos%width;y=pos//width;area+=1
   left=min(left,x);right=max(right,x);top=min(top,y);bottom=max(bottom,y)
   for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
    if 0<=nx<width and 0<=ny<height:
     idx=ny*width+nx
     if data[idx]:data[idx]=0;q.append(idx)
  if best is None or area>best[0]:best=(area,(left,top,right+1,bottom+1))
 return best[1] if best else (0,0,1,1)
def analyze(path,cols,rows):
 with Image.open(path) as im:
  im.load();width,height=im.size;alpha=im.getchannel('A') if 'A' in im.getbands() else None
  result={'file':path.name,'size':[width,height],'cols':cols,'rows':rows,'cellSize':[width/cols,height/rows],'frames':[]}
  result['sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
  if alpha is None:result['alphaExtrema']=None;return result
  result['alphaExtrema']=list(alpha.getextrema());result['cornerAlpha']=[alpha.getpixel(p) for p in [(0,0),(width-1,0),(0,height-1),(width-1,height-1)]]
  for i in range(cols*rows):
   c=i%cols;r=i//cols;x0,y0,x1,y1=round(c*width/cols),round(r*height/rows),round((c+1)*width/cols),round((r+1)*height/rows)
   if path.name=='platforms-v4.png':
    # The generator grouped rows inside the canvas instead of respecting equal
    # cell bands. Metadata alone isolates whole silhouettes, no pixel editing.
    xedges=[0,326,640,954,1254];ybands=[(230,500),(520,820),(840,1140)]
    x0,x1=xedges[c:c+2];y0,y1=ybands[r]
    result['frameGeometry']='explicit source rect per frame; do not infer equal cells'
   a=alpha.crop((x0,y0,x1,y1));mask=a.point(lambda v:255 if v>80 else 0)
   left,top,right,bottom=box_of_main(mask)
   f={'index':i,'rect':[x0,y0,x1-x0,y1-y0],'bbox':[left,top,right-left,bottom-top],
    'spriteRect':[x0+max(0,left-2),y0+max(0,top-2),min(x1-x0,right+2)-max(0,left-2),min(y1-y0,bottom+2)-max(0,top-2)],
    'centerX':(left+right)/2,'bottomNormalized':bottom/(y1-y0),'bottom':bottom,
    'touchesCellEdge':left<=1 or top<=1 or right>=x1-x0-1 or bottom>=y1-y0-1}
   if path.name.startswith('platforms'):
    # Read the first opaque platform pixel in central columns; median suppresses
    # snow/fine vine outliers. StandingX is normalized to cellwidth.
    points=[]
    for x in range(max(left+2,round((x1-x0)*.2)),min(right-2,round((x1-x0)*.8))):
     for y in range(y1-y0):
      if a.getpixel((x,y))>180:points.append(y);break
    points.sort();surface=points[len(points)//2] if points else top
    f['topNormalized']=surface/(y1-y0)
    f['standingX']=[(left+4)/(x1-x0),(right-4)/(x1-x0)]
    f['standingUnits']='normalized to cell width; topNormalized normalized to cell height'
   result['frames'].append(f)
  return result
units={f'B{i:02}':analyze(root/f'B{i:02}-fx-v2.png',4,4) for i in range(1,12)}
portal=analyze(root/'portal-v2.png',4,4)
bounds={'units':units,'portal':portal}
icons=analyze(root/'fire-e-icons-v2.png',2,1);bounds['fireEIcons']=icons
platform=analyze(root/'platforms-v4.png',4,3)
if platform['alphaExtrema'] and platform['alphaExtrema'][0]<=2 and max(platform['cornerAlpha'])<=2:bounds['platforms']=platform
(root/'bounds-v2.json').write_text(json.dumps(bounds,ensure_ascii=False,indent=2),encoding='utf-8')
validation=[analyze(p,4,3) if p.name.startswith('platforms') else analyze(p,2,1) if p.name.startswith('fire-e') else analyze(p,4,4) for p in sorted(root.glob('*.png'))]
(root/'validation-v2.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'units':len(units),'portal':{'alpha':portal['alphaExtrema'],'size':portal['size']},'icons':{'size':icons['size']},'platformSelected':'platforms' in bounds,'platform':{'alpha':platform['alphaExtrema'],'corner':platform.get('cornerAlpha'),'size':platform['size'],'standing':[f.get('topNormalized') for f in platform['frames']]}},ensure_ascii=False))

