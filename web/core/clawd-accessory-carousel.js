/* Five visible accessory tiles; arrows browse without changing the fitting selection. */
(function(global){
 'use strict';
 global.createClawdAccessoryCarousel=function(panel,options={}){
  const viewport=panel?.querySelector('[data-accessory-viewport]');
  const prev=panel?.querySelector('[data-accessory-prev]'),next=panel?.querySelector('[data-accessory-next]');
  if(!viewport||!prev||!next)return {refresh(){},reveal(){},destroy(){}};
  const items=[...viewport.querySelectorAll('label')],visible=5,cleanup=[];
  let step=0,target=null,disposed=false;
  const clamp=i=>Math.max(0,Math.min(Math.max(0,items.length-visible),i));
  function listen(node,name,fn){node.addEventListener(name,fn);cleanup.push(()=>node.removeEventListener(name,fn));}
  function width(){return viewport.clientWidth||viewport.getBoundingClientRect?.().width||0;}
  function setArrow(button,enabled){
   button.disabled=!enabled;button.tabIndex=enabled?0:-1;
   if(!enabled&&document.activeElement===button)viewport.focus?.({preventScroll:true});
  }
  function sync(){
   if(disposed)return;
   const max=Math.max(0,viewport.scrollWidth-width()),x=Math.max(0,viewport.scrollLeft||0);
   setArrow(prev,max>1&&x>1);setArrow(next,max>1&&x<max-1);
   if(target!==null&&Math.abs(x-target*step)<1)target=null;
  }
  function go(index,animate=true){
   if(disposed||!step)return;
   target=clamp(index);const left=target*step;
   if(viewport.scrollTo)viewport.scrollTo({left,behavior:animate&&!options.reduceMotion?'smooth':'auto'});
   else viewport.scrollLeft=left;
   sync();
  }
  function refresh(){
   if(disposed)return;
   const w=width();if(!w){setArrow(prev,false);setArrow(next,false);return;}
   const index=step?Math.round((viewport.scrollLeft||0)/step):0;
   const style=global.getComputedStyle?.(viewport),gap=parseFloat(style?.columnGap||style?.gap)||6;
   step=(w-(visible-1)*gap)/visible+gap;
   go(index,false);
  }
  function reveal(value){
   if(disposed||!width())return;refresh();
   const index=items.findIndex(item=>item.querySelector('input')?.value===value);if(index<0)return;
   const start=clamp(Math.round((viewport.scrollLeft||0)/step));
   if(index<start)go(index,false);else if(index>=start+visible)go(index-visible+1,false);
  }
  listen(prev,'click',()=>go((target??Math.round((viewport.scrollLeft||0)/step))-1));
  listen(next,'click',()=>go((target??Math.round((viewport.scrollLeft||0)/step))+1));
  listen(viewport,'scroll',sync);
  // Native touch/trackpad horizontal scrolling uses CSS snap and the same edge indicators.
  listen(viewport,'pointerdown',()=>target=null);listen(viewport,'wheel',()=>target=null);
  let observer=null;
  if(global.ResizeObserver){observer=new global.ResizeObserver(refresh);observer.observe(viewport);}
  else listen(global,'resize',refresh);
  refresh();
  return {refresh,reveal,getState:()=>({start:step?clamp(Math.round((viewport.scrollLeft||0)/step)):0,count:items.length,canPrev:!prev.disabled,canNext:!next.disabled}),destroy(){if(disposed)return;disposed=true;observer?.disconnect();cleanup.forEach(fn=>fn());}};
 };
})(window);
