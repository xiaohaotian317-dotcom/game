// World positions are authored against the approved scene composition (1440 x 680).
const ledge=(id,x,y,w,type='stone')=>({id,x,y,w,type,baked:type==='stone',active:true,hp:type==='wood'?90:Infinity,maxHp:type==='wood'?90:Infinity});
export const SCENES={
  moon:{id:'moon',name:'月光遗迹',subtitle:'断桥与月镜',english:'MOONLIT RUINS',color:'#a7c4f5',height:680,floor:550,spawn:{x:220,y:495},defaultHero:'fire',
    platforms:[ledge('ground',0,550,1440),ledge('start',90,495,290),ledge('left',18,315,354),ledge('upper-left',58,174,305),ledge('bridge-left',434,168,156),ledge('bridge',590,179,254,'wood'),ledge('bridge-right',844,168,164),ledge('upper-right',1008,191,370),ledge('middle',554,357,285),ledge('right',1270,477,170),ledge('lift',1166,402,128,'lift')],
    targets:[{x:790,y:550},{x:1125,y:191}],mirror:{x:157,y:254,angle:-Math.PI/4},
    lift:{x:1166,y:402,w:128,low:466,high:292,target:402,speed:100,switchX:1364,switchY:234},
    cards:[{id:'bridge',name:'断桥',copy:'攻击破坏，打开下落路线',action:'试击断桥',asset:'bridge'},{id:'lift',name:'升降月台',copy:'击打符印，改变落脚高度',action:'切换月台',asset:'lift'},{id:'mirror',name:'转向月镜',copy:'切换镜面，折射投射物',action:'旋转月镜',asset:'mirror'}]},
  lava:{id:'lava',name:'熔岩祭坛',subtitle:'导流与摆锤',english:'LAVA SANCTUM',color:'#f3ad66',height:680,floor:527,spawn:{x:220,y:527},defaultHero:'fire',
    platforms:[ledge('ground',0,527,1440),ledge('upper-left',76,151,230),ledge('upper-right',1138,151,250),ledge('left',175,322,382),ledge('right',882,322,393),ledge('middle',556,246,329),ledge('bridge',-500,200,1,'wood')],
    targets:[{x:960,y:527},{x:1160,y:322}],valve:{x:401,y:278,route:0,angle:0},
    hammer:{anchorX:720,anchorY:60,length:136,angle:.25,velocity:0,hitAt:0,pulse:0},vents:[{x:495,y:527,phase:0},{x:955,y:527,phase:0}],
    cards:[{id:'vents',name:'预警地火',copy:'先亮后喷，观察时机穿越',action:'查看下一次喷发',asset:'vent'},{id:'valve',name:'导流阀门',copy:'击打切换，改变安全通道',action:'切换导流',asset:'wheel'},{id:'hammer',name:'受击摆锤',copy:'攻击摆动，压制平台落点',action:'推动摆锤',asset:'hammer'}]},
  garden:{id:'garden',name:'浮空花园',subtitle:'风道与藤桥',english:'FLOATING GARDEN',color:'#c5dd9e',height:680,floor:551,spawn:{x:220,y:525},defaultHero:'nature',
    platforms:[ledge('ground',0,551,1440),ledge('start',18,525,388),ledge('upper-left',70,145,264),ledge('left',310,245,329),ledge('island',752,205,135),ledge('right',1012,270,400),ledge('vine-left',501,340,142),ledge('vine-right',954,352,94),ledge('vine',632,346,334,'vine'),ledge('bridge',-500,200,1,'wood')],
    targets:[{x:1085,y:551},{x:1190,y:270}],wind:{x:520,y:171,direction:1,bounds:{x:520,y:145,w:295,h:140}},vine:{x:632,y:346,w:334,growth:0,until:0,budX:550,budY:313},spring:{x:718,y:551},
    cards:[{id:'wind',name:'转向风铃',copy:'击打风铃，改变气流方向',action:'切换风道',asset:'chime'},{id:'vine',name:'生长藤桥',copy:'激活种芽，临时连接平台',action:'催生藤桥',asset:'vine'},{id:'spring',name:'蓄力弹跳花',copy:'踩压蓄力，借势跃上高层',action:'查看弹跳花',asset:'flower'}]}
};
export function applyScene(w,id){
  const s=SCENES[id];if(!s)return w;
  w.sceneId=id;w.height=s.height;w.floor=s.floor;w.spawn={...s.spawn};w.characterScale=.82;w.jumpScale=1.14;
  w.platforms=s.platforms.map(p=>({...p}));
  if(id==='moon')w.platforms.push(ledge('stepping-column',466,496,53));
  if(id==='garden')w.platforms.push(ledge('stepping-column',319,444,71),ledge('right-step',1210,431,76),ledge('flower-pad',686,532,64,'flower'));
  Object.assign(w.player,{x:s.spawn.x,y:s.spawn.y,prevX:s.spawn.x,prevY:s.spawn.y,platformId:id==='lava'?'ground':'start'});
  w.targets.forEach((t,i)=>Object.assign(t,{...s.targets[i],prevX:s.targets[i].x,prevY:s.targets[i].y,spawnX:s.targets[i].x,spawnY:s.targets[i].y}));
  w.mirror={...w.mirror,...s.mirror,enabled:!!s.mirror};w.spring={...w.spring,...s.spring,enabled:!!s.spring};
  if(s.spring)w.spring.surfaceY=532;
  w.mechanisms={cooldown:0,flash:0};
  for(const key of ['lift','valve','hammer','wind','vine'])if(s[key])w.mechanisms[key]=structuredClone(s[key]);
  if(s.vents)w.mechanisms.vents=s.vents.map(v=>({...v,mode:'rest',progress:0}));
  const vine=w.platforms.find(p=>p.type==='vine');if(vine){vine.active=true;w.mechanisms.vine.growth=1;w.mechanisms.vine.until=30;}
  // Preserve the approved 1440px centre. Two 432px side courts add escape routes.
  const offset=432;w.width=2304;w.sceneOffset=offset;
  const central=w.platforms.filter(p=>p.x>=0);
  const courts=[];
  for(const b of central.filter(p=>p.baked&&p.id!=='ground')){
    const left=Math.max(0,b.x),right=Math.min(432,b.x+b.w);
    if(right-left>45)courts.push({...b,id:'west-'+b.id,x:432-right,w:right-left});
    const a=Math.max(1008,b.x),z=Math.min(1440,b.x+b.w);
    if(z-a>45)courts.push({...b,id:'east-'+b.id,x:1872+1440-z,w:z-a});
  }
  for(const b of w.platforms)if(b.id==='ground')b.w=w.width;else if(b.x>=0)b.x+=offset;
  w.platforms.push(...courts);
  w.spawn.x+=offset;w.player.x+=offset;w.player.prevX=w.player.x;
  for(const t of w.targets){t.x+=offset;t.prevX=t.x;t.spawnX=t.x;}
  // Keep the familiar training distance; the side courts provide room to retreat.
  if(w.mirror.enabled)w.mirror.x+=offset;if(w.spring.enabled)w.spring.x+=offset;
  for(const key of ['lift','valve','wind','vine']){const m=w.mechanisms[key];if(!m)continue;m.x+=offset;if(m.switchX!==undefined)m.switchX+=offset;if(m.budX!==undefined)m.budX+=offset;if(m.bounds)m.bounds.x+=offset;}
  if(w.mechanisms.hammer)w.mechanisms.hammer.anchorX+=offset;
  for(const v of w.mechanisms.vents||[])v.x+=offset;
  w.obstacles=[{id:'west-cover',x:354,y:s.floor-100,w:62,h:100,actor:true},{id:'east-cover',x:2128,y:s.floor-100,w:62,h:100,actor:true}];
  for(const b of w.obstacles)w.platforms.push(ledge(b.id,b.x,b.y,b.w,'cover'));
  for(const b of w.platforms)if(b.type==='stone')b.renderDepth=28;
  w.camera={x:0,overview:false};w.aim={x:1120,y:s.floor-60};
  return w;
}
