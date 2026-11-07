"""Read-only image measurements and v3 metadata; never rewrites a PNG."""
from pathlib import Path
from PIL import Image
import json,hashlib,statistics
d=Path(__file__).parent
old=json.loads((d/'star-manifest-v2.json').read_text(encoding='utf-8'))
m=json.loads((d/'star-alpha-measurements-v3.json').read_text(encoding='utf-8'))
source=Path(r'C:\Users\xiaohaotian\.codex\generated_images\01a1b18b-37ec-7303-8ecf-a7109deb4557\exec-a81d0232-b5a3-4194-826c-13b25b5d126f.png')
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
assert source_hash==m['sha256']
for f,previous in zip(m['frames'],old['frames']):
    x,y,w,h=f['rect']; ax,ay=previous['center']
    f.update({k:previous[k] for k in ['phaseName','center','groundContactY','sourcePixelsPerReferenceUnit','phaseRole']})
    f.update({'sourceRect':f['rect'],'centerLocal':[ax-x,ay-y],'pivot':[ax-x,ay-y],
              'pivotNormalized':[round((ax-x)/w,6),round((ay-y)/h,6)],
              'pivotBasis':'pixels relative to rect top-left; align this to effect world anchor',
              'groundContactLocalY':ay-y if f['skill']=='R' else None,
              'groundContactYNormalized':round((ay-y)/h,6) if f['skill']=='R' else None,
              'anchorMethod':'v2 source-pixel semantic anchor retained after targeted edit visual inspection; recomputed local pivot for measured v3 rect',
              'previousV2Rect':previous['rect'],'previousV2Pivot':previous['pivot']})
m.update({
 'schema':'t39-star-fx-v3','hero':'star','created':'2026-11-07','tool':'built-in image_gen targeted edit',
 'originalGeneratedSource':str(source),'originalSha256':source_hash,'rawCopyHashMatchesOriginal':True,
 'editInput':{'file':'hero-star-fx-v2.png','sha256':old['sha256'],'status':'rejected for runtime integration because low-alpha gray-white haze was excessive; retained unchanged as edit source'},
 'promptFile':'star-prompt-v3.txt','pixelEditing':'none outside built-in image_gen; raw output copied byte-for-byte',
 'requestedFrameLayout':[4,6],'frameCount':24,'skillFrames':old['skillFrames'],
 'coordinateConvention':old['coordinateConvention'],'commonScaleRule':old['commonScaleRule'],
 'groundRule':old['groundRule'],'phaseRule':old['phaseRule'],
 'transparencyAcceptance':'Substantially cleaner candidate. Empty-space samples now zero-alpha; local low-alpha fringes still require actual dark-scene visual check by main agent.',
 'acceptance':'candidate pending main-agent integration/visual review; not user accepted',
 'previousVersion':'hero-star-fx-v2.png',
 'layoutReview':'All 24 phases remain in original 4x6 positions. Canvas remains1024x1536. F single core and ring impact, E hourglass/shield, R ground array/vertical beams preserved.',
})
m['alpha']['notice']='Raw RGBA PNG from built-in image_gen edit preserved byte-for-byte. Strong improvement in true zero-alpha area; no script alpha thresholding or pixel cleanup. Bounds at alpha>16 are diagnostic measurements only.'

def summarize(values):
    hist=[0]*256
    for v in values: hist[v]+=1
    n=len(values)
    return {'pixels':n,'zeroPixels':hist[0],'zeroFraction':hist[0]/n,'nonzeroPixels':n-hist[0],
            'alphaAbove8':sum(hist[9:]),'alphaAbove16':sum(hist[17:]),'alphaAbove64':sum(hist[65:]),
            'meanAlpha':sum(i*count for i,count in enumerate(hist))/n,'maxAlpha':max(i for i,count in enumerate(hist) if count)}
audit={}
for version in ['v2','v3']:
    image=Image.open(d/('hero-star-fx-'+version+'.png')); a=image.getchannel('A'); p=a.load()
    w,h=a.size
    seams=[]
    for y in range(h):
        for x in range(w):
            if x<4 or y<4 or x>=w-4 or y>=h-4 or any(abs(x-b)<3 for b in [256,512,768]) or any(abs(y-b)<3 for b in [256,512,768,1024,1280]):
                seams.append(p[x,y])
    corners=[]
    for row in range(6):
        for col in range(4):
            x0=col*256;y0=row*256
            for dx0 in [0,240]:
                for dy0 in [0,240]:
                    corners.extend(p[x0+x,y0+y] for x in range(dx0,dx0+16) for y in range(dy0,dy0+16))
    hist=a.histogram()
    audit[version]={'file':'hero-star-fx-'+version+'.png','size':list(image.size),'sha256':hashlib.sha256((d/('hero-star-fx-'+version+'.png')).read_bytes()).hexdigest(),
                    'allPixels':summarize(list(a.getdata())),'nominalGridSeamsAndOuter4px':summarize(seams),'sixteenPixelCellCornerPatches':summarize(corners)}
a=Image.open(d/m['file']).getchannel('A'); hashes=[]; strong=[]
for f in m['frames']:
    x,y,w,h=f['rect']; box=a.crop((x,y,x+w,y+h));p=box.load()
    hashes.append(hashlib.sha256(box.tobytes()).hexdigest())
    edge=[p[u,0] for u in range(w)]+[p[u,h-1] for u in range(w)]+[p[0,v] for v in range(h)]+[p[w-1,v] for v in range(h)]
    if max(edge)>64:strong.append({'frame':f['index'],'maxEdgeAlpha':max(edge),'countAbove64':sum(v>64 for v in edge)})
    assert 0<=f['pivot'][0]<=w and 0<=f['pivot'][1]<=h
audit['validation']={'uniqueAlphaTiles':len(set(hashes)),'strongEdgePixels':strong,'framesAndPivotsInBounds':True,'rawCopyHashMatchesOriginal':True,
                    'v2HashUnchanged':audit['v2']['sha256']==old['sha256'],'v2MetadataSourcePixelAnchorsRetainedForAll24Frames':True}
m['comparisonAuditFile']='star-alpha-comparison-v2-v3.json'
m['validation']=audit['validation']
(d/'star-alpha-comparison-v2-v3.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
(d/'star-manifest-v3.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
selection={'hero':'star','created':'2026-11-07','candidates':[
 {'file':'hero-star-fx-v2.png','status':'rejected for runtime; preserved as source','reason':'Gray-white low-alpha haze across nominal background; main-agent visual rejection','manifest':'star-manifest-v2.json','sha256':old['sha256']},
 {'file':'hero-star-fx-v3.png','status':'preferred candidate pending main-agent visual review','reason':'Built-in image_gen transparency-only edit; true alpha0 coverage substantially improved','manifest':'star-manifest-v3.json','sha256':m['sha256']}],
 'unchangedOtherHeroes':['hero-lightning-fx-v2.png','hero-shadow-fx-v2.png']}
(d/'star-selection-v3.json').write_text(json.dumps(selection,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(audit,ensure_ascii=False,indent=2))

