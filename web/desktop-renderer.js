(function(){
  'use strict';
  const root=document.getElementById('clawd-desktop');
  const rig=JSON.parse(document.getElementById('clawd-rig-data').textContent);
  const controller=window.createClawdController(root,rig,{bindInput:false,bindDemo:false,sunglassesEnabled:true,happyEnabled:true,accessoryStorage:false,breathingEnabled:true,reachEnabled:true,onAccessoryConfirmed:line=>speak(line,'accessory')});
  const bridge=window.clawdDesktop;
  const connection=root.querySelector('[data-connection]'),toggle=root.querySelector('[data-toggle]');
  const panel=root.querySelector('[data-accessory-menu]'),error=root.querySelector('[data-accessory-error]');
  const status=root.querySelector('[data-status]'),bubble=root.querySelector('[data-bubble]'),bubbleText=root.querySelector('[data-bubble-text]'),retry=root.querySelector('[data-retry]');
  let connected=false,statisticsTimer=null,statisticsGeneration=0,lastSleepConfig='',disposed=false,saving=false,held=new Set(),pendingMouse=null,mouseFrame=null;
  let bubbleTimer=null,bubbleFade=null,lastSpoken='',thoughtTimer=null,bubbleSource=null,accessoryReveal=null,accessoryGeneration=0;
  let runtime={phase:'starting',enabled:true,running:false,accessory:'none',sideButtons:true,bubbleLines:true};
  // Window geometry in logical px (zoom scales all of it); keep in sync with Preferences::dimensions in Rust.
  const WIDTH=388,NARROW=352,HEIGHT=300,DECOR=166;
  // Head top anchor for the bubble tail: SVG (123,22) mapped into the 340×257 scene at (4,26). Fixed gap, no per-accessory raise.
  const HEAD={x:4+(123-12)*340/216,y:26+(22+16)*257/163};
  // Character lines (台词) shown in the bubble; narration (旁白) stays in the hidden live region only.
  const SPEECH=new Set(['哇！','谁、谁来了？','我没睡！在敲呢！','呼……继续工作','睡着了','呼……Zzz','困困的……','偷偷戴上','全工位最酷的小蟹','耍帅结束，继续工作','嗯？没人吧……','好安静啊','……人呢？','Ultra Clawding!!','忙不过来了！','呼……缓口气','嘿嘿~','跟着节奏敲~','啵，长高一点点','坐稳啦']);
  function forgetInput(){held.clear();pendingMouse=null;cancelAnimationFrame(mouseFrame);mouseFrame=null;}
  function clear(){forgetInput();controller.clearAll();}
  function adjusting(){const a=controller.getState().accessory;return a.menuOpen||a.preview;}
  function width(){return runtime.sideButtons===false?NARROW:WIDTH;}
  function layout(){
    root.classList.toggle('no-side',runtime.sideButtons===false);
    root.classList.toggle('is-mirrored',runtime.mirrored===true);
    root.style.width=width()+'px';
    root.style.height=(HEIGHT+(controller.getState().accessory.menuOpen?DECOR:0))+'px';
    placeBubble(bubble);placeBubble(retry);
  }
  const stats=root.querySelector('[data-statistics]'),statsTotal=root.querySelector('[data-statistics-total]'),statsRate=root.querySelector('[data-statistics-rate]');
  function compact(n){
    if(!Number.isFinite(n)||n<0)return '—';
    n=Math.floor(n);
    if(n<10000)return String(n);
    const wan=Math.floor(n/1000)/10;
    return (wan>=1000?String(Math.floor(wan)):wan.toFixed(1))+'万';
  }
  function syncStatistics(){
    const visible=runtime.statisticsEnabled===true;
    stats.hidden=!visible;
    if(!visible||document.hidden||disposed){
      clearTimeout(statisticsTimer);statisticsTimer=null;statisticsGeneration++;
      if(!visible){statsTotal.textContent='0';statsRate.textContent='0';}
      return;
    }
    if(statisticsTimer!==null)return;
    const generation=++statisticsGeneration;
    // One outstanding request/timer; only aggregate numbers cross this bridge.
    statisticsTimer=-1;
    Promise.resolve(bridge.statistics?.()).then(value=>{
      if(disposed||generation!==statisticsGeneration||!value)return;
      statsTotal.textContent=compact(value.total);statsRate.textContent=compact(value.perMinute);
    }).catch(()=>{
      if(generation===statisticsGeneration){statsTotal.textContent='—';statsRate.textContent='—';}
    }).finally(()=>{
      if(disposed||generation!==statisticsGeneration)return;
      statisticsTimer=setTimeout(()=>{statisticsTimer=null;syncStatistics();},1000);
    });
  }
  // Keep the bubble above the head with a fixed gap; if it would leave the window, slide it diagonally up and sideways.
  function placeBubble(node){
    if(!node||node.hidden)return;
    const outer=root.getBoundingClientRect(),box=node.getBoundingClientRect();
    const ratio=outer.width?width()/outer.width:1;
    const w=box.width*ratio,h=box.height*ratio,limit=width()-6,tailGap=32;
    let left=HEAD.x-56,top=HEAD.y-tailGap-h;
    const over=left+w-limit;
    if(over>0){left-=over;top-=Math.min(over,12);}
    if(left<4){top-=Math.min(4-left,12);left=4;}
    if(top<4){left=Math.min(HEAD.x+8,limit-w);top=4;}
    node.style.left=Math.round(left)+'px';node.style.top=Math.round(top)+'px';
    node.style.setProperty('--tail',Math.round(Math.max(6,Math.min(w-18,HEAD.x-left-5)))+'px');
  }
  function hideBubble(){clearTimeout(bubbleTimer);clearTimeout(bubbleFade);bubbleTimer=bubbleFade=null;bubbleSource=null;bubble.hidden=true;bubble.classList.remove('is-fading');}
  function speechBlocked(){return (runtime.update?.phase&&runtime.update.phase!=='idle')||disposed||runtime.bubbleLines===false||runtime.enabled===false||runtime.phase==='error'||document.hidden||controller.getState().paused||adjusting();}
  function stopThoughtWatch(){clearTimeout(thoughtTimer);thoughtTimer=null;}
  function speak(text,source='status'){
    if(speechBlocked()){hideBubble();return;}
    clearTimeout(bubbleTimer);clearTimeout(bubbleFade);
    bubbleSource=source;bubbleText.textContent=text;bubble.classList.remove('is-fading');bubble.hidden=false;placeBubble(bubble);
    bubbleTimer=setTimeout(()=>{bubble.classList.add('is-fading');bubbleFade=setTimeout(hideBubble,180);},2600);
  }
  // Some animations draw their own thought bubble (happy/dream: #happy-bubble with fish, sprout, heart… motifs, plus the pop burst).
  // While it is up, speech lines are held back. ~200ms after it ends, only the line still valid now (the current status) is spoken;
  // anything said in between is dropped, there is no queue.
  const THOUGHT_SETTLE=200,THOUGHT_POLL=50;
  function thoughtShowing(){const h=controller.getState().happy;return !!h&&h!=='none';}
  function watchThought(){
    if(thoughtTimer!==null||disposed)return;
    thoughtTimer=setTimeout(function poll(){
      if(disposed){thoughtTimer=null;return;}
      if(thoughtShowing()){thoughtTimer=setTimeout(poll,THOUGHT_POLL);return;}
      thoughtTimer=setTimeout(()=>{
        thoughtTimer=null;
        if(thoughtShowing()){watchThought();return;}
        const text=status.textContent;lastSpoken=text;
        if(SPEECH.has(text))speak(text);
      },THOUGHT_SETTLE);
    },THOUGHT_POLL);
  }
  function statusChanged(){
    const text=status.textContent;
    if(speechBlocked()){hideBubble();stopThoughtWatch();lastSpoken=text;return;}
    if(thoughtShowing()||thoughtTimer!==null){hideBubble();lastSpoken=text;watchThought();return;}
    if(text===lastSpoken)return;
    lastSpoken=text;
    if(SPEECH.has(text))speak(text);else if(bubbleSource!=='accessory')hideBubble();
  }
  const MutationObserverCtor=window.MutationObserver;
  const observer=MutationObserverCtor?new MutationObserverCtor(statusChanged):null;
  observer?.observe(status,{childList:true,characterData:true,subtree:true});
  function moveLater(dx,dy){
    pendingMouse={dx,dy};if(mouseFrame!==null)return;
    mouseFrame=requestAnimationFrame(()=>{mouseFrame=null;if(pendingMouse){controller.moveMouse(pendingMouse.dx,pendingMouse.dy);pendingMouse=null;}});
  }
  function input(value){
    if(disposed||!value)return;
    if(value.type==='reset'){forgetInput();if(runtime.update?.phase&&runtime.update.phase!=='idle')return;if(!adjusting()){controller.clearAll();if(runtime.running&&!controller.getState().paused)controller.resumeIdle();}return;}
    if((runtime.update?.phase&&runtime.update.phase!=='idle')||controller.getState().paused||adjusting()||!runtime.enabled||runtime.settingsOpen||runtime.popupOpen)return;
    if(value.type==='key'){
      if(value.code==='Pause'){if(value.down)controller.tap('Pause');return;}
      if(value.down){if(controller.press(value.code,{repeat:held.has(value.code)}))held.add(value.code);}
      else{held.delete(value.code);controller.release(value.code);}
    }else if(ownsPointer())return;
    else if(value.type==='move')moveLater(value.dx,value.dy);
    else if(value.type==='button'){
      if(value.down)controller.moveMouse(0,0);
      controller.mouseButton(value.button,value.down);
    }
  }
  function state(value){
    if(disposed||!value)return;runtime={...runtime,...value};value=runtime;
    const label={starting:'连接中',listening:'联动中',paused:'已暂停',locked:'锁屏暂停',error:'连不上了 · 点我重试',unsupported:'系统不支持联动'};
    connection.textContent=value.settingsOpen||value.popupOpen||controller.getState().accessory.menuOpen?'调整中':label[value.phase]||'连接中';connection.title=value.detail||connection.textContent;
    const updateActive=!!value.update?.phase&&value.update.phase!=='idle';
    const manual=value.enabled===false;
    root.classList.toggle('is-paused',manual&&!updateActive);
    toggle.classList.toggle('is-card',manual);
    toggle.setAttribute('aria-pressed',String(!manual));
    toggle.setAttribute('aria-label',manual?'已暂停 · 点一下继续':'暂停');toggle.title=manual?'点一下继续 · 按住拖动':'暂停';
    // Connection errors use the orange bubble; a healthy connection shows no status at all.
    retry.hidden=value.phase!=='error'||manual||updateActive;retry.title=value.detail||'重试输入服务';
    if(!retry.hidden){hideBubble();placeBubble(retry);}
    if(manual||value.bubbleLines===false)hideBubble();
    root.classList.toggle('is-updating',updateActive);
    const paused=!updateActive&&(!value.enabled||value.settingsOpen||value.popupOpen||document.hidden||['starting','locked','error','unsupported'].includes(value.phase));
    if(updateActive)controller.cancelReaction();
    if(paused||updateActive)forgetInput();controller.setPaused(!!paused);controller.setUpdateState?.(value.update||{phase:'idle'});
    if(paused||value.bubbleLines===false){hideBubble();stopThoughtWatch();}
    root.querySelector('.side').inert=manual||updateActive;toggle.disabled=updateActive;
    const sleepConfig=JSON.stringify([value.sleepEnabled!==false,value.sleepSeconds||90,value.breathingEnabled!==false]);
    if(sleepConfig!==lastSleepConfig){controller.configure({sleepEnabled:value.sleepEnabled!==false,sleepSeconds:value.sleepSeconds||90,breathingEnabled:value.breathingEnabled!==false});lastSleepConfig=sleepConfig;}
    if(!adjusting()&&controller.getState().accessory.selected!==value.accessory)controller.restoreAccessory(value.accessory||'none');
    if(value.running&&!connected&&!paused&&!adjusting())controller.resumeIdle();
    const reach=value.directionalArms!==false;
    if(controller.getReachEnabled()!==reach){controller.cancelReaction();controller.setReachEnabled(reach);}
    connected=value.running;layout();syncStatistics();
  }
  // The native raw-input stream also sees clicks on our own window. Give
  // body hover / gestures ownership before forwarding mouse animation events.
  let bodyHovered=false,gesture=null,nativeDragging=false;
  const isBody=node=>!!node?.closest?.('#body-motion,#left-hand,#right-hand');
  function ownsPointer(){return bodyHovered||gesture!==null||nativeDragging;}
  function dropMouse(){pendingMouse=null;cancelAnimationFrame(mouseFrame);mouseFrame=null;if(controller.getState().mouse){controller.mouseButton(0,false);controller.mouseButton(2,false);controller.stopMouse();}}
  root.addEventListener('pointerover',e=>{bodyHovered=isBody(e.target);if(bodyHovered)dropMouse();});
  root.addEventListener('pointerleave',()=>{bodyHovered=false;});
  root.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('button,input,textarea,select,a,[data-accessory-menu]')||!e.target.closest('.scene,.statistics'))return;
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now(),body:isBody(e.target)};
    bodyHovered=gesture.body;dropMouse();root.setPointerCapture?.(e.pointerId);e.preventDefault();
  });
  root.addEventListener('pointermove',e=>{
    if(!gesture){bodyHovered=isBody(e.target);if(bodyHovered)dropMouse();return;}
    if(e.pointerId!==gesture.id||Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<=6)return;
    const id=gesture.id;gesture=null;nativeDragging=true;controller.cancelReaction();dropMouse();
    if(root.hasPointerCapture?.(id))root.releasePointerCapture(id);
    Promise.resolve(bridge.drag?.()).catch(()=>{}).finally(()=>{nativeDragging=false;});
  });
  function releaseGesture(e,cancelled=false){
    if(!gesture||e.pointerId!==gesture.id||(!cancelled&&e.button!==0))return;
    const g=gesture;gesture=null;
    if(root.hasPointerCapture?.(e.pointerId))root.releasePointerCapture(e.pointerId);
    if(!cancelled&&g.body&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<=6&&performance.now()-g.at<=300
      &&!(runtime.update?.phase&&runtime.update.phase!=='idle')&&runtime.enabled!==false&&!runtime.settingsOpen&&!runtime.popupOpen&&!adjusting()){
      forgetInput();hideBubble();stopThoughtWatch();controller.react('random');
    }
  }
  window.addEventListener('pointerup',e=>releaseGesture(e));
  root.addEventListener('pointercancel',e=>releaseGesture(e,true));
  root.addEventListener('lostpointercapture',e=>{if(gesture?.id===e.pointerId)gesture=null;});
  root.addEventListener('contextmenu',()=>{gesture=null;controller.cancelReaction();dropMouse();});
  window.addEventListener('blur',()=>{gesture=null;bodyHovered=false;});
  async function openAccessories(){
    if(disposed||controller.getState().accessory.menuOpen||runtime.settingsOpen||(runtime.update?.phase&&runtime.update.phase!=='idle'))return;
    const generation=++accessoryGeneration;
    forgetInput();hideBubble();stopThoughtWatch();panel.classList.add('is-opening');
    controller.setPaused(false);controller.openAccessoryMenu();layout();
    if(error)error.hidden=true;
    try{
      await bridge.adjustment?.(true);
      if(disposed||generation!==accessoryGeneration||!controller.getState().accessory.menuOpen)return;
      accessoryReveal=requestAnimationFrame(()=>{
        accessoryReveal=null;if(disposed||generation!==accessoryGeneration||!controller.getState().accessory.menuOpen)return;
        panel.classList.remove('is-opening');
        panel.querySelector('[name="clawd-accessory"]:checked')?.focus({preventScroll:true});
      });
    }catch{
      if(disposed||generation!==accessoryGeneration)return;
      panel.classList.remove('is-opening');
      controller.closeAccessoryMenu(false);layout();state(runtime);
      await bridge.adjustment?.(false).catch(()=>{});
    }
  }
  async function finishAccessories(confirm){
    if(disposed||saving||!controller.getState().accessory.menuOpen)return;
    accessoryGeneration++;cancelAnimationFrame(accessoryReveal);accessoryReveal=null;panel.classList.remove('is-opening');
    saving=true;panel.querySelectorAll('button,input').forEach(n=>n.disabled=true);
    try{
      if(confirm)await bridge.updateSettings({accessory:controller.getState().accessory.draft});
      controller.closeAccessoryMenu(confirm);forgetInput();layout();
      await bridge.adjustment?.(false);state(runtime);
    }catch{
      if(error){error.textContent='没保存上，请重试';error.hidden=false;}
    }finally{saving=false;panel.querySelectorAll('button,input').forEach(n=>n.disabled=false);}
  }
  root.querySelectorAll('[data-accessory-open]').forEach(n=>n.addEventListener('click',()=>{if(controller.getState().accessory.menuOpen)finishAccessories(false);else openAccessories();}));
  panel.querySelectorAll('[name="clawd-accessory"]').forEach(n=>n.addEventListener('change',()=>{if(n.checked&&!saving)controller.selectAccessory(n.value);}));
  root.querySelector('[data-accessory-confirm]').addEventListener('click',()=>finishAccessories(true));
  root.querySelector('[data-accessory-cancel]').addEventListener('click',()=>finishAccessories(false));
  panel.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finishAccessories(false);}
    if(e.key==='Tab'){
      const items=[...panel.querySelectorAll('input,button')].filter(n=>!n.disabled),first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  });
  root.querySelector('[data-settings]').addEventListener('click',()=>bridge.settings());
  retry.addEventListener('click',()=>{retry.disabled=true;Promise.resolve(bridge.retry?.()).catch(()=>{}).finally(()=>{retry.disabled=false;});});
  // Pause block: a click toggles; while it is the paused card, dragging it past a few pixels moves the window instead.
  let press=null,dragged=false;
  toggle.addEventListener('pointerdown',e=>{if(e.button===0&&runtime.enabled===false){press={x:e.clientX,y:e.clientY};dragged=false;}});
  toggle.addEventListener('pointermove',e=>{
    if(!press||dragged)return;
    if(Math.abs(e.clientX-press.x)+Math.abs(e.clientY-press.y)>4){dragged=true;press=null;Promise.resolve(bridge.drag?.()).catch(()=>{});}
  });
  toggle.addEventListener('pointerup',()=>{press=null;});
  toggle.addEventListener('click',e=>{if(dragged){dragged=false;e.preventDefault();return;}bridge.toggle();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){forgetInput();controller.setPaused(true);hideBubble();stopThoughtWatch();}else state(runtime);syncStatistics();});
  const unsubscribeInput=bridge.input(input),unsubscribeState=bridge.state(state),unsubscribeAccessories=bridge.accessories?.(openAccessories)||(()=>{});
  bridge.snapshot().then(state);
  window.addEventListener('beforeunload',()=>{disposed=true;cancelAnimationFrame(accessoryReveal);accessoryReveal=null;observer?.disconnect();clearTimeout(thoughtTimer);thoughtTimer=null;hideBubble();clearTimeout(statisticsTimer);statisticsGeneration++;unsubscribeInput();unsubscribeState();unsubscribeAccessories();clear();controller.destroy();});
  window.clawdDesktopController=controller;
  window.clawdDesktopFormat=compact;
})();
