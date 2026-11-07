"""Read-only source art and crop mapping inspection. No image output or pixel edits."""
from pathlib import Path
from PIL import Image
import json,hashlib,re
ROOT=Path(__file__).resolve().parent
GAME=ROOT.parents[4]/'arcane-duel-lab'/'dist'
# Resolve explicitly because the handoff directory is intentionally independent of source.
GAME=Path(r'C:/Users/xiaohaotian/Desktop/双人/arcane-duel-lab/dist')
metaPath=GAME/'assets/campaign-growth/growth-ui-bounds-v1.json';meta=json.loads(metaPath.read_text(encoding='utf-8'))
quality=['白/普通','绿/一般','蓝/高级','紫/史诗','红/传说','橙/无敌']
descriptions={
'equipment':['铆钉钢铁皮革拳套','荆棘翠玉拳套','冰晶钢爪拳套','黑紫羽刃拳套','赤红龙鳞拳套','白金曜阳拳套','白晶木制长法杖','活木翠玉长法杖','冰晶银蓝长法杖','紫月悬晶长法杖','赤龙血晶长法杖','金翼曜阳长法杖'],
'armors':['钢铁锁甲战甲','翠叶荆棘战甲','银蓝冰晶板甲','黑紫鸦羽战甲','赤龙尖刺板甲','白金凤翼重甲','白布连帽长法袍','翠绿连帽法袍','蓝冰连帽法袍','紫月连帽法袍','赤龙连帽法袍','白金曜阳连帽法袍']}
report={
'task':'T39/equipment_art','status':'read-only art/crop review complete; no new image generation warranted by inspected source','decision':'Keep existing equipment-v1.png and armors-v1.png. They visibly distinguish melee and staff categories. Improve semantic UI and aspect-preserving rendering; exact user screenshot issue has not been reproduced by this static audit.',
'inputs':[],'mappingEvidence':{
'heroClass':{'melee':['lightning','shadow'],'staff':['fire','nature','frost','star']},
'itemInfo':'icon=(item.role===melee?0:6)+quality; sheet=weapon?equipment:armors',
'sheetStyle':'When meta exists, uses meta[sheet].frames[index].rect; otherwise fallback4columns3rows with same index order.',
'emptySlot':'equipmentClass(hero)===melee?0:6, already role-specific, but low-opacity/desaturated and no explicit item-class badge.',
'profileValidation':'normalizeSolo keeps equipment only when role is melee/staff and slot weapon/armor; equipped slots must match equipmentClass(hero).'},
'assets':{},'recommendations':[
'Do not replace distinct original art solely because category labels are weak. First use visible class labels/badges: 拳套/法杖 and 战甲/法袍, with melee versus caster shape cues.',
'Add the category as itemToken DOM data/class and meaningful short label, also for empty equipment slots; retain actual ownership/role checks in existing logic.',
'Preserve source aspect ratio. The current background-size math extracts a non-square sourceRect into a square item-art box, stretching the card. Use the per-frame containRelativeBox in this report for a centered span with the source rect aspect ratio, or SVG viewBox with preserveAspectRatio=meet.',
'Keep all original card borders and item shapes. Avoid RGB background removal, alpha repair or blind recropping into guessed6x2 layout; source art is4x3 with first6melee/last6staff.',
'The legal role/quality indices are distinct and match source content. This audit did not find a wrong-crop root cause for truly identical category icons. Primary agent should verify runtime DOM/image/meta and the exact user view if identical art persists.',
'Quality color alone is not the category. Existing item silhouettes already differ, and the new UI should make this obvious even when rarity borders match.'
],
'verificationLimit':'Static read and original image inspection only; no browser/runtime reproduction, no source edits, no new PNG, no subjective user acceptance.'}
for key in ['equipment','armors']:
 rec=meta[key];p=GAME/'assets/campaign-growth'/rec['file'];im=Image.open(p);a=im.getchannel('A') if im.mode=='RGBA' else None
 asset={'sourcePath':str(p),'file':rec['file'],'size':list(im.size),'mode':im.mode,'alphaExtrema':list(a.getextrema()) if a else None,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'declaredCols':rec['cols'],'declaredRows':rec['rows'],'frames':[]}
 hashes=[]
 for f in rec['frames']:
  i=f['index'];x,y,w,h=f['rect'];role='melee' if i<6 else 'staff';q=i%6
  # In-memory crop is only read for content hashing; no raster file is written.
  ch=hashlib.sha256(im.crop((x,y,x+w,y+h)).tobytes()).hexdigest();hashes.append(ch)
  fit=min(1/w,1/h);rw=w*fit;rh=h*fit
  artifact={'index':i,'role':role,'quality':q,'qualityName':quality[q],'category':('拳套' if role=='melee' else '法杖') if key=='equipment' else ('战甲' if role=='melee' else '法袍'),'visualDescription':descriptions[key][i],'sourceRect':f['rect'],'sourceAspectRatio':w/h,'center':[x+w/2,y+h/2],'centerLocal':[w/2,h/2],'containRelativeBox':{'left':(1-rw)/2,'top':(1-rh)/2,'width':rw,'height':rh},'contentPixelHash':ch,'sourceRectWithinImage':x>=0 and y>=0 and x+w<=im.width and y+h<=im.height}
  asset['frames'].append(artifact)
 asset['all12ContentCropsUnique']=len(set(hashes))==12
 asset['sameQualityRolePairsHaveDifferentContent']=[hashes[q]!=hashes[q+6] for q in range(6)]
 report['assets'][key]=asset
 report['inputs'].append({'path':str(p),'sha256':asset['sha256'],'role':'view_image inspected original source'})
report['inputs'].append({'path':str(metaPath),'sha256':hashlib.sha256(metaPath.read_bytes()).hexdigest(),'role':'read relevant equipment and armors crop sections'})
css=(GAME/'campaign-system.css').read_text(encoding='utf-8')
report['cssEvidence']=[part+'}' for part in css.split('}') if any(key in part for key in ['.item-art','.empty-equipment','.loot-token']) and len(part)<600]
report['fallbackRisk']={'source':'campaign-system-ui.mjs:16-17 and campaign.mjs:34,39','fact':'The4x3 fallback assumes equal341.33px row heights. Actual equipment row boundaries are0/318/636/1024, armors0/318/650/1024. Fallback therefore samples neighboring-row strips before metadata arrives. It does not make legal melee/staff indices equal.','recommendation':'Use explicit existing frame rects from the start or ensure metadata before panel display; refresh an open panel after async metadata arrives. Runtime reproduction is still required.'}
(ROOT/'existing-art-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'decision':report['decision'],'assets':{k:{'size':v['size'],'mode':v['mode'],'alphaExtrema':v['alphaExtrema'],'sha256':v['sha256'],'all12ContentCropsUnique':v['all12ContentCropsUnique'],'rolePairsDifferent':v['sameQualityRolePairsHaveDifferentContent']} for k,v in report['assets'].items()}},ensure_ascii=False,indent=2))

