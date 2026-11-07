"""Read-only alpha/crop audit; no PNG writes or pixel modification."""
from PIL import Image
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parent
p=ROOT/'archive-controls-v1.png'
src=Path(r'C:/Users/xiaohaotian/.codex/generated_images/01a1b188-681a-76a2-8fa2-0106444de3ea/exec-10038f5a-2712-4424-8176-4dc7648c189c.png')
im=Image.open(p);a=im.getchannel('A');hist=a.histogram()
regions={'portraitFrame':[0,0,735,1024],'statFrame':[747,0,789,410],'transferFrame':[735,410,801,216],'xpTrack':[747,626,789,121],'upgradeButton':[747,747,789,277]}
safe={'portraitFrame':[110,155,545,705],'statFrame':[837,144,608,170],'transferFrame':[935,478,508,84],'xpTrack':[813,668,624,17],'upgradeButton':[891,821,468,85]}
out={'file':p.name,'sourcePath':str(src),'size':list(im.size),'mode':im.mode,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'alphaExtrema':list(a.getextrema()),'alphaZero':hist[0],'alphaOneToEight':sum(hist[1:9]),'alphaOver16':sum(hist[17:]),'opaque255':hist[255],'elements':{}}
for key,(x,y,w,h) in regions.items():
 r={'searchRect':[x,y,w,h],'alphaBounds':{}}
 for t in [0,8,16,32,64,128,220]:
  b=a.crop((x,y,x+w,y+h)).point(lambda v:255 if v>t else 0).getbbox()
  r['alphaBounds'][str(t)]=[x+b[0],y+b[1],b[2]-b[0],b[3]-b[1]] if b else None
 sx,sy,sw,sh=safe[key];sa=a.crop((sx,sy,sx+sw,sy+sh));hh=sa.histogram()
 r['candidateSafeRect']=safe[key];r['safeRectAlpha']={'extrema':list(sa.getextrema()),'zero':hh[0],'oneToEight':sum(hh[1:9]),'over16':sum(hh[17:]),'pixels':sw*sh}
 out['elements'][key]=r
 print(key,json.dumps(r))
(ROOT/'alpha-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print('FILE',json.dumps({k:v for k,v in out.items() if k!='elements'}))

