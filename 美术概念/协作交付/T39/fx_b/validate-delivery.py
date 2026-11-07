"""Validate metadata and raw PNGs without editing pixels."""
import json,hashlib
from pathlib import Path
from PIL import Image
d=Path(__file__).parent
out={}
for hero in ['star','lightning','shadow']:
    m=json.loads((d/(hero+'-manifest-v2.json')).read_text(encoding='utf-8'))
    a=Image.open(d/m['file']).getchannel('A')
    bad=[]; hashes=[]
    for f in m['frames']:
        x,y,w,h=f['rect']; box=a.crop((x,y,x+w,y+h)); p=box.load()
        edge=[p[u,0] for u in range(w)]+[p[u,h-1] for u in range(w)]+[p[0,v] for v in range(h)]+[p[w-1,v] for v in range(h)]
        hashes.append(hashlib.sha256(box.tobytes()).hexdigest())
        if max(edge)>64:
            bad.append({'frame':f['index'],'maxEdgeAlpha':max(edge),'edgePixelsAlphaAbove64':sum(v>64 for v in edge)})
        assert 0<=x<x+w<=m['size'][0] and 0<=y<y+h<=m['size'][1]
        assert 0<=f['pivot'][0]<=w and 0<=f['pivot'][1]<=h
    out[hero]={'uniqueAlphaTiles':len(set(hashes)),'strongEdgePixels':bad,'framesAndPivotsInBounds':True,'rawCopyHashMatchesOriginal':m['rawCopyHashMatchesOriginal']}
(d/'validation-v2.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,indent=2))

