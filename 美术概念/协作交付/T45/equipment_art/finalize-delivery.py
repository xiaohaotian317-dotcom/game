from pathlib import Path
import hashlib,json
base=Path(__file__).resolve().parent
meta=json.loads((base/'equipment-meta-v1.json').read_text(encoding='utf-8'))
out={'task':'T45','generator':'builtin image_gen','transparent_background':True,'records':[]}
for quality,source in meta['sources'].items():
    p=base/source['promptFile']
    out['records'].append({'quality':int(quality[1:]),'file':source['file'],'size':source['size'],'originalSourcePath':source['originalSourcePath'],'sha256':source['sha256'],'promptFile':source['promptFile'],'promptSha256':source['promptSha256'],'prompt':p.read_text(encoding='utf-8')})
(base/'equipment-prompts-v1.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
expected=[]
for q in [0,2,3,4,5]:
    for s in 'ABC':
        for k in ['melee-weapon','melee-armor','staff-weapon','staff-armor']:
            expected.append(f'q{q}-{s}-{k}')
assert set(meta['units'])==set(expected)
assert len(meta['sources'])==5
for key,unit in meta['units'].items():
    assert (base/unit['file']).is_file()
    x,y,w,h=unit['rect'];sw,sh=unit['size']
    assert x>=0 and y>=0 and w>0 and h>0 and x+w<=sw and y+h<=sh
for source in meta['sources'].values():
    assert hashlib.sha256((base/source['file']).read_bytes()).hexdigest()==source['sha256']
    assert hashlib.sha256((base/source['promptFile']).read_bytes()).hexdigest()==source['promptSha256']
checks={'status':'passed','unitCount':len(meta['units']),'sourceCount':len(meta['sources']),'allExpectedKeysPresent':True,'allRectsWithinOriginalBounds':True,'allOriginalAndPromptHashesMatch':True,'pngsModified':False}
(base/'delivery-checks-v1.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(checks,ensure_ascii=False))
