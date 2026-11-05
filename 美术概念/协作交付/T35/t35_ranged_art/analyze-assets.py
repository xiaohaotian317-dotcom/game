from PIL import Image
from pathlib import Path
import hashlib, json, sys

root = Path(__file__).resolve().parent
version = sys.argv[1] if len(sys.argv) > 1 else 'v1'
assert version in ['v1', 'v2']
asset = root / ('hybrid-projectiles-' + version + '.png')
im = Image.open(asset)
alpha = im.getchannel('A')
phases = ['launch', 'flightA', 'flightB', 'impact']
pivots = [[120, 260], [198, 256], [198, 256], [254, 256], [104, 264], [210, 260], [210, 260], [222, 264]]
frames = []
validation = []
for index in range(8):
    x, y = (index % 4) * 384, (index // 4) * 512
    tile = alpha.crop((x, y, x + 384, y + 512))
    bounds = tile.point(lambda v: 255 if v > 32 else 0).getbbox()
    b = list(bounds)
    frames.append({
        'index': index, 'hero': 'lightning' if index < 4 else 'shadow',
        'phase': phases[index % 4], 'rect': [x, y, 384, 512],
        'pivot': pivots[index], 'contentBoundsAlpha32': b,
        'direction': 'right', 'mirrorLeft': True,
        'recommendedBlend': 'lighter' if index < 4 else 'source-over',
    })
    edge = []
    for px in range(384):
        edge.extend([tile.getpixel((px, 0)), tile.getpixel((px, 511))])
    for py in range(512):
        edge.extend([tile.getpixel((0, py)), tile.getpixel((383, py))])
    validation.append({
        'index': index, 'alphaExtrema': list(tile.getextrema()),
        'edgeAlphaMax': max(edge), 'edgeAlphaMean': round(sum(edge) / len(edge), 3),
        'contentInsetAlpha32': [b[0], b[1], 384 - b[2], 512 - b[3]],
        'contentIsolated': all([b[0] > 0, b[1] > 0, b[2] < 384, b[3] < 512]),
    })
meta = {
    'schema': 1, 'task': 'T35', 'status': 'art-delivery-only; main-agent integration pending',
    'file': asset.name, 'mode': im.mode, 'size': list(im.size),
    'sha256': hashlib.sha256(asset.read_bytes()).hexdigest(),
    'grid': {'columns': 4, 'rows': 2, 'cell': [384, 512]},
    'frames': frames,
    'playback': {
        'launchDuration': 0.09, 'flightLoop': [1, 2], 'flightFrameSeconds': 0.075,
        'impactDuration': 0.16,
        'note': 'Per-hero indices add 4 for shadow. Animate material with uniform scale/rotation/opacity; do not stretch or rebuild the PNG. Keep flight pivots stable. Spawn launch at real hand/weapon socket and impact at collision point. Values are integration suggestions, not user-locked balance.',
    },
    'notes': [
        'All rects and pivots use original native pixels. Pivot is local to each rect. All sprites right-facing; flip at render time for left.',
        'Core alpha>32 silhouettes isolated in each cell. Faint alpha can remain in outer bloom; preserve original alpha. No scripted background removal or pixel alteration was applied. v2 is preferred because the built-in image edit removed the sheet-wide low-alpha wash.',
        'Top-row launch source and impact contact point differ from in-flight visual centers; use phase pivot rather than tile midpoint.',
        'Shadow smoke contains deliberate dark strokes; source-over keeps raven/steel material. Additive blend would erase the black feather silhouette.',
        'Use 150-180 world-unit full-cell width for flight as a starting point, preserving 384:512 ratio; actual visible projectile core is about 125-150 wide. Impact may be slightly larger, not screen filling.',
    ],
}
(root / ('projectile-meta-' + version + '.json')).write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
report = {
    'file': asset.name, 'size': list(im.size), 'mode': im.mode,
    'sha256': meta['sha256'], 'alphaExtrema': list(alpha.getextrema()),
    'zeroAlphaFraction': alpha.histogram()[0] / (im.width * im.height),
    'lowAlpha32Fraction': sum(alpha.histogram()[:33]) / (im.width * im.height),
    'frames': validation, 'allContentIsolatedAlpha32': all(v['contentIsolated'] for v in validation),
    'method': 'Pillow read-only channel, bounds, and edge analysis; original PNG bytes unchanged.',
}
(root / ('alpha-validation-' + version + '.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
