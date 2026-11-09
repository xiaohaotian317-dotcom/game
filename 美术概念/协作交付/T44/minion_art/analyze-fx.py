"""Read-only original PNG geometry analysis; writes JSON only. Run after analyze-minions.py."""
from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
ROOT=Path(__file__).resolve().parent
META=ROOT/'minion-meta-v1.json'
meta=json.loads(META.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def runs(active):
 out=[];start=None
 for i,value in enumerate(active):
  if value and start is None:start=i
  if start is not None and (not value or i==len(active)-1):
   end=i if not value else i+1
   if out and start-out[-1][1]<24:out[-1][1]=end
   else:out.append([start,end])
   start=None
 return out
def alpha_summary(a,rgba):
 low=(a>0)&(a<=16)
 return {'extrema':[int(a.min()),int(a.max())],'zero':int((a==0).sum()),'zeroRatio':float((a==0).mean()),'alpha1':int((a==1).sum()),'alpha2to16':int(((a>=2)&(a<=16)).sum()),'alpha17to32':int(((a>=17)&(a<=32)).sum()),'alphaGT80':int((a>80).sum()),'lowAlphaMedianMaxRGB':float(np.median(rgba[:,:,:3][low].max(1))) if low.any() else 0,'cornerAlpha':[int(a[0,0]),int(a[0,-1]),int(a[-1,0]),int(a[-1,-1])],'borderMaxAlpha':int(max(a[0].max(),a[-1].max(),a[:,0].max(),a[:,-1].max()))}
configs={
'melee':{'file':'minion-melee-fx-v2.png','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-decd5dee-3405-4ae0-96b9-163484ca30d0.png','prompt':'prompt-minion-melee-fx-v2.txt','families':['M11','M12','M13','M14','M15','M16','M20'],'ground':['M11','M13'],'phases':['windup','strike','impact','fade']},
'ranged':{'file':'minion-ranged-fx-v2.png','source':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/exec-d8040567-2661-4210-b218-bdf1a593698b.png','prompt':'prompt-minion-ranged-fx-v2.txt','families':['M17','M18','M19','M20'],'ground':[],'phases':['charge','launch','flight','impact']}
}
head_points={
'M17':[[177,190],[510,190],[830,190],[1127,188]],
'M18':[[174,479],[506,480],[825,480],[1128,480]],
'M19':[[173,789],[527,785],[848,785],[1108,774]],
'M20':[[194,1081],[544,1083],[861,1083],[1145,1081]]
}
fx={}
for key,conf in configs.items():
 path=ROOT/conf['file'];rgba=np.array(Image.open(path));a=rgba[:,:,3];h,w=a.shape
 bands=runs((a>32).sum(1)>20);assert len(bands)==len(conf['families']),(key,bands)
 rowcuts=[0]+[round((bands[i-1][1]+bands[i][0])/2) for i in range(1,len(bands))]+[h]
 frames=[];families={}
 for row,id in enumerate(conf['families']):
  sy,ey=rowcuts[row:row+2];rh=ey-sy;columns=(a[sy:ey]>32).sum(0);zero=columns==0
  starts=np.where(zero&~np.r_[False,zero[:-1]])[0];ends=np.where(zero&~np.r_[zero[1:],False])[0]+1;gaps=[]
  for k in range(1,4):
   center=round(k*w/4);candidates=[(int(s),int(e)) for s,e in zip(starts,ends) if s<center+50 and e>center-50 and e-s>=2]
   assert candidates,(key,id,k)
   gaps.append(min(candidates,key=lambda p:abs((p[0]+p[1])/2-center)))
  cuts=[0]+[round((s+e)/2) for s,e in gaps]+[w];indices=[]
  for col,phase in enumerate(conf['phases']):
   lo,hi=cuts[col:col+2];sub=a[sy:ey,lo:hi];ys,xs=np.where(sub>32);assert len(xs)>8
   # Low-alpha pixels stay in the unchanged PNG; alpha>32 only locates the original material.
   bx,by,bw,bh=int(xs.min()),int(ys.min()),int(xs.max()-xs.min()+1),int(ys.max()-ys.min()+1)
   sx,ex=max(lo,lo+bx-2),min(hi,lo+bx+bw+2);ty,by2=max(sy,sy+by-2),min(ey,sy+by+bh+2)
   x0,x1=round(col*w/4),round((col+1)*w/4);rw=x1-x0;ground=id in conf['ground'];materialBottom=int(ys.max()+1)
   if key=='ranged':px,py=head_points[id][col];pivot=[px-x0,py-sy]
   else:pivot=[rw*.5,materialBottom if ground else (bands[row][0]+bands[row][1])*.5-sy]
   idx=len(frames);indices.append(idx)
   frames.append({'index':idx,'family':id,'phase':phase,'rect':[x0,sy,rw,rh],'spriteRect':[sx,ty,ex-sx,by2-ty],'pivot':pivot,'pivotAbsolute':[x0+pivot[0],sy+pivot[1]],'centerX':pivot[0],'centerY':pivot[1],'ground':ground,'anchorKind':'support-contact' if ground else 'projectile-head' if key=='ranged' else 'actor-weapon','groundContactY':materialBottom if ground else None,'bottomNormalized':materialBottom/rh,'direction':'right','isolationRect':[lo,sy,hi-lo,rh],'extendsLogicalRectPx':[max(0,x0-sx),max(0,ex-x1)],'materialTouchesIsolationEdge':bool((sub[0]>32).any() or (sub[-1]>32).any() or (sub[:,0]>32).any() or (sub[:,-1]>32).any()),'phaseMaskSha256':hashlib.sha256((sub>32).tobytes()).hexdigest(),**({'projectileHeadPivot':pivot,'projectileHeadPivotAbsolute':[x0+pivot[0],sy+pivot[1]],'headCalibration':'manual visual core/head center, excludes chain/trail; source-local pixels, not automated anatomy'} if key=='ranged' else {})})
  families[id]={'frames':indices,'phaseOrder':conf['phases'],'ground':id in conf['ground'],'continuousMix':True,'referenceCellWidth':w/4,'referenceRowHeight':rh,'uniquePhaseMasks':len({frames[i]['phaseMaskSha256'] for i in indices})}
 fx[key]={'file':path.name,'size':[w,h],'sha256':sha(path),'bytes':path.stat().st_size,'sourcePath':conf['source'],'sourceSha256':sha(Path(conf['source'])),'originalBytesMatch':sha(path)==sha(Path(conf['source'])),'promptFile':conf['prompt'],'grid':[4,len(conf['families'])],'measuredMaterialBandsY':bands,'logicalRowCutsY':rowcuts,'alpha':alpha_summary(a,rgba),'frames':frames,'families':families,'notes':['Explicit row cuts follow measured original material bands, not blind equal subdivision.','All four original phase sprites keep one scale reference; do not independently normalize bounding boxes to the same output width.','Melee windup/strike/impact/fade blend within a family. Ranged charge/launch/flight/impact preserve manually calibrated head/core pivots; flight and impact remain semantically separate.','Low-alpha original noise is retained; no PNG pixels are changed.']}
for id,u in meta['units'].items():
 idle=u['frames'][6];u['idleHeight']=idle['bbox'][3];u['idleCenterX']=idle['bbox'][0]+idle['bbox'][2]/2-idle['rect'][0];u['status']='original-generated-measured-pending-main-integration-and-user-acceptance'
 u['issues']=['Generated source is 1254 square rather than requested 2048.','Low-alpha black background/edge noise retained unchanged; see measured alpha statistics.','Use each frame groundContactY/bottomNormalized and measured source spriteRect; do not blind-cut equal tiles.','Manual portrait and discharge socket need production-scale integration review; visual fluidity remains subject to user acceptance.']
 if any(any(v for v in f['extendsLogicalRectPx']) for f in u['frames']):u['issues'].append('Some strokes/particles extend past logical equal-grid rect; measured spriteRect preserves them without neighboring material.')
 u['promptChain']=['prompt-'+id+'-motion-v1.txt']
 if id=='M15':u['promptChain']+=['prompt-M15-motion-v2.txt','prompt-M15-motion-v3.txt'];u['issues'].append('Selected v3 follows built-in background extraction and smaller safe layout; v1/v2 rejected/candidate sources retained.')
 if id=='M17':u['promptChain']+=['prompt-M17-motion-v2.txt'];u['issues'].append('Selected v2 removes dense background residue from v1 via built-in background extraction; v1 retained rejected.')
 if id=='M19':u['visualLocomotion']='six-phase low-hover/tendril drift';u['groundAICompatible']=True;u['issues'].append('Bottom anchor is lowest tendril/corpse contact; body intentionally reads as low-hovering.')
rejections=[
('M15-motion-v1.png','exec-0d90a64a-ff7f-4ece-8aa7-dd065480284e.png','prompt-M15-motion-v1.txt','rejected: broad gray background and oversized rightward blades'),
('M15-motion-v2.png','exec-30409fa2-71d6-42d8-b8cc-a1fa6f0c9660.png','prompt-M15-motion-v2.txt','rejected/candidate: background cleared but attack needed smaller safe layout'),
('M17-motion-v1.png','exec-b1cff459-5e49-4ef1-b323-cdac585ac0a0.png','prompt-M17-motion-v1.txt','rejected/candidate: dense low-alpha background residue'),
('minion-ranged-fx-v1.png','exec-42b932c3-1274-4448-8b74-48887589a8c2.png','prompt-minion-ranged-fx-v1.txt','rejected: gray/fog wash'),
('minion-melee-fx-v1.png','exec-4221ceb0-b62a-4cf3-817e-eaabd6ca8445.png','prompt-minion-melee-fx-v1.txt','rejected/candidate: broad faint colored edge wash; v2 removes negative-space residue')
]
meta['rejectedCandidates']=[{'file':file,'sha256':sha(ROOT/file),'sourcePath':'C:/Users/xiaohaotian/.codex/generated_images/01a1b18b-37ec-7303-8ecf-a7109deb4557/'+src,'promptFile':prompt,'reason':reason,'originalBytesPreserved':True} for file,src,prompt,reason in rejections]
meta['status']='10-units-and-2-fx-generated-measured-pending-main-integration'
meta['fx']=fx
meta['generatorCallCount']=17
meta['originalPixelEditing']='none; all PNGs copied byte-for-byte from built-in image_gen outputs; scripts only read alpha/crop and write JSON'
meta['acceptance']='First M11/M12 silhouettes/material passed primary-agent source review; this is not user final art acceptance. Remaining sources pending primary integration review.'
meta['totals']={'units':10,'characterFrames':160,'selectedFxAtlases':2,'fxFrames':sum(len(v['frames']) for v in fx.values()),'selectedPngs':12,'preservedRejectedPngs':5}
META.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':meta['status'],'totals':meta['totals'],'fx':{key:{'size':v['size'],'sha256':v['sha256'],'bytesMatch':v['originalBytesMatch'],'frames':len(v['frames']),'bands':v['measuredMaterialBandsY'],'edgeContacts':sum(f['materialTouchesIsolationEdge'] for f in v['frames']),'uniquePhases':[f['uniquePhaseMasks'] for f in v['families'].values()],'alpha':v['alpha']} for key,v in fx.items()}},ensure_ascii=False,indent=2))
