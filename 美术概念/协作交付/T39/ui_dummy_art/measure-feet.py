from PIL import Image
from pathlib import Path
im=Image.open(Path(__file__).resolve().parent/'training-sentinel-v1.png').getchannel('A')
regions=[(40,40,365,470),(410,40,750,470),(795,70,1120,470),(1152,40,1526,470),(40,560,365,983),(400,575,745,983),(758,675,1110,984),(1180,560,1515,983)]
for i,(x0,y0,x1,y1) in enumerate(regions):
 y=450 if i<4 else 962
 runs=[];s=None
 for x in range(x0,x1):
  on=im.getpixel((x,y))>128
  if on and s is None:s=x
  if not on and s is not None:runs.append([s,x-1]);s=None
 if s is not None:runs.append([s,x1-1])
 print(i,y,runs)

