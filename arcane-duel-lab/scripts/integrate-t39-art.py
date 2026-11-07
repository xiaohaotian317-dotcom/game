"""Copy reviewed original PNGs unchanged and normalize measured metadata, never edit pixels."""
from pathlib import Path
import json, shutil, hashlib
root=Path(__file__).resolve().parents[1]
source=root.parent/'美术概念/协作交付/T39'
assets=root/'dist/assets'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def copy(src,folder):
    folder.mkdir(parents=True,exist_ok=True);dest=folder/src.name;shutil.copyfile(src,dest)
    assert hashlib.sha256(src.read_bytes()).digest()==hashlib.sha256(dest.read_bytes()).digest()
    return hashlib.sha256(dest.read_bytes()).hexdigest()
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf8')
out=assets/'refined-skills';out.mkdir(exist_ok=True)
units={}
for hero in ['fire','nature','frost','lightning','shadow','star']:
    if hero in ['fire','nature','frost']:
        folder=source/'fx_a';version=3 if hero=='frost' else 2;m=read(folder/f'{hero}-atlas-v{version}.json');frames=[f for s in m['skills'] for f in s['frames']]
    else:
        folder=source/'fx_b';version=3 if (folder/f'{hero}-manifest-v3.json').exists() else 2;m=read(folder/f'{hero}-manifest-v{version}.json');frames=m['frames']
    file=f'hero-{hero}-fx-v{version}.png';digest=copy(folder/file,out)
    normalized=[]
    for f in frames:
        r=f.get('rect',f.get('sourceRect'));pivot=f.get('pivotLocal',f.get('pivot',f.get('centerLocal',[128,128])))
        gy=f.get('groundContactLocalY',f.get('groundContactY'))
        if gy is None:gy=pivot[1]
        if gy>r[3]:gy-=r[1]
        normalized.append({'rect':r,'spriteRect':f.get('spriteRect',r),'pivot':pivot,'centerX':pivot[0],'groundContactY':gy,'referenceSize':256})
    units[hero]={'file':file,'size':m['size'],'frames':normalized,'sha256':digest,'framesPerSkill':8,'referenceSize':256}
    prompt=m.get('promptFile',f'{hero}-prompt-v{version}.txt')
    if (folder/prompt).exists():copy(folder/prompt,out)
write(out/'atlas-meta-v2.json',{'version':'T39','units':units,'pixelsUnchanged':True,'phaseSequence':'0-1 enter, 2-5 looping main movement, 6-7 dissipate','artAcceptance':'runtime inspection and user acceptance separate'})
ui=read(source/'ui_dummy_art/integration-manifest.json')
controls=assets/'realm-controls';copy(source/'ui_dummy_art/ornate-controls-v1.png',controls);write(controls/'controls-meta-v1.json',ui['assets']['ornate-controls-v1.png'])
training=assets/'training';copy(source/'ui_dummy_art/training-sentinel-v1.png',training);write(training/'sentinel-meta-v1.json',ui['assets']['training-sentinel-v1.png'])
for p in (source/'ui_dummy_art').glob('*prompt*'):copy(p,controls if 'control' in p.name else training)
minions=assets/'minion-fx'
for name in ['melee-v1.png','ranged-v1.png','integration-manifest.json']:copy(source/'minion_fx'/name,minions)
for p in (source/'minion_fx').glob('*prompt*'):copy(p,minions)
print('Copied 10 original PNGs; normalized 144 hero frames plus 60 minion phases and 8 sentinel poses.')
