"""Read-only explicit frame crops measured inside visually verified row/phase regions."""
from PIL import Image
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
rowsM=[(110,280),(325,490),(540,720),(750,945),(975,1165),(1195,1375),(1425,1590)]
cutsM=[[0,180,479,717,948],[0,180,480,714,948],[0,180,481,723,948],[0,180,476,724,948],[0,180,481,721,948],[0,180,482,723,948],[0,180,471,720,948]]
rowsR=[(75,170),(225,378),(415,545),(602,758),(805,928),(973,1130),(1160,1310),(1355,1505)]
out={}
for name,rows,cuts in [('melee-v1.png',rowsM,cutsM),('ranged-v1.png',rowsR,[[0,256,512,768,1024]]*8)]:
 im=Image.open(ROOT/name);a=im.getchannel('A');rec=[]
 for ri,(y0,y1) in enumerate(rows):
  for ci in range(4):
   x0,x1=cuts[ri][ci:ci+2];rb={'row':ri,'column':ci,'searchRect':[x0,y0,x1-x0,y1-y0],'alphaBounds':{}}
   for t in [8,16,32,64,128]:
    mask=a.crop((x0,y0,x1,y1)).point(lambda v:255 if v>t else 0);b=mask.getbbox()
    rb['alphaBounds'][str(t)]=[x0+b[0],y0+b[1],b[2]-b[0],b[3]-b[1]] if b else None
   b=rb['alphaBounds']['16'];x,y,w,h=b
   # Only source rectangles are derived. This never edits source PNG pixels.
   sx=max(0,x-4);sy=max(0,y-4);ex=min(im.width,x+w+4);ey=min(im.height,y+h+4)
   rb['sourceRect']=[sx,sy,ex-sx,ey-sy];rec.append(rb)
   print(name,ri,ci,'bounds16',b,'source',rb['sourceRect'],'body128',rb['alphaBounds']['128'])
 out[name]=rec
(ROOT/'frame-measurements.json').write_text(json.dumps(out,indent=2),encoding='utf-8')

