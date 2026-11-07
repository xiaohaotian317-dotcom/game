"""Read-only T41 final geometry, safe-area, ring and original-byte verification."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parent;m=json.loads((ROOT/'t41-hud-meta-v1.json').read_text(encoding='utf-8'))
allFrames=m['stageTitles']+m['artifactHud']+m['petEntries']+m['bossWarnings'];out={'passed':True,'activeElementCount':len(allFrames),'files':{},'elementErrors':[]}
for name,asset in m['assets'].items():
 p=ROOT/name;source=Path(asset['sourcePath']);im=Image.open(p);w,h=im.size;a=im.getchannel('A');raw=a.tobytes();cover=bytearray(w*h);frames=[f for f in allFrames if f['file']==name];safeBad=0
 for f in frames:
  x,y,rw,rh=f['sourceRect'];ok=0<=x and 0<=y and x+rw<=w and y+rh<=h
  sr=f['safeRect'];sx,sy,sw,sh=sr;ok=ok and sx>=x and sy>=y and sx+sw<=x+rw and sy+sh<=y+rh
  safeMat=sum(a.crop((sx,sy,sx+sw,sy+sh)).histogram()[17:]);safeBad+=safeMat
  if 'slice' in f:
   l,t,r,b=f['slice'];ok=ok and l+r<rw and t+b<rh
  for key in ['topCenterSegments','bottomCenterSegments']:
   if key in f:
    for seg in f[key]:
     qx,qy,qw,qh=seg['rect'];ok=ok and qw>0 and qh>0 and qx>=x and qy>=y and qx+qw<=x+rw and qy+qh<=y+rh
  if 'avatarCircle' in f:
   cx,cy,rr=f['avatarCircle'];avat=[a.getpixel((xx,yy)) for yy in range(cy-rr,cy+rr+1) for xx in range(cx-rr,cx+rr+1) if (xx-cx)**2+(yy-cy)**2<=rr*rr]
   ok=ok and max(avat)<=16
  if 'radiusX' in f:
   ok=ok and f['radiusX']>0 and f['radiusY']>0 and x<f['center'][0]<x+rw and y<f['groundContactY']<y+rh
  if not ok:out['elementErrors'].append(f.get('id',f.get('stageId')))
  for py in range(y,y+rh):
   for px in range(x,x+rw):cover[py*w+px]+=1
 rec={'size':[w,h],'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'originalBytesEqual':p.read_bytes()==source.read_bytes(),'elements':len(frames),'safeAreaMaterialOver16Pixels':safeBad,'uncoveredMaterialOver16Pixels':sum(v>16 and cover[i]==0 for i,v in enumerate(raw)),'multiplyCoveredMaterialOver16Pixels':sum(v>16 and cover[i]>1 for i,v in enumerate(raw))}
 if rec['uncoveredMaterialOver16Pixels']:rec['uncoveredSamples']=[[i%w,i//w,v] for i,v in enumerate(raw) if v>16 and cover[i]==0][:30]
 rec['passed']=rec['originalBytesEqual'] and rec['sha256']==asset['sha256'] and safeBad==0 and rec['uncoveredMaterialOver16Pixels']==0 and rec['multiplyCoveredMaterialOver16Pixels']==0
 out['passed']=out['passed'] and rec['passed'];out['files'][name]=rec
out['passed']=bool(out['passed'] and not out['elementErrors'])
(ROOT/'provenance-verification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2));assert out['passed']

