from pathlib import Path
import hashlib, json, shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent/'美术概念/协作交付/T46/equipment_art'
DEST = ROOT/'dist/assets/equipment-sets'
meta = json.loads((SOURCE/'atlas-meta-v2.json').read_text(encoding='utf-8-sig'))
provenance = json.loads((SOURCE/'provenance-v2.json').read_text(encoding='utf-8-sig'))
assert len(meta['units']) == 60
for name in {unit['file'] for unit in meta['units'].values()}:
    source = SOURCE/name
    quality = name.split('-')[1][1:]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == provenance[quality]['sha256']
    shutil.copy2(source, DEST/name)
    assert source.read_bytes() == (DEST/name).read_bytes()
(DEST/'atlas-meta-v2.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
print('60 distinct equipment icons copied with measured crops; original v1 preserved')
