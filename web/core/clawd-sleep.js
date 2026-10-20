/* Clawd: stretch, settle and sleep. */
(function (global) {
  'use strict';
  const modules=global.ClawdModules || (global.ClawdModules={});
  modules.sleep=function(ctx) {
    function stopSleep() {
      ctx.endDream();
      clearTimeout(ctx.sleepTimer);ctx.sleepTimer=null;
      const wasSleeping=ctx.sleepPhase!=='awake';
      ctx.sleepPhase='awake';ctx.sleepClock=0;ctx.sleepArmFrame=-1;
      if(wasSleeping){ctx.pose('left','idle');ctx.pose('right','idle');}
      ctx.left.removeAttribute('clip-path');ctx.right.setAttribute('clip-path','url(#far-arm-visible)');
      ctx.renderSleepSymbols();ctx.refreshEyes();ctx.renderBody();
    }
    function queueSleep(delay=2200) {
      if(ctx.isAdjusting?.())return;
      clearTimeout(ctx.idleTimer);
      if(ctx.disposed || !ctx.sleepEnabled || ctx.sleepPhase!=='awake' || ctx.wakePhase!=='none')return;
      ctx.idleTimer=setTimeout(()=>{
        ctx.idleTimer=null;
        if(document.hidden || ctx.held.size || ctx.level || performance.now()<ctx.recoveryUntil || ctx.mouseMode || ctx.looking){queueSleep(2000);return;}
        startSleep();
      },Math.max(delay,ctx.sleepDelayMs-2400-(performance.now()-ctx.idleSince)));
    }
    function startSleep() {
      if(ctx.disposed || ctx.wakePhase!=='none' || ctx.held.size || ctx.level || performance.now()<ctx.recoveryUntil || ctx.mouseMode || ctx.looking)return;
      ctx.stopEggTimer();ctx.stopHappy(false);ctx.stopCool(false,true);clearTimeout(ctx.idleTimer);stopSleep();ctx.resetActivity();
      clearTimeout(ctx.bodyTimer);ctx.bounceOffset=0;
      ctx.cancelHand('left');ctx.cancelHand('right');
      ctx.pose('left','idle');ctx.pose('right','idle');ctx.sleepArmFrame=-1;
      ctx.sleepStart=performance.now();ctx.sleepClock=0;ctx.sleepPhase='stretch';
      function tick() {
        if(ctx.disposed || ctx.sleepPhase==='awake')return;
        ctx.sleepClock=performance.now()-ctx.sleepStart;
        const phase=ctx.sleepClock<1250 ? 'stretch' : ctx.sleepClock<2400 ? 'settling' : 'asleep';
        const previous=ctx.sleepPhase;ctx.sleepPhase=phase;
        if(phase==='asleep'&&previous!=='asleep')ctx.scheduleDream(true);
        const raised=phase==='stretch' ? Math.min(1,ctx.sleepClock/650) : phase==='settling' ? 1-Math.min(1,(ctx.sleepClock-1250)/600) : 0;
        ctx.renderStretchArms(raised);
        ctx.refreshEyes();ctx.renderBody();ctx.renderSleepSymbols();ctx.refreshStatus();
        ctx.sleepTimer=setTimeout(tick,80);
      }
      tick();
    }
    return {stopSleep,queueSleep,startSleep};
  };
})(window);
