"""Integrate measured original full-body atlases; do not rewrite source pixels."""
from pathlib import Path
import argparse, hashlib, json, shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / '美术概念/协作交付/T46'
DEST = ROOT / 'dist/assets/enemies/chapter2'
parser = argparse.ArgumentParser()
parser.add_argument('--partial', action='store_true')
args = parser.parse_args()
result = json.loads((DEST/'bounds-v1.json').read_text(encoding='utf-8-sig'))
result['version'] = 2
result['bodyRevision'] = 'T46-full-body'
audit = {}
for folder in ['boss_body_a', 'boss_body_b', 'boss_b12_redesign']:
    meta = SOURCE/folder/'boss-body-meta-v3.json'
    if not meta.exists():
        if args.partial:
            continue
        raise SystemExit(f'Missing measured delivery: {meta}')
    delivery = json.loads(meta.read_text(encoding='utf-8-sig'))
    for key, unit in delivery['units'].items():
        if folder == 'boss_body_a' and key == 'B12' and not args.partial:
            continue  # Rejected curled crab body is only a temporary preview fallback.
        original = SOURCE/folder/unit['file']
        sha = hashlib.sha256(original.read_bytes()).hexdigest()
        assert sha == unit['sha256'] == unit['sourceSha256'], key
        assert len(unit['frames']) == 16 and unit['referenceSourceHeight'] > 0, key
        assert unit['portrait']['rect'][2] == unit['portrait']['rect'][3], key
        for frame in unit['frames']:
            assert frame['spriteRect'][2] > 0 and frame['spriteRect'][3] > 0
            assert len(frame['pivot']) == 2 and 0 <= frame['groundContactY'] <= frame['rect'][3]
        shutil.copy2(original, DEST/unit['file'])
        assert (DEST/unit['file']).read_bytes() == original.read_bytes(), key
        result['units'][key] = {**unit, 'file': 'chapter2/'+unit['file']}
        audit[key] = {'id':key, 'file':unit['file'], 'sha256':sha, 'source':unit['source'], 'referenceSourceHeight':unit['referenceSourceHeight'], 'pixelsEdited':False}
if not args.partial:
    assert set(audit) == {f'B{n}' for n in range(12,21)}
(DEST/'bounds-v2.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
(ROOT/'validation/campaign18-boss-body-provenance.json').write_text(json.dumps({'status':'integrated-original-bytes-verified','scope':'Original full-body 16-pose redesigns; chapter-one bodies preserved; user art acceptance tracked separately','bodies':list(audit.values())}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(audit)} original boss atlases copied, hash checked; {len(result["units"])} active chapter-two enemies')
