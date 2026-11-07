"""Write delivery metadata only; all PNG files are read-only inputs."""
import json,hashlib
from pathlib import Path
from PIL import Image
d=Path(__file__).parent
sources={
 'star':r'C:\Users\xiaohaotian\.codex\generated_images\01a1b18b-37ec-7303-8ecf-a7109deb4557\exec-a1b58ff0-c98f-4dcd-8bf9-5643e2ed83be.png',
 'lightning':r'C:\Users\xiaohaotian\.codex\generated_images\01a1b18b-37ec-7303-8ecf-a7109deb4557\exec-297a2fcd-af8c-4f62-9e2c-0132cc32708c.png',
 'shadow':r'C:\Users\xiaohaotian\.codex\generated_images\01a1b18b-37ec-7303-8ecf-a7109deb4557\exec-c99b80f6-e68d-4d87-846b-b7c8152cf345.png'
}
anchors={
 'star':[[146,136],[409,135],[684,135],[974,135],[187,384],[400,384],[656,384],[912,384],
         [128,640],[384,640],[640,640],[896,640],[128,896],[384,896],[640,896],[896,896],
         [128,1216],[384,1218],[640,1218],[896,1218],[128,1480],[384,1482],[640,1481],[896,1480]],
 'lightning':[[156,137],[423,138],[692,138],[973,139],[206,384],[388,385],[641,385],[897,385],
              [128,640],[384,640],[640,640],[896,640],[128,896],[384,896],[640,896],[896,896],
              [128,1229],[384,1229],[640,1229],[896,1229],[128,1486],[384,1486],[640,1485],[896,1485]],
 'shadow':[[134,133],[413,132],[714,130],[993,128],[210,380],[386,383],[641,383],[896,383],
           [172,634],[447,645],[746,643],[995,626],[221,879],[422,881],[680,882],[912,883],
           [128,1224],[384,1224],[640,1224],[896,1224],[128,1493],[384,1493],[640,1493],[896,1493]]
}
phaseNames={
 'star':{
 'F':['星核聚拢','环轨压缩','单核射出','贯流加速','命中内塌缩','环状星屑冲击','环屑外散','余星消散'],
 'E':['弧轨聚拢','沙漏浮现','逆流充盈','护幕升起','护盾成形','治愈环流','沙漏解体','轨迹消散'],
 'R':['贴地星阵','星海凝聚','三束初升','五束交错','中心审判','侧束续击','星芒回落','阵纹残辉']},
 'lightning':{
 'F':['雷结凝聚','拳核成形','雷拳射出','拳弹贯冲','拳锋命中','分叉环爆','雷环裂散','残弧消逝'],
 'E':['链环引导','回旋成圈','环链旋转','向右伸刺','长链贯穿','收链回旋','链环解体','电屑消散'],
 'R':['贴地雷印','战铠引导','甲胄凝形','战铠满展','雷翼开域','雷翼回收','甲片解体','雷域余辉']},
 'shadow':{
 'F':['三刃聚拢','月刃分离','三月刃射出','平行飞刃贯冲','三刃合击','月弧回旋','刃羽裂散','残羽消逝'],
 'E':['鸦影聚拢','鸦翼展形','低掠疾袭','振翼加速','前向残影斩','叠刃穿过','羽迹外散','短刃残光'],
 'R':['贴地羽印','群鸦初升','升降环绕','双弧交织','千鸦交叉斩','群鸦换向','刃羽回落','羽印消散']}
}
combined={'schema':'t39-fx-b-delivery-v2','created':'2026-11-07','tool':'built-in image_gen','pngPixelEditing':'none; raw copy only','status':'concept delivery pending main-agent integration and user visual acceptance','heroes':{}}
for hero in ['star','lightning','shadow']:
    m=json.loads((d/(hero+'-alpha-measurements-v2.json')).read_text(encoding='utf-8'))
    png=d/m['file']; original=Path(sources[hero])
    same=hashlib.sha256(original.read_bytes()).hexdigest()==m['sha256']
    assert same
    for frame in m['frames']:
        i=frame['index']; x,y,rw,rh=frame['rect']; ax,ay=anchors[hero][i]
        frame.update({
            'phaseName':phaseNames[hero][frame['skill']][frame['phase']],
            'sourceRect':frame['rect'],
            'center':[ax,ay],
            'centerLocal':[ax-x,ay-y],
            'pivot':[ax-x,ay-y],
            'pivotNormalized':[round((ax-x)/rw,6),round((ay-y)/rh,6)],
            'pivotBasis':'pixels relative to rect top-left; align this to effect world anchor',
            'groundContactY':ay if frame['skill']=='R' else None,
            'groundContactLocalY':ay-y if frame['skill']=='R' else None,
            'groundContactYNormalized':round((ay-y)/rh,6) if frame['skill']=='R' else None,
            'anchorMethod':'manual semantic feature alignment after visual inspection; R uses observed ellipse centerline, not alpha-bbox bottom',
            'sourcePixelsPerReferenceUnit':256,
            'phaseRole':'windup' if frame['phase']<2 else ('active' if frame['phase']<6 else 'dissipate')
        })
    m.update({'hero':hero,'originalGeneratedSource':sources[hero],'originalSha256':m['sha256'],'rawCopyHashMatchesOriginal':same,
              'promptFile':hero+'-prompt-v2.txt','tool':'built-in image_gen','requestedFrameLayout':[4,6],
              'frameCount':24,'skillFrames':{'F':list(range(8)),'E':list(range(8,16)),'R':list(range(16,24))},
              'coordinateConvention':'All rect/spriteRect/coreAlpha64Rect/center are source-image pixels. Rect=[x,y,width,height]. Pivot is local pixels relative to rect, not normalized sprite bbox.',
              'commonScaleRule':'Use a shared 256px reference scale for the complete sequence. Do not resize every spriteRect to the same height or width. Draw each measured rect with its per-frame pivot.',
              'groundRule':'Only R is floor-anchored. Align groundContactY to actual support surface; preserve vertical aspect. F/E are centered flight/gesture effects, not ground-squashed.',
              'phaseRule':'Eight distinct phases per skill; 0-1 windup,2-5 active,6-7 dissolve. F hit phases4-5 trigger on impact, not automatically during every flight loop.',
              'transparencyAcceptance':'RGBA alpha exists and raw bytes preserved; strict zero-alpha gutters were not fully achieved. Review the low-alpha background before final acceptance.',
              'acceptance':'not user accepted; not installed in runtime by this agent'})
    (d/(hero+'-manifest-v2.json')).write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
    combined['heroes'][hero]={'file':m['file'],'manifest':hero+'-manifest-v2.json','prompt':m['promptFile'],'source':sources[hero],'size':m['size'],'sha256':m['sha256'],'rawCopyHashMatchesOriginal':same,'alpha':m['alpha']}
(d/'manifest-v2.json').write_text(json.dumps(combined,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({hero:{'file':combined['heroes'][hero]['file'],'hashMatches':combined['heroes'][hero]['rawCopyHashMatchesOriginal']} for hero in combined['heroes']},ensure_ascii=False))

