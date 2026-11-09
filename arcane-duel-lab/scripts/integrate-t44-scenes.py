from pathlib import Path
import json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT.parent/'美术概念/协作交付/T44/scene_art';DEST=ROOT/'dist/assets/campaign/chapter2';DEST.mkdir(parents=True,exist_ok=True)
meta=json.loads((SOURCE/'scene-meta-v1.json').read_text(encoding='utf-8-sig'))
files={meta['world']['file'],*[v['file'] for v in meta['stages'].values()],*[v['file'] for key in ['platforms','ground','nameplates','bossHuds','warnings'] for v in meta[key]]}
audit=[]
for name in sorted(files):
 source=SOURCE/name;shutil.copy2(source,DEST/name);sha=hashlib.sha256(source.read_bytes()).hexdigest();assert hashlib.sha256((DEST/name).read_bytes()).hexdigest()==sha;audit.append({'file':name,'sha256':sha})
(DEST/'scene-meta-v1.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'validation/campaign18-scene-provenance.json').write_text(json.dumps({'files':audit,'pixelsEdited':False,'status':'copied-pending-runtime-QA'},ensure_ascii=False,indent=2),encoding='utf-8')
print(len(files),'scene originals copied')
