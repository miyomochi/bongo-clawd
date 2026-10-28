/* Clawd: behavior. Private context belongs to one controller instance. */
(function (global) {
  'use strict';
  const modules = global.ClawdModules || (global.ClawdModules = {});
  modules.behavior = function (ctx) {
    // Choose once per episode, never on animation ticks. Keep cycling across idle resets.
    const lookLines=['好安静啊','……人呢？','嗯？没人吧……'];
    const fastLines=['忙不过来了！','Ultra Clawding!!'];
    let lookLineIndex=0,fastLineIndex=0;
    const enterDwell=600,exitDwell=2400;
    let riseSince=null,fallSince=null;
    function stableLevel(candidate,now){
      if(candidate>ctx.level){
        fallSince=null;if(riseSince===null)riseSince=now;
        if(now-riseSince>=enterDwell){riseSince=null;return candidate;}
      }else if(candidate<ctx.level){
        riseSince=null;if(fallSince===null)fallSince=now;
        if(now-fallSince>=exitDwell){fallSince=null;return candidate;}
      }else riseSince=fallSince=null;
      return ctx.level;
    }
    function stopLook() {
      clearTimeout(ctx.lookTimer); ctx.lookTimer=null;
      ctx.looking=false; ctx.lookX=ctx.lookY=ctx.eyeX=ctx.eyeY=0; ctx.squint=false;
      ctx.refreshEyes(); ctx.renderBody();
    }

    function queueLook(delay=12000+Math.random()*6000) {
      if(ctx.isAdjusting?.())return;
      clearTimeout(ctx.idleTimer);
      if ((ctx.coolPhase&&ctx.coolPhase!=='none')||(ctx.happyPhase&&ctx.happyPhase!=='none')||(ctx.bubblesPhase&&ctx.bubblesPhase!=='none')||(ctx.magicPhase&&ctx.magicPhase!=='none')||(ctx.gamingPhase&&ctx.gamingPhase!=='none')){if(ctx.sleepEnabled)ctx.queueSleep(0);return;}
      if (ctx.disposed || ctx.sleepPhase!=='awake' || ctx.wakePhase!=='none') return;
      const remaining=ctx.sleepDelayMs-2400-(performance.now()-ctx.idleSince);
      if(ctx.sleepEnabled){
        if(remaining<=2700){ctx.queueSleep(0);return;}
        delay=Math.min(delay,remaining-2700);
      }
      if (ctx.lookCount>=ctx.lookLimit) {
        if(ctx.sleepEnabled){ctx.queueSleep(0);return;}
        ctx.lookCount=0;delay=30000+Math.random()*15000;
      }
      ctx.idleTimer=setTimeout(()=>{
        ctx.idleTimer=null;
        if(document.hidden || ctx.held.size || ctx.level || performance.now()<ctx.recoveryUntil || ctx.mouseMode) { ctx.queueLook(2000); return; }
        ctx.startLook();
      },delay);
    }

    function markActivity() {
      ctx.interruptGaming?.();ctx.idleChoice=null;
      ctx.idleSince=performance.now();
      clearTimeout(ctx.idleTimer);
      if(ctx.sleepPhase==='asleep')ctx.startWake();
      else if(ctx.sleepPhase!=='awake')ctx.stopSleep();
      if(ctx.looking)ctx.stopLook();
      ctx.lookCount=0; ctx.lookLimit=1+Math.floor(Math.random()*2);
      ctx.queueLook();ctx.queueEgg();
    }

    function startLook() {
      if((ctx.coolPhase&&ctx.coolPhase!=='none')||(ctx.happyPhase&&ctx.happyPhase!=='none')||(ctx.bubblesPhase&&ctx.bubblesPhase!=='none')||(ctx.magicPhase&&ctx.magicPhase!=='none')||(ctx.gamingPhase&&ctx.gamingPhase!=='none'))return;
      if(ctx.disposed || ctx.sleepPhase!=='awake' || ctx.wakePhase!=='none' || ctx.held.size || ctx.level || performance.now()<ctx.recoveryUntil || ctx.mouseMode) return;
      clearTimeout(ctx.idleTimer); ctx.stopLook();
      ctx.looking=true;ctx.lookStart=performance.now();ctx.lookCount++;
      ctx.lookCaption=lookLines[lookLineIndex++%lookLines.length];
      function tick() {
        if(ctx.disposed || !ctx.looking)return;
        const t=performance.now()-ctx.lookStart;
        if(t>=2700){ctx.stopLook();ctx.refreshStatus();ctx.queueLook(8000+Math.random()*6000);return;}
        let i=0;while(i<ctx.lookFrames.length-2 && t>ctx.lookFrames[i+1][0])i++;
        const a=ctx.lookFrames[i],b=ctx.lookFrames[i+1],f=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
        const lerp=j=>Math.round(a[j]+(b[j]-a[j])*f);
        ctx.eyeX=lerp(1);ctx.eyeY=lerp(2);ctx.lookX=lerp(3);ctx.lookY=lerp(4);
        ctx.squint=(t>=350&&t<1150)||(t>=1850&&t<2350);
        ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();
        ctx.lookTimer=setTimeout(tick,60);
      }
      tick();
    }

    function activityTick() {
      ctx.activityTimer = null;
      if (ctx.disposed) return;
      const now = performance.now();
      ctx.hits = ctx.hits.filter(t => now-t < 2000);
      ctx.rate = ctx.hits.length/2;
      if(ctx.wakePhase!=='none') {
        if(ctx.hits.length)ctx.activityTimer=setTimeout(ctx.activityTick,80);
        return;
      }
      const recent = ctx.hits.length && now-ctx.hits[ctx.hits.length-1] < 1100;
      const sustained = ctx.hits.length >= 12 && ctx.hits[ctx.hits.length-1]-ctx.hits[0] >= 1000;
      const candidate = recent && sustained ? (ctx.rate >= (ctx.level===2 ? 7.5 : 9) ? 2 : ctx.rate >= (ctx.level ? 4.5 : 6) ? 1 : 0) : 0;
      const next=stableLevel(candidate,now);
      if(next===2&&!ctx.fastCaption)ctx.fastCaption=fastLines[fastLineIndex++%fastLines.length];
      if(!next)ctx.fastCaption=null;
      if (next && !ctx.level) { ctx.enteringUntil=now+240; ctx.nextSurge=now+1400+Math.random()*500; }
      if (!next && ctx.level) { ctx.enteringUntil=0; ctx.recoveryStart=now; ctx.recoveryUntil=now+3500; }
      if (next) ctx.recoveryUntil=0;
      if (ctx.recoveryUntil && now>=ctx.recoveryUntil) ctx.recoveryUntil=0;
      ctx.root.dataset.recovering=String(now<ctx.recoveryUntil);
      ctx.level=next; ctx.root.dataset.busy=String(ctx.level);
      if(ctx.level){ctx.hurryBubbles?.();ctx.hurryMagic?.();}
      if((ctx.level||now<ctx.recoveryUntil)&&ctx.happyPhase==='smiling')ctx.popHappy();
      if (!ctx.level) { ctx.nextSurge=Infinity; ctx.surgeUntil=0; }
      else {
        if (now >= ctx.nextSurge) { ctx.surgeUntil=now+650; ctx.nextSurge=now+4000+Math.random()*2500; }
        if (now >= ctx.nextDrop) { ctx.emitDrop(now); ctx.nextDrop=now+(ctx.level===2 ? 155 : 380); }
      }
      ctx.refreshEyes(); ctx.renderBody(); ctx.refreshStatus();
      if (ctx.hits.length || ctx.level || now<ctx.recoveryUntil) ctx.activityTimer=setTimeout(ctx.activityTick,80);
    }

    function resetActivity() {
      riseSince=fallSince=null;
      clearTimeout(ctx.activityTimer); ctx.activityTimer=null;
      cancelAnimationFrame(ctx.particleFrame); ctx.particleFrame=null;
      ctx.hits=[]; ctx.particles.forEach(p=>p.el.remove()); ctx.particles=[];
      ctx.recoveryUntil=ctx.recoveryStart=ctx.enteringUntil=0; ctx.lastStroke=-Infinity; ctx.root.dataset.recovering='false';
      ctx.level=ctx.rate=0; ctx.nextSurge=Infinity; ctx.surgeUntil=0; ctx.nextDrop=0;
      ctx.fastCaption=null;
      ctx.root.dataset.busy='0'; ctx.refreshEyes(); ctx.renderBody();
    }

    function scheduleBlink() {
      if(ctx.isAdjusting?.())return;
      ctx.blinkTimer = setTimeout(() => {
        if (ctx.disposed) return;
        if (!document.hidden) {
          ctx.blinking=true; ctx.refreshEyes();
          ctx.blinkEnd = setTimeout(() => {
            ctx.blinking=false; ctx.refreshEyes();
          }, 110);
        }
        ctx.scheduleBlink();
      }, 5000 + Math.random() * 7000);
    }
    return { stopLook, queueLook, markActivity, startLook, activityTick, resetActivity, scheduleBlink };
  };
})(window);
