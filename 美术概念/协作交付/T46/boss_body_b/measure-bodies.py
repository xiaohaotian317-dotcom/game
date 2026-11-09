"""Read-only alpha/CC measurements of generated originals. No image output."""
from pathlib import Path
from PIL import Image
from collections import deque
import hashlib,json
ROOT=Path(__file__).resolve().parent
GEN=Path('C:/Users/xiaohaotian/.codex/generated_images/01a1bf3b-cb4b-7021-b499-f7c16019fce1')
SPECS={
 'B17':{'name':'时砂圣甲','file':'B17-motion-v3.png','source':'exec-f39d1e9c-b06f-412f-ace7-83ff7e74184d.png','prompt':'B17-body-prompt-v3.txt','portrait':[815,435,92,92],'castSocket':[235,171],'refs':['B17-motion-v2.png'],'design':'six-legged royal beetle; burial-vault carapace, giant actual hourglass chamber, inner sand joints; braced raised-body summon11'},
 'B18':{'name':'噬月螳皇','file':'B18-motion-v2.png','source':'exec-e5a1f521-b59c-494b-af22-107c096c72aa.png','prompt':'B18-body-prompt-v2.txt','portrait':[825,422,78,78],'castSocket':[253,160],'alphaThreshold':128,'refs':['B18-motion-v1.png','B09-雷骨翼龙.png','B08-霜牙狼王.png'],'design':'predatory crescent-scythe anatomy, bone lunar crown, violet-black ribbed wing mantle; luminous chest lunar organ and wing spots'},
 'B19':{'name':'雷铸巨像','file':'B19-motion-v3.png','source':'exec-3fa179af-6348-41d9-aafa-ffc5474bb1b7.png','prompt':'B19-body-prompt-v3.txt','portrait':[773,391,76,76],'castSocket':[251,130],'refs':['B19-motion-v2.png'],'design':'walking cathedral thunder furnace, layered shoulder towers, heavy cannon/pincer and buttress legs, broad open blue-white arc reactor; summon11'},
 'B20':{'name':'蚀日双相王','file':'B20-motion-v3.png','source':'exec-af09f72d-bf90-4063-9c6f-77647c72ff43.png','prompt':'B20-body-prompt-v3.txt','portrait':[755,369,76,76],'castSocket':[235,127],'refs':['B20-motion-v2.png'],'design':'asymmetric layered sun-moon back crown, hollow eclipse chest, black-gold royal mantle containing visible starfields, gold-violet arms; open-arm summon11'},
}
STATES=['walk-contact-A','walk-compression-A','walk-passing-A','walk-contact-B','walk-compression-B','walk-passing-B','idle','windup','melee','recovery','ranged','special','hurt','stagger','dying','dead']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def component_pixels(im,rect,threshold=16):
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
meta={'version':'T46-boss-body-b-v3','status':'original full-body redesigns measured; awaiting main integration and user art acceptance','generator':'built-in image_gen transparent_background=true; original generated PNG bytes copied','pixelsEdited':False,'firstChapterChanged':False,'frameOrder':STATES,'coordinateNotes':'rect/sourceRect/spriteRect/portrait.rect are atlas-absolute [x,y,w,h]. bbox/pivot/groundContactY are frame-local. sourceClipSpans atlas-absolute [x,width,y,height], per-unit alpha12/96 CC plus 3px path padding, not PNG rewriting. e.visual/referenceSourceHeight is ONE uniform scale for every pose of a given boss; never scale each down/crouch pose to idle height. Explicit foot pivot preserves support. Use source-clips drawOriginalRegion for measured paths.','units':units}
(ROOT/'boss-body-meta-v3.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({id:{'height':u['referenceSourceHeight'],'minMargin':min(f['minMaterialMargin'] for f in u['frames']),'sourceMatches':u['originalBytesMatch'],'portrait':u['portrait']} for id,u in units.items()},ensure_ascii=False))
