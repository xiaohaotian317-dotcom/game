from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[3]/'arcane-duel-lab/dist/assets/boss-fx'
meta=json.loads((root/'bounds-v2.json').read_text(encoding='utf-8'))
assert len(meta['units'])==11
for entry in list(meta['units'].values())+[meta['portal']]:
 assert len(entry['frames'])==16
 assert entry['alphaExtrema'][0]<=2
 assert (root/entry['file']).exists()
 for f in entry['frames']:assert f['bbox'][2]>0 and f['bbox'][3]>0
assert meta['platforms']['file']=='platforms-v4.png'
assert max(meta['platforms']['cornerAlpha'])==0
assert len(meta['platforms']['frames'])==12
for f in meta['platforms']['frames']:
 assert 0<f['topNormalized']<1
 assert 0<=f['standingX'][0]<f['standingX'][1]<=1
 assert f['rect'][0]>=0 and f['rect'][1]>=0
assert meta['fireEIcons']['size']==[1774,887]
gallery=Path(__file__).parent/'画册.html'
links=re.findall(r'(?:src|href)="([^"]+)"',gallery.read_text(encoding='utf-8'))
assert all((gallery.parent/v).exists() for v in links)
prompts=json.loads((root/'prompts-v2-complete.json').read_text(encoding='utf-8'))
assert len(prompts['assets'])==16
assert all(Path(a['source']).exists() for a in prompts['assets'])
print(json.dumps({'selectedBosses':11,'bossFrames':176,'portalFrames':16,'platforms':12,'icons':2,'generatedPNGs':len(prompts['assets']),'galleryLinks':len(links),'missing':[],'sourcePathsExist':True},ensure_ascii=False))

