"""Read-only PNG alpha/crop audit. Never writes or changes image pixels."""
import hashlib,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
FILES={
'ornate-controls-v1.png':[
('closeNormal',(0,0,515,429)),('closeHover',(515,0,1028,429)),('closePressed',(1028,0,1536,429)),
('sceneSelect',(0,429,1536,715)),('back',(0,715,768,1024)),('enter',(768,715,1536,1024))],
'training-sentinel-v1.png':[(str(r*4+c),(c*384,r*512,(c+1)*384,(r+1)*512)) for r in range(2) for c in range(4)]
}
def bbox_for(a,box,t):
 x0,y0,x1,y1=box
 xs=[];ys=[]
 for y in range(y0,y1):
  for x in range(x0,x1):
   if a.getpixel((x,y))>t:xs.append(x);ys.append(y)
 return [min(xs),min(ys),max(xs)-min(xs)+1,max(ys)-min(ys)+1] if xs else None
report={'method':'Read-only alpha channel analysis; image bytes unchanged; crop rectangles use x,y,width,height; thresholds strict greater-than. Regions partition actual visual elements; 4x2 search grid is not treated as final crop.'}
for name,regions in FILES.items():
 p=ROOT/name;im=Image.open(p);a=im.getchannel('A');h=a.histogram()
 rec={'file':name,'width':im.width,'height':im.height,'mode':im.mode,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'alphaExtrema':a.getextrema(),'alphaZeroPixels':h[0],'alphaNonzeroPixels':im.width*im.height-h[0],'alphaOpaquePixels':h[255],'regions':{}}
 for key,box in regions:
  local={'searchRect':[box[0],box[1],box[2]-box[0],box[3]-box[1]],'alphaBounds':{str(t):bbox_for(a,box,t) for t in [0,8,16,64,128,220]}}
  # Actual bottom opaque-body columns; useful for locating foot contacts separately from tiny effects.
  local['bottomBodyRows']=[]
  for y in range(max(box[1],box[3]-100),box[3]):
   spans=[x for x in range(box[0],box[2]) if a.getpixel((x,y))>128]
   if len(spans)>=12:local['bottomBodyRows'].append([y,min(spans),max(spans),len(spans)])
  rec['regions'][key]=local
 report[name]=rec
(ROOT/'alpha-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k=='method'},ensure_ascii=False))
for n in FILES:
 r=report[n];print(n,{k:r[k] for k in ['width','height','mode','sha256','bytes','alphaExtrema','alphaZeroPixels','alphaOpaquePixels']})
 for key,v in r['regions'].items():
  print(key,v['alphaBounds'],'bottom128',v['bottomBodyRows'][-5:])

