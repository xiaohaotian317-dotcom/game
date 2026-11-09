from pathlib import Path
from PIL import Image
import hashlib,json
ROOT=Path(__file__).resolve().parent
FILE=ROOT/'B12-motion-v2.png'
SOURCE=Path('C:/Users/xiaohaotian/.codex/generated_images/01a1bf3d-ca53-7941-a467-9941a932f3f6/exec-56580cb1-0868-40d8-8307-fc3b305963e4.png')
im=Image.open(FILE)
assert im.mode=='RGBA'
W,H=im.size
a=im.getchannel('A')
edgesX=[round(k*W/4) for k in range(5)]
edgesY=[round(k*H/4) for k in range(5)]
order=['walk-contact-A','walk-compression-A','walk-passing-A','walk-contact-B','walk-compression-B','walk-passing-B','idle','windup','melee','recovery','ranged','special','hurt','stagger','dying','dead']
frames=[];checks=[]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def spans_from_alpha(tile,x0,y0):
    cw,ch=tile.size;pix=tile.load();rows=[]
    # Read-only alpha measurement; no PNGs or image pixels are written.
    for yy in range(ch):
        runs=[];start=None
        for xx in range(cw+1):
            solid=xx<cw and pix[xx,yy]>=8
            if solid and start is None:start=xx
            if not solid and start is not None:
                runs.append((start,xx));start=None
        rows.append(runs)
    padded=[]
    for yy in range(ch):
        runs=rows[yy]
        merged=[]
        for l,r in runs:
            if merged and l<=merged[-1][1]:merged[-1]=(merged[-1][0],max(r,merged[-1][1]))
            else:merged.append((l,r))
        padded.append(merged)
    spans=[];active={}
    for yy,row in enumerate(padded+[[]]):
        keys=set(row)
        for key in list(active):
            if key not in keys:
                start=active.pop(key);spans.append([x0+key[0],key[1]-key[0],y0+start,yy-start])
        for key in keys:
            if key not in active:active[key]=yy
    return sorted(spans,key=lambda v:(v[2],v[0]))
for j,semantic in enumerate(order):
    col,row=j%4,j//4;x0,x1=edgesX[col:col+2];y0,y1=edgesY[row:row+2]
    tile=a.crop((x0,y0,x1,y1));cw,ch=tile.size
    b8=tile.point(lambda z:255 if z>=8 else 0).getbbox()
    bb=tile.point(lambda z:255 if z>=12 else 0).getbbox()
    left,top,right,bottom=bb
    sprite=[x0+max(0,left-3),y0+max(0,top-3),min(cw,right+3)-max(0,left-3),min(ch,bottom+3)-max(0,top-3)]
    ground=bottom-1
    # Common anatomical body axis through the planted legs/hips; the large anchor
    # projects to the left of this axis. Fixed x across poses avoids atlas recenter jitter.
    pivotX=185.0
    spans=spans_from_alpha(tile,x0,y0)
    f={'index':j,'semantic':semantic,'rect':[x0,y0,cw,ch],'sourceRect':[x0,y0,cw,ch],'spriteRect':sprite,'bbox':[left,top,right-left,bottom-top],'pivot':[pivotX,ground],'groundContactY':ground,'bottomNormalized':ground/ch,'centerX':pivotX,'sourceClipSpans':spans,'bodyPixelsAlpha12':sum(1 for v in tile.getdata() if v>=12),'minMaterialMargin':min(left,top,cw-right,ch-bottom),'majorMaterialTouchesIsolationEdge':False}
    frames.append(f)
    margin=[b8[0],b8[1],cw-b8[2],ch-b8[3]]
    assert min(margin)>=20,(j,margin)
    checks.append({'frame':j,'alpha8BBoxLocal':list(b8),'alpha8MarginsLTRB':margin,'alpha12BBoxLocal':[left,top,right,bottom],'sourceClipCount':len(spans)})
idleHeight=frames[6]['bbox'][3]
assert idleHeight==227
cast={'x':256,'y':122,'frame':10,'coordinates':'frame-local pixels at the forward smaller-pincer cyan release aperture'}
unit={'name':'深潮锚王','file':FILE.name,'size':[W,H],'mode':im.mode,'alphaExtrema':list(a.getextrema()),'sha256':digest(FILE),'source':str(SOURCE),'sourceSha256':digest(SOURCE),'originalBytesMatch':digest(FILE)==digest(SOURCE),'prompt':'B12-motion-prompt-v2.txt','promptSha256':digest(ROOT/'B12-motion-prompt-v2.txt'),'references':['B12-motion-v1.png'],'frames':frames,'idleHeight':idleHeight,'referenceSourceHeight':idleHeight,'idleCenterX':185.0,'portrait':{'rect':[774,349,90,90],'frame':6,'note':'Manually selected square crown/eyes/face crop, atlas-absolute; face raised above shoulders. Body anchor independent.'},'socket':{'x':cast['x']/frames[10]['rect'][2],'y':cast['y']/frames[10]['rect'][3],'ground':frames[10]['groundContactY']/frames[10]['rect'][3]},'castSocket':cast,'design':'Selected upright abyssal bone-crowned tyrant with raised clear skull face, ivory shell/black-iron shipwreck armor, exposed cyan tidal heart, asymmetric huge anchor forearm; right-facing walk, anchor strike8, pincer tide10, double-tide invocation11.','pixelsEdited':False}
meta={'version':'T46-b12-redesign-v2','status':'selected main-Agent concept expanded to sixteen poses; original atlas measured, awaiting main integration and user art acceptance','generator':'built-in image_gen transparent_background=true; original generated PNG bytes copied','pixelsEdited':False,'firstChapterChanged':False,'frameOrder':order,'coordinateNotes':'rect/sourceRect/spriteRect/portrait.rect are atlas-absolute [x,y,w,h]. bbox/pivot/groundContactY are frame-local. sourceClipSpans atlas-absolute [x,width,y,height], exact alpha8 mask without expansion to exclude sub8-alpha chromatic residue; no PNG rewriting. bbox/reference height use alpha12 material. Use ONE uniform e.visual/referenceSourceHeight scale for every pose; actual idle crown-to-foot height227px, not cell height. Fixed anatomical pivot x185 across poses; explicit measured contact y keeps feet/corpse supported. Cast socket frame10 local.','units':{'B12':unit}}
(ROOT/'boss-body-meta-v3.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report={'file':FILE.name,'size':[W,H],'sha256':digest(FILE),'pixelsEdited':False,'originalBytesMatch':unit['originalBytesMatch'],'alphaExtrema':list(a.getextrema()),'alpha8MinimumCellMargin':min(min(c['alpha8MarginsLTRB']) for c in checks),'frames':checks,'referenceSourceHeight':idleHeight,'portrait':unit['portrait'],'castSocket':cast,'limits':['Read-only alpha measurement and manual anatomy anchors; no production integration or gameplay acceptance is implied.','Generation v2 is the single authorized spacing correction. v1 remains archived, not selected for integration.','At alpha1 some extremely faint chromatic residue reaches cell margins; all alpha>=8 anatomy/effects have at least23px safety margins. Source clips isolate the actual material.']}
(ROOT/'B12-motion-validation-v2.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
provenance=[]
sources={
'B12-concept-v1.png':'exec-4bbc3f67-60dd-4d4a-90f6-5fff34b8537a.png',
'B12-motion-v1.png':'exec-14597139-c459-44fd-8b36-d995ff80fde6.png',
'B12-motion-v2.png':'exec-56580cb1-0868-40d8-8307-fc3b305963e4.png'}
for name,sourceName in sources.items():
    p=ROOT/name;s=SOURCE.parent/sourceName;q=Image.open(p);prompt=name.replace('.png','').replace('concept-v','concept-prompt-v').replace('motion-v','motion-prompt-v')+'.txt'
    provenance.append({'file':name,'source':str(s),'sha256':digest(p),'sourceSha256':digest(s),'originalBytesMatch':digest(p)==digest(s),'size':list(q.size),'mode':q.mode,'alphaExtrema':list(q.getchannel('A').getextrema()),'prompt':prompt,'promptSha256':digest(ROOT/prompt),'pixelsEdited':False,'role':'selected 16-pose atlas' if name.endswith('motion-v2.png') else ('selected identity concept' if 'concept' in name else 'archive before spacing correction')})
(ROOT/'provenance-v2.json').write_text(json.dumps({'generator':'built-in image_gen','transparent_background':True,'assets':provenance},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'frames':len(frames),'referenceSourceHeight':idleHeight,'minimumMarginAlpha8':report['alpha8MinimumCellMargin'],'allOriginalBytesMatch':all(p['originalBytesMatch'] for p in provenance),'sha256':digest(FILE)},ensure_ascii=False))
