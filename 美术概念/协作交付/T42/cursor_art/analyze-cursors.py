"""Read-only cursor alpha/crop/radius audit; no PNG writes or resampling."""
from pathlib import Path
from PIL import Image
from statistics import median
import json,hashlib,math
ROOT=Path(__file__).resolve().parent
p=ROOT/'hero-cursors-v1.png';src=Path(r'C:/Users/xiaohaotian/.codex/generated_images/01a1b188-681a-76a2-8fa2-0106444de3ea/exec-6bcfac77-6e31-4f47-ba0c-8ab767b4600c.png')
im=Image.open(p);w,h=im.size;a=im.getchannel('A');pix=im.load();hist=a.histogram()
# Planned cells are used only to isolate each subject. Final crops are explicit alpha bounds.
heroes=['fire','nature','frost','lightning','shadow','star']
visualCenters=[[276,267],[766,267],[1262,266],[276,779],[767,779],[1262,779]]
out={'file':p.name,'sourcePath':str(src),'size':[w,h],'mode':im.mode,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'alphaExtrema':list(a.getextrema()),'alphaZero':hist[0],'alphaOneToEight':sum(hist[1:9]),'alphaOver16':sum(hist[17:]),'frames':[]}
for i,hero in enumerate(heroes):
 col=i%3;row=i//3;x0=col*512;y0=row*512;x1=x0+512;y1=y0+512
 rec={'hero':hero,'plannedCell':[x0,y0,512,512],'alphaBounds':{}}
 pts=[];pts128=[]
 for threshold in [8,16,32,64,128]:
  b=a.crop((x0,y0,x1,y1)).point(lambda v:255 if v>threshold else 0).getbbox()
  rec['alphaBounds'][str(threshold)]=[x0+b[0],y0+b[1],b[2]-b[0],b[3]-b[1]] if b else None
 bx,by,bw,bh=rec['alphaBounds']['16'];sx=max(x0,bx-4);sy=max(y0,by-4);ex=min(x1,bx+bw+4);ey=min(y1,by+bh+4)
 rec['sourceRect']=[sx,sy,ex-sx,ey-sy]
 for yy in range(by,by+bh):
  for xx in range(bx,bx+bw):
   aa=pix[xx,yy][3]
   if aa>16:pts.append((xx,yy))
   if aa>128:pts128.append((xx,yy))
 cx,cy=visualCenters[i]
 rec['center']=[cx,cy];rec['pivot']=[cx,cy];rec['pivotLocal']=[cx-sx,cy-sy]
 rec['outerRadius16']=max(math.hypot(xx-cx,yy-cy) for xx,yy in pts)
 rec['outerRadius128']=max(math.hypot(xx-cx,yy-cy) for xx,yy in pts128)
 inner=min(math.hypot(xx-cx,yy-cy) for xx,yy in pts)
 rec['clearCenterRadius16']=inner;rr=max(1,math.floor(inner)-2)
 hp=[a.getpixel((xx,yy)) for yy in range(cy-rr,cy+rr+1) for xx in range(cx-rr,cx+rr+1) if (xx-cx)**2+(yy-cy)**2<=rr*rr]
 rec['safeHollowCircle']=[cx,cy,rr];rec['safeHollowAlphaMax']=max(hp);rec['centerPixelAlpha']=a.getpixel((cx,cy))
 lum=[]
 for xx,yy in pts128:
  r,g,b,aa=pix[xx,yy];lum.append(.2126*r+.7152*g+.0722*b)
 lum.sort();rec['materialLumaMean']=sum(lum)/len(lum);rec['materialLumaP95']=lum[round((len(lum)-1)*.95)]
 out['frames'].append(rec)
 print(hero,json.dumps(rec))
(ROOT/'alpha-cursor-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print('FILE',json.dumps({k:v for k,v in out.items() if k!='frames'}))

