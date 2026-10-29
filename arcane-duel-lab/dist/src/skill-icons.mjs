export const ICON_ORDER=Object.freeze(['attack','q','e','dash','r','recast']);
export function skillArt(hero,key,recast=false){
  if(!['fire','nature','frost','lightning','shadow','star'].includes(hero))throw new Error('Unknown icon hero');
  const index=recast?5:ICON_ORDER.indexOf(key);if(index<0)throw new Error('Unknown icon slot');
  return {url:'assets/icons/'+hero+'-skills-v1.png',index,position:(index%3*50)+'% '+(Math.floor(index/3)*100)+'%'};
}
export function skillArtStyle(hero,key,recast=false){const a=skillArt(hero,key,recast);return 'background-image:url('+a.url+');background-position:'+a.position;}
