"""Copy the original cursor atlas, prompt and measured metadata without pixel edits."""
from pathlib import Path
import hashlib,json,shutil
root=Path(__file__).resolve().parents[1]
source=root.parent/'美术概念/协作交付/T42/cursor_art'
target=root/'dist/assets/aim-cursors'
meta=json.loads((source/'cursor-meta-v1.json').read_text(encoding='utf-8'))
assert hashlib.sha256((source/meta['file']).read_bytes()).hexdigest()==meta['sha256']
target.mkdir(exist_ok=True)
for name in [meta['file'],meta['promptPath'],'cursor-meta-v1.json']:
    shutil.copyfile(source/name,target/name)
print('Original cursor PNG, complete prompt and measured metadata copied.')
