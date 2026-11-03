"""Read-only RGBA/crop analysis; this script never writes image pixels."""
from pathlib import Path
from PIL import Image
import hashlib,json,statistics
BASE=Path(__file__).resolve().parent
manifest_path=BASE/'delivery.json'
data=json.loads(manifest_path.read_text(encoding='utf-8'))
item=data['selected']
path=BASE/item['file']
digest=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def bbox_at(alpha,rect,threshold):
    bb=alpha.crop(rect).point(lambda v:255 if v>=threshold else 0).getbbox()
    return None if bb is None else [bb[0]+rect[0],bb[1]+rect[1],bb[2]+rect[0],bb[3]+rect[1]]
with Image.open(path) as im:
    im.load()
    a=im.getchannel('A')
    w,h=im.size
    xs=[round(w*i/4) for i in range(5)]
    ys=[round(h*i/4) for i in range(5)]
    item.update(destinationPath=str(path),size=list(im.size),mode=im.mode,bytes=path.stat().st_size,sha256=digest(path),sourceSha256=digest(item['sourcePath']))
    item['sourceBytesIdentical']=item['sha256']==item['sourceSha256']
    hist=a.histogram()
    item['alphaSummary']={'min':a.getextrema()[0],'max':a.getextrema()[1],'zeroPixels':hist[0],'totalPixels':w*h,'pixelsAtLeast16':sum(hist[16:]),'gridBoundsX':xs,'gridBoundsY':ys}
    item['frames']=[]
    for n,name in enumerate(data['items']):
        row,col=divmod(n,4)
        rect=[xs[col],ys[row],xs[col+1],ys[row+1]]
        bounds={str(t):bbox_at(a,rect,t) for t in [1,8,16,64,200]}
        rec={'index':n,'row':row+1,'column':col+1,'name':name,'cellRectXYWH':[rect[0],rect[1],rect[2]-rect[0],rect[3]-rect[1]],'alphaBoundsLTRBByThreshold':bounds,'cellAlphaMinMax':list(a.crop(rect).getextrema())}
        if name is not None:
            bb=bounds['16']
            padded=[max(rect[0],bb[0]-5),max(rect[1],bb[1]-5),min(rect[2],bb[2]+5),min(rect[3],bb[3]+5)]
            base=bounds['200']
            baseY=base[3]-1
            # The bottommost opaque contact x is a useful optional exact contact anchor.
            contactXs=[]
            for y in range(max(base[1],baseY-2),baseY+1):
                for x in range(base[0],base[2]):
                    if a.getpixel((x,y))>=200:
                        contactXs.append(x)
            centerX=(bb[0]+bb[2])/2
            rec.update(
                recommendedCropRectXYWH=[padded[0],padded[1],padded[2]-padded[0],padded[3]-padded[1]],
                solidWidthHeight=[bb[2]-bb[0],bb[3]-bb[1]],
                cellMarginPixelsLTRB=[bb[0]-rect[0],bb[1]-rect[1],rect[2]-bb[2],rect[3]-bb[3]],
                recommendedBottomAnchorXYInAtlas=[centerX,baseY],
                recommendedBottomAnchorXYInCrop=[centerX-padded[0],baseY-padded[1]],
                recommendedBottomAnchorUVInCrop=[round((centerX-padded[0])/(padded[2]-padded[0]),4),round((baseY-padded[1])/(padded[3]-padded[1]),4)],
                optionalOpaqueContactXYInAtlas=[statistics.median(contactXs),baseY],
                cropBasis='alpha>=16主体bbox外加5px，只建议运行时drawImage源矩形；原PNG未裁切。',
                anchorBasis='alpha>=200实体底行作为落地高度，x使用主体bbox中心；斜镜/斜剑可参考optionalOpaqueContact。'
            )
        item['frames'].append(rec)
    item['emptyFinalCell']={'rectXYWH':item['frames'][-1]['cellRectXYWH'],'alphaMinMax':item['frames'][-1]['cellAlphaMinMax'],'hasSemanticPixelsAlphaAtLeast8':bounds['8'] is not None}
for rejected in data['rejectedGenerations']:
    rejected['sha256']=digest(rejected['sourcePath'])
data['analysisMethod']='Pillow只读RGBA/alpha，逐格测threshold1/8/16/64/200边界，5px crop padding；仅JSON写入，不修改任何PNG。'
approval_note='原图尺寸经主Agent确认可接受1254×1254，以实际rect接入；不再为1024目标重生或脚本缩放。'
if approval_note not in data['reviewNotes']:
    data['reviewNotes'].append(approval_note)
manifest_path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'size':item['size'],'sha256':item['sha256'],'sourceBytesIdentical':item['sourceBytesIdentical'],'alphaSummary':item['alphaSummary'],'emptyFinalCell':item['emptyFinalCell'],'frames':[{k:f[k] for k in ['index','name','recommendedCropRectXYWH','solidWidthHeight','recommendedBottomAnchorXYInCrop','optionalOpaqueContactXYInAtlas']} for f in item['frames'] if f['name'] is not None]},ensure_ascii=False,indent=2))
