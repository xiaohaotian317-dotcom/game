from pathlib import Path
import re,json,shutil
root=Path(__file__).resolve().parents[3]
assets=root/'arcane-duel-lab/dist/assets/campaign-growth'
here=Path(__file__).resolve().parent
for filename in ['prompts-ui-v1.json','validation-ui-v1.json']:
    shutil.copyfile(assets/filename,here/filename)
html=here/'道具与地形画册.html'
refs=re.findall(r'(?:href|src)="([^"]+)"',html.read_text(encoding='utf-8'))
local=[r for r in refs if not r.startswith('#')]
missing=[r for r in local if not (here/r).exists()]
assert not missing,missing
print(json.dumps({'localReferenceCount':len(local),'missing':missing},ensure_ascii=False))
