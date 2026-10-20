/* One shared cooldown and one pending choice for awake easter eggs. */
(function(global){
  'use strict';
  const modules=global.ClawdModules||(global.ClawdModules={});
  modules.eggs=function(ctx){
    let timer=null,nextAllowed=performance.now()+360000+Math.random()*240000;
    const choose=()=>ctx.happyEnabled&&(!ctx.coolEnabled||Math.random()<.5)?'happy':'cool';
    let kind=choose();
    function stopEggTimer(){clearTimeout(timer);timer=null;}
    function finishEgg(reschedule=true){nextAllowed=performance.now()+360000+Math.random()*240000;kind=choose();if(reschedule)queueEgg();}
    function queueEgg(){
      if(ctx.isAdjusting?.())return;
      if(ctx.disposed||ctx.sleepPhase!=='awake'||ctx.wakePhase!=='none'||(!ctx.coolEnabled&&!ctx.happyEnabled)||ctx.coolPhase!=='none'||ctx.happyPhase!=='none'){stopEggTimer();return;}
      // Ordinary typing must not continually push the pending timer backward.
      if(timer!==null)return;
      timer=setTimeout(()=>{
        timer=null;const now=performance.now();const remaining=ctx.sleepDelayMs-(now-ctx.idleSince);
        if(!document.hidden&&now>=nextAllowed&&(!ctx.sleepEnabled||remaining>14000)){
          if(kind==='happy'&&ctx.happyEnabled&&ctx.startHappy())return;
          if(kind==='cool'&&ctx.coolEnabled&&now-ctx.idleSince>=18000&&ctx.startCool())return;
        }
        queueEgg();
      },Math.max(3000,nextAllowed-performance.now()));
    }
    return {queueEgg,stopEggTimer,finishEgg};
  };
})(window);
