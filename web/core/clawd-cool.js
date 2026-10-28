/* Optional sunglasses vignette: one RAF while active, one rare-idle timeout. */
(function(global){
  'use strict';
  const modules=global.ClawdModules||(global.ClawdModules={});
  const clamp=t=>Math.max(0,Math.min(1,t));
  const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
  const mix=(a,b,t)=>a+(b-a)*t;
  const leaveAt=18050,duration=leaveAt+1750;
  function sample(t,reduced=false){
    const p={phase:'fetching',x:126,y:124,scale:.72,angle:-11,opacity:1,bodyY:0,eyeY:0,hand:true,release:0,stars:0,done:false};
    if(reduced){
      Object.assign(p,{phase:t<leaveAt?'wearing':'leaving',x:120,y:70,scale:1,angle:0,hand:false,opacity:Math.min(1,t/180,(duration-t)/400),done:t>=duration});return p;
    }
    if(t<380){p.bodyY=Math.round(3*ease(t/380));p.opacity=0;p.eyeY=2;}
    else if(t<1300){const f=ease((t-380)/920);p.y=mix(124,105,f);p.bodyY=3;p.eyeY=2;}
    else if(t<2550){const f=ease((t-1300)/1250);p.phase='lifting';p.x=mix(126,120,f);p.y=mix(105,70,f);p.scale=mix(.72,1,f);p.angle=mix(-11,0,f);p.bodyY=Math.round(mix(3,-2,f));p.eyeY=Math.round(2*(1-f));}
    else if(t<3050){const f=ease((t-2550)/500);Object.assign(p,{phase:'adjusting',x:120,y:70+(1-f),scale:1,angle:0,bodyY:Math.round(-2*(1-f)),release:f});}
    else if(t<leaveAt){Object.assign(p,{phase:'wearing',x:120,y:70,scale:1,angle:0,hand:false,stars:t-2900});}
    else {const f=ease((t-leaveAt)/1750);Object.assign(p,{phase:'leaving',x:120+15*f,y:70-31*f,scale:1+.06*f,angle:-15*f,opacity:1-ease((t-leaveAt-300)/1350),hand:false,done:t>=duration});}
    return p;
  }
  global.ClawdCoolTimeline={sample,duration};
  modules.cool=function(ctx){
    ctx.coolPhase='none';ctx.coolClock=0;ctx.coolBodyY=0;ctx.coolEyeY=0;
    let frame=null,hold=null,fadeFrame=null;
    const glasses=ctx.svg.querySelector('#clawd-sunglasses');
    const hand=ctx.svg.querySelector('#cool-hand');
    const stars=ctx.svg.querySelector('#cool-stars');
    const nodes=stars?[...stars.children]:[];
    let before='';
    const available=!!(glasses&&hand&&stars);
    function eligible(){return !ctx.gamingOwnsHands?.()&&ctx.magicPhase==='none'&&!ctx.disposed&&ctx.bubblesPhase==='none'&&ctx.happyPhase==='none'&&ctx.sleepPhase==='awake'&&ctx.wakePhase==='none'&&!ctx.held.size&&!ctx.active.size&&!ctx.mouseButtons.size&&!ctx.mouseMode&&!ctx.level&&performance.now()>=ctx.recoveryUntil&&!ctx.looking;}
    function coolOwnsLeft(){return !ctx.reduceMotion&&['fetching','lifting','adjusting'].includes(ctx.coolPhase);}
    function stopCool(reschedule=true,fadeForSleep=false){
      const transform=glasses?.getAttribute('transform');
      const opacity=Number(glasses?.getAttribute('opacity')??1);
      clearTimeout(hold);hold=null;cancelAnimationFrame(fadeFrame);fadeFrame=null;
      cancelAnimationFrame(frame);frame=null;
      const active=ctx.coolPhase!=='none';
      ctx.coolPhase='none';ctx.coolClock=0;ctx.coolBodyY=ctx.coolEyeY=0;
      if(available){glasses.setAttribute('display','none');glasses.removeAttribute('transform');glasses.removeAttribute('opacity');hand.setAttribute('display','none');stars.setAttribute('display','none');}
      if(active){ctx.left.removeAttribute('display');ctx.left.removeAttribute('visibility');ctx.renderBody();ctx.refreshEyes();ctx.refreshStatus();}
      ctx.root.dataset.cool='none';
      if(active&&fadeForSleep&&opacity>0){
        const start=performance.now();glasses.setAttribute('display','inline');
        if(transform)glasses.setAttribute('transform',transform);
        glasses.setAttribute('opacity',String(opacity));
        function fade(now){
          fadeFrame=null;const progress=(now-start)/180;
          if(progress>=1||ctx.disposed){glasses.setAttribute('display','none');glasses.removeAttribute('opacity');glasses.removeAttribute('transform');return;}
          glasses.setAttribute('opacity',String(opacity*(1-progress)));fadeFrame=requestAnimationFrame(fade);
        }
        fadeFrame=requestAnimationFrame(fade);
      }
      if(active)ctx.finishEgg(reschedule);
      if(reschedule&&!ctx.disposed){ctx.queueLook();ctx.queueEgg();}
    }
    function render(p,t){
      ctx.coolPhase=p.phase;ctx.coolClock=t;ctx.coolBodyY=p.bodyY;ctx.coolEyeY=p.eyeY;ctx.root.dataset.cool=p.phase;
      glasses.setAttribute('display','inline');glasses.setAttribute('opacity',String(clamp(p.opacity)));
      glasses.setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.angle.toFixed(2)}) scale(${p.scale.toFixed(3)}) translate(-120 -70)`);
      const useHand=p.hand&&!ctx.reduceMotion;
      ctx.left.setAttribute('visibility',useHand?'hidden':'visible');hand.setAttribute('display',useHand?'inline':'none');
      if(useHand){
        const index=Math.max(0,Math.min(ctx.rig.coolHandFrames.length-1,Math.round(t/40)));
        // Frames were generated with the exact same timeline and square block geometry.
        const markup=ctx.rig.coolHandFrames[index];
        if(markup!==before){hand.innerHTML=markup;before=markup;}
      }
      stars.setAttribute('display',p.stars&&!ctx.reduceMotion?'inline':'none');
      const delays=[0,420,880,1470];
      nodes.forEach((node,i)=>{
        const u=(p.stars-delays[i])/640;
        const show=p.stars>0&&u>=0&&u<=1;
        node.setAttribute('display',show?'inline':'none');
        if(!show)return;
        const size=.3+.7*Math.sin(Math.PI*u);
        node.setAttribute('transform',`translate(${[74,176,180,125][i]} ${[45,43,78,29][i]}) scale(${size.toFixed(3)})`);
        node.setAttribute('opacity',String(Math.min(1,u*5,(1-u)*4)));
      });
      ctx.renderBody();ctx.refreshEyes();ctx.refreshStatus();
    }
    function startCool(){
      if(!available||ctx.coolPhase!=='none'||!eligible())return false;
      ctx.stopEggTimer();cancelAnimationFrame(fadeFrame);fadeFrame=null;clearTimeout(ctx.idleTimer);clearTimeout(ctx.bodyTimer);ctx.bounceOffset=0;
      ctx.cancelHand('left');ctx.pose('left','idle');before='';
      const start=performance.now();ctx.coolPhase='fetching';
      function tick(now){
        frame=null;if(ctx.disposed||ctx.coolPhase==='none')return;
        const t=now-start,p=sample(t,ctx.reduceMotion);
        if(p.done){stopCool();return;}
        render(p,t);
        if(t>=5200&&t<leaveAt){
          // The fitted layer already follows body-motion. Leave it static between
          // entry sparkles and departure; normal input animates the body/hands.
          hold=setTimeout(()=>{hold=null;tick(performance.now());},leaveAt-t);
        }else frame=requestAnimationFrame(tick);
      }
      render(sample(0,ctx.reduceMotion),0);ctx.queueLook();frame=requestAnimationFrame(tick);return true;
    }
    return {startCool,stopCool,coolOwnsLeft};
  };
})(window);
