from pathlib import Path
from PIL import Image
import hashlib,json
root=Path(__file__).resolve().parents[1]
source=root.parent/'美术概念/协作交付/T73/favorite-hero'
out=root/'dist/assets/lobby/favorite'
out.mkdir(parents=True,exist_ok=True)
versions={'fire':2,'nature':2,'frost':1,'lightning':1,'shadow':1,'star':1}
items=[]
for hero,version in versions.items():
    src=source/f'favorite-hero-{hero}-v{version}.png'
    with Image.open(src) as original:
        assert original.mode=='RGBA' and original.size==(2172,724)
        assert original.getchannel('A').getextrema()[0]==0
        image=original.resize((768,256),Image.Resampling.LANCZOS)
        target=out/f'{hero}-nameplate-v1.png'
        if target.exists():raise RuntimeError('Do not overwrite an exported frame')
        image.save(target,optimize=True)
    items.append({'hero':hero,'source':str(src.relative_to(root.parent)),'sourceSize':[2172,724],'runtime':str(target.relative_to(root)),'runtimeSize':[768,256],'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'runtimeSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'alpha':True,'renderViewBox':[0,80,2172,564]})
(out/'manifest-v1.json').write_text(json.dumps({'scope':'Noncreative equal-aspect UI texture downsample; original artwork and alpha preserved','files':items},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'frames':len(items),'bytes':sum(i['bytes'] for i in items)}))
