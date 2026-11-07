"""Read-only alpha/projection inspection. Never changes PNG bytes."""
from PIL import Image
import hashlib,json,sys
from pathlib import Path

src=Path(sys.argv[1]); dst=Path(sys.argv[2])
im=Image.open(src).convert('RGBA'); w,h=im.size
a=im.getchannel('A'); hist=a.histogram()
threshold=16
mask=a.point(lambda v:255 if v>threshold else 0)
px=mask.load()
def valleys(axis,fixed0,fixed1,nominals,radius):
    limits=[0]
    samples=[]
    for nominal in nominals:
        lo=max(limits[-1]+1,nominal-radius); hi=min((w if axis=='x' else h)-1,nominal+radius)
        costs=[]
        for p in range(lo,hi+1):
            if axis=='x': cost=sum(px[x,y]>0 for x in range(max(0,p-1),min(w,p+2)) for y in range(fixed0,fixed1))
            else: cost=sum(px[x,y]>0 for y in range(max(0,p-1),min(h,p+2)) for x in range(fixed0,fixed1))
            costs.append((cost,abs(p-nominal),p))
        cost,_,p=min(costs)
        limits.append(p); samples.append({'nominal':nominal,'measured':p,'threePixelOccupancy':cost})
    limits.append(w if axis=='x' else h)
    return limits,samples
ys,ygaps=valleys('y',0,w,[round(h*i/6) for i in range(1,6)],30)
frames=[]; xgaps=[]
for row in range(6):
    y0,y1=ys[row:row+2]
    xs,gaps=valleys('x',y0,y1,[round(w*i/4) for i in range(1,4)],28)
    xgaps.append({'row':row,'gaps':gaps})
    for col in range(4):
        x0,x1=xs[col:col+2]
        rect=[x0,y0,x1-x0,y1-y0]
        bb=mask.crop((x0,y0,x1,y1)).getbbox()
        if bb: bb=[x0+bb[0],y0+bb[1],bb[2]-bb[0],bb[3]-bb[1]]
        core=a.point(lambda v:255 if v>64 else 0).crop((x0,y0,x1,y1)).getbbox()
        if core: core=[x0+core[0],y0+core[1],core[2]-core[0],core[3]-core[1]]
        counts=[sum(px[x,y]>0 for x in range(x0,x1)) for y in range(y0,y1)]
        search0=max(y0,y1-85)
        ground=max(range(search0,y1),key=lambda y:counts[y-y0]) if row>=4 else None
        frames.append({'index':row*4+col,'skill':'FER'[row//2],'phase':(row%2)*4+col,'rect':rect,'spriteRect':bb,'coreAlpha64Rect':core,'groundProjectionPeakY':ground,'alpha16Pixels':sum(counts)})
data={'file':src.name,'sourceImage':str(src),'size':[w,h],'mode':im.mode,'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'bytes':src.stat().st_size,'alpha':{'minMax':a.getextrema(),'zeroPixels':hist[0],'opaquePixels':hist[255],'intermediatePixels':sum(hist[1:255]),'belowOrEqual10Fraction':sum(hist[:11])/sum(hist),'belowOrEqual16Fraction':sum(hist[:17])/sum(hist),'thresholdForBounds':threshold,'notice':'PNG kept byte-for-byte; low nonzero alpha fog remains in nominal empty regions. Rects measured at alpha>16, not asserted fully zero-alpha gutters.'},'rowGapMeasurement':ygaps,'columnGapMeasurements':xgaps,'frames':frames}
dst.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'file':src.name,'sha256':data['sha256'],'rows':ys,'frames':[{'i':f['index'],'rect':f['rect'],'sprite':f['spriteRect'],'ground':f['groundProjectionPeakY']} for f in frames]},ensure_ascii=False,indent=2))

