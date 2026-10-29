"""Copy generated images unchanged, read alpha bounds, write atlas metadata."""
from PIL import Image
from pathlib import Path
import shutil,json
src=Path('C:/Users/xiaohaotian/.codex/generated_images/01a18113-4702-7a33-9e1d-a7e53ad5324e')
root=Path('dist/assets/heroes');root.mkdir(exist_ok=True)
rigs={'frost':'fe19cca3-eef0-4572-a267-51ca7c274db8','lightning':'a341b465-36a7-4828-adef-961ebbfbb21a','shadow':'eb303c8a-476b-4651-b579-e72fcfcaee72','star':'454a4787-2924-4dbc-bb33-a3e08a880fb2'}
fx={'frost':'3d580d77-f1e7-4ef4-b1d7-fff57027a318','lightning':'1e3ec985-ef53-4a2c-b014-0d1a365acc13','shadow':'b73af150-c693-4786-91c2-1f990131da35','star':'bcbaf600-aa66-4ad7-ba30-2c625c5d926c'}
result={}
for hero,ident in rigs.items():
    path=root/(hero+'-rig-v1.png');shutil.copyfile(src/('exec-'+ident+'.png'),path)
    im=Image.open(path).convert('RGBA');width,height=im.size;alpha=im.getchannel('A').tobytes()
    assert alpha.count(0)>width*height*.1,hero+' missing transparency'
    seen=bytearray(width*height);parts=[]
    for index,value in enumerate(alpha):
        if value<50 or seen[index]:continue
        seen[index]=1;pending=[index];minx=maxx=index%width;miny=maxy=index//width;count=0
        while pending:
            i=pending.pop();x,y=i%width,i//width;minx=min(minx,x);maxx=max(maxx,x);miny=min(miny,y);maxy=max(maxy,y);count+=1
            for n in (i-1,i+1,i-width,i+width):
                if n<0 or n>=width*height or seen[n] or alpha[n]<50 or abs(n%width-x)>1:continue
                seen[n]=1;pending.append(n)
        if count>180:parts.append(dict(x=minx,y=miny,w=maxx-minx+1,h=maxy-miny+1,area=count))
    parts=sorted(parts,key=lambda b:b['area'],reverse=True)[:8]
    top=sorted([b for b in parts if b['y']+b['h']/2<height/2],key=lambda b:b['x'])
    bottom=sorted([b for b in parts if b['y']+b['h']/2>=height/2],key=lambda b:b['x'])
    assert len(top)==4 and len(bottom)==4,(hero,parts)
    result[hero]={n:{k:b[k] for k in ['x','y','w','h']} for n,b in zip(['core','upperArm','forearm','thigh','shin','cape','weapon','gear'],top+bottom)}
    fxpath=root/(hero+'-fx-v1.png');shutil.copyfile(src/('exec-'+fx[hero]+'.png'),fxpath)
    effectim=Image.open(fxpath);fw,fh=effectim.size;assert effectim.mode=='RGBA'
    result[hero]['fx']=[{'x':x*fw//2,'y':y*fh//2,'w':fw//2,'h':fh//2} for y in range(2) for x in range(2)]
    print(hero,result[hero])
(root/'bounds-v1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
