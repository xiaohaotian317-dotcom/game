from pathlib import Path
import json,shutil,hashlib
r=Path(__file__).resolve().parents[1];src=r.parent/'美术概念/协作交付/T41/hud_art';dst=r/'dist/assets/realm-hud';dst.mkdir(parents=True,exist_ok=True)
m=json.loads((src/'t41-hud-meta-v1.json').read_text(encoding='utf-8'))
for name,a in m['assets'].items():
 shutil.copy2(src/name,dst/name);assert hashlib.sha256((dst/name).read_bytes()).hexdigest()==a['sha256'];shutil.copy2(src/a['promptPath'],dst/a['promptPath'])
shutil.copy2(src/'t41-hud-meta-v1.json',dst/'atlas-meta-v1.json')
print('3 PNGs, 11 titles, 2 artifacts, 3 pet gates and 11 warning rings preserved')
