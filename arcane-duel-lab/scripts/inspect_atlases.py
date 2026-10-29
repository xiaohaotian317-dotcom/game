"""Read transparent atlas component bounds. No source pixels are modified."""
from PIL import Image
from pathlib import Path
from collections import deque
import json
root = Path(__file__).resolve().parents[1] / "dist" / "assets"
names = ["torso", "head", "upperArm", "forearm", "thigh", "shin", "cape", "weapon"]
result = {}
for hero in ["fire", "nature"]:
    im = Image.open(root / (hero + "-rig.png")).convert("RGBA")
    width, height = im.size
    alpha = im.getchannel("A").tobytes()
    if alpha.count(0) < width * height * .1:
        raise ValueError("Atlas background is not transparent")
    seen = bytearray(width * height)
    parts = []
    for index, value in enumerate(alpha):
        if value < 50 or seen[index]:
            continue
        seen[index] = 1
        pending = [index]
        minx=maxx=index % width
        miny=maxy=index // width
        count=0
        while pending:
            i=pending.pop()
            x,y=i%width,i//width
            minx=min(minx,x);maxx=max(maxx,x);miny=min(miny,y);maxy=max(maxy,y)
            count+=1
            for n in (i-1,i+1,i-width,i+width):
                if n<0 or n>=width*height or seen[n] or alpha[n]<50:
                    continue
                if abs((n%width)-x)>1:
                    continue
                seen[n]=1
                pending.append(n)
        if count>800:
            parts.append(dict(x=minx,y=miny,w=maxx-minx+1,h=maxy-miny+1,area=count))
    parts=sorted(parts,key=lambda b:b["area"],reverse=True)[:8]
    top=sorted([b for b in parts if b["y"]+b["h"]/2<height/2],key=lambda b:b["x"])
    bottom=sorted([b for b in parts if b["y"]+b["h"]/2>=height/2],key=lambda b:b["x"])
    if len(top)!=4 or len(bottom)!=4:
        raise ValueError(f"{hero}: expected 4+4 parts, got {parts}")
    result[hero]={n:{k:b[k] for k in ["x","y","w","h"]} for n,b in zip(names,top+bottom)}
    print(hero, result[hero])
(root/"rig-bounds.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
