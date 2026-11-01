"""Read-only image alpha analysis; never edits generated PNG pixels."""
from pathlib import Path
from PIL import Image
import json, hashlib

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / 'arcane-duel-lab/dist/assets/campaign-growth'
HEROES = ['fire','nature','frost','lightning','shadow','star']
ROWS = {'fire':[0,390,655,1024], 'nature':[0,320,680,1024], 'frost':[0,345,640,1024], 'lightning':[0,350,640,1024], 'shadow':[0,335,650,1024], 'star':[0,310,650,1024]}
out={'version':'growth-heroes-v1','alphaThreshold':16,'note':'Original generated pixels preserved. Explicit rects account for natural row spacing; consumers must use rect/spriteRect rather than inferring equal row cuts. bbox is local to rect; centerX is local px; bottomNormalized is relative to rect height.','units':{},'icons':{}}
audit=[]
for hero in HEROES:
    p=ASSETS/f'hero-{hero}-fx-v1.png'
    if p.exists():
        im=Image.open(p); a=im.getchannel('A'); hist=a.histogram()
        frames=[]
        for i in range(12):
            row,col=divmod(i,4); x=col*384; y=ROWS[hero][row]; w=384; h=ROWS[hero][row+1]-y
            cell=a.crop((x,y,x+w,y+h)); box=cell.point(lambda v:255 if v>=16 else 0).getbbox() or (0,0,w,h)
            l,t,r,b=box
            frames.append({'rect':[x,y,w,h],'spriteRect':[x+l,y+t,r-l,b-t],'bbox':[l,t,r-l,b-t],'centerX':round((l+r)/2,2),'bottomNormalized':round(b/h,6)})
        out['units'][hero]={'file':p.name,'size':list(im.size),'cols':4,'rows':3,'frames':frames}
        audit.append({'hero':hero,'kind':'fx','file':p.name,'size':list(im.size),'mode':im.mode,'alphaRange':list(a.getextrema()),'zeroAlphaRatio':round(hist[0]/im.width/im.height,6),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    p=ASSETS/f'hero-{hero}-icons-v1.png'
    if p.exists():
        im=Image.open(p)
        out['icons'][hero]={'file':p.name,'size':list(im.size),'cols':3,'rows':1}
        audit.append({'hero':hero,'kind':'icons','file':p.name,'size':list(im.size),'mode':im.mode,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(ASSETS/'growth-hero-bounds-v1.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
(Path(__file__).parent/'hero-validation-v1.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'units':list(out['units']),'icons':list(out['icons']),'audit':audit},ensure_ascii=False))
