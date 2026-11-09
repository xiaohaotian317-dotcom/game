"""Read-only alpha measurement. Never saves or changes an image."""
from pathlib import Path
from PIL import Image
from collections import deque
import hashlib,json

ROOT=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def record(name,source,prompt):
 p=ROOT/name;im=Image.open(p)
 return {'file':name,'source':source,'sha256':sha(p),'sourceSha256':sha(Path(source)),'size':list(im.size),'mode':im.mode,'prompt':prompt,'promptSha256':sha(ROOT/prompt),'generator':'built-in image_gen, transparent_background=true; original PNG bytes copied','alphaExtrema':list(im.getchannel('A').getextrema())}
def isolate(im,rect,padding=3):
 x0,y0,w,h=rect;a=im.getchannel('A').crop((x0,y0,x0+w,y0+h));p=a.load();seen=set();best=[]
 for y in range(h):
  for x in range(w):
   if p[x,y]>8 and (x,y) not in seen:
    q=deque([(x,y)]);seen.add((x,y));part=[]
    while q:
     u,v=q.popleft();part.append((u,v))
     for n,m in ((u-1,v),(u+1,v),(u,v-1),(u,v+1)):
      if 0<=n<w and 0<=m<h and (n,m) not in seen and p[n,m]>8:seen.add((n,m));q.append((n,m))
    if len(part)>len(best):best=part
 rows={}
 for x,y in best:
  for yy in range(max(0,y-padding),min(h,y+padding+1)):
   left,right=max(0,x-padding),min(w,x+padding+1)
   if yy in rows:rows[yy]=(min(rows[yy][0],left),max(rows[yy][1],right))
   else:rows[yy]=(left,right)
 spans=[]
 for y,(left,right) in sorted(rows.items()):
  if spans and spans[-1][0]==x0+left and spans[-1][1]==right-left and spans[-1][2]+spans[-1][3]==y0+y:spans[-1][3]+=1
  else:spans.append([x0+left,right-left,y0+y,1])
 b=[min(x for x,y in best),min(y for x,y in best),max(x for x,y in best)+1,max(y for x,y in best)+1]
 return b,spans,len(best)

motion=record('mossdeer-juvenile-motion-v2.png','C:/Users/xiaohaotian/.codex/generated_images/01a1bf3c-eb03-7b42-ae58-a20a49fac5fc/exec-168db518-4495-4737-b4c4-a0dcad91ca54.png','mossdeer-juvenile-motion-prompt-v2.txt')
motion['reference']='mossdeer-juvenile-motion-v1.png';motion['referenceSha256']=sha(ROOT/motion['reference']);motion['naturalHeight']=70;motion['referenceSourceHeight']=244;motion['grid']=[4,4];motion['walkFrames']=[0,1,2,3,4,5];motion['frames']=[]
states=['walk-contact-a','walk-compress-a','walk-pass-a','walk-contact-b','walk-compress-b','walk-pass-b','idle','windup','release','recover','heal','root-command','hurt','recall','down-start','down-rest']
im=Image.open(ROOT/motion['file']);w,h=im.size
for i,state in enumerate(states):
 x0=round(i%4*w/4);x1=round((i%4+1)*w/4);y0=round(i//4*h/4);y1=round((i//4+1)*h/4);rect=[x0,y0,x1-x0,y1-y0];b,spans,n=isolate(im,rect)
 motion['frames'].append({'index':i,'state':state,'rect':rect,'sourceRect':rect,'spriteRect':[x0+max(0,b[0]-3),y0+max(0,b[1]-3),min(rect[2],b[2]+3)-max(0,b[0]-3),min(rect[3],b[3]+3)-max(0,b[1]-3)],'bbox':b,'pivot':[rect[2]/2,b[3]-1],'groundContactY':b[3]-1,'sourceClipSpans':spans,'bodyPixelsAlpha8':n})
ui=record('mossdeer-juvenile-ui-v1.png','C:/Users/xiaohaotian/.codex/generated_images/01a1bf3c-eb03-7b42-ae58-a20a49fac5fc/exec-f24480ce-5d53-4cbf-9b62-f8a10c4f74fe.png','mossdeer-juvenile-ui-prompt-v1.txt');ui['reference']='mossdeer-juvenile-motion-v1.png';ui['grid']=[3,1];ui['frames']=[]
im=Image.open(ROOT/ui['file']);w,h=im.size
for i,state in enumerate(['portrait','standing','emblem']):
 x0=round(i*w/3);x1=round((i+1)*w/3);rect=[x0,0,x1-x0,h];b,spans,n=isolate(im,rect);r=[x0+max(0,b[0]-3),max(0,b[1]-3),min(rect[2],b[2]+3)-max(0,b[0]-3),min(rect[3],b[3]+3)-max(0,b[1]-3)]
 ui['frames'].append({'state':state,'rect':r,'sourceRect':r,'spriteRect':r,'pivot':[r[2]/2,r[3]-1],'bbox':b,'sourceClipSpans':spans,'bodyPixelsAlpha8':n})
# Portrait: square includes complete antlers, ears, chin and upper chest; no neighbor.
ui['faceRect']=[80,0,644,724];ui['faceSquare']=[0,0,724,724]
v={'version':'T46-mossdeer-juvenile-v1','petId':'mossdeer','form':0,'status':'original art measured; awaiting main-agent runtime integration and user acceptance','pixelsEdited':False,'alphaNotes':'Alpha8 connected-body measurement plus 3px path padding only isolates detached generated specks at draw-time. Original PNG pixels unchanged. sourceClipSpans are atlas-absolute [x,width,y,height]; rect/spriteRect atlas absolute; pivots/bbox frame-local. Use shared source-clips drawOriginalRegion for path clipping. Uniform 70/244 scale across every pose; never renormalize down/hurt to same height.','motion':motion,'ui':ui,'selection':{'activeMotion':'mossdeer-juvenile-motion-v2.png','archivedMotion':'mossdeer-juvenile-motion-v1.png','reason':'v2 removes external spell-orb spill so runtime skill VFX remains separate'},'otherJuveniles':{'frostfox':'Already clearly supernatural: blue-white fur, broad ice-blue tail and moon forehead mark. Keep current form0; consider darker linework if future user feedback requests it.','emberwing':'Already a fantasy gryphon: eagle head, lion body, ember crest/wing/tail. Keep current form0.','dawnlion':'Clearly a suanni-like beast: charcoal body, golden mane, gold flank runes. Keep current form0.','mossdeer':'Old form0 was realistic tan spotted fawn with token small green accents; replaced with jade-gray spirit beast silhouette.'}}
(ROOT/'juvenile-meta-v1.json').write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'motionSize':motion['size'],'motionSHA':motion['sha256'],'uiSize':ui['size'],'uiSHA':ui['sha256'],'frames':len(motion['frames']),'minGround':min(f['groundContactY'] for f in motion['frames']),'maxGround':max(f['groundContactY'] for f in motion['frames'])},ensure_ascii=False))
