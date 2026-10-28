/* A quiet idle vignette: a small wand and a few translucent pixel bubbles. */
(function(global){
 'use strict';
 const modules=global.ClawdModules||(global.ClawdModules={}),NS='http://www.w3.org/2000/svg',duration=7200;
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const between=(t,a,b)=>ease((t-a)/(b-a));
 function path(points,close=true){
  const q=points.map(([x,y])=>[Math.round(x),Math.round(y)]);let d=`M${q[0].join(' ')}`;
  for(let i=1;i<q.length+(close?1:0);i++){
   const a=q[(i-1)%q.length],b=q[i%q.length],n=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));let old=a;
   for(let k=1;k<=n;k++){const p=[Math.round(a[0]+(b[0]-a[0])*k/n),Math.round(a[1]+(b[1]-a[1])*k/n)];if(p[0]!==old[0]&&p[1]!==old[1])d+=`H${p[0]}`;d+=`L${p.join(' ')}`;old=p;}
  }return d+(close?'Z':'');
 }
 const circle=(x,y,r)=>Array.from({length:65},(_,i)=>{const t=i/64*Math.PI*2;return[x+Math.cos(t)*r,y+Math.sin(t)*r];});
 modules.bubbles=function(ctx){
  ctx.bubblesPhase='none';ctx.bubbleSmile=false;
  const make=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const keyboard=ctx.svg.querySelector('#keyboard'),wand=make('g',{id:'bubble-wand',display:'none','pointer-events':'none','shape-rendering':'crispEdges'});
  const alarm=make('g',{id:'eyes-bubbles-hurry',display:'none'});ctx.body.appendChild(alarm);ctx.bubbleHurryEyes=alarm;
  alarm.appendChild(make('path',{fill:'#2b241e',d:'M90 57H92V59H95V61H98V64H95V66H92V68H90V65H93V63H95V62H93V60H90Z M138 64H136V66H133V68H130V71H133V73H136V75H138V72H135V70H133V69H135V67H138Z'}));
  keyboard.parentNode.insertBefore(wand,keyboard);
  const stem=make('path',{fill:'#8f729b'}),rim=make('path',{fill:'#c0a4ca','fill-rule':'evenodd'}),rimLight=make('path',{fill:'none',stroke:'#ead3ea','stroke-width':'1'});
  wand.appendChild(stem);wand.appendChild(rim);wand.appendChild(rimLight);
  const stream=make('g',{id:'idle-soap-bubbles',display:'none','pointer-events':'none','shape-rendering':'crispEdges'});keyboard.parentNode.appendChild(stream);
  const specs=[{birth:1350,life:2700,r:9,dx:24,dy:48},{birth:2250,life:3000,r:13,dx:-25,dy:46},{birth:3150,life:2500,r:6,dx:30,dy:44},{birth:4050,life:2800,r:10,dx:1,dy:50}];
  const bubbles=specs.map((p,i)=>{
   const g=make('g',{'data-soap-bubble':i,display:'none'}),tint=make('path',{fill:['#9ad5df','#cfb3dc','#b9decb','#edc5d6'][i],opacity:'.075'});
   const edge=make('path',{fill:['#afd7df','#c9b0da','#acd7c2','#e5bfd3'][i],'fill-rule':'evenodd'});
   const sheen=make('path',{fill:'none',stroke:'#f4f2df','stroke-width':'1.2'}),accent=make('path',{fill:'none',stroke:['#d8b4d8','#9ed2dd','#c5b3dc','#b5dcd8'][i],'stroke-width':'1'});
   [tint,edge,sheen,accent].forEach(n=>g.appendChild(n));stream.appendChild(g);return{...p,g,tint,edge,sheen,accent};
  });
  let frame=null,started=0,armParent=null,armNext=null,armMoved=false,armTransform=null,hurryAt=null,lastPose=[156.5,87],hurryPose=null;
  ctx.bubbleHurrying=false;ctx.bubbleAlarm=false;
  const poses=[[0,156.5,87],[150,156.5,87],[430,174,96],[1100,178,64],[5000,178,64],[5900,174,96],[6200,156.5,87],[7200,156.5,87]];
  function restoreArm(){if(armMoved){armParent.insertBefore(ctx.left,armNext?.parentNode===armParent?armNext:null);if(armTransform===null)ctx.left.removeAttribute('transform');else ctx.left.setAttribute('transform',armTransform);ctx.pose('left','idle');armMoved=false;armParent=armNext=null;}wand.removeAttribute('transform');}
  function bubblesOwnsLeft(){return armMoved;}
  function anchorBubbles(x,y){if(armMoved){const transform=`translate(${x} ${y})`;ctx.left.setAttribute('transform',transform);wand.setAttribute('transform',transform);}}
  function arm(x,y){
   const a=[158,74],b=[169,76],d=[x-5.5,y-1],c=[x+5.5,y+1],low=p=>[p[0],p[1]+11];
   const faces=[[[a,b,low(b),low(a)],'#bc6049'],[[b,c,low(c),low(b)],'#bc6049'],[[d,a,low(a),low(d)],'#bc6049'],[[a,b,c,d],'#e89170'],[[d,c,low(c),low(d)],'#d97757']];
   ctx.left.innerHTML='<g id="paw-left-motion">'+faces.map(([points,fill])=>`<path fill="${fill}" d="${path(points)}"/>`).join('')+'</g>';
  }
  function eligible(){return !ctx.gamingOwnsHands?.()&&ctx.magicPhase==='none'&&!ctx.disposed&&!ctx.paused&&!document.hidden&&!ctx.isAdjusting?.()&&!ctx.isClickReacting?.()&&ctx.sleepPhase==='awake'&&ctx.wakePhase==='none'&&ctx.coolPhase==='none'&&ctx.happyPhase==='none'&&!ctx.looking&&!ctx.held.size&&!ctx.active.size&&!ctx.mouseButtons.size&&!ctx.mouseMode&&!ctx.level&&performance.now()>=ctx.recoveryUntil;}
  function stopBubbles(reschedule=true){
   const active=ctx.bubblesPhase!=='none';cancelAnimationFrame(frame);frame=null;
   hurryAt=null;ctx.bubbleHurrying=false;ctx.bubbleAlarm=false;alarm.setAttribute('display','none');wand.removeAttribute('opacity');
   ctx.bubblesPhase='none';ctx.bubbleSmile=false;ctx.root.dataset.bubbles='none';wand.setAttribute('display','none');stream.setAttribute('display','none');bubbles.forEach(p=>p.g.setAttribute('display','none'));restoreArm();
   if(active){ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();ctx.finishEgg?.(reschedule);if(reschedule&&!ctx.disposed){ctx.queueLook();ctx.queueEgg();}}
  }
  function hurryBubbles(){
   if(ctx.bubblesPhase==='none'||hurryAt!==null)return;
   hurryAt=performance.now()-started;hurryPose=[...lastPose];ctx.bubbleHurrying=true;ctx.bubbleAlarm=armMoved;
   paint(hurryAt);
  }
  function paint(ms){
   ctx.bubblesPhase=ms<430?'fetching':ms<1100?'lifting':ms<5000?'bubbling':ms<6200?'stowing':'drifting';ctx.root.dataset.bubbles=ctx.bubblesPhase;
   ctx.bubbleSmile=ms>=1700&&ms<5000;
   let i=0;while(i<poses.length-2&&ms>poses[i+1][0])i++;
   const a=poses[i],b=poses[i+1],f=between(ms,a[0],b[0]);let x=a[1]+(b[1]-a[1])*f,y=a[2]+(b[2]-a[2])*f;
   if(ctx.reduceMotion){x=ms>=430&&ms<5900?178:156.5;y=ms>=430&&ms<5900?64:87;}
   const h=hurryAt===null?null:Math.min(1,(ms-hurryAt)/(ctx.reduceMotion?180:420));
   if(h!==null){const f=ease(h);x=hurryPose[0]+(156.5-hurryPose[0])*f;y=hurryPose[1]+(87-hurryPose[1])*f;ctx.bubbleAlarm=armMoved&&h<1;ctx.bubblesPhase=h<1&&armMoved?'hurrying':'drifting';ctx.root.dataset.bubbles=ctx.bubblesPhase;}
   lastPose=[x,y];
   if(ms<6200&&(h===null||h<1)){arm(x,y);ctx.root.dataset.left='bubbles';}else{restoreArm();ctx.bubbleAlarm=false;}
   const holding=ms>=430&&ms<5900&&(h===null||h<.85);wand.setAttribute('display',holding?'inline':'none');wand.setAttribute('opacity',String(h===null?1:1-ease(h)));
   if(holding){stem.setAttribute('d',path([[x-2,y-8],[x+1,y-8],[x+2,y+2],[x-1,y+2]]));const outer=circle(x+2,y-12,5.5),inner=circle(x+2,y-12,3.5);rim.setAttribute('d',path(outer)+path(inner));rimLight.setAttribute('d',path(outer.slice(34,48),false));}
   stream.setAttribute('display','inline');
   bubbles.forEach((p,index)=>{
    const age=ms-p.birth,show=age>=0&&age<p.life&&(hurryAt===null||p.birth<=hurryAt);p.g.setAttribute('display',show?'inline':'none');if(!show)return;
    const u=age/p.life,enter=ctx.reduceMotion?1:between(age,0,280),fade=Math.min(1,age/180,(p.life-age)/400);
    const cx=181+(ctx.reduceMotion?[-1,-21,20,8][index]:p.dx*u+2*Math.sin(u*Math.PI*2+index)*u),cy=52-(ctx.reduceMotion?[10,28,19,40][index]:p.dy*u);
    const r=p.r*(ctx.reduceMotion?1:.15+.85*enter),outer=circle(cx,cy,r),inner=circle(cx,cy,Math.max(.1,r-1));
    p.g.setAttribute('opacity',String(Math.max(0,fade*.9)));p.tint.setAttribute('d',path(outer));p.edge.setAttribute('d',path(outer)+path(inner));p.sheen.setAttribute('d',path(outer.slice(34,46),false));p.accent.setAttribute('d',path(outer.slice(4,17),false));
   });
   ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();
  }
  function startBubbles(){
   if(ctx.bubblesPhase!=='none'||!eligible())return false;
   ctx.stopEggTimer();clearTimeout(ctx.idleTimer);clearTimeout(ctx.bodyTimer);ctx.bounceOffset=0;ctx.stopBreathing();ctx.cancelHand('left');ctx.pose('left','idle');
   armParent=ctx.left.parentNode;armNext=ctx.left.nextSibling;armTransform=ctx.left.getAttribute('transform');wand.parentNode.insertBefore(ctx.left,wand);armMoved=true;
   started=performance.now();hurryAt=null;ctx.bubbleHurrying=false;ctx.bubbleAlarm=false;ctx.bubblesPhase='fetching';
   function tick(now){frame=null;if(ctx.disposed||ctx.bubblesPhase==='none')return;if(now-started>=duration){stopBubbles();return;}paint(now-started);frame=requestAnimationFrame(tick);}
   paint(0);ctx.queueLook();frame=requestAnimationFrame(tick);return true;
  }
  ctx.cleanup.push(()=>{wand.remove();stream.remove();alarm.remove();});
  return{startBubbles,stopBubbles,bubblesOwnsLeft,anchorBubbles,hurryBubbles};
 };
})(window);
