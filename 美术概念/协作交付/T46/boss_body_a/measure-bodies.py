"""Read-only alpha/CC measurements of generated originals. No image output."""
from pathlib import Path
from PIL import Image
from collections import deque
import hashlib,json
ROOT=Path(__file__).resolve().parent
GEN=Path('C:/Users/xiaohaotian/.codex/generated_images/01a1bf3c-eb03-7b42-ae58-a20a49fac5fc')
SPECS={
 'B15':{'name':'烬翼审判官','file':'B15-motion-v4.png','source':'exec-eec9fecf-b244-4857-abc5-31ac0e015b1e.png','prompt':'B15-motion-prompt-v4.txt','portrait':[788,370,64,64],'castSocket':[250,107],'alphaThreshold':96,'refs':['B15-motion-v3.png'],'design':'charred judgment robes, molten wing-bones, exposed chest furnace and execution blade; coherent blade/wings prepare-release-recover'},
 'B16':{'name':'千面镜姬','file':'B16-motion-v3.png','source':'exec-85c75c3f-a557-43d6-8444-3fe276b09b37.png','prompt':'B16-motion-prompt-v3.txt','portrait':[771,375,70,70],'castSocket':[265,119],'alphaThreshold':96,'refs':['C:/Users/xiaohaotian/Desktop/双人/美术概念/敌人与BOSS/v1/BOSS/B02-织梦蛛后.png'],'design':'multi-faced mirror plate queen, asymmetric mask and floating fractured back-crown; opens mirror fan in clone command pose11'},
 'B14':{'name':'孢冠沼母','file':'B14-motion-v4.png','source':'exec-272f57b3-bb00-4dca-a9fd-5ad869144882.png','prompt':'B14-motion-prompt-v4.txt','portrait':[766,375,86,86],'castSocket':[264,118],'alphaThreshold':96,'refs':['B14-motion-v3.png'],'design':'towering amber-lamella crown, queen root-throne silhouette, living spore heart and root vascular light; summon pose11'},
 'B12':{'name':'深潮锚王','file':'B12-motion-v4.png','source':'exec-bc528677-793d-494a-8c47-953d505229c0.png','prompt':'B12-motion-prompt-v4.txt','portrait':[801,418,88,88],'castSocket':[253,159],'refs':['B12-motion-v3.png'],'design':'sunken-cathedral shell, anchor claws, visible inner tide heart and integrated cyan fissures'},
 'B13':{'name':'裂晶巨蜥','file':'B13-motion-v4.png','source':'exec-0301d581-4e72-4e15-9d69-697c72542738.png','prompt':'B13-motion-prompt-v4.txt','portrait':[839,424,76,76],'castSocket':[261,125],'refs':['B13-motion-v3.png'],'design':'regal crystal crown and massive forearms/tail cleaver; inner crimson mineral furnace; burrow pose11'},
}
STATES=['walk-contact-A','walk-compression-A','walk-passing-A','walk-contact-B','walk-compression-B','walk-passing-B','idle','windup','melee','recovery','ranged','special','hurt','stagger','dying','dead']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def component_pixels(im,rect,threshold=12):
 x0,y0,w,h=rect;a=im.getchannel('A').crop((x0,y0,x0+w,y0+h));p=a.load();seen=set();parts=[]
 for y in range(h):
  for x in range(w):
   if p[x,y]>threshold and (x,y) not in seen:
    q=deque([(x,y)]);seen.add((x,y));part=[]
    while q:
     u,v=q.popleft();part.append((u,v))
     for n,m in ((u-1,v),(u+1,v),(u,v-1),(u,v+1)):
      if 0<=n<w and 0<=m<h and (n,m) not in seen and p[n,m]>threshold:seen.add((n,m));q.append((n,m))
    if len(part)>35:parts.append(part)
 # Include separate solid crystal/crown elements, ignore tiny detached generator specks.
 pts=[p for part in parts for p in part];return pts
def measure(spec):
 p=ROOT/spec['file'];im=Image.open(p);width,height=im.size;frames=[]
 for i,state in enumerate(STATES):
  x0=round(i%4*width/4);x1=round((i%4+1)*width/4);y0=round(i//4*height/4);y1=round((i//4+1)*height/4);rect=[x0,y0,x1-x0,y1-y0];pts=component_pixels(im,rect,spec.get('alphaThreshold',12));left=min(x for x,y in pts);top=min(y for x,y in pts);right=max(x for x,y in pts)+1;bottom=max(y for x,y in pts)+1;rows={}
  for x,y in pts:
   for yy in range(max(0,y-3),min(rect[3],y+4)):
    lo,hi=max(0,x-3),min(rect[2],x+4)
    if yy in rows:rows[yy]=(min(rows[yy][0],lo),max(rows[yy][1],hi))
    else:rows[yy]=(lo,hi)
  spans=[]
  for y,(lo,hi) in sorted(rows.items()):
   if spans and spans[-1][0]==x0+lo and spans[-1][1]==hi-lo and spans[-1][2]+spans[-1][3]==y0+y:spans[-1][3]+=1
   else:spans.append([x0+lo,hi-lo,y0+y,1])
  source=[x0+max(0,left-3),y0+max(0,top-3),min(rect[2],right+3)-max(0,left-3),min(rect[3],bottom+3)-max(0,top-3)]
  frames.append({'index':i,'semantic':state,'rect':rect,'sourceRect':rect,'spriteRect':source,'bbox':[left,top,right-left,bottom-top],'pivot':[rect[2]/2,bottom-1],'groundContactY':bottom-1,'bottomNormalized':(bottom-1)/rect[3],'centerX':rect[2]/2,'sourceClipSpans':spans,'bodyPixels':len(pts),'isolationAlphaThreshold':spec.get('alphaThreshold',12),'minMaterialMargin':min(left,top,rect[2]-right,rect[3]-bottom),'majorMaterialTouchesIsolationEdge':min(left,top,rect[2]-right,rect[3]-bottom)<=1})
 idle=frames[6];portrait=spec['portrait'];px=portrait[0]+portrait[2]*.65-idle['rect'][0];py=portrait[1]+portrait[3]*.5-idle['rect'][1];source=GEN/spec['source']
 return {'name':spec['name'],'file':spec['file'],'size':[width,height],'mode':im.mode,'alphaExtrema':list(im.getchannel('A').getextrema()),'sha256':sha(p),'source':str(source),'sourceSha256':sha(source),'originalBytesMatch':p.read_bytes()==source.read_bytes(),'prompt':spec['prompt'],'promptSha256':sha(ROOT/spec['prompt']),'references':spec['refs'],'frames':frames,'idleHeight':idle['bbox'][3],'referenceSourceHeight':idle['bbox'][3],'idleCenterX':idle['centerX'],'portrait':{'rect':portrait,'frame':6,'note':'Manual square eye/face/crown crop, atlas absolute. Body anchor metadata is independent.'},'socket':{'x':px/idle['rect'][2],'y':py/idle['rect'][3],'ground':idle['bottomNormalized']},'castSocket':{'x':spec['castSocket'][0],'y':spec['castSocket'][1],'frame':10,'coordinates':'frame-local pixels at actual ranged-release aperture'},'design':spec['design'],'pixelsEdited':False}
units={id:measure(spec) for id,spec in SPECS.items() if (ROOT/spec['file']).exists()}
meta={'version':'T46-boss-body-a-v3','status':'original full-body redesigns measured; awaiting main integration and user art acceptance','generator':'built-in image_gen transparent_background=true; original generated PNG bytes copied','pixelsEdited':False,'firstChapterChanged':False,'frameOrder':STATES,'coordinateNotes':'rect/sourceRect/spriteRect/portrait.rect are atlas-absolute [x,y,w,h]. bbox/pivot/groundContactY are frame-local. sourceClipSpans atlas-absolute [x,width,y,height], per-unit alpha12/96 CC plus 3px path padding, not PNG rewriting. e.visual/referenceSourceHeight is ONE uniform scale for every pose of a given boss; never scale each down/crouch pose to idle height. Explicit foot pivot preserves support. Use source-clips drawOriginalRegion for measured paths.','units':units}
(ROOT/'boss-body-meta-v3.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({id:{'height':u['referenceSourceHeight'],'minMargin':min(f['minMaterialMargin'] for f in u['frames']),'sourceMatches':u['originalBytesMatch'],'portrait':u['portrait']} for id,u in units.items()},ensure_ascii=False))
