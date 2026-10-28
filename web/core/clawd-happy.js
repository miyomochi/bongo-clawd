/* Happy face, tiny interchangeable thoughts, and an occasional sleeping dream. */
(function(global){
  'use strict';
  const modules=global.ClawdModules||(global.ClawdModules={});
  const duration=6800,popDuration=220;
  const clamp=t=>Math.max(0,Math.min(1,t));
  modules.happy=function(ctx){
    ctx.happyPhase='none';ctx.happyMode='awake';ctx.happyMotif='heart';
    const eyes=ctx.svg.querySelector('#eyes-happy'),overlay=ctx.svg.querySelector('#happy-overlay');
    const bubble=ctx.svg.querySelector('#happy-bubble'),content=ctx.svg.querySelector('#happy-heart');
    const tail=ctx.svg.querySelector('#happy-tail'),dots=ctx.svg.querySelector('#dream-dots');
    const burst=ctx.svg.querySelector('#happy-burst'),hearts=ctx.svg.querySelector('#happy-hearts');
    const heartNodes=hearts?[...hearts.children]:[];const fragments=burst?[...burst.children]:[];
    const motifs=content?[...content.querySelectorAll('[data-bubble-motif]')]:[];
    let lastMotif=null;
    function selectMotif(requested){
      const ids=motifs.map(node=>node.dataset.bubbleMotif);
      const choices=ids.filter(id=>id!==lastMotif);
      const picked=ids.includes(requested)?requested:choices[Math.floor(Math.random()*choices.length)]||'heart';
      ctx.happyMotif=picked;lastMotif=picked;
      motifs.forEach(node=>node.setAttribute('display',node.dataset.bubbleMotif===picked?'inline':'none'));
    }
    const available=!!(eyes&&overlay&&bubble&&content&&tail&&dots&&burst&&hearts);
    let frame=null,dreamTimer=null,startedAt=0,popStart=0;
    ctx.happyEyes=eyes;
    function cancelDreamTimer(){clearTimeout(dreamTimer);dreamTimer=null;}
    function happyOwnsEyes(){return ctx.happyPhase==='smiling'&&ctx.happyMode==='awake';}
    function canStartHappy(){return !ctx.gamingOwnsHands?.()&&ctx.magicPhase==='none'&&available&&!ctx.disposed&&ctx.happyPhase==='none'&&ctx.coolPhase==='none'&&ctx.bubblesPhase==='none'&&ctx.sleepPhase==='awake'&&ctx.wakePhase==='none'&&!ctx.looking&&!ctx.level&&performance.now()>=ctx.recoveryUntil;}
    function anchorHappy(x,y){if(available)overlay.setAttribute('transform',`translate(${x} ${y})`);}
    function scheduleDream(first=false){
      cancelDreamTimer();
      if(!ctx.happyEnabled||ctx.disposed||ctx.sleepPhase!=='asleep')return;
      const delay=first?18000+Math.random()*14000:30000+Math.random()*25000;
      dreamTimer=setTimeout(()=>{dreamTimer=null;if(!document.hidden&&ctx.sleepPhase==='asleep')startDream();else if(ctx.sleepPhase==='asleep')scheduleDream();},delay);
    }
    function stopHappy(reschedule=true){
      cancelDreamTimer();cancelAnimationFrame(frame);frame=null;
      const active=ctx.happyPhase!=='none',dream=ctx.happyMode==='dream';
      ctx.happyPhase='none';ctx.happyMode='awake';ctx.root.dataset.happy='none';
      if(available){overlay.setAttribute('display','none');eyes.setAttribute('display','none');burst.setAttribute('display','none');bubble.removeAttribute('transform');}
      if(active){ctx.refreshEyes();ctx.renderSleepSymbols();ctx.refreshStatus();if(dream){if(reschedule)scheduleDream();}else ctx.finishEgg(reschedule);}
      if(reschedule&&!ctx.disposed){ctx.queueLook();ctx.queueEgg();}
    }
    function endDream(){cancelDreamTimer();if(ctx.happyMode==='dream')stopHappy(false);}
    function paint(now){
      if(!available)return;
      const elapsed=now-startedAt;const popping=ctx.happyPhase==='popping';
      overlay.setAttribute('display','inline');
      bubble.setAttribute('display',popping?'none':'inline');burst.setAttribute('display',popping?'inline':'none');
      hearts.setAttribute('display',popping?'none':'inline');
      if(popping){
        const t=clamp((now-popStart)/popDuration);
        fragments.forEach((node,i)=>{const a=i*Math.PI/4;const d=ctx.reduceMotion?12:10+9*t;node.setAttribute('transform',`translate(${Math.round(192+Math.cos(a)*d)} ${Math.round(35+Math.sin(a)*d)}) rotate(${i*45})`);node.setAttribute('opacity',String(1-t));});
        return;
      }
      const enter=ctx.reduceMotion?1:clamp(elapsed/280),out=clamp((duration-elapsed)/350);
      bubble.setAttribute('opacity',String(Math.min(enter,out)));
      const size=ctx.reduceMotion?1:.88+.12*enter;
      bubble.setAttribute('transform',`translate(192 35) scale(${size.toFixed(3)}) translate(-192 -35)`);
      tail.setAttribute('display',ctx.happyMode==='dream'?'none':'inline');dots.setAttribute('display',ctx.happyMode==='dream'?'inline':'none');
      const wave=ctx.reduceMotion?0:Math.sin(elapsed*Math.PI*2/1100);
      // Same small footprint; fish swim, plants sway, hearts and stars bob.
      if(ctx.happyMotif==='fish')content.setAttribute('transform',`translate(${192+wave*1.2} 35) rotate(${wave*4})`);
      else if(ctx.happyMotif==='sprout'||ctx.happyMotif==='flower')content.setAttribute('transform',`translate(192 35) rotate(${wave*5})`);
      else content.setAttribute('transform',`translate(192 ${35-Math.max(0,wave)*2}) scale(${(1+.055*wave).toFixed(3)} ${(1-.06*wave).toFixed(3)})`);
      heartNodes.forEach((node,i)=>{
        const t=((elapsed+i*650)%2700)/2700;
        const x=[70,177,153][i]+(ctx.reduceMotion?0:(i===1?3:-3)*t);
        const y=[54,86,35][i]-(ctx.reduceMotion?0:10*t);
        const small=ctx.happyMode==='dream'?.7:1;
        node.setAttribute('transform',`translate(${Math.round(x)} ${Math.round(y)}) scale(${(small*(ctx.reduceMotion?.62:.45+.35*Math.sin(Math.PI*t))).toFixed(3)})`);
        node.setAttribute('opacity',String(Math.min(enter,out,ctx.reduceMotion?.7:Math.min(1,t*6,(1-t)*4))));
      });
    }
    function tick(now){
      frame=null;if(ctx.disposed||ctx.happyPhase==='none')return;
      if(ctx.happyMode==='dream'&&(ctx.sleepPhase!=='asleep'||ctx.wakePhase!=='none')){stopHappy(false);return;}
      if(ctx.happyPhase==='smiling'&&(ctx.level||now<ctx.recoveryUntil)){popHappy();return;}
      if((ctx.happyPhase==='popping'&&now-popStart>=popDuration)||(ctx.happyPhase!=='popping'&&now-startedAt>=duration)){stopHappy();return;}
      paint(now);frame=requestAnimationFrame(tick);
    }
    function popHappy(){
      if(ctx.happyPhase!=='smiling')return;
      ctx.happyPhase='popping';ctx.root.dataset.happy='popping';popStart=performance.now();
      // Hand eye ownership back in the same input tick, before any pop frames.
      ctx.enteringUntil=0;ctx.refreshEyes();ctx.refreshStatus();cancelAnimationFrame(frame);paint(popStart);frame=requestAnimationFrame(tick);
    }
    function start(mode,motif){
      cancelDreamTimer();ctx.stopEggTimer();clearTimeout(ctx.idleTimer);
      selectMotif(motif);
      startedAt=performance.now();ctx.happyMode=mode;ctx.happyPhase=mode==='dream'?'dreaming':'smiling';ctx.root.dataset.happy=ctx.happyPhase;
      paint(startedAt);ctx.refreshEyes();ctx.renderBody();ctx.renderSleepSymbols();ctx.refreshStatus();
      ctx.queueLook();frame=requestAnimationFrame(tick);return true;
    }
    function startHappy(motif){return canStartHappy()?start('awake',motif):false;}
    function startDream(motif){return available&&!ctx.disposed&&ctx.sleepPhase==='asleep'&&ctx.wakePhase==='none'&&ctx.coolPhase==='none'&&ctx.happyPhase==='none'?start('dream',motif):false;}
    return {startHappy,startDream,stopHappy,popHappy,scheduleDream,endDream,happyOwnsEyes,canStartHappy,anchorHappy};
  };
})(window);
