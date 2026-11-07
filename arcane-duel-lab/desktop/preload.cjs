const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('arcaneDesktop',Object.freeze({
  lan:true,
  quit:()=>ipcRenderer.invoke('arcane:quit'),
  motionVersion:process.argv.includes('--arcane-motion=legacy')?'legacy':'v2',
  state:()=>ipcRenderer.invoke('arcane:state'),
  host:options=>ipcRenderer.invoke('arcane:host',options),
  connect:options=>ipcRenderer.invoke('arcane:connect',options),
  home:()=>ipcRenderer.invoke('arcane:home')
}));
