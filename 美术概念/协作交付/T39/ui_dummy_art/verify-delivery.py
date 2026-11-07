"""Final read-only asset provenance and integration geometry verification."""
from pathlib import Path
from PIL import Image
import hashlib,json
root=Path(__file__).resolve().parent
m=json.loads((root/'integration-manifest.json').read_text(encoding='utf-8'))
out={'passed':True,'assets':{},'notes':['PNG files are never written by this script.','SourceRect/pivot geometry checks do not establish subjective art acceptance.']}
for name,rec in m['assets'].items():
 p=root/name;s=Path(rec['sourcePath']);h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
 im=Image.open(p);a=im.getchannel('A')
 check={'sha256':h(p),'sourceSha256':h(s),'hashMatchesOriginal':h(p)==h(s)==rec['sha256'],'sizeMatches':list(im.size)==[rec['width'],rec['height']],'mode':im.mode,'alphaExtrema':list(a.getextrema()),'rects':{}}
 sprites=rec.get('sprites',{}) or {str(f['id']):f for f in rec['frames']}
 for key,v in sprites.items():
  x,y,w,h2=v['sourceRect'];r=[x,y,w,h2]
  sx,sy,sw,sh=v['safeRect']
  valid=(0<=x<im.width and 0<=y<im.height and x+w<=im.width and y+h2<=im.height and sx>=x and sy>=y and sx+sw<=x+w and sy+sh<=y+h2)
  pivot=v.get('pivot')
  if pivot:valid=valid and x<=pivot[0]<=x+w and y<=pivot[1]<=y+h2
  check['rects'][key]={'sourceRect':r,'geometryValid':bool(valid)}
  out['passed']=out['passed'] and valid
 out['passed']=out['passed'] and check['hashMatchesOriginal'] and check['sizeMatches'] and a.getextrema()[0]==0
 out['assets'][name]=check
(root/'provenance-verification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
assert out['passed']

