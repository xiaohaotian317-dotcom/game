export const LOADING_SCENES={moon:{name:'月光遗迹',subtitle:'断桥与月镜',tip:'击碎木桥可打开下落路线，月镜能改变投射物方向。'},lava:{name:'熔岩祭坛',subtitle:'导流与摆锤',tip:'观察地火预警，用导流阀和摆锤改变对手的落点。'},garden:{name:'浮空花园',subtitle:'风道与藤桥',tip:'顺着风道调整跳跃，利用藤桥与弹跳花抢占高处。'}};
export class LoadingScreen{
  constructor(){
    this.node=document.createElement('section');this.node.className='realm-loading';this.node.hidden=true;this.node.setAttribute('role','status');this.node.setAttribute('aria-live','polite');
    this.node.innerHTML='<div class="loading-landscape"></div><div class="loading-shade"></div><div class="loading-copy"><small>ARCANE DUEL · ENTER THE REALM</small><div class="loading-ornament">✧</div><h2></h2><p class="loading-subtitle"></p><div class="loading-progress" role="progressbar" aria-label="素材加载进度" aria-valuemin="0" aria-valuemax="100"><i></i></div><div class="loading-caption"><span>正在载入秘境</span><b></b></div><p class="loading-tip"></p><button class="loading-retry" hidden>重新加载</button></div>';
    document.body.append(this.node);this.token=0;
  }
  start(scene='moon',label='正在载入秘境'){
    const token=++this.token,s=LOADING_SCENES[scene]||LOADING_SCENES.moon;
    clearTimeout(this.timer);this.node.hidden=true;this.node.classList.remove('loading-error');this.node.querySelector('h2').textContent=s.name;
    this.node.querySelector('.loading-subtitle').textContent=s.subtitle;this.node.querySelector('.loading-tip').textContent=s.tip;
    this.node.querySelector('.loading-landscape').style.backgroundImage='url("assets/loading/'+(LOADING_SCENES[scene]?scene:'moon')+'-loading-v1.png")';
    this.node.querySelector('.loading-caption span').textContent=label;this.node.querySelector('.loading-retry').hidden=true;this.progress(0,0,token);
    this.timer=setTimeout(()=>{if(this.token===token){this.node.hidden=false;this.node.querySelector('h2').focus?.({preventScroll:true});}},140);return token;
  }
  progress(done,total,token=this.token){if(token!==this.token)return;const bar=this.node.querySelector('[role=progressbar]'),known=total>0,percent=known?Math.min(100,Math.round(done/total*100)):0;bar.classList.toggle('indeterminate',!known);if(known)bar.setAttribute('aria-valuenow',percent);else bar.removeAttribute('aria-valuenow');bar.querySelector('i').style.width=(known?percent:24)+'%';this.node.querySelector('.loading-caption b').textContent=known?done+' / '+total:'连接中';}
  finish(token=this.token){if(token!==this.token)return;clearTimeout(this.timer);this.node.hidden=true;this.token++;}
  fail(message,retry,token=this.token){if(token!==this.token)return;clearTimeout(this.timer);this.node.hidden=false;this.node.classList.add('loading-error');this.node.querySelector('.loading-caption span').textContent=message;const b=this.node.querySelector('.loading-retry');b.hidden=false;b.onclick=retry;}
}
