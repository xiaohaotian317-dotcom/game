"""Read-only PNG inspection. Writes metadata/text only, never edits/export pixels."""
from pathlib import Path
from PIL import Image
import numpy as np
import json,hashlib

ROOT=Path(__file__).resolve().parent
SOURCE=Path(r'C:\Users\xiaohaotian\.codex\generated_images\01a1be36-34bb-73a3-9245-25f82b743efe')
FILES={
 'artifact-icons-v1.png':'exec-e45b1c0d-e11d-4a27-94ab-c21dec1e4c41.png',
 'artifact-active-fx-v1.png':'exec-ae1d4f98-4b4a-441b-b1c9-be623f10f382.png',
 'artifact-active-fx-v2.png':'exec-0f1eb0c2-5ba7-42b9-9d00-be0a9e9f0fdc.png',
 'artifact-hud-entry-v1.png':'exec-e40493fa-23be-4c56-867f-5587e6fbde96.png',
}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def local(p,r):return [p[0]-r[0],p[1]-r[1]]
def rlocal(a,r):return [a[0]-r[0],a[1]-r[1],a[2],a[3]]
def abounds(a,region,t=16,pad=0):
 x,y,w,h=region;yy,xx=np.where(a[y:y+h,x:x+w]>t);l=max(x,int(xx.min())+x-pad);top=max(y,int(yy.min())+y-pad);rr=min(x+w,int(xx.max())+x+1+pad);bb=min(y+h,int(yy.max())+y+1+pad);return [l,top,rr-l,bb-top]
def stats(a,r):
 x,y,w,h=r;v=a[y:y+h,x:x+w];return {'min':int(v.min()),'max':int(v.max()),'alphaOver16':int(np.sum(v>16)),'pixels':int(v.size)}
def circle_stats(a,c):
 x,y,r=c;yy,xx=np.ogrid[:a.shape[0],:a.shape[1]];v=a[(xx-x)**2+(yy-y)**2<=r*r];return {'min':int(v.min()),'max':int(v.max()),'alphaOver16':int(np.sum(v>16)),'pixels':int(v.size)}
assets={};prompts=[]
for file,source in FILES.items():
 p=ROOT/file;src=SOURCE/source;im=Image.open(p);a=np.array(im.getchannel('A'));s=sha(p);promptpath='prompt-'+p.stem+'.txt';prompt=(ROOT/promptpath).read_text(encoding='utf-8').strip()
 assets[file]={'file':file,'size':list(im.size),'mode':im.mode,'bytes':p.stat().st_size,'sha256':s,'sourcePath':str(src),'sourceSha256':sha(src),'originalPngBytesPreserved':s==sha(src),'generationId':src.stem,'promptPath':promptpath,'alphaExtrema':[int(a.min()),int(a.max())],'alphaZero':int(np.sum(a==0)),'alphaAtMost8':int(np.sum(a<=8)),'alphaOver16':int(np.sum(a>16)),'status':'rejected source archive' if file=='artifact-active-fx-v1.png' else 'selected for primary-agent integration'}
 prompts.append({'id':p.stem,'file':file,'prompt':prompt,'transparent_background':True,'sourcePath':str(src),'sha256':s,'inputImages':[str(ROOT/'artifact-active-fx-v1.png')] if file=='artifact-active-fx-v2.png' else []})

icons=[];a=np.array(Image.open(ROOT/'artifact-icons-v1.png').getchannel('A'))
for i,(id,name,foot) in enumerate([('voidTimeTalisman','虚时护符',[399,949]),('springRadianceChalice','春晖玉盏',[1143,932])]):
 cell=[i*768,0,768,1024];r=abounds(a,cell,pad=10);pivot=[r[0]+r[2]/2,r[1]+r[3]/2]
 icons.append({'id':id,'name':name,'file':'artifact-icons-v1.png','size':[1536,1024],'sourceRect':r,'rect':r,'materialBounds16':abounds(a,cell),'pivot':pivot,'pivotLocal':local(pivot,r),'groundContactY':foot[1],'groundContactYLocal':foot[1]-r[1],'dropPivot':foot,'dropPivotLocal':local(foot,r),'safeRect':r,'safeRectLocal':[0,0,r[2],r[3]],'sourceAspectRatio':r[2]/r[3],'usage':'Use contain scaling preserving original object proportions. This is a standalone transparent relic object, not a badge tile. groundContactY/dropPivot are optional inventory-drop alignment anchors; UI icon pivot is the visual source center.'})

effects=[];a=np.array(Image.open(ROOT/'artifact-active-fx-v2.png').getchannel('A'))
anchors=[[193,446],[577,446],[961,446],[1345,446],[193,953],[578,953],[963,953],[1346,953]]
labels=['ignite','build','hold-or-bloom','dissolve']
for i in range(8):
 col=i%4;row=i//4;cell=[col*384,row*512,384,512];r=abounds(a,cell,pad=12);p=anchors[i];x,y,w,h=cell;perim=np.r_[a[y,x:x+w],a[y+h-1,x:x+w],a[y:y+h,x],a[y:y+h,x+w-1]]
 effects.append({'id':('voidTimeTalisman' if row==0 else 'springRadianceChalice')+'-'+str(col+1),'artifactId':'voidTimeTalisman' if row==0 else 'springRadianceChalice','phase':col,'phaseName':labels[col],'file':'artifact-active-fx-v2.png','size':[1536,1024],'cellRect':cell,'sourceRect':r,'rect':r,'materialBounds16':abounds(a,cell),'pivot':p,'pivotLocal':local(p,r),'groundContactY':p[1],'groundContactYLocal':p[1]-r[1],'safeRect':r,'safeRectLocal':[0,0,r[2],r[3]],'referenceHeightPx':440,'cellBoundaryAlphaMax':int(perim.max()),'cellBoundaryAlphaOver16':int(np.sum(perim>16)),'groundNote':'Pivot is the projected ellipse center on the actual support, not the lowest gold point. The release layer can follow the bearer; no collision or immunity is encoded in the art.','scaleNote':'One shared scale = desired world FX height / 440 for every phase. Never normalize the crop heights separately. Keep pivots anchored while continuously mixing adjacent phases.'})

a=np.array(Image.open(ROOT/'artifact-hud-entry-v1.png').getchannel('A'));huds=[]
specs=[
 ('voidTimeTalisman','虚时护符',[0,0,1536,325],[234,179,89],[505,132,701,80],[1317,137,63,63],None),
 ('springRadianceChalice','春晖玉盏',[0,325,1536,318],[233,502,89],[510,463,697,72],[1321,469,64,64],None),
 ('sunSuanniDungeon','镇曜灵猊',[0,643,1536,381],[231,854,83],[540,814,467,69],None,[1150,831,251,58]),
]
for id,name,region,circle,text,cool,button in specs:
 r=abounds(a,region,pad=4);e={'id':id,'name':name,'file':'artifact-hud-entry-v1.png','size':[1536,1024],'sourceRect':r,'rect':r,'materialBounds16':abounds(a,region),'conservativeNoNeighborRect':r,'pivot':[r[0]+r[2]/2,r[1]+r[3]/2],'groundContactY':None,'avatarCircle':circle,'avatarCircleLocal':[circle[0]-r[0],circle[1]-r[1],circle[2]],'avatarSafeRect':[circle[0]-55,circle[1]-55,110,110],'safeRect':text,'textSafeRect':text,'textSafeRectLocal':rlocal(text,r),'safeRectLocal':rlocal(text,r),'avatarCircleAlpha':circle_stats(a,circle),'textSafeRectAlpha':stats(a,text),'textAreaMode':'quiet painted dark-teal enamel, intentionally opaque; place live DOM text above it. The circular avatar opening is transparent.','noNeighborNote':'Measured row separation is y318..331 and y636..649 with no alpha>16, so sourceRect is an ordinary non-overlapping rectangle, no source mask needed.'}
 e['pivotLocal']=local(e['pivot'],r);e['avatarSafeRectLocal']=rlocal(e['avatarSafeRect'],r);e['avatarSafeRectAlpha']=stats(a,e['avatarSafeRect'])
 if cool:e.update(cooldownSafeRect=cool,cooldownSafeRectLocal=rlocal(cool,r),cooldownSafeRectAlpha=stats(a,cool))
 if button:e.update(buttonRect=[1084,791,386,134],buttonRectLocal=rlocal([1084,791,386,134],r),buttonSafeRect=button,buttonSafeRectLocal=rlocal(button,r),buttonSafeRectAlpha=stats(a,button),unlockRuleNote='Keep the real stage/pet unlock state and live button label in DOM; art alone does not unlock the dungeon.')
 huds.append(e)

meta={'schemaVersion':1,'task':'T45','role':'artifact_art','date':'2026-11-09','status':'Measured source delivery; pending primary-agent integration/runtime QA and user visual acceptance','generator':{'mode':'built-in image_gen','noPixelEdits':True,'sourcePngBytesPreserved':True,'analysisScript':'measure-artifacts-v1.py','scriptPolicy':'Only inspect PNGs/provenance and write JSON/text. No derived/cropped/repaired PNGs are created.'},'coordinateConvention':{'rect':'[x,y,width,height] absolute original PNG pixels unless Local suffix','points':'absolute original PNG pixels unless Local suffix','groundContactY':'center of the floor ellipse for FX; optional physical bottom for item drops; null for UI-only shells','safeRect':'UI painted text or button interior is clear of ornament, not necessarily alpha-transparent; avatar opening transparency audited separately'},'assets':assets,'selectedAssets':['artifact-icons-v1.png','artifact-active-fx-v2.png','artifact-hud-entry-v1.png'],'rejectedAssets':[{'file':'artifact-active-fx-v1.png','reason':'Broad diffuse white/gray haze reaches row boundaries and would show a cloudy crop edge; retained unchanged for provenance. Superseded by built-in edit v2.'}],'icons':icons,'activeFx':effects,'hudAndEntry':huds,'timingRecommendation':{'voidTimeTalisman':{'animationSegmentsNormalized':[0,.2,.72,1],'note':'Four phases only describe art. Primary agent must bind full-immunity active time and attack-speed duration to real gameplay timers; do not silently derive gameplay duration from this suggested animation split.'},'springRadianceChalice':{'animationSegmentsNormalized':[0,.24,.6,1],'note':'Healing applies to real living HP/MP values once; animation must not revive or double-apply healing.'}},'integrationNotes':['Use raw original PNG bytes unchanged. Final source sizes are 1536x1024 for all four stored PNGs.','Runtime uses only three selected PNGs; the fourth is an archived rejected first FX version.','Do not normalize per-phase crop sizes: draw the shared 440px reference scale and the measured pivots.','No baked words/numbers, gameplay state or fake cooldown are included. Overlay real name/cooldown/state in DOM.','Preserve the current one-artifact slot and prevention of switch/equip/cooldown reset; no logic is implemented by this art delivery.','Chapter challenges unlock after chapter1 stage11, while this fourth-pet entrance must use the actual chapter2-stage6 pet unlock rule.','No runtime source, official asset, memory, save, commit, release or deployment was modified.']}
(ROOT/'artifact-meta-v1.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'prompts-v1.json').write_text(json.dumps({'generator':'built-in image_gen','assets':prompts},ensure_ascii=False,indent=2),encoding='utf-8')
report={'pngCount':len(assets),'selectedPngCount':3,'allOriginalHashesMatch':all(v['originalPngBytesPreserved'] for v in assets.values()),'effects':len(effects),'allEffectCellBoundariesOver16Zero':all(e['cellBoundaryAlphaOver16']==0 for e in effects),'effectBoundaryAlphaMax':[e['cellBoundaryAlphaMax'] for e in effects],'avatarCircleAlpha':[e['avatarCircleAlpha'] for e in huds],'allAvatarSafeRectsOver16Zero':all(e['avatarSafeRectAlpha']['alphaOver16']==0 for e in huds),'shellRects':[e['sourceRect'] for e in huds]}
(ROOT/'artifact-audit-v1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
