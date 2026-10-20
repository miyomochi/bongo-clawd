/* Clawd: startled jump, suspicious glance and a brief burst of pretend work. */
(function (global) {
  'use strict';
  const modules=global.ClawdModules || (global.ClawdModules={});
  modules.wake=function(ctx) {
    const pretendEnd=4600,wakeEnd=5200;
    ctx.wakeCalmStart=pretendEnd;
    function stopWake() {
      clearTimeout(ctx.wakeTimer);ctx.wakeTimer=null;
      ctx.wakePhase='none';ctx.wakeClock=0;ctx.wakeX=ctx.wakeY=ctx.wakeEyeX=0;
      ctx.wakeBubble.setAttribute('display','none');
      ctx.cancelHand('left');ctx.cancelHand('right');
      ctx.pose('left','idle');ctx.pose('right','idle');
      ctx.refreshEyes();ctx.renderBody();
    }
    function startWake() {
      if(ctx.disposed || ctx.sleepPhase!=='asleep' || ctx.wakePhase!=='none')return false;
      clearTimeout(ctx.idleTimer);ctx.stopLook();ctx.stopSleep();ctx.resetActivity();
      clearTimeout(ctx.bodyTimer);ctx.bounceOffset=0;
      ctx.cancelHand('left');ctx.cancelHand('right');
      ctx.pose('left','idle');ctx.pose('right','idle');
      ctx.lookCount=0;ctx.lookLimit=1+Math.floor(Math.random()*2);
      ctx.wakeStart=performance.now();ctx.wakeClock=0;ctx.wakeNextTap=1000;ctx.wakeHand=0;
      ctx.wakePhase='startled';
      function tick() {
        if(ctx.disposed || ctx.wakePhase==='none')return;
        const t=performance.now()-ctx.wakeStart;ctx.wakeClock=t;
        if(t>=wakeEnd) {
          stopWake();clearTimeout(ctx.activityTimer);ctx.activityTick();ctx.queueLook();ctx.queueEgg();ctx.refreshStatus();return;
        }
        ctx.wakePhase=t<440 ? 'startled' : t<1000 ? 'checking' : t<pretendEnd ? 'pretending' : 'calming';
        ctx.wakeY=t<360 ? -Math.round(9*Math.sin(Math.PI*t/360)) : t<440 ? 2 : 0;
        ctx.wakeX=t>=440&&t<700 ? -1 : t>=700&&t<1000 ? 1 : 0;
        ctx.wakeEyeX=t>=440&&t<700 ? -4 : t>=700&&t<1000 ? 4 : 0;
        if(ctx.wakePhase==='pretending' && t>=ctx.wakeNextTap) {
          if(!ctx.reduceMotion)ctx.tapHand(ctx.wakeHand++%2 ? 'right' : 'left');
          ctx.wakeNextTap=t+90;
        }
        const bubble=t<1000;
        ctx.wakeBubble.setAttribute('display',bubble ? 'inline' : 'none');
        ctx.wakeBubble.setAttribute('transform',`translate(0 ${ctx.reduceMotion ? 0 : -Math.round(2*Math.min(1,t/220))})`);
        ctx.wakeBubble.setAttribute('opacity',String(ctx.reduceMotion ? 1 : Math.min(1,(1000-t)/180)));
        ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();
        ctx.wakeTimer=setTimeout(tick,40);
      }
      tick();return true;
    }
    return {startWake,stopWake};
  };
})(window);
