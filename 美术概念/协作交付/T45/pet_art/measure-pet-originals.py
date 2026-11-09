"""T45 PNG analysis only. Reads source pixels; never changes or writes PNG files."""
from pathlib import Path
import hashlib,json
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parent
SOURCE=Path('C:/Users/xiaohaotian/.codex/generated_images/01a1be36-7e16-7273-b38b-146e7157889f')
THRESHOLD=16
files={
'dawnlion-form1-motion-v1.png':('exec-ce7a2342-063e-4ebe-8d87-34bb9de51e41.png','dawnlion-form1-motion-prompt-v1.txt',[]),
'dawnlion-form2-motion-v1.png':('exec-a12e6c39-b4aa-4979-809b-7850c5c72ca8.png','dawnlion-form2-motion-prompt-v1.txt',['dawnlion-form1-motion-v1.png']),
'dawnlion-form3-motion-v1.png':('exec-930bf0e1-2bc1-4dbc-a108-139b7072b238.png','dawnlion-form3-motion-prompt-v1.txt',['dawnlion-form2-motion-v1.png']),
'dawnlion-form3-motion-v2.png':('exec-64e79db2-1356-4335-9d3f-fc325a978814.png','dawnlion-form3-motion-prompt-v2.txt',['dawnlion-form3-motion-v1.png']),
'dawnlion-portraits-skills-v1.png':('exec-53c89617-f3ae-40c8-b9fb-cc652431ad67.png','dawnlion-portraits-skills-prompt-v1.txt',['dawnlion-form1-motion-v1.png','dawnlion-form2-motion-v1.png','dawnlion-form3-motion-v2.png']),
'dawnlion-skills-fx-v1.png':('exec-ba4b16df-61c1-4d84-83ae-a3b80853f31a.png','dawnlion-skills-fx-prompt-v1.txt',[])
}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
sources={}
for name,(source,prompt,refs) in files.items():
 p=ROOT/name;im=Image.open(p);a=np.asarray(im)[:,:,3];assert im.mode=='RGBA';assert sha(p)==sha(SOURCE/source)
 sources[name]={'file':name,'source':str(SOURCE/source),'sha256':sha(p),'sourceSha256':sha(SOURCE/source),'size':list(im.size),'mode':im.mode,'prompt':prompt,'promptSha256':sha(ROOT/prompt),'references':[{'file':r,'sha256':sha(ROOT/r)} for r in refs],'generator':'built-in image_gen; transparent_background=true; original generated PNG byte-for-byte copy','alpha':{'extrema':[int(a.min()),int(a.max())],'coverage':{str(t):float(np.mean(a>t)) for t in [0,1,8,16,32,64,128,192,240]},'outerEdgeAbove16':int(np.count_nonzero(a[0,:]>16)+np.count_nonzero(a[-1,:]>16)+np.count_nonzero(a[1:-1,0]>16)+np.count_nonzero(a[1:-1,-1]>16))}}
def frames(name,rows):
 im=Image.open(ROOT/name);a=np.asarray(im)[:,:,3];w,h=im.size;xs=[round(i*w/4) for i in range(5)];ys=[round(i*h/rows) for i in range(rows+1)];result=[]
 for i in range(4*rows):
  row,col=divmod(i,4);x,y=xs[col],ys[row];tw,th=xs[col+1]-x,ys[row+1]-y;t=a[y:y+th,x:x+tw];yy,xx=np.where(t>THRESHOLD)
  if len(xx)==0:result.append({'index':i,'empty':True,'rect':[x,y,tw,th]});continue
  l,top,right,b=int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1
  result.append({'index':i,'rect':[x,y,tw,th],'spriteRect':[x+l,y+top,right-l,b-top],'bbox':[l,top,right-l,b-top],'centerX':tw/2,'pivot':[tw/2,th/2],'groundContactY':None,'alphaBottomNormalized':b/th,'minPaddingAt16':min(l,top,tw-right,th-b),'edgePixels':{str(q):int(np.count_nonzero(t[0,:]>q)+np.count_nonzero(t[-1,:]>q)+np.count_nonzero(t[1:-1,0]>q)+np.count_nonzero(t[1:-1,-1]>q)) for q in [1,8,16]},'touchesCellEdge':bool(l==0 or top==0 or right==tw or b==th)})
 return result
actions=['walk0','walk1','walk2','walk3','walk4','walk5','idle','windup','claw','recovery','roar','skyfire','hurt','stagger','dying','dead']
motion={}
selected=['dawnlion-form1-motion-v1.png','dawnlion-form2-motion-v1.png','dawnlion-form3-motion-v2.png']
names=['曜纹幼猊','金鬃灵猊','镇曜玄猊']
grounds=[[249,250,251,252,258,255,256,255,257,257,261,261,259,254,254,255],[255,258,256,255,260,260,262,260,259,260,264,264,261,256,257,256],[254,258,256,257,252,253,252,254,250,250,252,255,248,246,246,245]]
mouths=[[261,120],[263,122],[238,119]]
claws=[[298,203],[304,200],[282,192]]
face_motion=[[833,422,72,72],[831,414,77,77],[826,424,68,68]]
for form,name in enumerate(selected):
 fs=frames(name,4)
 for i,f in enumerate(fs):
  f.update({'action':actions[i],'phase':i if i<6 else 0,'pivot':[f['centerX'],grounds[form][i]],'groundContactY':grounds[form][i],'bottomNormalized':grounds[form][i]/f['rect'][3]})
  assert f['edgePixels']['16']==0,(name,i,f)
 ref=fs[6]['bbox'][3]
 motion[str(form)]={**sources[name],'form':form,'name':names[form],'cols':4,'rows':4,'naturalHeight':[74,92,106][form],'referenceFrame':6,'referenceSourceHeight':ref,'idleHeight':ref,'scaleRule':'All frames share naturalHeight/referenceSourceHeight source-pixel scale; never resize independently to bbox.','walkFrames':list(range(6)),'suggestedWalkFps':11,'frames':fs,'faceCrop':{'rect':face_motion[form],'frame':6,'kind':'motion-fallback-face'},'sockets':{'claw':{'frame':8,'pixel':claws[form],'ground':grounds[form][8]},'roar':{'frame':10,'pixel':mouths[form],'ground':grounds[form][10]},'skyfire':{'frame':11,'pixel':[fs[11]['centerX'],grounds[form][11]],'kind':'grounded-cast-base'}}}
uiName='dawnlion-portraits-skills-v1.png';ui=frames(uiName,2);assert ui[7]['empty']
for f in ui:
 if not f.get('empty'):assert f['edgePixels']['16']==0
face_crops=[[226,130,188,188],[663,128,190,190],[1096,111,196,196]]
portraits={str(i):{'file':uiName,'form':i,'name':names[i],'rect':ui[i]['spriteRect'],'frame':i,'faceRect':face_crops[i],'note':'Dedicated newly painted head/bust portrait. rect preserves full mane/horns; faceRect is tighter square HUD/capture closeup. Both atlas absolute.'} for i in range(3)}
fxName='dawnlion-skills-fx-v1.png';fx=frames(fxName,3)
clawp=[[111,191],[81,192],[75,190],[83,190]]
ringp=[[180,170],[180,171],[177,170],[178,171]]
firep=[[181,272],[181,272],[181,272],[181,272]]
skills={}
for row,(key,name) in enumerate([('claw','曜爪'),('ring','日轮啸'),('flame','镇曜天火')]):
 fs=fx[row*4:row*4+4]
 for phase,f in enumerate(fs):
  f['action']=key;f['phase']=phase;f['pivot']=[clawp,ringp,firep][row][phase];f['centerX']=f['pivot'][0];f['groundContactY']=272 if row==2 else None;f['bottomNormalized']=272/f['rect'][3] if row==2 else f['alphaBottomNormalized'];assert f['edgePixels']['16']==0
 skills[key]={'name':name,'kind':key,'icon':{'file':uiName,'frame':4+row,'rect':ui[4+row]['spriteRect'],'pivot':[ui[4+row]['bbox'][2]/2,ui[4+row]['bbox'][3]/2]},'fx':{'file':fxName,'rows':3,'cols':4,'frames':fs,'suggestedFps':10,'suggestedDuration':.4 if row<2 else .8,'referenceSourceSize':[362,362],'grounded':row==2,'note':'claw origin is measured solar glint at left of slash; ring origin is open center; flame origin is seal support-plane center. Fixed source-pixel scale across phases.'}}
meta={'version':'T45-pet-meta-v1','status':'staging-original-art-awaiting-main-agent-integration-and-user-art-acceptance','petId':'dawnlion','name':'镇曜灵猊','alphaThreshold':16,'coordinateNotes':'rect/spriteRect/faceRect/faceCrop.rect are atlas absolute [x,y,w,h]. bbox/pivot/centerX/groundContactY and sockets.pixel are frame-rect-local pixels. naturalHeight is target runtime rendered height (74/92/106), all below hero110. No PNG pixels edited; no clipRects. Alpha16 bounds are read-only measurements, not alpha cutoff for rendering. Lower-opacity glows outside alpha16 bounds remain intact in original source.','motion':motion,'portraits':portraits,'species':{'file':uiName,'frame':3,'rect':ui[3]['spriteRect'],'note':'Final-form full-body right-facing species display; do not use as a face avatar.'},'skills':skills,'uiAtlas':{'file':uiName,'cols':4,'rows':2,'frames':ui,'note':'Intentionally split UI and FX into two atlases for readable portrait/icon sizes. Final cell7 is transparent.'},'sources':sources,'rejectedDrafts':[{'file':'dawnlion-form3-motion-v1.png','reason':'Claw in frame8 crosses nominal boundary into frame9 and dead tail touches frame15 left edge. Superseded by complete uniformly smaller v2 generation. Keep original archive only.'}],'calibration':'Foot contacts, portrait faceRect and spell sockets manually inspected on original PNG; alpha extents measured numerically. These are integration suggestions requiring actual mirrored/runtime/UI review, not automatic anatomy recognition or user approval.'}
(ROOT/'pet-meta-v1.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'provenance-v1.json').write_text(json.dumps({'version':'T45-pet-provenance-v1','sources':sources},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'selected':[{ 'file':v['file'],'naturalHeight':v['naturalHeight'],'referenceSourceHeight':v['referenceSourceHeight'],'minPaddingAt16':min(f['minPaddingAt16'] for f in v['frames'])} for v in motion.values()],'uiSize':sources[uiName]['size'],'fxSize':sources[fxName]['size'],'sourceShaMatching':len(sources),'selectedFrameCount':48+7+12,'noSelectedAlpha16Edges':True},ensure_ascii=True))
