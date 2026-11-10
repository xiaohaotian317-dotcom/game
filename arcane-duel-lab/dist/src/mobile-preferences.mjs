const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const storageOrDefault=value=>{if(value!==undefined)return value;try{return globalThis.localStorage;}catch{return null;}};
export function controlOpacity(storage){
  try{const raw=storageOrDefault(storage)?.getItem('arcane-mobile-controls-opacity');if(raw!==null&&raw!==undefined&&Number.isFinite(Number(raw)))return clamp(Number(raw),.3,1);}catch{}
  return .85;
}
export function applyControlOpacity(value=controlOpacity(),root=globalThis.document?.documentElement){
  const opacity=clamp(Number.isFinite(Number(value))?Number(value):.85,.3,1);
  root?.style.setProperty('--mobile-controls-opacity',String(opacity));return opacity;
}
export function saveControlOpacity(value,storage){
  const opacity=applyControlOpacity(value);try{const target=storageOrDefault(storage);if(!target)return false;target.setItem('arcane-mobile-controls-opacity',String(opacity));return true;}catch{return false;}
}

export const CONTROL_LAYOUT_KEY='arcane-mobile-controls-layout-v1';
export const CONTROL_LAYOUT_ROLES=Object.freeze(['joystick','attack','jump','dash','q','e','r','artifact','context']);
const validRoles=new Set(CONTROL_LAYOUT_ROLES);
/** Only changed centers are stored; absent roles retain the original authored layout. */
export function normalizeControlLayout(value){
 const positions={};
 if(!value||value.version!==1||!value.positions||typeof value.positions!=='object')return {version:1,positions};
 for(const role of CONTROL_LAYOUT_ROLES){const p=Object.hasOwn(value.positions,role)?value.positions[role]:null;if(p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y))positions[role]={x:clamp(p.x,0,1),y:clamp(p.y,0,1)};}
 return {version:1,positions};
}
export function controlLayout(storage){try{return normalizeControlLayout(JSON.parse(storageOrDefault(storage)?.getItem(CONTROL_LAYOUT_KEY)||'null'));}catch{return normalizeControlLayout(null);}}
export function saveControlLayout(value,storage){
 const next=normalizeControlLayout(value),target=storageOrDefault(storage);try{if(!target)return false;target.setItem(CONTROL_LAYOUT_KEY,JSON.stringify(next));}catch{return false;}
 if(typeof globalThis.dispatchEvent==='function'&&typeof CustomEvent==='function')globalThis.dispatchEvent(new CustomEvent('arcane-control-layout-changed',{detail:next}));return true;
}
/** Bound centers by the actual safe area, button size and a protected HUD/menu strip. */
export function clampControlCenter(point,size,area){
 const width=Math.max(1,Number(area.width)||1),height=Math.max(1,Number(area.height)||1),x=Number(area.x)||0,y=Number(area.y)||0;
 const halfW=Math.min(width/2,Math.max(24,Number(size.width)/2||24)+7),halfH=Math.min(height/2,Math.max(24,Number(size.height)/2||24)+7),hud=Math.min(104,height*.3);
 const minX=x+halfW,maxX=x+width-halfW,minY=Math.min(y+height-halfH,y+hud+halfH),maxY=y+height-halfH;
 return {x:clamp(Number.isFinite(point.x)?point.x:x+width/2,minX,maxX),y:clamp(Number.isFinite(point.y)?point.y:y+height/2,minY,maxY)};
}
export function controlCenter(position,size,area){return clampControlCenter({x:area.x+position.x*area.width,y:area.y+position.y*area.height},size,area);}
export function controlPosition(point,size,area){const p=clampControlCenter(point,size,area);return {x:clamp((p.x-area.x)/Math.max(1,area.width),0,1),y:clamp((p.y-area.y)/Math.max(1,area.height),0,1)};}
export function measureControlArea(root){
 let probe=root.querySelector('.mobile-layout-safe-area');if(!probe){probe=root.ownerDocument.createElement('div');probe.className='mobile-layout-safe-area';probe.setAttribute('aria-hidden','true');root.append(probe);}
 const r=probe.getBoundingClientRect(),win=root.ownerDocument.defaultView;if(r.width>0&&r.height>0)return {x:r.x,y:r.y,width:r.width,height:r.height};
 const css=win.getComputedStyle(root.ownerDocument.documentElement),n=k=>Math.max(0,parseFloat(css.getPropertyValue('--native-safe-'+k))||0),left=n('left'),top=n('top');return {x:left,y:top,width:Math.max(1,win.innerWidth-left-n('right')),height:Math.max(1,win.innerHeight-top-n('bottom'))};
}
export function editableControlElements(root){const result=new Map();for(const el of root.querySelectorAll('[data-mobile-role]')){let role=el.classList.contains('mobile-context')?'context':el.dataset.mobileRole;if(validRoles.has(role))result.set(role,el);}return result;}
export function applyControlLayout(root,value){
 const layout=normalizeControlLayout(value),area=measureControlArea(root);
 for(const [role,el]of editableControlElements(root)){
  const p=layout.positions[role];if(!p){delete el.dataset.layoutPositioned;el.style.removeProperty('--mobile-layout-left');el.style.removeProperty('--mobile-layout-top');continue;}
  const box=el.getBoundingClientRect(),size={width:box.width||Math.max(48,el.classList.contains('mobile-joystick')?116:role==='context'?96:54),height:box.height||Math.max(48,el.classList.contains('mobile-joystick')?116:54)},center=controlCenter(p,size,area);
  el.dataset.layoutPositioned='true';el.style.setProperty('--mobile-layout-left',(center.x-size.width/2)+'px');el.style.setProperty('--mobile-layout-top',(center.y-size.height/2)+'px');
 }
 return area;
}
