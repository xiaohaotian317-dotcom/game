"""Build T41 handoff metadata from measured source images, without any PNG edits."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
a=json.loads((ROOT/'alpha-components-audit.json').read_text());d=json.loads((ROOT/'frame-measurements.json').read_text())
boss=['B08','B05','B04','B02','B07','B06','B01','B03','B11','B09','B10']
themes=['snowWolf','forgeBull','venomSerpent','spiderSilk','ancientTree','gargoyleBell','sandScorpion','bloodMoonBat','silverBone','lightningDragon','astralAbyss']
titles=['霜牙雪岭','熔炉火境','千鳞毒沼','织梦蛛巢','荆冠密林','断钟石庭','赤尾沙陵','血月回廊','白骨王城','雷骨天脊','无面星渊']
def common(f):
 e=dict(f);x,y,w,h=e['sourceRect'];e['rect']=e['sourceRect'];e['sourceAspectRatio']=w/h;e['pivot']=[x+w/2,y+h/2];e['pivotLocal']=[w/2,h/2]
 if 'safeRect' in e:
  sx,sy,sw,sh=e['safeRect'];e['safeRectLocal']=[sx-x,sy-y,sw,sh];e['safeRectRelative']=[(sx-x)/w,(sy-y)/h,sw/w,sh/h];e['textAnchor']=[sx+sw/2,sy+sh/2]
 return e
def slices(e,sl):
 e['slice']=sl;e['sliceOrder']='L,T,R,B; PNG pixels relative to sourceRect';x,y,w,h=e['sourceRect'];l,t,r,b=sl;e['svgCuts']={'x':[x,x+l,x+w-r,x+w],'y':[y,y+t,y+h-b,y+h]}
 return e
tt=[]
caps=[205,190,185,185,245,205,190,195,190,195,190]
for i,f in enumerate(d['stage-title-plates-v1.png']['frames']):
 e=slices(common(f),[caps[i],65,caps[i],65]);e.update({'id':'stage'+str(i+1),'stageId':i+1,'theme':themes[i],'stageNameForMappingOnly':titles[i],'bossId':boss[i],'file':'stage-title-plates-v1.png'})
 x,y,w,h=e['rect'];cx=384 if i%2==0 else 1152;left=x+caps[i];right=x+w-caps[i];cw=140
 e['crestRect']=[cx-cw/2,y,cw,65];e['lowerCrestRect']=[cx-cw/2,y+h-65,cw,65]
 for key,yy in [('topCenterSegments',y),('bottomCenterSegments',y+h-65)]:
  e[key]=[{'role':'leftRail','rect':[left,yy,cx-cw/2-left,65],'mode':'stretchX'},{'role':'crestBand','rect':[cx-cw/2,yy,cw,65],'mode':'fixedAspectCenter'},{'role':'rightRail','rect':[cx+cw/2,yy,right-(cx+cw/2),65],'mode':'stretchX'}]
 e['displaySuggestion']={'width':280,'height':64,'note':'Keep ornaments proportional. Native plate aspect is within4-5:1; direct contain is preferred unless width variation is needed.'}
 tt.append(e)
controls=[]
sl=[[250,65,80,65],[290,75,90,60],[360,90,120,60],[370,80,110,60],[340,85,110,60]]
for i,f in enumerate(d['artifact-pet-controls-v2.png']['frames']):
 e=slices(common(f),sl[i]);e['file']='artifact-pet-controls-v2.png';cx,cy,rr=e['avatarCircle'];x,y,w,h=e['rect'];e['avatarCircleLocal']=[cx-x,cy-y,rr];e['avatarRect']=[cx-rr,cy-rr,rr*2,rr*2];e['avatarAnchor']=[cx,cy]
 e['displaySuggestion']={'width':250,'height':48 if i==0 else 53} if i<2 else {'width':600,'height':150,'note':'Approx4:1, keep left portrait cap fixed and stretch only long quiet rails.'}
 if i==0:e.update({'artifactId':'mirror','itemType':'mirror'})
 if i==1:e.update({'artifactId':'sword','itemType':'skySword'})
 if i>=2:e.update({'petTheme':['deer','griffin','fox'][i-2],'parentStage':[5,7,9][i-2]})
 controls.append(e)
warnings=[]
for i,f in enumerate(d['boss-warning-rings-v1.png']['frames']):
 e=common(f);e.update({'id':boss[i],'stageId':i+1,'bossId':boss[i],'theme':themes[i],'file':'boss-warning-rings-v1.png'})
 x,y,w,h=e['rect'];cx,cy=e['center'];e['centerLocal']=[cx-x,cy-y];e['pivot']=e['center'];e['pivotLocal']=e['centerLocal'];e['groundContactYLocal']=e['groundContactY']-y;e['radiusYRatio']=e['radiusY']/e['radiusX'];e['safeRect']=e['innerSafeRect'];sx,sy,sw,sh=e['safeRect'];e['safeRectLocal']=[sx-x,sy-y,sw,sh]
 e['measurementMethod']='Alpha>128 perimeter midline fit: weighted left/right material centers near horizontal axis, then median top/bottom material centers sampled away from center crests and endcaps. Excludes protruding ornaments from physical radius.'
 e['rendering']='sx=physicalDangerRadius/radiusX; sy=(physicalDangerRadius*groundProjectionRatio)/radiusY; destX=worldX-centerLocal.x*sx; destY=supportY-groundContactYLocal*sy. Keep center tied to actual support anchor.'
 e['warningOnly']=True;e['nineSlice']=False;e['nineSliceReason']='Never nine-slice a danger ellipse. Scale the whole measured ellipse from center/radius to match physics.'
 warnings.append(e)
assets={}
for name in ['stage-title-plates-v1.png','artifact-pet-controls-v2.png','boss-warning-rings-v1.png']:
 q={k:v for k,v in a[name].items() if k!='componentsOver16'};q['promptPath']='prompt-'+name.replace('.png','.txt');q['originalPngBytesPreserved']=True;assets[name]=q
old={k:v for k,v in a['artifact-pet-controls-v1.png'].items() if k!='componentsOver16'};old.update({'status':'rejected source layout; kept unchanged for provenance','reason':'Global material bounds overlap between sword/deer and deer/griffin rows; ordinary crop could include a neighboring decoration. Use v2 instead.','promptPath':'prompt-artifact-pet-controls-v1.txt'})
out={
'schemaVersion':1,'task':'T41','role':'hud_art','status':'three active atlases generated and measured; pending primary-agent integration/runtime QA and user acceptance',
'generator':{'mode':'built-in image_gen','noPixelEdits':True,'sourcePngBytesPreserved':True,'scriptPolicy':'Only read PNG alpha/components/provenance and write JSON/text. No cropped/repaired PNGs exported.'},
'coordinateConvention':{'rect':'[x,y,width,height], absolute source PNG pixels','slice':'[L,T,R,B] relative to sourceRect','pivotAndCenters':'absolute PNG coordinates plus explicit Local coordinates','avatarCircle':'[centerX,centerY,radius], absolute source pixels; use existing actual portrait/icon images in this empty opening','ringGroundContactY':'center of the projected floor ellipse, not its lowest ornamental point'},
'assets':assets,'rejectedAssets':[old],'stageTitles':tt,'artifactHud':controls[:2],'petEntries':controls[2:],'bossWarnings':warnings,
'emptyTwelfthCells':{n:{'rect':d[n]['emptyTwelfthRegion'],'alpha':d[n]['emptyTwelfthAlpha']} for n in ['stage-title-plates-v1.png','boss-warning-rings-v1.png']},
'integrationNotes':[
'All stage names, boss IDs and theme names in JSON are mapping data only; no writing/numbers/labels are baked into PNG.',
'Use sourceRect values, not equal atlas cells. Source PNGs must remain unchanged.',
'Title plates have top/bottom central ornament. For width changes, replace ordinary top/bottom center strips with supplied rail/crestBand segments; do not draw stretched crest underneath a fixed overlay.',
'Controls-v2 keeps all avatar circles and content openings empty. Existing hero/pet/artifact images remain the real content; do not replace them with generated portraits.',
'Controls have all large decoration inside the fixed left/right slice caps. The long plain middle rails can stretch. Use approximately4:1 for pet entries.',
'Text/content safe rectangles and avatar circles were tightened after alpha inspection to avoid metal tips. Do not enlarge the masks blindly into ornaments.',
'Boss warning ellipses are ground telegraphs only. Center at the real support anchor, scale radiusX to actual danger radius; radiusY is display perspective only. No damage, HP, AI or timings are changed by this art.',
'Ring ornaments extend slightly outside the fitted dominant boundary; they are decoration, not extra hit radius. Do not scale by full alpha bbox or treat its bottom as groundContactY.',
'Never nine-slice the warning ellipse. Whole-ellipse scaling preserves circular physical radius projection.',
'Correct Canvas/SVG compositing must respect alpha. Native images contain some alpha1..8 tails and arbitrary low-alpha RGB; never chroma-key by RGB or threshold/repair PNG pixels.',
'Keep HUD compact below hero/pet HUD; placement, unlock states, buttons, cooldown values and progress remain primary-agent code.',
'No minion or boss numeric balance is altered by this delivery.'
],
'actualDeviations':[
'Control-v1 was1536x1024 with overlapping neighboring row bounds and was rejected. It remains archived unchanged.',
'Control-v2 is1254x1254 rather than requested1536-square; it has clean separated5 rows and native pet-frame aspect ratios near4.2-4.5:1.',
'Some title/ring rows have less than requested20-30px material gutter; explicit crops were measured and will be verified for zero neighboring alpha>16 material.',
'Title plates are centered on transparent/near-transparent openings rather than filled panels; supply a quiet DOM background behind the text if necessary.',
'Native empty regions and centers contain alpha1..8 edge/tail values. All practical safe areas and avatar masks are audited; original bytes remain intact.',
'Boss rings include small decorative crest/clasp details on the perimeter. The measured fitted ellipse excludes these projections.'
],
'audits':{'alphaAndComponents':'alpha-components-audit.json','frameAndRingMeasurements':'frame-measurements.json','verification':'provenance-verification.json'}
}
(ROOT/'t41-hud-meta-v1.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print('Saved t41-hud-meta-v1.json:11 titles,2 artifact HUDs,3 pet entries,11 warning rings. No PNG edits.')

