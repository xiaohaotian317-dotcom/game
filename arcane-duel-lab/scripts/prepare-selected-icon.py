"""Export standard Android density assets; preserve the selected generated original."""
from pathlib import Path
import hashlib,json,shutil
from PIL import Image

root=Path(__file__).resolve().parents[1]
source=root.parent/'美术概念/协作交付/T62/app-icon-B/app-icon-B-v2.png'
expected='495e7f3a99817d21d345181aed4b796749dbbdddcbc7e864fc98427df45ede47'
assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
destination=root/'dist/assets/mobile/app-icon-v4.png'
shutil.copyfile(source,destination)
image=Image.open(source).convert('RGBA')
assert image.width==image.height
res=root/'mobile/android/app/src/main/res'
files=[]
for density,size,layer in [('mdpi',48,108),('hdpi',72,162),('xhdpi',96,216),('xxhdpi',144,324),('xxxhdpi',192,432)]:
    folder=res/('mipmap-'+density)
    for name in ['ic_launcher','ic_launcher_round']:
        target=folder/(name+'.png')
        image.resize((size,size),Image.Resampling.LANCZOS).save(target)
        files.append({'path':target.relative_to(root).as_posix(),'size':[size,size]})
    # Android masks the central 72dp of its 108dp adaptive layer. Preserve the
    # complete square painting there so the face is not unexpectedly zoomed in.
    visible=round(layer*2/3)
    foreground=Image.new('RGBA',(layer,layer),(0,0,0,0))
    scaled=image.resize((visible,visible),Image.Resampling.LANCZOS)
    offset=(layer-visible)//2
    foreground.alpha_composite(scaled,(offset,offset))
    target=folder/'ic_launcher_foreground.png'
    foreground.save(target)
    files.append({'path':target.relative_to(root).as_posix(),'size':[layer,layer],'contentRect':[offset,offset,visible,visible]})
assert destination.read_bytes()==source.read_bytes()
report={'chosenByUser':'B / 焰术师近脸 v2','originalSha256':expected,'sourcePixelsEdited':False,'nativeExport':'Proportional LANCZOS sizing only; adaptive foreground padded to the Android central 72dp viewport. No painted retouching or generative source edits.','files':files}
(root/'validation/t64-icon-exports.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'sameOriginal':True,'densityExports':len(files)}))
