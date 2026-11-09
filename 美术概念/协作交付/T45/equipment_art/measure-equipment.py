"""Read-only PNG alpha measurement. Writes JSON, never edits or re-encodes images."""
from pathlib import Path
import json, hashlib
from PIL import Image
import numpy as np

BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[4]
SOURCE_ROOT=Path(r'C:/Users/xiaohaotian/.codex/generated_images/01a1be36-b736-7602-8a10-19aa4131f37d')
SPECS={
0:('exec-7031bba7-1ef4-4195-ad04-3ed79a27fbb6.png',['旅灯','寒铁','暮铜']),
2:('exec-1c7fcb35-8426-4f7f-9559-25f21cd35d8d.png',['霜晶','潮纹','铭雷']),
3:('exec-3c586a46-75d7-497a-bc6f-3efa26ec1124.png',['枯月','镜渊','星棘']),
4:('exec-c57c18ba-b567-4ca8-8810-74b0c7995e75.png',['烬曜','断时','苍辰']),
5:('exec-81332717-31d2-40fc-be17-4503f135319e.png',['日冕','恒曦','蚀日'])}
KINDS=[('melee','weapon','拳套'),('melee','armor','战甲'),('staff','weapon','法杖'),('staff','armor','法袍')]

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def components(mask):
    parents=[]; stats=[]
    def find(i):
        while parents[i]!=i:
            parents[i]=parents[parents[i]]
            i=parents[i]
        return i
    def union(a,b):
        ra,rb=find(a),find(b)
        if ra==rb:return
        if stats[ra][4]<stats[rb][4]:ra,rb=rb,ra
        parents[rb]=ra
        sa,sb=stats[ra],stats[rb]
        stats[ra]=[min(sa[0],sb[0]),min(sa[1],sb[1]),max(sa[2],sb[2]),max(sa[3],sb[3]),sa[4]+sb[4]]
    prev=[]
    for y,row in enumerate(mask):
        edges=np.flatnonzero(np.diff(np.pad(row.astype(np.int8),(1,1))))
        current=[]
        start=0
        for x1,x2 in zip(edges[::2],edges[1::2]):
            x1,x2=int(x1),int(x2)
            idx=len(parents);parents.append(idx);stats.append([x1,y,x2,y+1,x2-x1])
            while start<len(prev) and prev[start][1]<x1:start+=1
            j=start
            while j<len(prev) and prev[j][0]<=x2:
                union(idx,prev[j][2]);j+=1
            current.append((x1,x2,idx))
        prev=current
    return sorted([s for i,s in enumerate(stats) if parents[i]==i],key=lambda s:s[4],reverse=True)

meta={'schema':1,'task':'T45','status':'generated-and-measured; pending main-agent integration and user art acceptance','generator':'builtin image_gen; transparent_background=true','coordinateFormat':'rect=[x,y,width,height] in original PNG pixels; size=[atlasWidth,atlasHeight]','columns':['melee-weapon','melee-armor','staff-weapon','staff-armor'],'rows':['A','B','C'],'qualityIndices':[0,2,3,4,5],'measurement':{'method':'Read-only RLE connected components on alpha>=17, 8-connected; the 12 largest physical framed icons are located independently, sorted by row then column; each visible component bbox gets 2 px antialias padding. No equal-grid assumptions, no raster edits.','visibleAlphaThreshold':17,'padding':2,'pixelPolicy':'Original builtin PNG bytes preserved. Very low alpha generation residue is retained in source and excluded outside measured icon crops when possible.'},'sources':{},'units':{}}
reports=[]
for q,(original,names) in SPECS.items():
    file=f'equipment-q{q}-v1.png';path=BASE/file
    im=Image.open(path);assert im.mode=='RGBA'
    rgba=np.asarray(im);a=rgba[:,:,3];h,w=a.shape
    comps=components(a>=17)
    main=[s for s in comps if s[4]>10000]
    assert len(main)==12,(q,len(main),comps[:20])
    main=sorted(main,key=lambda s:(s[1]+s[3])/2)
    ordered=[]
    for row in range(3):
        ordered.extend(sorted(main[row*4:row*4+4],key=lambda s:(s[0]+s[2])/2))
    source=SOURCE_ROOT/original
    assert sha(source)==sha(path)
    prompt=BASE/'prompts'/f'equipment-q{q}-v1.txt'
    src={'file':file,'size':[w,h],'mode':im.mode,'sha256':sha(path),'originalSourcePath':str(source).replace('\\','/'),'promptFile':str(prompt.relative_to(BASE)).replace('\\','/'),'promptSha256':sha(prompt),'originalByteIdentical':True,'alphaExtrema':[int(a.min()),int(a.max())],'alphaZeroFraction':round(float(np.mean(a==0)),8),'sets':names}
    covered=np.zeros((h,w),dtype=bool)
    rects=[]
    for i,s in enumerate(ordered):
        row,col=divmod(i,4);letter='ABC'[row];role,slot,suffix=KINDS[col]
        x1,y1,x2,y2,area=s
        x=max(0,x1-2);y=max(0,y1-2);right=min(w,x2+2);bottom=min(h,y2+2)
        rect=[x,y,right-x,bottom-y]
        assert not covered[y:bottom,x:right].any(),(q,rect)
        covered[y:bottom,x:right]=True
        key=f'q{q}-{letter}-{role}-{slot}'
        meta['units'][key]={'file':file,'size':[w,h],'rect':rect,'visibleAlphaBBox':[x1,y1,x2-x1,y2-y1],'alphaVisiblePixels':int(area),'quality':q,'set':letter,'setTier':row,'setName':names[row],'name':names[row]+suffix,'role':role,'slot':slot,'row':row,'column':col}
        rects.append(rect)
    outside=a[~covered]
    src['outsideMeasuredRects']={'alphaMax':int(outside.max()) if outside.size else 0,'pixelsAlpha17Plus':int(np.sum(outside>=17)),'pixelsAlpha1To16':int(np.sum((outside>0)&(outside<17)))}
    # Minimum actual separations between padded independent crop rectangles.
    horizontal=[];vertical=[]
    for row in range(3):
        for col in range(3):
            left=rects[row*4+col];right=rects[row*4+col+1]
            horizontal.append(right[0]-left[0]-left[2])
    for row in range(2):
        for col in range(4):
            top=rects[row*4+col];bottom=rects[(row+1)*4+col]
            vertical.append(bottom[1]-top[1]-top[3])
    src['minimumCropGutter']={'horizontalPx':min(horizontal),'verticalPx':min(vertical)}
    assert min(horizontal)>0 and min(vertical)>0
    meta['sources'][f'q{q}']=src
    reports.append({'quality':q,'size':[w,h],'rects':rects,'otherComponentsOver16':len(comps)-12,'outside':src['outsideMeasuredRects'],'minimumCropGutter':src['minimumCropGutter']})
assert len(meta['units'])==60
(BASE/'equipment-meta-v1.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(BASE/'alpha-audit-v1.json').write_text(json.dumps({'status':'measured','originalFilesPreserved':True,'unitCount':len(meta['units']),'reports':reports},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(reports,ensure_ascii=False,indent=2))
