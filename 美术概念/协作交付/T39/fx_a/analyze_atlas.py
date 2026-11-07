"""Read-only original-PNG alpha/crop measurement. Writes JSON only, never images."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('hero')
parser.add_argument('--version', default='2')
parser.add_argument('--reference', default=None)
parser.add_argument('--source', required=True)
parser.add_argument('--anchors', required=True, help='JSON list: 3 {id,name,type,pivot:[x,y]} entries')
args = parser.parse_args()
root = Path(__file__).resolve().parent
image_path = root / f'hero-{args.hero}-fx-v{args.version}.png'
prompt_path = root / f'{args.hero}-prompt-v{args.version}.txt'
source_path = Path(args.source)
skills = json.loads(args.anchors)
raw = image_path.read_bytes()
im = Image.open(image_path)
assert im.mode == 'RGBA', im.mode
assert im.size == (1024, 1536), im.size
pixels = np.asarray(im)
alpha = pixels[:, :, 3]
threshold = 16
report = {
    'version': f'T39-{args.hero}-fx-v{args.version}',
    'status': 'concept-delivered-awaiting-main-agent-integration-and-user-review',
    'file': image_path.name,
    'source': str(source_path),
    'generator': 'built-in image_gen; transparent_background=true; one call for this output' + ('; edit from retained earlier image_gen output' if args.reference else '; new generation'),
    'referenceImage': args.reference,
    'promptFile': prompt_path.name,
    'originalPixelsPreserved': True,
    'sha256': hashlib.sha256(raw).hexdigest(),
    'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
    'size': list(im.size),
    'mode': im.mode,
    'cols': 4,
    'rows': 6,
    'frameCount': 24,
    'alphaThreshold': threshold,
    'alpha': {
        'min': int(alpha.min()), 'max': int(alpha.max()),
        'transparentPixels': int(np.count_nonzero(alpha == 0)),
        'nearTransparentPixelsAtMost1': int(np.count_nonzero(alpha <= 1)),
        'coverageByThreshold': {str(t): float(np.mean(alpha > t)) for t in (0, 1, 8, 16, 32, 64, 128, 192, 240)},
        'outerEdgePixelsAbove16': int(np.count_nonzero(alpha[0, :] > threshold) + np.count_nonzero(alpha[-1, :] > threshold) + np.count_nonzero(alpha[1:-1, 0] > threshold) + np.count_nonzero(alpha[1:-1, -1] > threshold)),
    },
    'gridAudit': {
        'method': 'Visually checked original; threshold16 alpha counted on every internal seam. Explicit rects below remain authoritative.',
        'verticalSeamsAbove16': {str(x): int(np.count_nonzero(alpha[:, x] > threshold)) for x in (255, 256, 511, 512, 767, 768)},
        'horizontalSeamsAbove16': {str(y): int(np.count_nonzero(alpha[y, :] > threshold)) for y in (255, 256, 511, 512, 767, 768, 1023, 1024, 1279, 1280)},
    },
    'coordinateNotes': 'rect and spriteRect are absolute atlas pixels [x,y,w,h]; bbox and pivot/centerX/groundContactY are local to rect. Pivot is semantic fixed anchor, not changing alpha-bbox center. For ground spell use groundContactY at contact-plane ellipse center, not bottom of decorative glow.',
    'sequence': 'Each skill reads four frames in first row, then four frames in second row. 0-1 growth, 2-5 coherent primary motion, 6-7 dissipation.',
    'skills': [],
}
for skill_index, skill in enumerate(skills):
    entry = dict(skill)
    entry['frames'] = []
    for phase in range(8):
        row, col = skill_index * 2 + phase // 4, phase % 4
        top_padding = int(skill.get('cropTopPadding', 0))
        x, y = col * 256, row * 256 - top_padding
        frame_height = 256 + top_padding
        tile = alpha[y:y+frame_height, x:x+256]
        yy, xx = np.where(tile > threshold)
        left, top, right, bottom = int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1
        frame = {
            'index': skill_index * 8 + phase,
            'phase': phase,
            'stage': 'growth' if phase < 2 else 'primary' if phase < 6 else 'dissipation',
            'rect': [x, y, 256, frame_height],
            'spriteRect': [x + left, y + top, right - left, bottom - top],
            'bbox': [left, top, right - left, bottom - top],
            'centerX': skill['pivot'][0],
            'pivot': skill['pivot'],
            'alphaBboxCenter': [(left+right)/2, (top+bottom)/2],
            'alpha16Pixels': int(np.count_nonzero(tile > threshold)),
            'edgePixelsAbove16': int(np.count_nonzero(tile[0, :] > threshold)+np.count_nonzero(tile[-1, :] > threshold)+np.count_nonzero(tile[1:-1, 0] > threshold)+np.count_nonzero(tile[1:-1, -1] > threshold)),
            'minPaddingAt16': min(left, top, 256-right, frame_height-bottom),
        }
        if skill['type'] == 'ground':
            frame['groundContactY'] = skill['pivot'][1]
        entry['frames'].append(frame)
    report['skills'].append(entry)
assert report['sha256'] == report['sourceSha256'], 'Copy changed bytes'
out = root / f'{args.hero}-atlas-v{args.version}.json'
out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'report': str(out), 'sha256': report['sha256'], 'alpha': report['alpha'], 'gridAudit': report['gridAudit']}, ensure_ascii=False))
