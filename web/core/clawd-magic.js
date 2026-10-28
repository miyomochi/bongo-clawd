/* A wandering star wand briefly turns Clawd into the flat four-legged sprite. */
(function(global){
 'use strict';
 const modules=global.ClawdModules||(global.ClawdModules={}),NS='http://www.w3.org/2000/svg';
 const duration=10500,clamp=t=>Math.max(0,Math.min(1,t)),ease=t=>{t=clamp(t);return t*t*(3-2*t);};
 modules.magic=function(ctx){
  ctx.magicPhase='none';
  const make=(tag,attrs={},parent)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent?.appendChild(n);return n;};
  const keyboard=ctx.svg.querySelector('#keyboard'),scene=keyboard.parentNode;
  const back=make('g',{id:'magic-behind',display:'none','pointer-events':'none'});scene.insertBefore(back,ctx.body);
  const front=make('g',{id:'magic-in-front',display:'none','pointer-events':'none'});scene.appendChild(front);
  const wand=make('g',{id:'magic-star-wand','shape-rendering':'crispEdges'},back);
  make('path',{fill:'#967eaf',d:'M-2 1H1V19H-2Z'},wand);
  make('path',{fill:'#d6bddc',d:'M-2 1H-1V18H-2Z'},wand);
  const star='M-2-9H2V-5H4V-3H9V0H6V3H4V8H1V6H-1V5H-3V7H-5V2H-7V0H-10V-3H-5V-5H-3V-7H-2Z';
  make('path',{fill:'#bc8d49',d:star,transform:'translate(0 1)'},wand);
  make('path',{fill:'#e9c776',d:star},wand);
  make('path',{fill:'#fff1bc',d:'M-2-6H0V-2H3V0H0V2H-2V0H-5V-2H-2Z'},wand);
  const dust=make('g',{id:'magic-stardust','shape-rendering':'crispEdges'},front),dustNodes=[];
  for(let i=0;i<20;i++)dustNodes.push(make('path',{fill:['#f1d88d','#cdb5e2','#f4e4bc'][i%3],d:i%3?'M-1-1H1V1H-1Z':'M-1-3H1V-1H3V1H1V3H-1V1H-3V-1H-1Z',display:'none'},dust));
  const flat=make('g',{id:'magic-flat-clawd',display:'none','pointer-events':'none','shape-rendering':'crispEdges'});scene.insertBefore(flat,keyboard);
  make('path',{fill:'#d97757',d:'M82 29H158V53H170V65H158V96H148V77H138V96H128V77H112V96H102V77H92V96H82V65H70V53H82Z'},flat);
  const flatOpen=make('path',{id:'magic-flat-open',fill:'#2b241e',d:'M96 45H102V56H96Z M138 45H144V56H138Z'},flat);
  const flatSqueeze=make('path',{id:'magic-flat-squeeze',fill:'#2b241e',display:'none',d:'M93 44H96V46H99V48H102V51H99V53H96V55H93V52H96V50H98V49H96V47H93Z M147 44H144V46H141V48H138V51H141V53H144V55H147V52H144V50H142V49H144V47H147Z'},flat);
  const eyes=make('g',{id:'eyes-magic',display:'none'},ctx.body);ctx.magicEyes=eyes;
  const eyeL=make('rect',{x:91,y:58,width:5,height:13,fill:'#2b241e'},eyes),eyeR=make('rect',{x:130,y:65,width:5,height:13,fill:'#2b241e'},eyes);
  const smoke=make('g',{id:'magic-smoke',display:'none','pointer-events':'none','shape-rendering':'crispEdges'},front),puffs=[];
  const cloud='M-5-8H4V-6H8V-2H10V4H7V7H2V9H-5V7H-9V3H-11V-3H-8V-6H-5Z';
  for(let i=0;i<24;i++)puffs.push(make('path',{fill:['#eee7db','#d6cddd','#f5ede0'][i%3],d:cloud},smoke));
  const burst=make('g',{id:'magic-smoke-burst',display:'none','shape-rendering':'crispEdges'},front),burstNodes=[];
  for(let i=0;i<10;i++)burstNodes.push(make('path',{fill:i%2?'#dbc5e2':'#f2d996',d:i%2?'M-1-5H1V5H-1Z':'M-1-4H1V-1H4V1H1V4H-1V1H-4V-1H-1Z'},burst));
  let frame=null,start=0,flatMode=false,visibility=null,hurryStarted=null,hurryWasFlat=false;
  ctx.magicHurrying=false;
  const trail=[];
  const hiddenNodes=[ctx.body,ctx.hands];
  function setFlat(value){
   if(value===flatMode)return;flatMode=value;
   if(value){
    visibility=hiddenNodes.map(n=>n.getAttribute('visibility'));
    ctx.cancelHand('left');ctx.cancelHand('right');ctx.pose('left','idle');if(!ctx.mouseMode)ctx.pose('right','idle');
    hiddenNodes.forEach(n=>n.setAttribute('visibility','hidden'));flat.setAttribute('display','inline');
   }else{
    hiddenNodes.forEach((n,i)=>visibility[i]===null?n.removeAttribute('visibility'):n.setAttribute('visibility',visibility[i]));visibility=null;
    flat.setAttribute('display','none');flat.removeAttribute('transform');
   }
  }
  const magicOwnsHands=()=>flatMode;
  function eligible(){return !ctx.gamingOwnsHands?.()&&!ctx.disposed&&!ctx.paused&&!document.hidden&&!ctx.isAdjusting?.()&&!ctx.isClickReacting?.()&&ctx.magicPhase==='none'&&ctx.bubblesPhase==='none'&&ctx.coolPhase==='none'&&ctx.happyPhase==='none'&&ctx.sleepPhase==='awake'&&ctx.wakePhase==='none'&&!ctx.looking&&!ctx.level&&performance.now()>=ctx.recoveryUntil;}
  function stopMagic(reschedule=true){
   const active=ctx.magicPhase!=='none';hurryStarted=null;ctx.magicHurrying=false;front.removeAttribute('opacity');back.removeAttribute('opacity');cancelAnimationFrame(frame);frame=null;setFlat(false);trail.length=0;
   ctx.magicPhase='none';ctx.root.dataset.magic='none';[back,front,eyes,flat,smoke,burst].forEach(n=>n.setAttribute('display','none'));
   if(active){ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();ctx.finishEgg?.(reschedule);if(reschedule&&!ctx.disposed){ctx.queueLook();ctx.queueEgg();}}
  }
  function paintSmoke(ms){
   const t=ms>=8900?(ms-8900)/1200:(ms-5000)/1200,show=t>=0&&t<1;
   smoke.setAttribute('display',show?'inline':'none');burst.setAttribute('display',show?'inline':'none');if(!show)return;
   const grow=ctx.reduceMotion?1:ease(t/.24),spread=ctx.reduceMotion?.55:ease((t-.2)/.8);
   puffs.forEach((n,i)=>{
    const a=(i-8)/16*Math.PI*2,x=i<8?[99,121,143,99,121,143,109,133][i]:121+Math.cos(a)*(20+spread*50),y=i<8?[37,37,37,64,64,64,85,85][i]:60+Math.sin(a)*(17+spread*32);
    const scale=ctx.reduceMotion?2:(.25+grow*(1.7+.45*Math.sin(Math.PI*t)))*(.92+(i%3)*.12);
    n.setAttribute('transform',`translate(${Math.round(x)} ${Math.round(y)}) scale(${scale.toFixed(3)})`);
    n.setAttribute('opacity',String(.97*Math.min(1,t*9,(1-t)*4)));
   });
   burstNodes.forEach((n,i)=>{
    const a=i/10*Math.PI*2,travel=ctx.reduceMotion?.45:ease(t/.65),x=121+Math.cos(a)*(49+travel*34),y=58+Math.sin(a)*(31+travel*27);
    n.setAttribute('transform',`translate(${Math.round(x)} ${Math.round(y)}) rotate(${(a*180/Math.PI+90).toFixed(2)}) scale(${ctx.reduceMotion?.75:1.2})`);
    n.setAttribute('opacity',String(Math.min(1,t*8)*Math.max(0,1-t/.72)*.9));
   });
  }
  function paint(ms){
   ctx.magicPhase=ms<600?'appearing':ms<3200?'orbiting':ms<5000?'casting':ms<6200?'transforming':ms<8900?'flat':ms<10100?'restoring':'finishing';ctx.root.dataset.magic=ctx.magicPhase;
   back.setAttribute('display','inline');front.setAttribute('display','inline');
   let theta=-.3,x=63,y=18,angle=28;
   if(ms>=600&&ms<3200){theta+=Math.PI*2*ease((ms-600)/2600);x=122-62*Math.cos(theta);y=23+16*Math.sin(theta);angle=28+Math.sin(theta)*22;}
   else if(ms>=3200){const t=ms-3200;y=18+(ctx.reduceMotion?0:5*Math.sin(t*Math.PI*2/1200));angle=28+(ctx.reduceMotion?0:14*Math.sin(t*Math.PI*2/1200));}
   if(ctx.reduceMotion){x=63;y=18;angle=28;}
   const wandOpacity=Math.min(ease(ms/600),1-ease((ms-5000)/260));wand.setAttribute('display',ms<5260?'inline':'none');wand.setAttribute('opacity',String(wandOpacity));
   const layer=ms>=600&&ms<3200&&Math.sin(theta)<0?back:front;if(wand.parentNode!==layer)layer.insertBefore(wand,layer===front?dust:null);
   wand.setAttribute('transform',`translate(${Math.round(x)} ${Math.round(y)}) rotate(${angle.toFixed(2)})`);
   if(ms<5260)trail.push({ms,x,y});while(trail.length&&ms-trail[0].ms>650)trail.shift();
   dustNodes.forEach((n,i)=>{
    const p=trail[Math.max(0,trail.length-1-i*2)],show=ms>180&&ms<5550&&!!p&&(!ctx.reduceMotion||i<4);n.setAttribute('display',show?'inline':'none');if(!show)return;
    const age=ms-p.ms,side=i%2?1:-1,dx=ctx.reduceMotion?(i-2)*4:side*(2+i%4),dy=ctx.reduceMotion?i*3:4+age/60;
    n.setAttribute('transform',`translate(${Math.round(p.x+dx)} ${Math.round(p.y+dy)}) scale(${(ctx.reduceMotion?.6:.3+.5*(1-age/700)).toFixed(3)})`);n.setAttribute('opacity',String(wandOpacity*Math.max(0,1-age/700)*.8));
   });
   const dx=Math.max(-3,Math.min(4,Math.round((x-114)/18))),dy=Math.max(-5,Math.min(2,Math.round((y-67)/12)));
   eyeL.setAttribute('transform',`translate(${dx} ${dy})`);eyeR.setAttribute('transform',`translate(${dx} ${dy})`);
   setFlat(ms>=5500&&ms<9500);
   if(flatMode){
    const squint=ms>=6800;flatOpen.setAttribute('display',squint?'none':'inline');flatSqueeze.setAttribute('display',squint?'inline':'none');
    const t=Math.max(0,Math.min(1800,ms-6800)),rock=ctx.reduceMotion?0:9*Math.sin(t*Math.PI*2/900)*Math.sin(Math.PI*t/1800);
    flat.setAttribute('transform',`translate(120 96) rotate(${rock.toFixed(3)}) translate(-120 -96)`);
   }
   paintSmoke(ms);ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();
  }
  function hurryMagic(){
   if(ctx.magicPhase==='none'||hurryStarted!==null)return;
   hurryStarted=performance.now();hurryWasFlat=flatMode;ctx.magicHurrying=true;ctx.magicPhase='hurrying';ctx.root.dataset.magic='hurrying';
   if(hurryWasFlat){wand.setAttribute('display','none');dust.setAttribute('display','none');flatOpen.setAttribute('display','none');flatSqueeze.setAttribute('display','inline');}
  }
  function paintHurry(now){
   const elapsed=now-hurryStarted;
   if(elapsed>=(hurryWasFlat?600:240)){stopMagic();return;}
   if(hurryWasFlat){paintSmoke(8900+elapsed*2);if(elapsed>=250)setFlat(false);}
   else {const opacity=String(1-ease(elapsed/240));front.setAttribute('opacity',opacity);back.setAttribute('opacity',opacity);}
   ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();
  }
  function startMagic(){
   if(!eligible())return false;ctx.stopEggTimer();clearTimeout(ctx.idleTimer);ctx.stopBreathing();trail.length=0;
   start=performance.now();hurryStarted=null;ctx.magicHurrying=false;dust.setAttribute('display','inline');ctx.magicPhase='appearing';
   function tick(now){frame=null;if(ctx.disposed||ctx.magicPhase==='none')return;if(hurryStarted!==null){paintHurry(now);if(ctx.magicPhase!=='none')frame=requestAnimationFrame(tick);return;}if(now-start>=duration*1.25){stopMagic();return;}paint((now-start)/1.25);frame=requestAnimationFrame(tick);}
   paint(0);ctx.queueLook();frame=requestAnimationFrame(tick);return true;
  }
  ctx.cleanup.push(()=>[back,front,flat,eyes].forEach(n=>n.remove()));
  return{startMagic,stopMagic,magicOwnsHands,hurryMagic};
 };
})(window);
