"""Copy generated PNGs unchanged; read atlas alpha and complete sprite bounds."""
from pathlib import Path
from PIL import Image
import shutil,json
source=Path('C:/Users/xiaohaotian/.codex/generated_images/01a18113-4702-7a33-9e1d-a7e53ad5324e')
out=Path('dist/assets/heroes')
files={'lightning-core-v2.png':'7d99fad5-d6f2-4463-b1fc-f7443e0988e9','frost-fx-v2.png':'fe9d0411-fd6f-4142-83fc-32fb4a349793','lightning-fx-v2.png':'ba313f18-4948-4937-9ba6-b8000c30dbcc','shadow-fx-v2.png':'fe6d8d80-6338-4ad4-94a3-478311f94a7c','star-fx-v2.png':'ab11ea1a-0eb7-47d5-b233-131b5e53856f'}
for name,ident in files.items():
    shutil.copyfile(source/('exec-'+ident+'.png'),out/name)
    im=Image.open(out/name);assert im.mode=='RGBA';assert im.getchannel('A').tobytes().count(0)>im.width*im.height*.05,name+' lacks alpha'
    print(name,im.size)
# Rectangles follow the actual painted silhouette; they need not match grid lines.
regions={
 'frost':[(0,48,770,332),(780,92,756,330),(90,370,540,650),(660,405,876,619)],
 'lightning':[(0,0,816,512),(840,0,696,560),(60,490,655,534),(900,525,560,499)],
 'shadow':[(30,10,740,445),(785,0,751,510),(72,430,610,594),(776,552,760,472)],
 'star':[(0,28,856,347),(845,0,691,453),(74,365,590,659),(720,435,816,589)]}
result={h:{'fx':[dict(zip(['x','y','w','h'],r)) for r in boxes]} for h,boxes in regions.items()}
im=Image.open(out/'lightning-core-v2.png');a=im.getchannel('A');box=a.point(lambda v:255 if v>=100 else 0).crop((50,0,510,530)).getbbox();assert box
x,y,r,b=box;result['lightning']['core']={'x':x+50,'y':y,'w':r-x,'h':b-y}
# Read-only bounds audit, useful for catching the former y=512 head clipping.
for h,row in result.items():
    for r in row['fx']:
        assert r['x']>=0 and r['y']>=0 and r['x']+r['w']<=1536 and r['y']+r['h']<=1024
assert result['frost']['fx'][3]['y']<430 and result['frost']['fx'][2]['y']<430
(out/'refinement-bounds-v2.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('lightning core:',result['lightning']['core'])
