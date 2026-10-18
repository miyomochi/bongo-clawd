(function(){
  'use strict';
  const root=document.getElementById('clawd-desktop');
  const rig=JSON.parse(document.getElementById('clawd-rig-data').textContent);
  const controller=window.createClawdController(root,rig,{bindInput:false,bindDemo:false});
  const bridge=window.clawdDesktop;
  const connection=root.querySelector('[data-connection]');
  const toggle=root.querySelector('[data-toggle]');
  let connected=false,lastSleepConfig='';
  let disposed=false,held=new Set(),pendingMouse=null,mouseFrame=null;
  function clear(){
    held.clear();pendingMouse=null;cancelAnimationFrame(mouseFrame);mouseFrame=null;controller.clearAll();
  }
  function moveLater(dx,dy){
    pendingMouse={dx,dy};
    if(mouseFrame!==null)return;
    mouseFrame=requestAnimationFrame(()=>{mouseFrame=null;if(pendingMouse){controller.moveMouse(pendingMouse.dx,pendingMouse.dy);pendingMouse=null;}});
  }
  function input(value){
    if(disposed||!value)return;
    if(value.type==='reset'){clear();return;}
    if(value.type==='key'){
      if(value.code==='Pause'){if(value.down)controller.tap('Pause');return;}
      if(value.down){controller.press(value.code,{repeat:held.has(value.code)});held.add(value.code);}
      else{held.delete(value.code);controller.release(value.code);}
    }else if(value.type==='move')moveLater(value.dx,value.dy);
    else if(value.type==='button'){
      if(value.down){controller.moveMouse(0,0);}
      controller.mouseButton(value.button,value.down);
    }
  }
  function state(value){
    const label={starting:'正在连接键鼠…',listening:'全局联动中',paused:'全局联动已暂停',locked:'锁屏暂停',error:'连接失败 · 菜单可重试',unsupported:'当前系统不支持全局联动'};
    connection.textContent=label[value.phase]||'等待连接';connection.title=value.detail||connection.textContent;
    toggle.textContent=value.enabled?'暂停':'启用';toggle.setAttribute('aria-pressed',String(value.enabled));
    root.querySelector('.handle').hidden=value.showTopBar===false;
    root.querySelector('.footer').hidden=value.showBottomBar===false;
    root.style.height=(335-(value.showTopBar===false?39:0)-(value.showBottomBar===false?31:0))+'px';
    const sleepConfig=JSON.stringify([value.sleepEnabled!==false,value.sleepSeconds||90]);
    if(sleepConfig!==lastSleepConfig){controller.configure({sleepEnabled:value.sleepEnabled!==false,sleepSeconds:value.sleepSeconds||90});lastSleepConfig=sleepConfig;}
    if(!value.running)clear();
    else if(!connected)controller.resumeIdle();
    connected=value.running;
  }
  root.querySelector('[data-settings]').addEventListener('click',()=>bridge.settings());
  root.querySelector('[data-hide]').addEventListener('click',()=>bridge.hide());
  toggle.addEventListener('click',()=>bridge.toggle());
  const unsubscribeInput=bridge.input(input),unsubscribeState=bridge.state(state);
  bridge.snapshot().then(state);
  window.addEventListener('beforeunload',()=>{disposed=true;unsubscribeInput();unsubscribeState();clear();controller.destroy();});
  // A test surface exposes no system access; it only accepts the same validated events.
  window.clawdDesktopController=controller;
})();
