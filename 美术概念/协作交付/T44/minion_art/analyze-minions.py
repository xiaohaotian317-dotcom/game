"""Read-only PNG alpha/crop analysis. Writes JSON only; never resaves or edits images."""
from pathlib import Path
from PIL import Image
import numpy as np, hashlib, json
from collections import deque

ROOT=Path(__file__).resolve().parent
SOURCES={
'M11':{'name':'锚甲蟹卫','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-5311cd07-f25f-4931-bd05-79339ebaf38b.png','portrait':[135,130,92,92],'socketPoint':[850,810]},
'M12':{'name':'赤晶镰蛛','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-3be12ad4-502e-4989-82ed-435562341754.png','portrait':[174,132,108,108],'socketPoint':[858,755]},
'M13':{'name':'菌铠尸卫','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-45ec647a-50f5-4e39-95b8-89e9b66a37be.png','portrait':[207,70,72,72],'socketPoint':[869,735]},
'M14':{'name':'烬羽刃侍','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-0f281c70-f9dd-4bdc-8390-39c97a91ebba.png','portrait':[166,22,90,90],'socketPoint':[925,725]},
'M15':{'name':'镜壳双刀卫','file':'M15-motion-v3.png','prompt':'prompt-M15-motion-v3.txt','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-8ed36836-c4dd-42f0-ad7d-f65e73d0a72e.png','portrait':[176,78,58,58],'socketPoint':[866,724]},
'M16':{'name':'时砂戟卫','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-9a290183-0ed9-4d32-be64-ed416e7b4624.png','portrait':[158,108,64,64],'socketPoint':[917,771]},
'M17':{'name':'契印咒师','file':'M17-motion-v2.png','prompt':'prompt-M17-motion-v2.txt','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-fa09f909-1c1c-404c-9326-3b052d0d4e21.png','portrait':[162,35,70,70],'socketPoint':[903,735]},
'M18':{'name':'棱镜晶巫','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-15b4d037-8614-4de0-bfe0-817d55e5a9db.png','portrait':[139,41,70,70],'socketPoint':[899,718]},
'M19':{'name':'孢囊浮灯','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-ab0cb20e-54ec-43bb-9beb-bb093e6b6ba1.png','portrait':[185,117,88,88],'socketPoint':[856,773]},
'M20':{'name':'雷铸钩卫','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-75a869ad-9d48-4dbf-bf34-1b75f2cd9327.png','portrait':[182,110,70,70],'socketPoint':[908,759]}
}
SEMANTICS=['walk-contact-A','walk-compression-A','walk-passing-A','walk-contact-B','walk-compression-B','walk-passing-B','idle','windup','melee','recovery','ranged','special','hurt','stagger','falling','dead']
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def box(mask):
 ys,xs=np.where(mask)
 return [int(xs.min()),int(ys.min()),int(xs.max()-xs.min()+1),int(ys.max()-ys.min()+1)]
def components(mask):
 h,w=mask.shape;seen=np.zeros_like(mask);result=[]
 for y,x in zip(*np.where(mask)):
  if seen[y,x]:continue
  seen[y,x]=True;q=deque([(y,x)]);points=[]
  while q:
   yy,xx=q.popleft();points.append((yy,xx))
   for dy,dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
    ny,nx=yy+dy,xx+dx
    if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;q.append((ny,nx))
  result.append(points)
 return sorted(result,key=len,reverse=True)
units={}
previous=json.loads((ROOT/'minion-meta-v1.json').read_text(encoding='utf-8')).get('units',{}) if (ROOT/'minion-meta-v1.json').exists() else {}
for id,info in SOURCES.items():
 path=ROOT/info.get('file',id+'-motion-v1.png')
 if previous.get(id,{}).get('sha256')==sha(path):units[id]=previous[id];continue
 im=Image.open(path);rgba=np.asarray(im);a=rgba[:,:,3];h,w=a.shape;frames=[];isolation=[]
 for row in range(4):
  sy,ey=round(row*h/4),round((row+1)*h/4);cols=(a[sy:ey]>32).sum(0);zero=cols==0
  starts=np.where(zero&~np.r_[False,zero[:-1]])[0];ends=np.where(zero&~np.r_[zero[1:],False])[0]+1;gaps=[]
  for k in range(1,4):
   center=round(k*w/4);runs=[(int(s),int(e)) for s,e in zip(starts,ends) if s<center+40 and e>center-40 and e-s>=2]
   gaps.append(min(runs,key=lambda p:abs((p[0]+p[1])/2-center)))
  cuts=[0]+[round((s+e)/2) for s,e in gaps]+[w];isolation.append({'row':row,'transparentRunsAlphaLE32':gaps,'analysisCuts':cuts})
  for col in range(4):
   idx=row*4+col;lo,hi=cuts[col:col+2];sub=a[sy:ey,lo:hi];comps=components(sub>32);selected=[c for c in comps if len(c)>=max(12,len(comps[0])*.0008)]
   chosen=np.zeros_like(sub,dtype=bool)
   for comp in selected:
    for y,x in comp:chosen[y,x]=True
   bx,by,bw,bh=box(chosen);sx=max(lo,lo+bx-2);sx2=min(hi,lo+bx+bw+2);y1=max(sy,sy+by-2);y2=min(ey,sy+by+bh+2)
   x0,x1=round(col*w/4),round((col+1)*w/4);rw,rh=x1-x0,ey-sy
   footMask=(sub>80)&chosen;bottom=int(np.where(footMask)[0].max())+1
   nominalBeyond=[max(0,x0-sx),max(0,sx2-x1),max(0,sy-y1),max(0,y2-ey)]
   material=a[y1:y2,sx:sx2]
   frames.append({'index':idx,'semantic':SEMANTICS[idx],'rect':[x0,sy,rw,rh],'spriteRect':[sx,y1,sx2-sx,y2-y1],'bbox':[lo+bx,sy+by,bw,bh],'bottomNormalized':bottom/rh,'groundContactY':bottom,'centerX':rw/2,'pivot':[rw/2,bottom],'isolationRect':[lo,sy,hi-lo,rh],'extendsLogicalRectPx':nominalBeyond,'materialPixelsAlphaGT32':int(chosen.sum()),'selectedComponents':len(selected),'majorMaterialTouchesIsolationEdge':bool(chosen[0].any() or chosen[-1].any() or chosen[:,0].any() or chosen[:,-1].any()),'poseMaskSha256':hashlib.sha256(chosen.tobytes()).hexdigest()})
 low=(a>0)&(a<=16);border=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]])
 f10=frames[10];px,py=info['socketPoint'];rx,ry,rw,rh=f10['rect']
 units[id]={'name':info['name'],'file':path.name,'size':[w,h],'mode':im.mode,'bytes':path.stat().st_size,'sha256':sha(path),'sourcePath':info['source'],'sourceSha256':sha(Path(info['source'])),'originalBytesMatch':sha(path)==sha(Path(info['source'])),'promptFile':info.get('prompt','prompt-'+id+'-motion-v1.txt'),'status':'sample-generated-measured-pending-primary-review','frames':frames,'portrait':{'frame':0,'rect':info['portrait'],'coordinateSpace':'absolute original PNG pixels; face close-up, not whole tile','calibration':'manual visual face selection; no image editing'},'socket':{'frame':10,'x':(px-rx)/rw,'y':(py-ry)/rh,'ground':f10['bottomNormalized'],'pointAbsolute':[px,py],'calibration':'manual visual mouth/front discharge position normalized inside frame rect; not anatomy detection'},'alpha':{'extrema':[int(a.min()),int(a.max())],'zero':int((a==0).sum()),'zeroRatio':float((a==0).mean()),'alpha1':int((a==1).sum()),'alpha2to16':int(((a>=2)&(a<=16)).sum()),'alpha17to32':int(((a>=17)&(a<=32)).sum()),'alphaGT80':int((a>80).sum()),'lowAlphaMedianMaxRGB':float(np.median(rgba[:,:,:3][low].max(1))),'cornerAlpha':[int(a[0,0]),int(a[0,-1]),int(a[-1,0]),int(a[-1,-1])],'borderMaxAlpha':int(border.max())},'isolationAnalysis':isolation,'walkUniquePoseMasks':len({f['poseMaskSha256'] for f in frames[:6]}),'issues':['Original alpha-1 black background noise retained; alpha cleanup not performed.','Frame 8 extended attack crosses nominal equal-grid boundary, but explicit spriteRect preserves the full weapon inside a measured transparent separation gap.','Use each frame bottomNormalized/groundContactY; do not force one shared source-bottom across walks/corpse.','Generated source is 1254 square rather than requested 2048.','Animation fluidity, runtime size and face crop remain subject to main-agent integration and user acceptance.']}
meta={'schemaVersion':1,'task':'T44','status':'two-sample-review','generator':'built-in image_gen; one separate call per unit; raw PNG bytes preserved','plannedRoster':['M11','M12','M13','M14','M15','M16','M17','M18','M19','M20'],'frameConvention':{'order':'row-major 4x4, index0..15','rect':'logical frame source coordinate space; explicitly enumerated, not used as a clipping window','spriteRect':'absolute original PNG safe crop; may extend past logical rect for a complete attack silhouette; never intersect neighbor subject','bottomNormalized':'alpha>80 material contact bottom / logical frame height','portrait':'absolute PNG face-only crop','method':'Read-only alpha>32 connected components; keep meaningful detached fragments; 2px crop padding limited by measured transparent column gaps. Source PNGs are never modified.'},'units':units,'fx':{'status':'not-generated-awaiting-two-sample-review','plannedMeleeFamilies':['M11','M12','M13','M14','M15','M16','M20'],'plannedRangedFamilies':['M17','M18','M19','M20'],'phasesPerFamily':4}}
(ROOT/'minion-meta-v1.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:{'size':v['size'],'sha256':v['sha256'],'bytesMatch':v['originalBytesMatch'],'frames':len(v['frames']),'walkMasks':v['walkUniquePoseMasks'],'edgeMaterial':sum(f['majorMaterialTouchesIsolationEdge'] for f in v['frames']),'attackCrop':v['frames'][8]['spriteRect'],'portrait':v['portrait']['rect'],'alpha':v['alpha']} for k,v in units.items()},ensure_ascii=False,indent=2))
