"""Read-only alpha/crop analysis. Never changes a PNG pixel."""
from pathlib import Path
from PIL import Image
import hashlib,json

folder=Path(__file__).resolve().parent
names={0:['旅灯','寒铁','暮铜'],2:['霜晶','潮纹','铭雷'],3:['枯月','镜渊','星棘'],4:['烬曜','断时','苍辰'],5:['日冕','恒曦','蚀日']}
columns=[('melee','weapon','拳套'),('melee','armor','战甲'),('staff','weapon','法杖'),('staff','armor','法袍')]
meta={'version':2,'task':'T46','mode':'built-in image_gen','pixelsEdited':False,'units':{},'atlases':{},'notes':['Four equipment columns fixed; rows are named A/B/C sets. Actual alpha bounds measured individually, no atlas rescaling or pixel edits.','Cell partitions follow measured transparent gutter centers, not naive equal division: image generator has outer margins.','UI names and category labels remain live text outside the PNG. Artwork acceptance remains with user.']}
def partitions(projection,parts):
 runs=[];start=None
 for i,visible in enumerate(projection):
  if not visible and start is None:start=i
  elif visible and start is not None:
   if i-start>=8:runs.append((start+i-1)/2)
   start=None
 length=len(projection)
 candidates=[p for p in runs if length*.05<p<length*.95]
 boundaries=[0]
 for i in range(1,parts):
  expected=length*i/parts;nearest=min(candidates,key=lambda p:abs(p-expected))
  assert abs(nearest-expected)<length*.14,(candidates,expected)
  boundaries.append(round(nearest))
 boundaries.append(length);assert boundaries==sorted(set(boundaries));return boundaries
for quality in [0,2,3,4,5]:
 file=folder/f'equipment-q{quality}-v2.png'
 if not file.is_file():continue
 im=Image.open(file).convert('RGBA');w,h=im.size;alpha=im.getchannel('A');mask=alpha.point(lambda a:255 if a>16 else 0)
 assert alpha.getextrema()[0]==0,'Opaque atlas background: '+str(file)
 xs,ys=mask.getprojection();xs,ys=partitions(xs,4),partitions(ys,3);gaps=[]
 for row,set_name in enumerate(names[quality]):
  for col,(role,slot,suffix) in enumerate(columns):
   x0,x1=xs[col:col+2];y0,y1=ys[row:row+2]
   area=mask.crop((x0,y0,x1,y1));bbox=area.getbbox();assert bbox, (quality,row,col)
   left,top,right,bottom=bbox;visible=[x0+left,y0+top,right-left,bottom-top]
   pad=2;rect=[max(x0,x0+left-pad),max(y0,y0+top-pad),0,0];rect[2]=min(x1,x0+right+pad)-rect[0];rect[3]=min(y1,y0+bottom+pad)-rect[1]
   margin=[left,top,x1-x0-right,y1-y0-bottom];gaps.append(min(margin))
   unit={'file':file.name,'size':[w,h],'rect':rect,'visibleAlphaBBox':visible,'alphaVisiblePixels':sum(area.histogram()[1:]),'quality':quality,'set':'ABC'[row],'setTier':row,'setName':set_name,'name':set_name+suffix,'role':role,'slot':slot,'row':row,'column':col,'cell':[x0,y0,x1-x0,y1-y0],'alphaCellMargins':margin}
   meta['units'][f'q{quality}-'+ 'ABC'[row]+'-'+role+'-'+slot]=unit
 meta['atlases'][str(quality)]={'file':file.name,'size':[w,h],'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'alphaExtrema':list(alpha.getextrema()),'minCellTransparentMargin':min(gaps),'pngPixelBytesUnchanged':True}
out=folder/'atlas-meta-v2.json';out.write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'units':len(meta['units']),'atlases':meta['atlases']},ensure_ascii=False))
