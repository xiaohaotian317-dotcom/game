"""Read original PNGs and generation records; write JSON/text measurements only.
No image pixels are changed and no derived PNG is exported.
"""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCE = Path(r'C:\Users\xiaohaotian\.codex\generated_images\01a19502-6b46-7212-827d-e8af8462d8a2')
SESSION = Path(r'C:\Users\xiaohaotian\.codex\sessions\2026\11\01\rollout-2026-11-01T10-48-46-01a19502-6b46-7212-827d-e8af8462d8a2.jsonl')
NAMES = ['暮潮沉港','赤晶矿窟','腐钟苔渠','烬羽焚城','镜渊回廊','沙漏王陵','噬月巢穴','苍雷机城','蚀日王座']
BOSSES = ['深潮锚王','裂晶巨蜥','孢冠沼母','烬翼审判官','千面镜姬','时砂圣甲','噬月螳皇','雷铸巨像','蚀日双相王']

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def rect(bounds):
    x0,y0,x1,y1=map(int,bounds); return [x0,y0,x1-x0,y1-y0]
def bounds(mask, ox=0, oy=0):
    yy,xx=np.where(mask)
    return [int(xx.min())+ox,int(yy.min())+oy,int(xx.max())+1+ox,int(yy.max())+1+oy]
def stats(a, r):
    x,y,w,h=r; v=a[y:y+h,x:x+w]
    return {'min':int(v.min()),'max':int(v.max()),'over16':int(np.sum(v>16)),'over128':int(np.sum(v>128)),'pixels':int(v.size)}
def point_local(pt,r): return [round(pt[0]-r[0],3),round(pt[1]-r[1],3)]
def rect_local(r,s): return [r[0]-s[0],r[1]-s[1],r[2],r[3]]
def clean_rect(a, candidate, min_height=8):
    """Largest fully alpha<=16 rectangle inside a visually selected opening."""
    x0,y0,w,h=candidate; heights=[0]*w;best=(0,None)
    for yy in range(h):
        for xx in range(w):heights[xx]=heights[xx]+1 if a[y0+yy,x0+xx]<=16 else 0
        stack=[]
        for xx in range(w+1):
            level=heights[xx] if xx<w else 0;start=xx
            while stack and stack[-1][1]>level:
                sx,hh=stack.pop();area=hh*(xx-sx)
                if hh>=min_height and area>best[0]:best=(area,[x0+sx,y0+yy-hh+1,xx-sx,hh])
                start=sx
            if not stack or stack[-1][1]<level:stack.append((start,level))
    return best[1] or candidate

def seam(a, target, delta=32):
    """Transparent inter-row source clipping seam; path changes at most 1 px/column."""
    h,w=a.shape; lo=max(0,target-delta);hi=min(h-1,target+delta)
    ys=np.arange(lo,hi+1); n=len(ys)
    # Alpha cost dominates a very small preference for the nominal divider.
    cost=(a[lo:hi+1,:].astype(float)/16)**2 + abs(ys[:,None]-target)*.002
    prev=cost[:,0].copy(); back=np.zeros((n,w),dtype=np.int16)
    for x in range(1,w):
        vals=np.stack([np.r_[np.inf,prev[:-1]],prev,np.r_[prev[1:],np.inf]])
        pick=np.argmin(vals,axis=0); back[:,x]=np.arange(n)+pick-1
        prev=vals[pick,np.arange(n)]+cost[:,x]
    p=int(np.argmin(prev)); out=[0]*w
    for x in range(w-1,-1,-1): out[x]=int(ys[p]);p=int(back[p,x]) if x else p
    return out

def compress_spans(top,bottom,ox=0):
    # Each [sourceX,width,sourceY,height] is an ownership clip rectangle.
    out=[];start=0
    for x in range(1,len(top)+1):
        if x==len(top) or (top[x],bottom[x])!=(top[start],bottom[start]):
            out.append([start+ox,x-start,int(top[start]),int(bottom[start]-top[start])]);start=x
    return out

def isolated_rows(a, cols, rows):
    h,w=a.shape; result=[]
    for c in range(cols):
        x0=round(c*w/cols);x1=round((c+1)*w/cols);sub=a[:,x0:x1]
        cuts=[[0]*(x1-x0)]+[seam(sub,round(r*h/rows),75 if cols==1 and rows==9 else 32) for r in range(1,rows)]+[[h]*(x1-x0)]
        for row in range(rows):
            top=cuts[row];bottom=cuts[row+1];owned=np.zeros_like(sub,dtype=bool)
            for x in range(x1-x0):owned[top[x]:bottom[x],x]=True
            b=bounds((sub>16)&owned,x0,0);r=rect([max(x0,b[0]-4),max(0,b[1]-4),min(x1,b[2]+4),min(h,b[3]+4)])
            result.append((row*cols+c,{'sourceRect':r,'materialBounds16':rect(b),'sourceClipSpans':compress_spans(top,bottom,x0),'clipConvention':'[sourceX,width,sourceY,height], intersect with sourceRect; apply as source mask before drawImage to exclude neighboring ornaments, never change original PNG'}))
    return [v for _,v in sorted(result)]

events={}
for line in SESSION.open(encoding='utf-8'):
    d=json.loads(line);it=d.get('payload',{}).get('item',{})
    if it.get('kind')=='image_gen.generation':events[it['id']]=it
sources={sha(p):p for p in SOURCE.glob('*.png')}
assets={};prompts=[]
for p in sorted(ROOT.glob('*.png')):
    im=Image.open(p);s=sha(p);src=sources.get(s);ev=events.get(src.stem,{}) if src else {}
    prompt=ev.get('revisedPrompt','');promptname='prompt-'+p.stem+'.txt'
    if prompt:(ROOT/promptname).write_text(prompt+'\n',encoding='utf-8')
    meta={'file':p.name,'size':list(im.size),'mode':im.mode,'bytes':p.stat().st_size,'sha256':s,'sourcePath':str(src) if src else None,'sourceSha256':sha(src) if src else None,'originalPngBytesPreserved':src is not None and sha(src)==s,'promptPath':promptname,'promptRecovery':'Full revisedPrompt recovered from the matching original built-in image_gen generation event; not reconstructed from the artwork.','generationId':ev.get('id'),'transparentBackground':ev.get('transparentBackground'),'sourceRecordPath':str(SESSION)}
    if im.mode=='RGBA':
        a=np.array(im.getchannel('A'));meta.update(alphaExtrema=[int(a.min()),int(a.max())],alphaZero=int(np.sum(a==0)),alphaOver16=int(np.sum(a>16)),materialBounds16=rect(bounds(a>16)))
    assets[p.name]=meta;prompts.append({'file':p.name,'sourcePath':meta['sourcePath'],'generationId':meta['generationId'],'prompt':prompt,'inputImages':ev.get('inputImages',[])})
(ROOT/'prompts-recovered-v1.json').write_text(json.dumps({'generator':'built-in image_gen','sourceRecordPath':str(SESSION),'assets':prompts},ensure_ascii=False,indent=2),encoding='utf-8')

meta=json.loads((ROOT/'scene-meta-v1.json').read_text(encoding='utf-8'))
meta.update(schema=2,date='2026-11-09',status='Original PNGs measured and provenance recovered; pending primary-agent integration, runtime QA, and user art acceptance',assets=assets)
meta['coordinateConvention']='All rects [x,y,width,height], points/pivots/groundContactY absolute original PNG pixels unless Local/Normalized suffix; do not assume equal-grid crop. sourceClipSpans are read-only source clipping domains.'
meta['generator']={'mode':'built-in image_gen','noPixelEdits':True,'sourcePngBytesPreserved':True,'analysisScript':'measure-scene-v1.py'}
meta['stages']={str(i+12):{'id':i+12,'name':NAMES[i],'file':f'chapter2-stage{i+12}-v1.png','size':[1659,948],'sourceRect':[0,0,1659,948],'pivot':[829.5,474],'backgroundOnly':True,'groundContactY':None,'collisionNote':'Painted scenery has no collision. Use measured terrain sprites and existing reachable platform routes; never infer a standing surface from the painted perspective water/floor.','quietCombatBandRect':[0,505,1659,290]} for i in range(9)}

for key,file,cols,rows in [('platforms','chapter2-platforms-v1.png',3,6),('ground','chapter2-ground-v1.png',3,3),('nameplates','chapter2-title-plates-v1.png',2,6),('bossHuds','chapter2-boss-hud-v1.png',1,9),('warnings','chapter2-warning-rings-v1.png',3,3)]:
    a=np.array(Image.open(ROOT/file).getchannel('A'));entries=isolated_rows(a,cols,rows)
    for i,e in enumerate(entries):
        e['file']=file;e['size']=list(a.shape[::-1]);r=e['sourceRect'];e['pivot']=[r[0]+r[2]/2,r[1]+r[3]/2];e['pivotLocal']=point_local(e['pivot'],r)
    meta[key]=entries

# Platform pair order follows the prompt: stage12 A/B, stage13 A/B, etc.
platform_y=[80,79,80,283,282,281,486,486,486,686,681,681,879,879,879,1070,1071,1070]
for i,e in enumerate(meta['platforms']):
    b=e['materialBounds16'];x=b[0]+13;right=b[0]+b[2]-13;y=platform_y[i]
    e.update(stage=12+i//2,name=NAMES[i//2],variant='AB'[i%2],standingSpan=[x,right],standingX=[x,right],standingY=y,groundContactY=y,pivot=[(x+right)/2,y],standingSpanLocal=[x-b[0],right-b[0]],groundContactYLocal=y-b[1],topNormalized=round((y-b[1])/b[3],6),standingXNormalized=[round((x-b[0])/b[2],6),round((right-b[0])/b[2],6)],collisionNote='Standing span is the measured flat top edge excluding bevel end caps. Keep this edge fixed; lower decorations may be compressed according to the next support distance.')
    e['pivotLocal']=point_local(e['pivot'],e['sourceRect']);e['groundContactYLocal']=y-e['sourceRect'][1];e['standingSpanLocal']=[x-e['sourceRect'][0],right-e['sourceRect'][0]];e['topNormalized']=round(e['groundContactYLocal']/e['sourceRect'][3],6);e['standingXNormalized']=[round(v/e['sourceRect'][2],6) for v in e['standingSpanLocal']]
ground_y=[124,123,123,516,516,516,935,935,935]
for i,e in enumerate(meta['ground']):
    b=e['materialBounds16'];x=b[0]+22;right=b[0]+b[2]-22;y=ground_y[i]
    e.update(stage=12+i,name=NAMES[i],standingSpan=[x,right],standingX=[x,right],standingY=y,groundContactY=y,pivot=[(x+right)/2,y],standingSpanLocal=[x-b[0],right-b[0]],groundContactYLocal=y-b[1],topNormalized=round((y-b[1])/b[3],6),standingXNormalized=[round((x-b[0])/b[2],6),round((right-b[0])/b[2],6)],tileJoinNote='The original is a perspective top+front chunk, not an edge-seamless texture. Repeat only measured interior standing span and overlap side bevels; no pixel repair was performed.')
    e['pivotLocal']=point_local(e['pivot'],e['sourceRect']);e['groundContactYLocal']=y-e['sourceRect'][1];e['standingSpanLocal']=[x-e['sourceRect'][0],right-e['sourceRect'][0]];e['topNormalized']=round(e['groundContactYLocal']/e['sourceRect'][3],6);e['standingXNormalized']=[round(v/e['sourceRect'][2],6) for v in e['standingSpanLocal']]

title_safe=[[140,122,362,42],[760,122,357,40],[147,338,345,35],[767,337,347,37],[146,547,345,38],[771,540,342,38],[145,754,345,37],[765,752,351,38],[144,957,354,38],[765,955,351,39],[163,1156,316,34],[752,1155,376,34]]
for i,e in enumerate(meta['nameplates']):
    al=np.array(Image.open(ROOT/e['file']).getchannel('A'))
    e.update(stage=12+i if i<11 else None,name=(NAMES+['轮回裂隙','王座试炼','备用通用框'])[i],safeRect=clean_rect(al,title_safe[i],25),groundContactY=None)
    e['safeRectLocal']=rect_local(e['safeRect'],e['sourceRect']);e['safeAlpha']=stats(al,e['safeRect'])

centers=[108,306,500,696,889,1082,1275,1468,1663]
# Conservative legible text sub-opening; full track is also supplied for live DOM overlays.
name_safe=[[400,83,130,10],[260,278,400,12],[410,464,165,17],[260,668,200,13],[260,860,200,13],[260,1053,200,10],[260,1244,200,12],[270,1429,190,14],[260,1634,200,15]]
for i,e in enumerate(meta['bossHuds']):
    al=np.array(Image.open(ROOT/e['file']).getchannel('A'))
    cy=centers[i];avatar=[147,cy,51];hp=[243,cy+24,523,16]
    name=clean_rect(al,[250,cy-37,435,28],12);hpsafe=clean_rect(al,[243,cy+17,523,22],8)
    e.update(stage=12+i,bossId=f'B{12+i}',name=BOSSES[i],avatarCircle=avatar,avatarSafeRect=[112,cy-35,70,70],nameRect=[259,cy-31,408,20],nameSafeRect=name,hpRect=hp,hpSafeRect=hpsafe,safeRect=name,groundContactY=None)
    for k in ['avatarSafeRect','nameRect','nameSafeRect','hpRect','hpSafeRect','safeRect']:e[k+'Local']=rect_local(e[k],e['sourceRect'])
    e['avatarCircleLocal']=[147-e['sourceRect'][0],cy-e['sourceRect'][1],51]
    e['safeAlpha']={k:stats(al,e[k]) for k in ['nameSafeRect','hpSafeRect','avatarSafeRect']}
    e['domOverlayNote']='Empty portrait and long HP opening are for true portrait/vitals. The narrow name track contains intentional center crest/filigree: use the conservative nameSafeRect or place readable live text above the shell; do not describe the entire nameRect as fully transparent.'

for entries in [meta['bossHuds'],meta['nameplates']]:
    for i,e in enumerate(entries):
        # A deliberately reduced rectangle avoids ALL material from the adjacent
        # row at the same horizontal position. Full ornaments use the source mask.
        samecol=[v for v in entries if abs(v['pivot'][0]-e['pivot'][0])<180]
        samecol.sort(key=lambda v:v['pivot'][1]);j=samecol.index(e)
        prev=samecol[j-1]['materialBounds16'] if j else None
        nxt=samecol[j+1]['materialBounds16'] if j+1<len(samecol) else None
        x,y,w,h=e['sourceRect'];lo=max(y,prev[1]+prev[3]+2) if prev else y;hi=min(y+h,nxt[1]-2) if nxt else y+h
        e['conservativeNoNeighborRect']=[x,lo,w,max(0,hi-lo)]
        e['conservativeNoNeighborRectNote']='Unmasked fallback crop with no adjacent-row alpha>16 material; intentionally trims projecting outer ornaments. Use sourceRect + sourceClipSpans for complete art. Conservative safe windows remain supplied separately.'
        e['conservativeSafeRectsLocal']={k:rect_local(e[k],e['conservativeNoNeighborRect']) for k in ['safeRect','nameSafeRect','hpSafeRect','avatarSafeRect'] if k in e}
        if 'avatarCircle' in e:e['conservativeAvatarCircleLocal']=[e['avatarCircle'][0]-x,e['avatarCircle'][1]-lo,e['avatarCircle'][2]]

ring_centers=[[215,249],[628,252],[1043,251],[208,635],[626,635],[1045,636],[211,1027],[627,1027],[1044,1027]]
ring_radii=[[194,109],[189,108],[196,107],[190,111],[194,108],[200,109],[193,108],[199,107],[195,110]]
for i,e in enumerate(meta['warnings']):
    p=ring_centers[i];rad=ring_radii[i];e.update(stage=12+i,bossId=f'B{12+i}',name=NAMES[i],pivot=p,groundContactY=p[1],center=p,ellipse={'center':p,'radiusX':rad[0],'radiusY':rad[1]},dangerRadiusPx=rad[0],radiusX=rad[0],radiusY=rad[1],centerLocal=point_local(p,e['sourceRect']),pivotLocal=point_local(p,e['sourceRect']),groundContactYLocal=p[1]-e['sourceRect'][1],radiusMeasurement='Visually measured outer structural ellipse at the floor plane; excludes top emblem, flame tips, crystal spikes and hanging ornaments. For a world danger radius R, scaleX=R/radiusX; center and groundContactY both map to the actual support anchor. Keep the native floor ellipse ratio unless scene projection explicitly changes it.',releaseNote='These are ornate warning-rim materials, not complete animated release FX. Runtime must retain continuous charge/release progress and clear true-danger fill/stroke matched to R.')
meta['world']['size']=assets[meta['world']['file']]['size']
for key in ['platforms','ground']:
    al=np.array(Image.open(ROOT/meta[key][0]['file']).getchannel('A'))
    for e in meta[key]:
        left,right=e['standingSpan'];e['standingLineAlphaCoverageOver16']=float(np.mean(al[e['standingY'],left:right]>16))
meta['integrationNotes']=['15 original PNGs: world + 9 backgrounds + ground/platform/title/boss-HUD/warning atlases.','The 12 title frames contain 9 main-stage frames, endless and dual-king frames, plus one spare generic frame.','Never equal-slice the source blindly. Apply sourceClipSpans for overlapping HUD ornaments; sourceRect is already measured.','Terrain standingY is at the visible top walk edge, not alpha minimum or bottom decoration.','All artwork is source delivery only: no runtime integration, gameplay verification, release or user acceptance is claimed.','Challenge21 and challenge22 unlock after chapter1 stage11 completion; no chapter2-stage9 prerequisite.']
(ROOT/'scene-meta-v1.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
report={'assets':len(assets),'allOriginalHashesMatch':all(v['originalPngBytesPreserved'] for v in assets.values()),'allFullPromptsRecovered':all(p['prompt'] for p in prompts),'platforms':len(meta['platforms']),'ground':len(meta['ground']),'allStandingSpansFullyMaterial':all(e['standingLineAlphaCoverageOver16']==1 for key in ['platforms','ground'] for e in meta[key]),'nameplates':len(meta['nameplates']),'bossHuds':len(meta['bossHuds']),'warnings':len(meta['warnings']),'safeAlpha':{'titles':[e['safeAlpha'] for e in meta['nameplates']],'bossHuds':[e['safeAlpha'] for e in meta['bossHuds']]}}
(ROOT/'measurement-audit-v1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
