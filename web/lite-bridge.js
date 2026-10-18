/* Desktop API adapter. The seven animation modules are unchanged. */
(function(){
  'use strict';
  const tauri=window.__TAURI__;
  const invoke=tauri.core.invoke;
  function listen(name,callback){
    let unsubscribe=null,disposed=false;
    tauri.event.listen(name,e=>{if(!disposed)callback(e.payload);}).then(fn=>{if(disposed)fn();else unsubscribe=fn;});
    return()=>{disposed=true;unsubscribe?.();};
  }
  function scale(value){const root=document.getElementById('clawd-desktop');if(root&&Number.isFinite(value.scale))root.style.zoom=String(value.scale);return value;}
  window.clawdDesktop={
    input:callback=>listen('clawd:input-batch',batch=>{for(const value of batch)callback(value);}),
    state:callback=>listen('clawd:state',value=>callback(scale(value))),
    snapshot:()=>invoke('clawd_snapshot').then(scale),
    toggle:()=>invoke('clawd_toggle'),
    settings:()=>invoke('clawd_settings'),
    hide:()=>invoke('clawd_hide'),
    updateSettings:patch=>invoke('clawd_update_settings',{patch}),
    closeSettings:()=>invoke('clawd_close_settings')
  };
  document.addEventListener('DOMContentLoaded',()=>{
    if(!document.getElementById('clawd-desktop'))return;
    invoke('clawd_ready').catch(()=>{});
    document.addEventListener('mousedown',event=>{
      if(event.button!==0||event.target.closest('button,input,textarea,select,a'))return;
      if(event.target.closest('.scene,.handle,.footer'))tauri.window.getCurrentWindow().startDragging().catch(()=>{});
    });
    document.addEventListener('contextmenu',event=>{event.preventDefault();invoke('clawd_menu').catch(()=>{});});
  });
})();
