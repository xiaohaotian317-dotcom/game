"""Read alpha bounds for the generated scene atlases. No PNG pixels are changed."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]/'dist'/'assets'/'scenes'
names={'moon':['bridge','mirror','lift','switch'],'lava':['hammer','wheel','vent','chain'],'garden':['chime','vine','flower','bud']}
result={}
for scene,parts in names.items():
    im=Image.open(root/(scene+'-props-v1.png')).convert('RGBA')
    alpha=im.getchannel('A').tobytes()
    width,height=im.size
    result[scene]={}
    seen=bytearray(width*height);components=[]
    for index,value in enumerate(alpha):
        if value<180 or seen[index]:continue
        seen[index]=1;pending=[index];x0=x1=index%width;y0=y1=index//width;area=0
        while pending:
            current=pending.pop();x=current%width;y=current//width;area+=1
            x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
            for neighbor in (current-1,current+1,current-width,current+width):
                if neighbor<0 or neighbor>=width*height or seen[neighbor] or alpha[neighbor]<180:continue
                if abs(neighbor%width-x)>1:continue
                seen[neighbor]=1;pending.append(neighbor)
        if area>1000:components.append({'x':x0,'y':y0,'w':x1-x0+1,'h':y1-y0+1,'area':area})
    chosen=sorted(components,key=lambda b:b['area'],reverse=True)[:4]
    top=sorted([b for b in chosen if b['y']+b['h']/2<height/2],key=lambda b:b['x'])
    bottom=sorted([b for b in chosen if b['y']+b['h']/2>=height/2],key=lambda b:b['x'])
    if len(top)!=2 or len(bottom)!=2:raise ValueError(f'{scene}: {chosen}')
    for name,box in zip(parts,top+bottom):result[scene][name]={k:box[k] for k in ['x','y','w','h']}
    field=Image.open(root/(scene+'-field-v1.png'))
    print(scene,'field:',field.size,'atlas:',im.size,result[scene])
(root/'prop-bounds-v1.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
