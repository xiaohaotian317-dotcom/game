"""Read alpha metadata only; original generated PNGs are preserved verbatim."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]/'dist'/'assets'/'combat'
out={}
for name,cols,rows,keys in [('fire-vfx-v2',2,2,['bolt','burst','eruption','meteor']),('nature-vfx-v2',2,2,['tree','bolt','roots','burst']),('wood-stag-v2',4,2,['run0','run1','run2','run3','idle','brace','strike','air']),('stone-covers-v2',3,1,['moon','lava','garden'])]:
    im=Image.open(root/(name+'.png')); a=im.getchannel('A'); width,height=im.size
    out[name]={};data=a.tobytes();seen=bytearray(width*height);components=[]
    for index,value in enumerate(data):
        if value<180 or seen[index]:continue
        seen[index]=1;pending=[index];x0=x1=index%width;y0=y1=index//width;area=0
        while pending:
            cur=pending.pop();x=cur%width;y=cur//width;area+=1
            x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
            for n in (cur-1,cur+1,cur-width,cur+width):
                if n<0 or n>=width*height or seen[n] or data[n]<180 or abs(n%width-x)>1:continue
                seen[n]=1;pending.append(n)
        if area>1000:components.append({'x':x0,'y':y0,'w':x1-x0+1,'h':y1-y0+1,'area':area})
    chosen=sorted(components,key=lambda b:b['area'],reverse=True)[:len(keys)]
    ordered=[]
    for row in range(rows):ordered.extend(sorted([b for b in chosen if int((b['y']+b['h']/2)/height*rows)==row],key=lambda b:b['x']))
    if len(ordered)!=len(keys):raise ValueError(str(chosen))
    for key,b in zip(keys,ordered):out[name][key]={k:b[k] for k in ['x','y','w','h']}
    print(name,im.size,out[name])
(root/'bounds-v2.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
