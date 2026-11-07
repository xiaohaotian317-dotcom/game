from pathlib import Path
import json,shutil,hashlib
r=Path(__file__).resolve().parents[1]
src=r.parent/'美术概念/协作交付/T40/archive_art'
dst=r/'dist/assets/archive-ui';dst.mkdir(parents=True,exist_ok=True)
m=json.loads((src/'archive-meta-v1.json').read_text(encoding='utf-8'))
mapping={'portrait':'portraitFrame','attributes':'attributeFrame','transfer':'transferCard','experience':'experienceTrack','upgrade':'upgradeButton'}
print('elements',list(m['elements']))
# Match measured element role names without altering original PNG bytes.
keys=list(m['elements'])
for alias,index in [('portrait',0),('attributes',1),('transfer',2),('experience',3),('upgrade',4)]:
    if mapping[alias] not in m['elements']:mapping[alias]=keys[index]
file=m['file'];shutil.copy2(src/file,dst/file)
assert hashlib.sha256((dst/file).read_bytes()).hexdigest()==m['sha256']
shutil.copy2(src/'prompt-archive-controls-v1.txt',dst/'prompt-archive-controls-v1.txt')
out={'schema':1,'files':{file:{'size':[m['width'],m['height']],'sha256':m['sha256']}},'elements':{}}
for alias,key in mapping.items():
    e=m['elements'][key]
    out['elements'][alias]={**e,'file':file,'renderScale':.25}
    if alias=='transfer':out['elements'][alias]['renderScale']=.48
    print(alias,e['rect'],list(e))
(dst/'atlas-meta-v1.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
