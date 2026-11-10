import {MOBILE_BUILD,mobile} from './platform.mjs';
const $=s=>document.querySelector(s),status=text=>$('#network-notice').textContent=text;
const api=mobile();let busy=false;
function lock(v){busy=v;document.querySelectorAll('button').forEach(b=>b.disabled=v);}
async function work(fn){if(busy)return;lock(true);try{await fn();}catch(e){status(e.message||'连接失败，请检查网络。');}finally{lock(false);}}
function enter(mode){sessionStorage.setItem('arcane-network-mode',mode);sessionStorage.removeItem('arcane-duel-room-v1');location.href='duel.html';}
$('#lan-host').onclick=()=>work(async()=>{if(!api)throw Error('此入口需要安卓安装版。');const s=await api.bridge.host({port:44174});status('同网房间服务已启动。');$('#lan-addresses').textContent=(s.addresses||[]).map(a=>a.address).join(' · ');enter('lan');});
$('#lan-join').onclick=()=>work(async()=>{if(!api)throw Error('此入口需要安卓安装版。');const address=$('#host-address').value.trim();if(!address)throw Error('请输入好友分享的房主地址。');const state=await api.bridge.connect({address});if(state.build&&state.build!==MOBILE_BUILD)throw Error('双方版本不一致，请使用配套版本。');enter('lan');});
$('#tap-enter').onclick=()=>work(async()=>{if(!api)throw Error('异地联机需要安卓安装版。');if(!$('#privacy-accepted').checked)throw Error('请先阅读并同意隐私与联机说明。');const check=await api.tap.status();if(!check.configured)throw Error('TapTap游戏尚未配置，当前包可使用同网联机。');sessionStorage.setItem('arcane-tap-privacy','accepted');await api.tap.login({privacyAccepted:true});await api.tap.connect();enter('tap');});
if(api)api.tap.status().then(s=>{$('#tap-state').textContent=s.configured?'TapTap联机已配置，登录后创建或加入房间。':'正在等待开发者后台的游戏ID与联机配置；同网联机可独立使用。';}).catch(e=>$('#tap-state').textContent=e.message);else $('#tap-state').textContent='请在安卓应用中使用。';
