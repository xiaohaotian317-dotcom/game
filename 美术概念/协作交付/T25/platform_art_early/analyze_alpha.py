"""Read-only PNG analysis for T25 platform delivery; does not save or alter images."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import statistics

BASE = Path(__file__).resolve().parent
manifest_path = BASE / 'delivery.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def bbox_at(alpha, box, threshold):
    crop = alpha.crop(box)
    mask = crop.point(lambda value: 255 if value >= threshold else 0)
    rect = mask.getbbox()
    if rect is None:
        return None
    return [rect[0]+box[0], rect[1]+box[1], rect[2]+box[0], rect[3]+box[1]]

for item in manifest['files']:
    path = BASE / item['file']
    with Image.open(path) as im:
        im.load()
        alpha = im.getchannel('A')
        item['destinationPath'] = str(path)
        item['size'] = list(im.size)
        item['mode'] = im.mode
        item['bytes'] = path.stat().st_size
        item['sha256'] = sha256(path)
        item['sourceSha256'] = sha256(Path(item['sourcePath']))
        item['sourceBytesIdentical'] = item['sourceSha256'] == item['sha256']
        hist = alpha.histogram()
        item['alpha'] = {
            'min':alpha.getextrema()[0], 'max':alpha.getextrema()[1],
            'zeroPixels':hist[0], 'totalPixels':im.width*im.height,
            'pixelsAtLeast16':sum(hist[16:]), 'pixelsAtLeast200':sum(hist[200:]),
            'samples':{str(p):im.getpixel(p)[3] for p in [(0,0),(768,0),(768,128),(400,250),(400,520),(768,1000),(1535,1023)]},
            'centralGutterX740to796Max':alpha.crop((740,0,796,1024)).getextrema()[1],
            'rowGutterMaxes':[alpha.crop((0,y-10,1536,y+10)).getextrema()[1] for y in [256,512,768]]
        }
        frames = []
        for row in range(4):
            for col in range(2):
                cell = [col*768,row*256,(col+1)*768,(row+1)*256]
                bounds = {str(t):bbox_at(alpha,cell,t) for t in [1,8,16,64,200]}
                solid = bounds['16']
                padded = [max(cell[0],solid[0]-6),max(cell[1],solid[1]-6),min(cell[2],solid[2]+6),min(cell[3],solid[3]+6)]
                x0 = int(solid[0]+(solid[2]-solid[0])*.2)
                x1 = int(solid[0]+(solid[2]-solid[0])*.8)
                tops = []
                for x in range(x0,x1):
                    ys = [y for y in range(cell[1],cell[3]) if alpha.getpixel((x,y)) >= 200]
                    if ys:
                        tops.append(ys[0])
                median_top = int(statistics.median(tops))
                # The recommended standing line is a conservative top-surface anchor.
                # The 4 px offset enters the flat painted tread rather than using antialias fringe.
                stand_y = median_top+4
                stage = item['stageRows'][row]['stage']
                frames.append({
                    'id':f'stage{stage:02d}-' + ('a' if col==0 else 'b'),
                    'theme':item['stageRows'][row]['theme'],
                    'variant':item['stageRows'][row]['variants'][col],
                    'cellRectXYWH':[cell[0],cell[1],768,256],
                    'alphaBoundsLTRBByThreshold':bounds,
                    'recommendedCropRectXYWH':[padded[0],padded[1],padded[2]-padded[0],padded[3]-padded[1]],
                    'cropPolicy':'建议运行时drawImage源矩形；不改写原PNG。6px边缘padding基于alpha>=16主体界限，低alpha抗锯齿请以实际renderer复核。',
                    'solidWidthHeight':[solid[2]-solid[0],solid[3]-solid[1]],
                    'solidAspectRatio':round((solid[2]-solid[0])/(solid[3]-solid[1]),3),
                    'centralTopAlpha200MedianY':median_top,
                    'centralTopAlpha200MinMaxY':[min(tops),max(tops)],
                    'recommendedStandingLineYInAtlas':stand_y,
                    'recommendedStandingLineYInCrop':stand_y-padded[1],
                    'recommendedStandingAnchorXYInAtlas':[(solid[0]+solid[2])/2,stand_y],
                    'recommendedStandingAnchorUVInCrop':[round(((solid[0]+solid[2])/2-padded[0])/(padded[2]-padded[0]),4),round((stand_y-padded[1])/(padded[3]-padded[1]),4)],
                    'standableCentralSpanXInAtlas':[solid[0]+12,solid[2]-12],
                    'standingLineBasis':'中心60%宽度内alpha>=200首行的中位数+4px；建议值，主Agent仍应目视校准前缘与实际碰撞。',
                    'belowStandingLinePixels':solid[3]-stand_y,
                })
        item['frames'] = frames
manifest['analysisMethod'] = 'Pillow读取RGBA与alpha；按两列四行固定cell分别测threshold 1/8/16/64/200 bbox；未对PNG做任何写入。'
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'files':[{
    'file':item['file'],'size':item['size'],'sha256':item['sha256'],'sourceBytesIdentical':item['sourceBytesIdentical'],
    'alpha':item['alpha'],
    'frames':[{k:f[k] for k in ['id','recommendedCropRectXYWH','solidWidthHeight','centralTopAlpha200MinMaxY','recommendedStandingLineYInAtlas','recommendedStandingLineYInCrop','belowStandingLinePixels']} for f in item['frames']]
} for item in manifest['files']]},ensure_ascii=False,indent=2))
