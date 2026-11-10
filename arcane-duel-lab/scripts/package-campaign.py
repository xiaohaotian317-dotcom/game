"""Versioned local delivery; never deletes or replaces a previous release."""
from pathlib import Path
import hashlib, json, shutil, zipfile, argparse

parser=argparse.ArgumentParser()
parser.add_argument('--version',default='campaign25',choices=[f'campaign{i}' for i in range(1,26)])
parser.add_argument('--report',help='JSON report filename inside validation/; defaults to <version>-package.json')
args=parser.parse_args()
version=args.version

root=Path(__file__).resolve().parents[1]
workspace=root.parent
source=root/'desktop/.build/campaign-out/ArcaneDuelCampaign-win32-x64'
output=workspace/f'发行/秘境决斗-秘境征途-{version}'
archive=output.with_suffix('.zip')
if not (source/'ArcaneDuelCampaign.exe').is_file():
    raise SystemExit('Build missing')
if output.exists() or archive.exists():
    raise SystemExit('Release already exists; choose a new version instead of overwriting')
report_name=args.report or f'{version}-package.json'
if Path(report_name).name!=report_name or not report_name.endswith('.json'):
    raise SystemExit('Report must be a JSON filename inside validation/')
def file_digest(file):
    digest=hashlib.sha256()
    with file.open('rb') as handle:
        for block in iter(lambda:handle.read(1024*1024),b''):
            digest.update(block)
    return digest.hexdigest()
metadata=json.loads((source/'版本信息.json').read_text(encoding='utf-8'))
if metadata.get('build')!=version:
    raise SystemExit('Built version does not match requested release; build the correct version first')
if version in ('campaign21','campaign22','campaign23','campaign24','campaign25') and metadata.get('lanBuild')!='android1-crossplay-v2':
    raise SystemExit('This release requires the Android/Windows crossplay build')
expected={p.relative_to(root/'dist').as_posix():file_digest(p) for p in (root/'dist').rglob('*') if p.is_file() and p.relative_to(root/'dist').parts[0] not in ('client','server','.openai')}
built={p.relative_to(source/'resources/app/dist').as_posix():file_digest(p) for p in (source/'resources/app/dist').rglob('*') if p.is_file()}
if expected!=built:
    raise SystemExit('Built web files differ from current source; freeze the web code and rebuild before packaging')
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
report={'version':version,'lanBuild':metadata.get('lanBuild'),'duelRuleset':metadata.get('duelRuleset'),'release':str(output),'exe':str(output/'ArcaneDuelCampaign.exe'),'archive':str(archive),'files':len(files),'runtimeFilesMatched':checked,'bytes':archive.stat().st_size,'sha256':file_digest(archive),'originalSitesUnchanged':True,'scope':'Matched Android/Windows LAN crossplay build; six-hero/two-chapter offline campaign with 20 story stages, 2 challenges and 1 tutorial, persistent first-run onboarding, shop entry and progression retained; manual validated whole-save export/import with pre-import backup; original Sites, campaign18/20 and older packages, real saves and full motion rollback preserved. Ads require a configured provider and confirmed completion; the Windows package has no production ad SDK. Local protocol/startup checks are not real-device crossplay, internet play, natural progression or user art approval.','nativeWindowVisualQA':False,'browserVisualQA':False,'realDeviceCrossplayQA':False,'fileSha256':{p.relative_to(output).as_posix():file_digest(p) for p in files},'sourceRuntimeSha256':expected}
(root/'validation'/report_name).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({key:value for key,value in report.items() if key not in ('fileSha256','sourceRuntimeSha256')},ensure_ascii=False,indent=2))

