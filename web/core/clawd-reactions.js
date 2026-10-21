/* Desktop hand motion and interaction extension. */
(function(global){
 'use strict';
 const instances=new WeakMap(),renderer=global.ClawdModules.renderer,input=global.ClawdModules.input;
 const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 const names={curious:'歪头挠挠',shy:'害羞爱心',jelly:'Duang！',sing:'摇摇唱歌'};
 global.ClawdModules.renderer=function(ctx){
  const api=renderer(ctx),ns='http://www.w3.org/2000/svg';
  let active=null,frame=null,last=null,started=0,now=0,scratch=false;
  const overlay=document.createElementNS(ns,'g');overlay.id='click-reaction-overlay';overlay.setAttribute('display','none');overlay.setAttribute('pointer-events','none');ctx.svg.append(overlay);
  overlay.innerHTML='<g data-click-bubble><path fill="#40392f" d="M178 6H198V8H200V28H198V30H185V34H182V30H178V28H176V8H178Z"/><path fill="#fff8ec" d="M179 8H197V10H198V26H196V28H184V30H183V28H179V26H178V10H179Z"/><path fill="#514638" d="M184 12H192V14H194V19H192V21H189V23H186V19H189V17H191V15H185V17H182V14H184Z M186 25H189V27H186Z"/></g><g data-click-heart><path fill="#e98b9e" d="M-5-5H-2V-4H0V-5H3V-4H5V-1H4V1H2V3H0V5H-2V3H-4V1H-6V-1H-7V-4H-5Z"/></g><g data-click-sparks></g><g data-click-notes></g>';
  const bubble=overlay.querySelector('[data-click-bubble]'),heart=overlay.querySelector('[data-click-heart]'),sparks=overlay.querySelector('[data-click-sparks]'),notes=overlay.querySelector('[data-click-notes]');
  for(let i=0;i<4;i++){
   const p=document.createElementNS(ns,'path');p.setAttribute('d','M-1-4H1V-1H4V1H1V4H-1V1H-4V-1H-1Z');p.setAttribute('fill',i%2?'#dfb766':'#edb8bc');sparks.append(p);
   const n=document.createElementNS(ns,'path');n.setAttribute('d','M0-7H7V-4H5V-5H2V1H1V2H-2V1H-3V-1H0Z');n.setAttribute('fill',['#d995aa','#79a8b8','#c5a56b','#cb8d70'][i]);notes.append(n);
  }
  const blush=document.createElementNS(ns,'g');blush.id='click-blush';blush.setAttribute('display','none');blush.setAttribute('pointer-events','none');
  blush.innerHTML='<path d="M87 76l3-4 M92 78l3-4 M97 79l3-4 M126 83l3-4 M131 84l3-4 M136 85l3-4" stroke="#f3afba" stroke-width="1.4"/>';
  ctx.body.append(blush);
  function fade(t,duration){return Math.min(smooth(t/180),smooth((duration-t)/280));}
  function refreshEyes(){
   api.refreshEyes();if(!active)return;
   const t=now-started;
   const selected=active==='curious'?ctx.openEyes:active==='jelly'&&t<150?ctx.blinkEyes:ctx.happyEyes;
   for(const n of [ctx.openEyes,ctx.blinkEyes,ctx.busyEyes,ctx.wideEyes,ctx.sneakEyes,ctx.startledEyes,ctx.happyEyes,ctx.headphoneEyes].filter(Boolean))n.setAttribute('display',n===selected?'inline':'none');
  }
  function renderBody(){
   api.renderBody();if(!active)return;
   const t=now-started,duration=active==='sing'?2600:active==='curious'?2100:active==='shy'?1900:1200,f=fade(t,duration);
   let angle=0,sx=1,sy=1,x=0,y=0;
   if(!ctx.reduceMotion){
    if(active==='curious')angle=7*smooth(t/300)*smooth((duration-t)/350);
    if(active==='shy'){angle=-3*Math.sin(Math.min(1,t/500)*Math.PI/2)*f;y=-1.5*Math.sin(t*Math.PI/950)*f;}
    if(active==='jelly'){const bounce=.22*Math.exp(-t/310)*Math.cos(t*Math.PI*2/330)*smooth((duration-t)/220);sx=1+bounce*.65;sy=1-bounce;}
    if(active==='sing'){angle=5*Math.sin(t*Math.PI*2/820)*f;x=1.4*Math.sin(t*Math.PI*2/820)*f;}
   }
   const motion=` translate(${x.toFixed(3)} ${y.toFixed(3)}) translate(118 94) rotate(${angle.toFixed(3)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-118 -94)`;
   ctx.body.setAttribute('transform',(ctx.body.getAttribute('transform')||'')+motion);
   ctx.hands.setAttribute('transform',(ctx.hands.getAttribute('transform')||'')+motion);
   if(active==='curious'&&t>400&&t<1630&&!ctx.reduceMotion){
    const enter=smooth((t-400)/230)*smooth((1630-t)/230),wave=Math.sin((t-400)*Math.PI*2/330);
    const index=Math.round(enter*8);ctx.left.innerHTML=ctx.rig.stretchFrames.left[index];
    ctx.left.setAttribute('transform',`rotate(${(-37*enter+wave*5*enter).toFixed(2)} 163 76)`);scratch=true;
   }else if(scratch){ctx.left.removeAttribute('transform');api.pose('left','idle');scratch=false;}
   blush.setAttribute('display',active==='shy'?'inline':'none');blush.setAttribute('opacity',String(f*.95));
   overlay.setAttribute('display','inline');overlay.setAttribute('opacity',String(f));
   bubble.setAttribute('display',active==='curious'?'inline':'none');
   if(active==='curious')bubble.setAttribute('transform',`translate(0 ${ctx.reduceMotion?0:(-2*Math.sin(t/320)*f).toFixed(2)})`);
   heart.setAttribute('display',active==='shy'?'inline':'none');
   if(active==='shy')heart.setAttribute('transform',`translate(187 ${33-(ctx.reduceMotion?0:6*smooth(t/duration))}) scale(${(.65+.15*f).toFixed(3)})`);
   sparks.setAttribute('display',active==='shy'?'inline':'none');
   [...sparks.children].forEach((n,i)=>{const p=clamp((t-i*140)/1000),z=ctx.reduceMotion?.5:Math.sin(p*Math.PI)*.55;n.setAttribute('transform',`translate(${[74,169,180,66][i]} ${[40,16,69,72][i]-(ctx.reduceMotion?0:p*5)}) scale(${z.toFixed(3)})`);});
   notes.setAttribute('display',active==='sing'?'inline':'none');
   [...notes.children].forEach((n,i)=>{const p=ctx.reduceMotion?.5:((t+i*420)%1800)/1800;n.setAttribute('transform',`translate(${[67,183,166,77][i]+(i%2?1:-1)*p*5} ${[52,59,26,23][i]-p*12}) scale(.8)`);n.setAttribute('opacity',String(ctx.reduceMotion?.8:Math.min(1,p*5,(1-p)*4)));});
  }
  function stopReaction(){
   if(!active)return;
   active=null;cancelAnimationFrame(frame);frame=null;overlay.setAttribute('display','none');blush.setAttribute('display','none');
   if(scratch){ctx.left.removeAttribute('transform');api.pose('left','idle');scratch=false;}
   ctx.root.dataset.reaction='none';api.refreshEyes();api.renderBody();ctx.refreshStatus();
   if(!ctx.disposed&&!ctx.paused&&!ctx.isAdjusting?.()){
    ctx.idleSince=performance.now();ctx.lookCount=0;ctx.queueLook();ctx.queueEgg();
   }
  }
  function tick(time){
   frame=null;if(ctx.disposed||!active)return;now=time;
   const duration=active==='sing'?2600:active==='curious'?2100:active==='shy'?1900:1200;
   if(now-started>=duration){stopReaction();return;}
   refreshEyes();renderBody();frame=requestAnimationFrame(tick);
  }
  function react(kind){
   if(ctx.disposed||ctx.paused||ctx.isAdjusting?.())return false;
   if(active)return false;
   stopReaction();ctx.clearAll();
   const choices=Object.keys(names).filter(k=>k!==last);
   active=Object.hasOwn(names,kind)?kind:choices[Math.floor(Math.random()*choices.length)];last=active;
   now=started=performance.now();ctx.root.dataset.reaction=active;ctx.setStatus(names[active],'reaction');tick(now);return true;
  }
  ctx.stopClickReaction=stopReaction;
  ctx.isClickReacting=()=>active!==null;
  instances.set(ctx.root,{react,cancelReaction:stopReaction,getReaction:()=>active});
  return {...api,refreshEyes,renderBody};
 };
 global.ClawdModules.input=function(ctx){
  const api=input(ctx),guarded={...api};
  // A reaction owns the hands until its last frame. Ignore input, never queue it.
  for(const name of ['press','release','tap','moveMouse','mouseButton']){
   guarded[name]=(...args)=>ctx.isClickReacting?.()?false:api[name](...args);
  }
  return guarded;
 };
 const create=global.createClawdController;
 global.createClawdController=function(root,rig,options={}){
  const c=create(root,rig,options),extra=instances.get(root);Object.assign(c,extra);
  for(const name of ['clearAll','destroy','sleep','wake','showSunglasses','showHappy','showDream','lookAround']){
   const fn=c[name];if(fn)c[name]=(...args)=>{extra.cancelReaction();return fn(...args);};
  }
  const paused=c.setPaused;c.setPaused=value=>{if(value)extra.cancelReaction();return paused(value);};
  return c;
 };
})(window);
