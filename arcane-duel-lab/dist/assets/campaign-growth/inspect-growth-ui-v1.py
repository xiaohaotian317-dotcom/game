from pathlib import Path
from PIL import Image
import json, hashlib, statistics

ROOT = Path(__file__).resolve().parent
CONFIG = {
  'ui': ('ui-icons-v1.png', 3, 2, [0,512,1024]),
  'items': ('items-v1.png',4,4,[0,250,500,750,1024]),
  'equipment': ('equipment-v1.png',4,3,[0,318,636,1024]),
  'armors': ('armors-v1.png',4,3,[0,318,650,1024]),
  'ground': ('ground-v1.png',4,3,[0,341,683,1024]),
  'platforms': ('platform-shapes-v1.png',4,3,[0,341,683,1024]),
}
THEMES=['frost','fire','poison','spider','forest','stone','sand','bloodmoon','bone','lightning','star','neutral']
result = {'version':'20261101-growth-ui-v1','units':'rect/spriteRect absolute PNG px; bbox/centerX local cell px; standingX and top/bottom normalized to cell; pixels never modified'}
checks=[]
for key,(file,cols,rows,yedges) in CONFIG.items():
    p=ROOT/file
    im=Image.open(p)
    w,h=im.size
    entry={'file':file,'size':[w,h],'cols':cols,'rows':rows,'frames':[]}
    if key in ['ground','platforms']:
        alpha=im.getchannel('A')
        hist=alpha.histogram()
        entry['alphaZeroFraction']=hist[0]/(w*h)
        entry['alphaThreshold']=200
    for i in range(cols*rows):
        c,r=i%cols,i//cols
        x0,x1=round(c*w/cols),round((c+1)*w/cols)
        y0,y1=yedges[r:r+2]
        cw,ch=x1-x0,y1-y0
        rect=[x0,y0,cw,ch]
        if key in ['ground','platforms']:
            a=alpha.crop((x0,y0,x1,y1))
            solid=a.point(lambda v:255 if v>200 else 0)
            b=solid.getbbox()
            assert b, (key,i,'empty frame')
            bx,by,br,bb=b
            bbox=[bx,by,br-bx,bb-by]
            sx=max(0,bx-3); sy=max(0,by-3)
            sr=min(cw,br+3); sb=min(ch,bb+3)
            sprite=[x0+sx,y0+sy,sr-sx,sb-sy]
            tops=[]
            for xx in range(bx+int((br-bx)*.15),br-int((br-bx)*.15)):
                hit=next((yy for yy in range(by,min(bb,by+70)) if a.getpixel((xx,yy))>200),None)
                if hit is not None: tops.append(hit)
            standing=round(statistics.median(tops))
            standx=[(bx+5)/cw,(br-5)/cw]
            frame={'index':i,'theme':THEMES[i],'rect':rect,'spriteRect':sprite,'bbox':bbox,'centerX':(bx+br)/2,'bottomNormalized':bb/ch,'topNormalized':standing/ch,'standingX':standx,'standingY':standing,'touchesCellEdge':bx<=1 or by<=1 or br>=cw-1 or bb>=ch-1}
            assert not frame['touchesCellEdge'],(key,i,'edge contact')
            assert a.getpixel((0,0))==0,(key,i,'corner alpha')
        else:
            frame={'index':i,'rect':rect,'spriteRect':rect,'bbox':[0,0,cw,ch],'centerX':cw/2,'bottomNormalized':1,'topNormalized':0,'standingX':[0,1]}
        entry['frames'].append(frame)
    result[key]=entry
    checks.append({'file':file,'size':[w,h],'mode':im.mode,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'frameCount':len(entry['frames']),'alphaZeroFraction':entry.get('alphaZeroFraction')})
(ROOT/'growth-ui-bounds-v1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'validation-ui-v1.json').write_text(json.dumps({'checks':checks,'status':'PNG decode, counts, bounds and alpha verified; art pending user acceptance'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'files':checks,'groundStandingY':[f['standingY'] for f in result['ground']['frames']],'platformStandingY':[f['standingY'] for f in result['platforms']['frames']]},ensure_ascii=False))
