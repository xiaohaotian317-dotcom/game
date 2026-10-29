"""Measure generated alpha bounds; never edit the image pixels."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]/'dist'/'assets'/'scenes'/'quiet'
im=Image.open(root/'terrain-quiet-v2.png');alpha=im.getchannel('A');width,height=im.size
out={}
for i,key in enumerate(['moon','lava','garden','wood']):
    x0=i%2*width//2;y0=i//2*height//2;x1=(i%2+1)*width//2;y1=(i//2+1)*height//2
    region=alpha.crop((x0,y0,x1,y1)).point(lambda p:255 if p>12 else 0)
    x,y,z,q=region.getbbox();out[key]={'x':x0+x,'y':y0+y,'w':z-x,'h':q-y}
(root/'bounds-v2.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(im.size,out)
