import {app,BrowserWindow,ipcMain,Menu,dialog} from 'electron';
import path from 'node:path';
import {LanRuntime} from './lan-runtime.mjs';

const qa=process.argv.find(a=>a.startsWith('--qa-instance='))?.split('=')[1];
const enemyPreview=app.getName()==='arcane-duel-enemy-preview';
const campaignPreview=app.getName()==='arcane-duel-campaign-preview';
const windowTitle=campaignPreview?'秘境决斗 · 秘境征途':enemyPreview?'秘境决斗 · 敌人交互试炼':'秘境决斗 · Windows局域网';
if(qa&&/^[a-z0-9-]{1,20}$/i.test(qa))app.setPath('userData',path.resolve(import.meta.dirname,'.qa-profiles',qa));
if(!qa&&!app.requestSingleInstanceLock()){app.quit();}else{
  let win,runtime,quitting=false;
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.whenReady().then(async()=>{
    app.setAccessibilitySupportEnabled(true);
    const gameRoot=app.isPackaged?app.getAppPath():path.resolve(import.meta.dirname,'..');
    runtime=new LanRuntime({root:path.join(gameRoot,'dist'),uiPort:qa?0:campaignPreview?44177:enemyPreview?44175:44173,hostBind:qa?'127.0.0.1':'0.0.0.0',testMode:!!qa});
    const origin=await runtime.start();
    win=new BrowserWindow({width:1440,height:900,minWidth:1000,minHeight:640,backgroundColor:'#080f1c',title:windowTitle+(qa?' · 本机测试 '+qa:''),autoHideMenuBar:true,webPreferences:{preload:path.join(import.meta.dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    win.webContents.on('page-title-updated',e=>{e.preventDefault();win.setTitle(windowTitle+(qa?' · 本机测试 '+qa:''));});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',(e,url)=>{try{if(new URL(url).origin!==origin)e.preventDefault();}catch{e.preventDefault();}});
    const allowed=new Set(['clipboard-sanitized-write','fullscreen','local-network','local-network-access','loopback-network']);
    win.webContents.session.setPermissionRequestHandler((wc,permission,callback)=>callback(wc===win.webContents&&allowed.has(permission)));
    win.webContents.session.setPermissionCheckHandler((wc,permission,requestingOrigin)=>wc===win.webContents&&requestingOrigin===origin&&allowed.has(permission));
    function checked(event,fn){if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw new Error('非法窗口请求');return fn();}
    ipcMain.handle('arcane:state',e=>checked(e,()=>runtime.state()));
    ipcMain.handle('arcane:host',(e,options)=>checked(e,()=>runtime.host({port:options?.port})));
    ipcMain.handle('arcane:connect',(e,options)=>checked(e,()=>runtime.connect({address:options?.address})));
    async function home(){
      const state=runtime.state();
      if(state.mode!=='offline'){
        const answer=await dialog.showMessageBox(win,{type:'question',buttons:['返回游戏','更换连接'],defaultId:0,cancelId:0,message:'更换连接会离开当前对局。',detail:state.mode==='host'?'你是房主，当前局域网房间服务也会关闭。':'你将离开当前房主。'});
        if(answer.response!==1)return false;
      }
      await runtime.reset();await win.loadURL(origin+'/desktop.html');return true;
    }
    ipcMain.handle('arcane:home',e=>checked(e,home));
    Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'游戏',submenu:[{label:'返回主大厅',click:()=>win.loadURL(origin+'/lobby.html')},{label:'局域网连接',click:home},{type:'separator'},{label:'全屏',accelerator:'F11',click:()=>win.setFullScreen(!win.isFullScreen())},{label:'退出',role:'quit'}]}]));
    await win.loadURL(origin+(enemyPreview?'/enemies.html':'/index.html'));
  }).catch(e=>{dialog.showErrorBox('秘境决斗启动失败',e.message+'\n请确认没有其他程序占用本机44173端口。');app.quit();});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',e=>{if(runtime&&!quitting){e.preventDefault();quitting=true;runtime.close().finally(()=>app.quit());}});
}
