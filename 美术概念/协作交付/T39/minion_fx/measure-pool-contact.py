from PIL import Image
from pathlib import Path
import json
root=Path(__file__).resolve().parent
d=json.loads((root/'frame-measurements.json').read_text());a=Image.open(root/'ranged-v1.png').getchannel('A');p=a.load();out=[]
for f in d['ranged-v1.png'][24:]:
 x,y,w,h=f['sourceRect'];rows=[]
 for yy in range(y,y+h):
  xs=[xx for xx in range(x,x+w) if p[xx,yy]>128]
  if xs:rows.append((len(xs),yy,min(xs),max(xs)))
 peak=max(n for n,yy,xx,ex in rows);band=[r for r in rows if r[0]>=peak*.90]
 anchorY=round(sum(yy for n,yy,xx,ex in band)/len(band));centerX=round(sum((xx+ex)/2 for n,yy,xx,ex in band)/len(band))
 out.append({'row':f['row'],'col':f['column'],'groundContactCenter':[centerX,anchorY],'contactBand90pct':[min(r[1] for r in band),max(r[1] for r in band)],'peakSpanPixels':peak,'maximumRow':max(rows)})
print(json.dumps(out,indent=2));(root/'pool-contact-audit.json').write_text(json.dumps(out,indent=2),encoding='utf-8')

