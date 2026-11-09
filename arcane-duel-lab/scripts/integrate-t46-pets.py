"""Copy selected original T46 PNGs and normalize measured runtime coordinates."""
from pathlib import Path
import hashlib, json, shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / '美术概念/协作交付/T46'
DEST = ROOT / 'dist/assets/pets/presentation'
DEST.mkdir(parents=True, exist_ok=True)
skills = json.loads((SOURCE/'pet_skill_art/pet-skills-meta-v2.json').read_text(encoding='utf-8-sig'))
juvenile = json.loads((SOURCE/'juvenile_art/juvenile-meta-v1.json').read_text(encoding='utf-8-sig'))
result = {'version': 2, 'files': [], 'sources': {}, 'skills': {}, 'juveniles': {}}

def copy_original(folder, name, info):
    source = SOURCE/folder/name
    assert hashlib.sha256(source.read_bytes()).hexdigest() == info['sha256'], name
    shutil.copy2(source, DEST/name)
    assert source.read_bytes() == (DEST/name).read_bytes(), name
    result['files'].append(name)
    result['sources'][name] = {k: info[k] for k in ('size', 'sha256', 'source')}

for name in skills['selectedFiles']:
    copy_original('pet_skill_art', name, skills['files'][name])
for kind, rows in skills['skills'].items():
    result['skills'][kind] = []
    for row in rows:
        icon = dict(row['icon'])
        x,y,w,h = icon['rect']
        side = max(w,h)
        icon['rect'] = [x-(side-w)/2, y-(side-h)/2, side, side]
        icon['size'] = skills['files'][icon['file']]['size']
        assert row['file'] in skills['selectedFiles']
        result['skills'][kind].append({**row, 'referenceWidth': row['referenceSourceWidth'], 'icon': icon})
for key in ('motion', 'ui'):
    info = juvenile[key]
    copy_original('juvenile_art', info['file'], info)
motion, ui = juvenile['motion'], juvenile['ui']
result['juveniles']['mossdeer'] = {
    **{k: motion[k] for k in ('file', 'frames', 'naturalHeight', 'referenceSourceHeight')},
    'portrait': {'file': ui['file'], 'rect': ui['faceSquare'], 'size': ui['size']},
}
(DEST/'presentation-meta-v2.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"{len(result['files'])} original PNGs, 12 skill rows, 16 juvenile poses copied and hash checked")
