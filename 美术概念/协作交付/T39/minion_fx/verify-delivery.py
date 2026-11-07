"""Read-only final original-byte, crop coverage and pivot checks."""
from pathlib import Path
from PIL import Image
import json,hashlib
root=Path(__file__).resolve().parent;m=json.loads((root/'integration-manifest.json').read_text())
out={'passed':True,'threshold':16,'pngPixelsChanged':False,'files':{},'frameCount':sum(f['frameCount'] for f in m['families'])}
for name,a in m['assets'].items():
 p=root/name;source=Path(a['sourcePath']);im=Image.open(p);w,h=im.size;alpha=im.getchannel('A').tobytes();cover=bytearray(w*h)
 frames=[(fam['id'],f) for fam in m['families'] if fam['file']==name for f in fam['frames']]
 rec={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'size':[w,h],'frames':len(frames),'geometryErrors':[]}
 for key,f in frames:
  x,y,fw,fh=f['sourceRect'];px,py=f['pivot'];valid=0<=x and 0<=y and x+fw<=w and y+fh<=h and x<=px<=x+fw and y<=py<=y+fh
  if not valid:rec['geometryErrors'].append([key,f['frame']])
  for yy in range(y,y+fh):
   for xx in range(x,x+fw):cover[yy*w+xx]+=1
 significant=[i for i,v in enumerate(alpha) if v>16]
 rec['uncoveredMaterialPixels']=sum(cover[i]==0 for i in significant)
 rec['multiplyCoveredMaterialPixels']=sum(cover[i]>1 for i in significant)
 rec['sourceByteHashEqual']=rec['sha256']==rec['sourceSha256']==a['sha256']
 rec['passed']=rec['sourceByteHashEqual'] and not rec['geometryErrors'] and rec['uncoveredMaterialPixels']==0 and rec['multiplyCoveredMaterialPixels']==0
 out['passed']=out['passed'] and rec['passed'];out['files'][name]=rec
(root/'provenance-verification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2));assert out['passed']

