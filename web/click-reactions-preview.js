(function(){
 'use strict';
 const root=document.getElementById('click-preview'),svg=root.querySelector('svg'),scene=root.querySelector('.scene'),station=root.querySelector('.station');
 const rig=JSON.parse(document.getElementById('clawd-rig-data').textContent),textarea=root.querySelector('textarea'),menu=document.querySelector('[data-context-menu]'),hint=root.querySelector('[data-gesture-status]');
 const c=window.createClawdController(root,rig,{bindInput:false,bindDemo:false,reachEnabled:true,accessoryStorage:false,sleepEnabled:false,sunglassesEnabled:false,happyEnabled:false,breathingEnabled:false});
 window.clawdLabController=c;
 let mode='random',gesture=null,offset={x:0,y:0},mousePressed=null;
 const cleanup=[];
 function listen(target,name,fn,opts){target.addEventListener(name,fn,opts);cleanup.push(()=>target.removeEventListener(name,fn,opts));}
 const body=node=>!!node?.closest?.('#body-motion,#left-hand,#right-hand');
 function closeMenu(){menu.hidden=true;}
 function setOffset(x,y){offset={x:Math.max(-70,Math.min(70,x)),y:Math.max(-35,Math.min(35,y))};station.style.transform=`translate(${offset.x}px,${offset.y}px)`;}
 function select(value,play=false){mode=value;root.querySelectorAll('[data-reaction-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.reactionChoice===mode)));closeMenu();if(play)c.react(mode);}
 root.querySelectorAll('[data-reaction-choice]').forEach(b=>listen(b,'click',()=>select(b.dataset.reactionChoice,true)));
 listen(root.querySelector('[data-home]'),'click',()=>{setOffset(0,0);c.clearAll();closeMenu();hint.textContent='工位归位了';});
 listen(scene,'pointerdown',e=>{
  closeMenu();
  if(body(e.target)){
   if(e.button!==0)return;
   gesture={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now(),base:{...offset},dragging:false};
   scene.setPointerCapture?.(e.pointerId);e.preventDefault();return;
  }
  const key=e.target.closest?.('[data-code]');
  if(key&&e.button===0){c.tap(key.dataset.code);return;}
  if(e.target.closest?.('#mouse-motion')&&(e.button===0||e.button===2)){c.moveMouse(0,0);c.mouseButton(e.button,true);mousePressed=e.button;}
 });
 listen(scene,'pointermove',e=>{
  if(gesture&&gesture.id===e.pointerId){
   const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
   if(!gesture.dragging&&Math.hypot(dx,dy)>6){gesture.dragging=true;hint.textContent='正在拖动工位';}
   if(gesture.dragging)setOffset(gesture.base.x+dx,gesture.base.y+dy);
   return;
  }
  // Body hover is deliberately inert. Only the illustrated mouse drives mouse use.
  if(body(e.target))return;
  if(e.target.closest?.('#mouse-motion'))c.moveMouse((e.movementX||0)/10,(e.movementY||0)/10);
 });
 function release(e,cancelled=false){
  if(mousePressed!==null){c.mouseButton(mousePressed,false);mousePressed=null;}
  if(!gesture||gesture.id!==e.pointerId)return;
  const g=gesture;gesture=null;
  if(scene.hasPointerCapture?.(e.pointerId))scene.releasePointerCapture(e.pointerId);
  if(!cancelled&&!g.dragging&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<=6&&performance.now()-g.at<=300){c.react(mode);hint.textContent='轻点：'+({curious:'歪头挠挠',shy:'害羞爱心',jelly:'Duang！',sing:'摇摇唱歌'}[c.getReaction()]||'回应中');}
  else hint.textContent=g.dragging?'拖动结束，没有触发轻点':'长按结束，没有触发轻点';
 }
 listen(globalThis.window,'pointerup',e=>release(e));
 listen(scene,'pointercancel',e=>release(e,true));
 listen(scene,'lostpointercapture',e=>{if(gesture?.id===e.pointerId){gesture=null;hint.textContent='已取消拖动';}});
 listen(scene,'contextmenu',e=>{
  if(!body(e.target))return;
  e.preventDefault();gesture=null;c.cancelReaction();
  menu.hidden=false;menu.style.left=Math.max(6,Math.min(window.innerWidth-190,e.clientX))+'px';menu.style.top=Math.max(6,Math.min(window.innerHeight-120,e.clientY))+'px';hint.textContent='右键菜单，没有触发轻点或用鼠标';
 });
 listen(menu.querySelector('[data-menu-random]'),'click',()=>select('random'));
 listen(menu.querySelector('[data-menu-home]'),'click',()=>{setOffset(0,0);closeMenu();});
 listen(document,'pointerdown',e=>{if(!e.target.closest?.('[data-context-menu]'))closeMenu();});
 listen(window,'keydown',e=>{
  if(e.code==='Escape')closeMenu();
  c.press(e.code,{repeat:e.repeat});
  if(e.target!==textarea&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 });
 listen(window,'keyup',e=>c.release(e.code));
 function reset(){gesture=null;mousePressed=null;closeMenu();c.clearAll();}
 listen(window,'blur',reset);listen(document,'visibilitychange',()=>{if(document.hidden)reset();});
 listen(window,'pagehide',()=>{cleanup.splice(0).forEach(fn=>fn());c.destroy();},{once:true});
})();
