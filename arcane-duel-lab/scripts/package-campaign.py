"""Versioned local delivery; never deletes or replaces a previous release."""
from pathlib import Path
import hashlib, json, shutil, zipfile, argparse

parser=argparse.ArgumentParser()
parser.add_argument('--version',default='campaign6',choices=['campaign1','campaign2','campaign3','campaign4','campaign5','campaign6'])
version=parser.parse_args().version

root=Path(__file__).resolve().parents[1]
workspace=root.parent
source=root/'desktop/.build/campaign-out/ArcaneDuelCampaign-win32-x64'
output=workspace/f'发行/秘境决斗-秘境征途-{version}'
archive=output.with_suffix('.zip')
if not (source/'ArcaneDuelCampaign.exe').is_file():
    raise SystemExit('Build missing')
if output.exists() or archive.exists():
    raise SystemExit('Release already exists; choose a new version instead of overwriting')
output.parent.mkdir(exist_ok=True)
shutil.copytree(source,output)
digest=lambda data:hashlib.sha256(data).hexdigest()
files=sorted(p for p in output.rglob('*') if p.is_file())
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=5) as z:
    for p in files:
        z.write(p,Path(output.name)/p.relative_to(output))
with zipfile.ZipFile(archive) as z:
    assert len(z.infolist())==len(files)
    for p in files:
        assert digest(p.read_bytes())==digest(z.read(str(Path(output.name)/p.relative_to(output)).replace('\\','/'))),str(p)
runtime=output/'resources/app/dist'
checked=0
for p in runtime.rglob('*'):
    if p.is_file():
        original=root/'dist'/p.relative_to(runtime)
        assert original.is_file() and digest(original.read_bytes())==digest(p.read_bytes()),str(p)
        checked+=1
report={'version':version,'release':str(output),'exe':str(output/'ArcaneDuelCampaign.exe'),'archive':str(archive),'files':len(files),'runtimeFilesMatched':checked,'bytes':archive.stat().st_size,'sha256':digest(archive.read_bytes()),'originalSitesUnchanged':True,'scope':'Simplified pets, three forms and eight-frame walks, nine skills, independent captured traits and persistent vitals; stage4 mirror pickup/health and coin upgrades; stage6 sword-rain artifact with Q; rank3 forge ten stones','nativeWindowVisualQA':False,'browserVisualQA':True}
(root/f'validation/{version}-package.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))

