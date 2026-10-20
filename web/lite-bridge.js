/* Local Tauri API adapter for the desktop companion. */
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
    accessories:callback=>listen('clawd:accessory-open',callback),
    adjustment:open=>invoke('clawd_adjustment',{open}),
    input:callback=>listen('clawd:input-batch',batch=>{for(const value of batch)callback(value);}),
    state:callback=>listen('clawd:state',value=>callback(scale(value))),
    statistics:()=>invoke('clawd_statistics'),
    snapshot:()=>invoke('clawd_snapshot').then(scale),
    toggle:()=>invoke('clawd_toggle'),
    settings:()=>invoke('clawd_settings'),
    hide:()=>invoke('clawd_hide'),
    updateSettings:patch=>invoke('clawd_update_settings',{patch}),
    closeSettings:()=>invoke('clawd_close_settings'),
    retry:()=>invoke('clawd_retry'),
    usage:()=>invoke('clawd_usage'),
    autostart:enabled=>invoke('clawd_autostart',{enabled}),
    checkUpdates:()=>invoke('clawd_check_updates'),
    uninstall:()=>invoke('clawd_uninstall'),
    drag:()=>tauri.window.getCurrentWindow().startDragging()
  };
  document.addEventListener('DOMContentLoaded',()=>{
    if(!document.getElementById('clawd-desktop'))return;
    invoke('clawd_ready').catch(()=>{});
    document.addEventListener('contextmenu',event=>{event.preventDefault();if(!event.target.closest('[data-accessory-menu]'))invoke('clawd_menu').catch(()=>{});});
  });
})();
