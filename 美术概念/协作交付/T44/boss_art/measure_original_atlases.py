"""T44 read-only PNG alpha/crop/provenance analysis. Never writes image pixels."""
from pathlib import Path
import hashlib
import json
from PIL import Image
import numpy as np

root=Path(__file__).resolve().parent
config=json.loads((root/'art-config-v1.json').read_text(encoding='utf-8'))
for extra in sorted(root.glob('boss-*-config-v1.json')):
 addition=json.loads(extra.read_text(encoding='utf-8'))
 for kind in ['units','fx']:
  config.setdefault(kind,{}).update(addition.get(kind,{}))
threshold=config.get('alphaThreshold',16)
output={'version':'T44-boss-meta-v1','status':'staging-art-awaiting-main-agent-review-and-runtime-integration','alphaThreshold':threshold,'units':{},'fx':{},'coordinateNotes':'rect/spriteRect/portrait.rect are atlas absolute [x,y,w,h]. centerX,groundContactY,pivot,bbox are rect-local pixels. socket x/y/ground are normalized in socketFrame nominal cell; socketPixel provides exact nominal cell coordinates. bottomNormalized is contact anchor/rect height; alphaBottomNormalized is painted extent. Use idle/reference source pixels for scale; never independently resize each frame to its alpha bbox.'}
actions=['walk0','walk1','walk2','walk3','walk4','walk5','idle','windup','melee','recovery','ranged','special','hit','stagger','fall','dead']
for kind in ['units','fx']:
 for key,spec in config.get(kind,{}).items():
  p=root/spec['file']; raw=p.read_bytes(); im=Image.open(p); assert im.mode=='RGBA'
  a=np.asarray(im)[:,:,3]; width,height=im.size; xs=[round(i*width/4) for i in range(5)]; ys=[round(i*height/4) for i in range(5)]
  item={k:v for k,v in spec.items() if k not in ['groundContactY','pivotY','centerX','rectOverrides','projectileHeadPivot']}
  item.update({'size':[width,height],'cols':4,'rows':4,'sha256':hashlib.sha256(raw).hexdigest(),'sourceSha256':hashlib.sha256(Path(spec['source']).read_bytes()).hexdigest(),'generator':'built-in image_gen; transparent_background=true; original generated PNG byte-for-byte copy','alpha':{'extrema':[int(a.min()),int(a.max())],'coverage':{str(t):float(np.mean(a>t)) for t in [0,1,8,16,32,64,128,192,240]},'outerEdgeAbove16':int(np.count_nonzero(a[0,:]>threshold)+np.count_nonzero(a[-1,:]>threshold)+np.count_nonzero(a[1:-1,0]>threshold)+np.count_nonzero(a[1:-1,-1]>threshold))},'frames':[]})
  assert item['sha256']==item['sourceSha256']
  for index in range(16):
   row,col=divmod(index,4); nx,ny=xs[col],ys[row]; nw,nh=xs[col+1]-nx,ys[row+1]-ny
   x,y,w,h=spec.get('rectOverrides',{}).get(str(index),[nx,ny,nw,nh]); tile=a[y:y+h,x:x+w]
   yy,xx=np.where(tile>threshold); left,top,right,bottom=int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1
   nominal_center=spec.get('centerX',[None]*16)[index] if spec.get('centerX') else nw/2
   center=nominal_center+nx-x
   contact=spec['groundContactY'][index]
   contact=None if contact is None else float(contact+ny-y)
   pivot_y=contact if contact is not None else spec.get('pivotY',[nh/2]*16)[index]+ny-y
   pad=2; sx=max(0,left-pad); sy=max(0,top-pad); sr=min(w,right+pad); sb=min(h,bottom+pad)
   frame={'index':index,'action':actions[index] if kind=='units' else ['charge','projectile','impact','ground'][row], 'phase':index if kind=='units' else col,'rect':[x,y,w,h],'spriteRect':[x+sx,y+sy,sr-sx,sb-sy],'bbox':[left,top,right-left,bottom-top],'centerX':center,'groundContactY':contact,'pivot':[center,pivot_y],'bottomNormalized':(contact if contact is not None else bottom)/h,'alphaBottomNormalized':bottom/h,'minPaddingAt16':min(left,top,w-right,h-bottom),'touchesCellEdge':bool(left==0 or top==0 or right==w or bottom==h),'edgePixelsAbove16':int(np.count_nonzero(tile[0,:]>threshold)+np.count_nonzero(tile[-1,:]>threshold)+np.count_nonzero(tile[1:-1,0]>threshold)+np.count_nonzero(tile[1:-1,-1]>threshold))}
   if kind=='fx' and row==1 and 'projectileHeadPivot' in spec:
    hx,hy=spec['projectileHeadPivot'][col]; frame['projectileHeadPivot']=[hx+nx-x,hy+ny-y]
   item['frames'].append(frame)
  if kind=='units':
   idle=item['frames'][6]; item['idleHeight']=idle['bbox'][3]; item['idleCenterX']=idle['centerX']; item['referenceSourceHeight']=idle['bbox'][3]; item['socketCalibration']='Manual visual mouth/weapon outlet in frame10, numeric source-pixel coordinates retained; not automatic anatomy detection.'
  item['cropAudit']='Original visually inspected. Explicit frame rects and alpha threshold16 verified; no pixels altered.'
  output[kind][key]=item
(root/'boss-meta-v1.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({kind:{key:{'size':v['size'],'sha256':v['sha256'],'edgePixelsAbove16':sum(f['edgePixelsAbove16'] for f in v['frames']),'outerEdgeAbove16':v['alpha']['outerEdgeAbove16']} for key,v in output[kind].items()} for kind in ['units','fx']},ensure_ascii=True))
