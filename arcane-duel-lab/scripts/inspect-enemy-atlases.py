"""Read generated PNG alpha and record frame geometry; never modify image pixels."""
from pathlib import Path
from PIL import Image
import json, hashlib
from collections import deque

def main_component_box(mask):
    # Read geometry without changing or re-exporting any source PNG pixels.
    width,height=mask.size;data=bytearray(mask.tobytes());best=None
    for seed in range(len(data)):
        if not data[seed]: continue
        data[seed]=0;queue=deque([seed]);area=0
        left=right=seed%width;top=bottom=seed//width
        while queue:
            pos=queue.popleft();x=pos%width;y=pos//width;area+=1
            left=min(left,x);right=max(right,x);top=min(top,y);bottom=max(bottom,y)
            for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0<=nx<width and 0<=ny<height:
                    idx=ny*width+nx
                    if data[idx]:data[idx]=0;queue.append(idx)
        if best is None or area>best[0]:best=(area,(left,top,right+1,bottom+1))
    return best[1]

root = Path(__file__).resolve().parents[1] / 'dist/assets/enemies'
units = {}
for path in sorted(root.glob('*-motion-v1.png')):
    with Image.open(path) as image:
        image.load()
        width, height = image.size
        alpha = image.getchannel('A') if 'A' in image.getbands() else None
        if alpha is None:
            raise ValueError(f'{path.name} is not transparent RGBA')
        cell_w, cell_h = width / 4, height / 4
        frames = []
        for i in range(16):
            col, row = i % 4, i // 4
            x0,y0,x1,y1=round(col*cell_w),round(row*cell_h),round((col+1)*cell_w),round((row+1)*cell_h)
            data = alpha.crop((x0,y0,x1,y1))
            mask = data.point(lambda a: 255 if a > 80 else 0)
            box = main_component_box(mask)
            if box is None:
                raise ValueError(f'{path.name} has empty cell {i}')
            left, top, right, bottom = box
            frames.append({'index':i, 'rect':[x0,y0,x1-x0,y1-y0],
                           'spriteRect':[x0+max(0,left-2),y0+max(0,top-2),min(x1-x0,right+2)-max(0,left-2),min(y1-y0,bottom+2)-max(0,top-2)],
                           'bbox':[left,top,right-left,bottom-top],
                           'bottom':bottom, 'bottomNormalized':bottom/(y1-y0),
                           'centerX':(left+right)/2,
                           'touchesCellEdge':left<=1 or top<=1 or right>=cell_w-1 or bottom>=cell_h-1})
        corners = [alpha.getpixel(p) for p in [(0,0),(width-1,0),(0,height-1),(width-1,height-1)]]
        assert max(corners)<=2, (path.name, corners)
        units[path.stem.split('-')[0]] = {'file':path.name,'size':[width,height],
            'cellSize':[cell_w,cell_h], 'alphaExtrema':list(alpha.getextrema()),
            'cornerAlpha':corners, 'idleCenterX':frames[6]['centerX'],
            'idleHeight':frames[6]['bbox'][3], 'frames':frames,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

overrides = {'M10':{'walk':[0,1,2,3,4,5], 'idle':0,'windup':6,'melee':7,'recovery':9,'ranged':8,'special':9,'summon':9,'hurt':10,'stagger':12,'dying':14,'dead':15}}
for key,mapping in overrides.items():
    if key in units:
        units[key]['frameOverrides']=mapping
        units[key]['idleCenterX']=units[key]['frames'][mapping['idle']]['centerX']
        units[key]['idleHeight']=units[key]['frames'][mapping['idle']]['bbox'][3]
socket_positions={'M01':(.55,.20),'M02':(.31,.60),'M03':(.82,.51),'M04':(.82,.80),
    'M05':(.84,.38),'M06':(.78,.52),'M07':(.62,.34),'M08':(.59,.51),
    'M09':(.82,.35),'M10':(.92,.40),'B01':(.80,.20),'B02':(.61,.34),
    'B03':(.81,.53),'B04':(.58,.33),'B05':(.75,.84),'B06':(.62,.45),
    'B07':(.82,.45),'B08':(.61,.47),'B09':(.60,.31),'B10':(.81,.46),'B11':(.59,.45),'S01':(.65,.59)}
for key,unit in units.items():
    frame=unit.get('frameOverrides',{}).get('ranged',10)
    sx,sy=socket_positions[key]
    unit['socket']={'x':sx,'y':sy,'ground':unit['frames'][frame]['bottomNormalized']}
    unit['socketFrame']=frame
    unit['socketCalibration']='Visual estimate in normalized cell coordinates; mouth/weapon tip, not automatic anatomy detection.'
result={'version':'enemy-motion-v1','alphaThreshold':80,'grid':[4,4],
        'method':'Read-only largest connected alpha component per cell; source PNGs unchanged.',
        'units':units}
(root/'bounds-v1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'count':len(units),'frames':sum(len(x['frames']) for x in units.values()),
    'cellEdgeWarnings':{key:[f['index'] for f in u['frames'] if f['touchesCellEdge']] for key,u in units.items() if any(f['touchesCellEdge'] for f in u['frames'])}},ensure_ascii=True))
