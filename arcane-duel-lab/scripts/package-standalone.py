"""Package the standalone runtime only; never include local databases or credentials."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import tarfile

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('output',type=Path)
args=parser.parse_args()
files=[root/'package.json',root/'.dockerignore',root/'scripts/serve.mjs',root/'scripts/audit-duel-online.mjs']
files+=sorted((root/'server').glob('*.mjs'))
files+=sorted((root/'drizzle').glob('*.sql'))
files+=[p for p in sorted((root/'dist').rglob('*')) if p.is_file() and p.relative_to(root/'dist').parts[0] not in {'client','server','.openai'}]
files+=[root/'deploy/standalone'/name for name in ['Dockerfile','compose.yaml','Caddyfile','.env.example','README.md']]
prefix='arcane-duel-standalone'
manifest={'purpose':'Standalone game and room service; not a Sites deployment archive','files':[]}
args.output.parent.mkdir(parents=True,exist_ok=True)
with tarfile.open(args.output,'w:gz') as archive:
    for p in files:
        if p.is_symlink():raise RuntimeError('Do not package symlinks: '+str(p))
        relative=p.relative_to(root).as_posix()
        data=p.read_bytes()
        manifest['files'].append({'path':relative,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        archive.add(p,arcname=prefix+'/'+relative,recursive=False)
    data=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    info=tarfile.TarInfo(prefix+'/DEPLOYMENT-MANIFEST.json');info.size=len(data);info.mode=0o644
    archive.addfile(info,io.BytesIO(data))
print(json.dumps({'archive':str(args.output.resolve()),'files':len(files)+1,'bytes':args.output.stat().st_size},ensure_ascii=False))
