/* One shared cooldown and one pending choice for awake easter eggs. */
(function(global){
  'use strict';
  const modules=global.ClawdModules||(global.ClawdModules={});
  modules.eggs=function(ctx){
    let timer=null,nextAllowed=performance.now()+360000+Math.random()*240000;
    const choose=()=>{const kinds=[];if(ctx.happyEnabled)kinds.push('happy');if(ctx.coolEnabled)kinds.push('cool');if(ctx.bubblesEnabled)kinds.push('bubbles');if(ctx.magicEnabled)kinds.push('magic');return kinds[Math.floor(Math.random()*kinds.length)]||null;};
    let kind=choose();
    function stopEggTimer(){clearTimeout(timer);timer=null;}
    function finishEgg(reschedule=true){nextAllowed=performance.now()+360000+Math.random()*240000;kind=choose();if(reschedule)queueEgg();}
    function queueEgg(){
      if(ctx.isAdjusting?.())return;
      if(ctx.gamingOwnsHands?.()||ctx.disposed||ctx.sleepPhase!=='awake'||ctx.wakePhase!=='none'||(!ctx.coolEnabled&&!ctx.happyEnabled&&!ctx.bubblesEnabled&&!ctx.magicEnabled)||ctx.coolPhase!=='none'||ctx.happyPhase!=='none'||ctx.bubblesPhase!=='none'||ctx.magicPhase!=='none'){stopEggTimer();return;}
      // Ordinary typing must not continually push the pending timer backward.
      if(timer!==null)return;
      timer=setTimeout(()=>{
        timer=null;const now=performance.now();const remaining=ctx.sleepDelayMs-(now-ctx.idleSince);
        if(!document.hidden&&now>=nextAllowed&&(!ctx.sleepEnabled||remaining>14000)){
          if(kind==='magic'&&ctx.magicEnabled&&ctx.startMagic())return;
          if(kind==='happy'&&ctx.happyEnabled&&ctx.startHappy())return;
          if(kind==='bubbles'&&ctx.bubblesEnabled&&now-ctx.idleSince>=18000&&ctx.startBubbles())return;
          if(kind==='cool'&&ctx.coolEnabled&&now-ctx.idleSince>=18000&&ctx.startCool())return;
        }
        queueEgg();
      },Math.max(3000,nextAllowed-performance.now()));
    }
    return {queueEgg,stopEggTimer,finishEgg};
  };
})(window);
