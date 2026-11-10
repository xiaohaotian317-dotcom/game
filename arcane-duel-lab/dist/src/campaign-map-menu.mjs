export const MAP_SYSTEMS=[
 {key:'character',name:'角色',icon:0},
 {key:'bag',name:'背包',icon:1},
 {key:'skills',name:'技能',icon:2},
 {key:'pet',name:'灵宠',icon:4},
 {key:'forge',name:'锻造炉',icon:5},
 {key:'artifact',name:'法器',icon:3},
 {key:'daily',name:'每日任务',icon:6}
];

// The map drawer opens the same archive panels as the battle toolbar.
export function mountMapMenu(root,{onOpen,iconStyle}){
 root.innerHTML=`<div class="map-menu-fold"><nav id="map-system-links" class="map-menu-links" aria-label="地图系统入口" inert>${MAP_SYSTEMS.map(s=>`<button type="button" data-map-system="${s.key}"><i aria-hidden="true" style="${iconStyle(s.icon)}"></i><span>${s.name}</span></button>`).join('')}</nav></div><button type="button" class="map-menu-toggle" aria-expanded="false" aria-controls="map-system-links"><svg class="map-menu-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M12 3H88L97 12V88L88 97H12L3 88V12ZM14 7H86L93 14V86L86 93H14L7 86V14Z"/><path vector-effect="non-scaling-stroke" d="M3 22 11 14 8 8 14 11 22 3M78 3 86 11 92 8 89 14 97 22M97 78 89 86 92 92 86 89 78 97M22 97 14 89 8 92 11 86 3 78"/></svg><i class="map-menu-seal" aria-hidden="true"><svg class="map-menu-glyph" viewBox="0 0 32 32"><path d="m16 3 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z"/><path d="m16 8 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/></svg></i><span>行囊与修行</span><b aria-hidden="true">⌃</b></button>`;
 const toggle=root.querySelector('.map-menu-toggle'),links=root.querySelector('nav');
 function setExpanded(open){root.classList.toggle('expanded',open);toggle.setAttribute('aria-expanded',String(open));links.inert=!open;toggle.setAttribute('aria-label',open?'收起地图系统侧栏':'展开地图系统侧栏');}
 toggle.addEventListener('click',()=>setExpanded(toggle.getAttribute('aria-expanded')!=='true'));
 root.addEventListener('click',e=>{const button=e.target.closest('[data-map-system]');if(button)onOpen(button.dataset.mapSystem);});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){e.preventDefault();setExpanded(false);toggle.focus();}});
 setExpanded(false);
 return {setExpanded,refreshIcons(){for(const s of MAP_SYSTEMS)root.querySelector(`[data-map-system="${s.key}"] i`).style.cssText=iconStyle(s.icon);}};
}
