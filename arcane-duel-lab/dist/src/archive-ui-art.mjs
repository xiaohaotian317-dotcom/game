let atlas=null,pending=null;
export async function ensureArchiveArt(){
 if(atlas)return;pending??=(async()=>{const data=await fetch('assets/archive-ui/atlas-meta-v1.json').then(r=>{if(!r.ok)throw Error('档案装饰载入失败');return r.json();});await Promise.all(Object.keys(data.files).map(file=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=()=>reject(Error('档案装饰载入失败'));img.src='assets/archive-ui/'+file;})));atlas=data;})().catch(e=>{pending=null;throw e;});return pending;
}
function piece(file,size,r,where,style=''){return `<svg class="archive-art-piece ${where}" viewBox="${r.join(' ')}" preserveAspectRatio="none" style="${style}" aria-hidden="true"><image href="assets/archive-ui/${file}" width="${size[0]}" height="${size[1]}"/></svg>`;}
export function archiveFrame(kind){
 const f=atlas?.elements[kind];if(!f)return '<span class="archive-frame" aria-hidden="true"></span>';
 const [x,y,w,h]=f.rect,[l,t,r,b]=f.slice||[24,24,24,24],scale=f.renderScale||.25,size=atlas.files[f.file].size,xs=[x,x+l,x+w-r],ys=[y,y+t,y+h-b],ws=[l,w-l-r,r],hs=[t,h-t-b,b];let content='';
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  if(row===1&&col===1&&f.centerOpening)continue;
  if(f.emblemRect&&col===0)continue;
  const segments=col===1&&(row===0?f.topCenterSegments:row===2?f.bottomCenterSegments:null);
  if(segments){content+=`<span class="archive-edge-segments art-${row}-${col}">${segments.map(v=>piece(f.file,size,v.rect,'',v.mode==='fixedAspectCenter'?`flex:0 0 ${v.rect[2]*scale}px`:'' )).join('')}</span>`;continue;}
  content+=piece(f.file,size,[xs[col],ys[row],ws[col],hs[row]],`art-${row}-${col}`);
 }
 if(f.emblemRect)content+=piece(f.file,size,[x,y,l,h],'','grid-area:1 / 1 / 4 / 2');
 return `<span class="archive-frame" aria-hidden="true" style="--cut-l:${l*scale}px;--cut-t:${t*scale}px;--cut-r:${r*scale}px;--cut-b:${b*scale}px">${content}</span>`;
}
export function archiveStrip(kind){if(!atlas?.elements[kind])return '';return `<span class="archive-strip-frame">${archiveFrame(kind)}</span>`;}
