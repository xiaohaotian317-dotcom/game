import {loadSolo,saveSolo} from './campaign-profile.mjs';
import {RELEASE_AD_POLICY} from './release-ad-policy.mjs';
import {shareMessage,dailyShareChoice,commitDailyShare} from './share-rewards.mjs';
function shareStyle(){if(document.querySelector('[data-service-style]'))return;const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('../service-settings.css',import.meta.url).href;css.dataset.serviceStyle='';document.head.append(css);}
function desktopShare(text,requestId){
 shareStyle();const dialog=document.createElement('dialog');dialog.className='game-share-dialog';dialog.setAttribute('aria-labelledby','game-share-title');dialog.innerHTML='<button type="button" class="share-close" aria-label="关闭分享">×</button><small>INVITE TO THE REALM</small><h2 id="game-share-title">分享秘境决斗</h2><p>复制这段介绍，分享给微信或QQ的好友。</p><textarea readonly aria-label="游戏分享内容"></textarea><button type="button" data-copy-share>复制分享内容</button><p role="status"></p>';dialog.querySelector('textarea').value=text;document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('.share-close').onclick=()=>dialog.close();dialog.querySelector('[data-copy-share]').onclick=async()=>{try{await navigator.clipboard.writeText(text);dialog.querySelector('[role="status"]').textContent='已复制，可自行粘贴分享。';}catch{dialog.querySelector('textarea').select();dialog.querySelector('[role="status"]').textContent='请选择上方文字复制。';}};dialog.showModal();return {opened:true,requestId};
}
/** A user click opens the platform chooser; sending is always up to the player. */
export async function openGameShare({storage=globalThis.localStorage,onSave=()=>{},bridge=globalThis.arcaneMobile?.bridge,webShare=globalThis.arcaneMobile?globalThis.navigator?.share?.bind(globalThis.navigator):null,openDesktop=desktopShare,requestId=crypto.randomUUID()}={}){
 const message=shareMessage(),text=message.text+(message.url?'\n'+message.url:'');
 const choice=dailyShareChoice(loadSolo(storage),{requestId});let opened;
 if(bridge?.shareGame)opened=await bridge.shareGame({requestId,text});
 else if(webShare){await webShare({title:message.title,text:message.text,...(message.url?{url:message.url}:{})});opened={opened:true,requestId};}
 else opened=await openDesktop(text,requestId);
 if(opened?.opened!==true||opened.requestId!==requestId)throw Error('分享入口未能打开，请重试。');
 if(!choice)return {rewarded:false};
 const committed=commitDailyShare({getProfile:()=>loadSolo(storage),onSave:next=>{if(!saveSolo(storage,next))return false;onSave(next);return true;},choice,opened,policy:RELEASE_AD_POLICY});
 return {rewarded:true,reward:committed.reward};
}
