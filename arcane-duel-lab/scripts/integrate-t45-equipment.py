from pathlib import Path
import json,shutil,hashlib
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT.parent/'美术概念/协作交付/T45/equipment_art';DEST=ROOT/'dist/assets/equipment-sets';DEST.mkdir(parents=True,exist_ok=True)
m=json.loads((SOURCE/'equipment-meta-v1.json').read_text(encoding='utf-8-sig'));assert len(m['units'])==60
for name in {v['file'] for v in m['units'].values()}:
 shutil.copy2(SOURCE/name,DEST/name);assert hashlib.sha256((SOURCE/name).read_bytes()).digest()==hashlib.sha256((DEST/name).read_bytes()).digest()
(DEST/'atlas-meta-v1.json').write_text(json.dumps({'version':1,'units':m['units']},ensure_ascii=False,indent=2),encoding='utf-8')
print('60 equipment icons copied with measured crops')
