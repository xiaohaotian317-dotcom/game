"""Assemble hand-reviewed integration metadata from read-only measurements."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
overview=json.loads((ROOT/'alpha-overview.json').read_text())
measure=json.loads((ROOT/'frame-measurements.json').read_text())
pool=json.loads((ROOT/'pool-contact-audit.json').read_text())
ids=[
('toxicSting',['M01'],252,100,'Chitin-orange claw/sting and viscous venom.'),
('spiderSilk',['M02','S01'],270,95,'Pearl-lavender claw and physical silk fibers.'),
('sonicDive',['M03'],277,105,'Dusky magenta wing-shaped sonic shear, not full circular rings.'),
('rockSmash',['M04'],259,115,'Mineral hammer sweep and rock impact. Hornlike ridge is only a visual motif, not a new charge mechanic.'),
('mantisCut',['M05'],278,100,'Jade twin scythe cutting traces.'),
('boneStrike',['M06'],275,105,'Steel edge, ivory chips and grave dust.'),
('chainHook',['M10'],264,125,'Interlocked oxidized iron chain and hooked cutting trace. Also provides a right-facing hook projectile option.')
]
mPivots=[
[[85,205],[340,205],[595,205],[835,205]],
[[85,414],[340,414],[595,414],[835,414]],
[[85,634],[340,634],[595,634],[835,634]],
[[85,869],[340,869],[595,869],[835,869]],
[[85,1076],[340,1076],[595,1076],[835,1076]],
[[85,1293],[340,1293],[595,1293],[835,1293]],
[[85,1512],[340,1512],[595,1512],[835,1512]]
]
rPivots=[
[[146,132],[447,120],[716,116],[972,117],[195,305],[430,300],[645,304],[900,307]],
[[135,488],[432,485],[692,485],[930,485],[127,679],[422,679],[650,677],[895,676]],
[[174,847],[478,863],[747,863],[1005,863],[154,1066],[379,1055],[636,1056],[893,1057]],
[x['groundContactCenter'] for x in pool]
]
families=[]
for row,(key,enemies,span,worldSpan,description) in enumerate(ids):
 frames=[]
 for phase in range(4):
  d=measure['melee-v1.png'][row*4+phase];x,y,w,h=d['sourceRect'];p=mPivots[row][phase]
  f={**d,'frame':phase,'phase':['windup','release','impact','dissipate'][phase],'pivot':p,'pivotLocal':[p[0]-x,p[1]-y],'pivotMethod':'Manual visual strike-center estimate, consistent center semantics across this row.','safeRect':d['sourceRect']}
  if key=='chainHook' and phase in [1,2]:
   hp=[422,1509] if phase==1 else [659,1509];f['projectileHeadPivot']=hp;f['projectileHeadPivotLocal']=[hp[0]-x,hp[1]-y]
  if key=='rockSmash' and phase==2:
   gp=[595,916];f['optionalGroundContactPivot']=gp;f['optionalGroundContactPivotLocal']=[gp[0]-x,gp[1]-y];f['groundContactNote']='Visual lower mineral/dust contact band estimate; the current native move is melee, not a zone.'
  frames.append(f)
 families.append({'id':key,'file':'melee-v1.png','enemyIDs':enemies,'sourceRow':row,'description':description,'orientation':'right-facing; horizontal +X','referenceSpanPixels':span,'suggestedWorldSpan':worldSpan,'suggestionOnly':True,'frameCount':4,'frames':frames})
rkeys=[('serpentVenom',['M07'],218,72,'Right-facing liquid spear, separate from organic sac.'),('spiderSac',['M08'],199,64,'Organic ribbed poison bladder and membrane tear.'),('ravenCurse',['M09'],222,74,'Dark feather dart with a brittle wooden spine; actual native style is feather, not root.'),('poisonPool',['M07','M08'],218,None,'Shallow physical ground poison: wet meniscus, foam, bubbles and vapor.')]
for k,(key,enemies,span,worldSpan,description) in enumerate(rkeys):
 frames=[]
 for i in range(8):
  row=k*2+i//4;col=i%4;d=measure['ranged-v1.png'][row*4+col];x,y,w,h=d['sourceRect'];p=rPivots[k][i]
  phase=(['gather','launch','flightA','flightB','contact','burst','runoff','fade'] if k<3 else ['spread','swell','matureA','bubbleBurst','matureB','newBubbles','thin','evaporate'])[i]
  method='Manual visual projectile head/contact estimate; not an alpha centroid.'
  if k==3:method='Measured dense liquid plane center from alpha>128 rows spanning >=90% of peak span. Not the smoke bounds or PNG bottom.'
  f={**d,'frame':i,'phase':phase,'pivot':p,'pivotLocal':[p[0]-x,p[1]-y],'pivotMethod':method,'safeRect':d['sourceRect']}
  if k==3:f.update({'groundContactPivot':p,'groundContactPivotLocal':[p[0]-x,p[1]-y],'contactBand90pct':pool[i]['contactBand90pct'],'peakContactSpanPixels':pool[i]['peakSpanPixels']})
  frames.append(f)
 families.append({'id':key,'file':'ranged-v1.png','enemyIDs':enemies,'sourceRows':[k*2,k*2+1],'description':description,'orientation':'ground-plane side perspective' if k==3 else 'right-facing +X; rotate around frame pivot by projectile velocity','referenceSpanPixels':span,'suggestedWorldSpan':worldSpan,'frameCount':8,'frames':frames,'loopFrames':[2,3,4,5] if k==3 else [2,3],'renderScale':'(radius*2)/referenceSpanPixels, constant all frames' if k==3 else 'worldSpan/referenceSpanPixels, constant all frames'})
mapping={
'M01':{'melee':'toxicSting','nativeStyles':['claw','venom'],'notes':'Two-step claw/sting; preserve poison mechanic.'},
'M02':{'melee':'spiderSilk','nativeStyles':['web','slash'],'notes':'Dash pounce then foreleg stab; use movement direction and physical hand/foreleg anchor.'},
'M03':{'melee':'sonicDive','nativeStyles':['sonic'],'notes':'Flying dash/dive, not a stationary ground pool.'},
'M04':{'melee':'rockSmash','nativeStyles':['rock'],'notes':'Native move is raised hammer smash; do not invent a horn-charge gameplay step.'},
'M05':{'melee':'mantisCut','nativeStyles':['slash'],'notes':'Two scythe strikes; can mirror/reverse sweep for second strike while hit direction remains real.'},
'M06':{'melee':'boneStrike','nativeStyles':['bone','slash'],'notes':'Shield bash then short sword stab.'},
'M07':{'projectile':'serpentVenom','impact':'serpentVenom','groundZone':'poisonPool','nativeStyles':['venom'],'notes':'Straight venom projectile, poison and pool:true.'},
'M08':{'projectile':'spiderSac','impact':'spiderSac','groundZone':'poisonPool','nativeStyles':['venom'],'notes':'Lobbed poison sac; rotate by actual vx/vy, not a new straight beam.'},
'M09':{'projectile':'ravenCurse','impact':'ravenCurse','nativeStyles':['feather'],'notes':'Three dark feather shots. The wood element is visual staff/quill material, not an added root status/zone.'},
'M10':{'melee':'chainHook','projectile':'chainHook','impact':'chainHook','nativeStyles':['slash','chain'],'flightFrames':[1],'notes':'Hook-axe melee plus real ranged chain hook/snare. For projectile use projectileHeadPivot rather than strike-center pivot.'},
'S01':{'melee':'spiderSilk','optionalImpact':'toxicSting','nativeStyles':['venom'],'suggestedVisualScale':0.50,'notes':'Summon-only short spider bite. Use much smaller silk/claw effect; optional tiny toxic impact. No adult scorpion tail model and no new pool.'}
}
assets={}
for name,v in overview.items():
 assets[name]={**v,'promptPath':'prompt-'+name.replace('.png','.txt'),'originalPixelsPreserved':True,'sourceCopyByteHashEqual':v['sha256']==v['sourceSha256']}
out={
'schemaVersion':1,'task':'T39','role':'minion_fx','status':'generated and read-only measured; pending primary-agent integration, runtime visual QA and user acceptance',
'generator':{'mode':'built-in image_gen','originalPngBytesPreserved':True,'noPixelRepair':True,'note':'All analysis scripts write JSON/text only. Source PNGs were copied unchanged from generated_images.'},
'coordinateConvention':{'rect':'[x,y,width,height], absolute PNG pixels','pivot':'absolute PNG [x,y]','pivotLocal':'pivot minus sourceRect origin','threshold':'material crop uses alpha>16; true empty alpha and 1..8 tails are separately audited'},
'assets':assets,'families':families,'enemyMapping':mapping,
'integrationNotes':[
'Select family first by enemyKind (M01..M10/S01), not only enemyStyle. Native kinds can share slash/venom but require distinct materials.',
'enemy-simulation.mjs currently overrides non-boss plan styles/status from e.themeStyle. Preserve actual mechanics; a modest runtime theme tint/accent can coexist with the kind-specific material. Do not accidentally make all themed minions use the same generic circle.',
'Source rows/columns only describe ordering. All actual drawImage sourceRect values are explicitly measured and must be used.',
'Keep scale constant across one family and anchor by each pivotLocal. Never expand charge/fade sprites to the same width/height as release, or the real evolution is lost.',
'For moving projectile families use frames2/3 during travel, frame0/1 at the real mouth/hand windup/release, and frames4..7 at collision. M08 keeps actual lob motion.',
'For chainHook projectile, choose phase1 and its separate projectileHeadPivot. Its other phases are melee charge/impact/recoil rather than an eight-frame flight loop.',
'For poisonPool draw at z.anchor/z.x,z.y using groundContactPivotLocal and one scale=(2*radius)/218. Keep image aspect ratio; do not squash the whole sprite because that also flattens vapor and bubbles.',
'PoisonPool frames2..5 can loop while active; 0..1 spread in,6..7 evaporate out. Actual damage/life remains simulation-owned.',
'Alpha1..8 tails have arbitrary RGB (including vivid fringes). Correct Canvas compositing respects alpha; never remove black or key by RGB, and never treat alpha>0 as material bounds. Inspect composited runtime output before accepting.',
'Suggested display spans are implementation suggestions, not new user-locked balance parameters. Effects should remain smaller and quieter than boss skills.',
'Preload PNG and metadata. Build any clip paths/caches once; avoid re-scanning alpha or filtering complete atlases per enemy every frame.'
],
'actualDeviations':[
'Melee sheet output is948x1659 rather than requested1024x1792. It has28 effects arranged7 rows, but phase widths and top/bottom margins are unequal. Explicit measurements supersede planned cells.',
'Melee bat release/impact have only5 source pixels between alpha>16 material. Their explicit crops each include4px near-transparent padding, with no neighboring alpha>16 pixels; do not add arbitrary source padding.',
'The generator painted some melee cutting forms as tactile chitin/metal/wing-shaped material ribbons, more solid than pure light wisps. They are effects only, no complete enemy bodies.',
'The melee final phase is fragmented but not fully empty; runtime fading is still needed for clean disappearance.',
'Both source images have extensive alpha1..8 tails rather than fully clear gutters everywhere. No post-generation thresholding or pixel fixing was applied. Original alpha evidence is in alpha-overview.json.',
'Pool phase0 is visibly smaller than mature phases; pool phase7 is thinner rather than fully invisible. Fixed scale preserves spreading/evaporation.'
],
'audits':{'alpha':'alpha-overview.json','projection':'projection-audit.json','frameMeasurements':'frame-measurements.json','groundContacts':'pool-contact-audit.json','finalVerification':'provenance-verification.json'},
'readOnlyInputs':['dist/src/enemy-roster.mjs','dist/src/enemy-painter.mjs','dist/src/enemy-ground-art.mjs','dist/src/enemy-simulation.mjs (selected attack/emission/theme lines)','dist/assets/enemies/M01-motion-v1.png','dist/assets/enemies/M09-motion-v1.png']
}
(ROOT/'integration-manifest.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print('Wrote integration-manifest.json; 11 families,',sum(f['frameCount'] for f in families),'frames; PNG bytes untouched.')

