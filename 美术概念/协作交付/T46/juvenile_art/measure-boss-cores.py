"""Read-only source alpha / connected components; does not edit PNG pixels."""
from pathlib import Path
from PIL import Image
from collections import deque
import hashlib,json
root=Path(__file__).resolve().parent;p=root/'boss-signature-cores-v1.png';im=Image.open(p);a=im.getchannel('A');width,height=im.size;pix=a.load();seen=set();parts=[]
for y in range(height):
 for x in range(width):
  if pix[x,y]>8 and (x,y) not in seen:
   q=deque([(x,y)]);seen.add((x,y));points=[]
   while q:
    u,v=q.popleft();points.append((u,v))
    for n,m in ((u-1,v),(u+1,v),(u,v-1),(u,v+1)):
     if 0<=n<width and 0<=m<height and (n,m) not in seen and pix[n,m]>8:seen.add((n,m));q.append((n,m))
   if len(points)>100:parts.append(points)
names=['深潮螺心','赤晶脊核','孢冠琥珀','烬羽金脉','分裂镜心','时砂琥珀','月镰灵纹','雷铸线圈','蚀日双核'];centers=[(230,243),(637,218),(1045,208),(227,640),(628,611),(1037,626),(178,1015),(628,1035),(1035,1027)];placements=['shell','spine','crown','wing-root','chest','abdomen','thorax','chest','chest'];sizes=[64,82,76,84,56,54,60,76,76];colors=['#6cebf3','#ff567c','#ffd65f','#ffb95e','#d8b5ff','#ffd569','#d8ecff','#6ddcff','#f6c35d']
frames=[]
for i in range(9):
 points=[]
 for part in parts:
  cx=sum(x for x,y in part)/len(part);cy=sum(y for x,y in part)/len(part)
  if min(2,int(cx/(width/3)))==i%3 and min(2,int(cy/(height/3)))==i//3:points.extend(part)
 left=max(0,min(x for x,y in points)-6);top=max(0,min(y for x,y in points)-6);right=min(width,max(x for x,y in points)+7);bottom=min(height,max(y for x,y in points)+7);rect=[left,top,right-left,bottom-top];rows={}
 for x,y in points:
  for yy in range(max(top,y-5),min(bottom,y+6)):
   lo,hi=max(left,x-5),min(right,x+6)
   if yy in rows:rows[yy]=(min(rows[yy][0],lo),max(rows[yy][1],hi))
   else:rows[yy]=(lo,hi)
 spans=[]
 for y,(lo,hi) in sorted(rows.items()):
  if spans and spans[-1][0]==lo and spans[-1][1]==hi-lo and spans[-1][2]+spans[-1][3]==y:spans[-1][3]+=1
  else:spans.append([lo,hi-lo,y,1])
 frames.append({'bossId':'B'+str(12+i),'name':names[i],'index':i,'rect':rect,'sourceRect':rect,'spriteRect':rect,'pivot':[centers[i][0]-left,centers[i][1]-top],'pivotAbsolute':list(centers[i]),'sourceClipSpans':spans,'bodyPixelsAlpha8':len(points),'suggestedBodyPlacement':placements[i],'suggestedRuntimeWidth':sizes[i],'referenceSourceSize':[rect[2],rect[3]],'lightColor':colors[i]})
source=Path('C:/Users/xiaohaotian/.codex/generated_images/01a1bf3c-eb03-7b42-ae58-a20a49fac5fc/exec-66c310c8-9547-483e-8f9c-0811d8e608cc.png');sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
meta={'version':'T46-boss-signature-cores-v1','status':'original measured components; awaiting main-agent runtime composition and user art acceptance','file':p.name,'source':str(source),'sha256':sha(p),'sourceSha256':sha(source),'size':list(im.size),'mode':im.mode,'alphaExtrema':list(a.getextrema()),'pixelsEdited':False,'generator':'built-in image_gen transparent_background=true; original bytes copied','prompt':'boss-signature-cores-prompt-v1.txt','promptSha256':sha(root/'boss-signature-cores-prompt-v1.txt'),'grid':[3,3],'frames':frames,'notes':'Components are physical boss body overlays, not stand-alone boss replacements or UI frames. rect and sourceClipSpans are atlas absolute. pivot is frame-local; pivotAbsolute documents intended luminous center. Read-only alpha8 CC +5px draw-time path padding isolates stray pixels and preserves B18 tip above the nominal row split. Use drawOriginalRegion; original PNG pixels unchanged. Runtime widths are suggestions, calibrate to actual boss sockets/poses. Local breath intensity/phase may be animated at runtime without repainting source.'}
(root/'boss-signature-meta-v1.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'size':meta['size'],'sha256':meta['sha256'],'frameCount':len(frames),'shaMatches':meta['sha256']==meta['sourceSha256'],'rects':[v['rect'] for v in frames]}))
