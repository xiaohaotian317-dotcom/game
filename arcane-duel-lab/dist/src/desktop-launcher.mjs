const $=s=>document.querySelector(s),desktop=window.arcaneDesktop;
const status=message=>{$('#lan-status').textContent=message;$('#lan-status').hidden=!message;};
try{$('#lan-name').value=localStorage.getItem('arcane-desktop-name')||'冒险者';$('#lan-address').value=localStorage.getItem('arcane-desktop-address')||'';}catch{}
async function enter(kind){
  if(!desktop){status('请在Windows客户端中使用局域网联机。');return;}
  const buttons=[$('#lan-host'),$('#lan-join')];buttons.forEach(b=>b.disabled=true);
  try{
    const name=$('#lan-name').value.trim()||'冒险者';status(kind==='host'?'正在创建房间…':'正在连接房主…');
    if(kind==='host')await desktop.host({port:Number($('#lan-port').value)});else await desktop.connect({address:$('#lan-address').value});
    sessionStorage.removeItem('arcane-duel-room-v1');
    const body={name,code:$(kind==='host'?'#lan-create-code':'#lan-join-code').value.trim(),hero:'fire'};
    const response=await fetch('/api/duel/'+(kind==='host'?'rooms':'join'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();
    if(!response.ok)throw new Error(data.error||'连接房间失败');
    sessionStorage.setItem('arcane-duel-room-v1',JSON.stringify({code:data.room.code,token:data.token,seat:data.room.seat}));
    try{localStorage.setItem('arcane-desktop-name',name);if(kind==='guest')localStorage.setItem('arcane-desktop-address',$('#lan-address').value);}catch{}
    location.href='duel.html';
  }catch(e){status(String(e.message).replace(/^Error invoking remote method '[^']+': Error: /,''));}
  finally{buttons.forEach(b=>b.disabled=false);}
}
$('#lan-host-form').addEventListener('submit',e=>{e.preventDefault();enter('host');});
$('#lan-join-form').addEventListener('submit',e=>{e.preventDefault();enter('guest');});
