/* Clawd: renderer. Private context belongs to one controller instance. */
(function (global) {
  'use strict';
  const modules = global.ClawdModules || (global.ClawdModules = {});
  modules.renderer = function (ctx) {
    function setStatus(text, kind) {
      if(ctx.status.textContent!==text)ctx.status.textContent = text;
      ctx.root.dataset.state = kind || 'idle';
    }

    function pose(hand, state) {
      (hand === 'left' ? ctx.left : ctx.right).innerHTML = ctx.rig[hand][state];
      ctx.root.dataset[hand] = state;
    }

    function cancelHand(hand) {
      ctx.handTimers[hand].forEach(clearTimeout);
      ctx.handTimers[hand] = [];
    }

    function refreshEyes() {
      if(ctx.gamingOwnsHands?.())return;
      const surge = ctx.level > 0 && performance.now() < ctx.surgeUntil;
      const recovering = performance.now() < ctx.recoveryUntil;
      const entering = ctx.level > 0 && performance.now() < ctx.enteringUntil;
      const sleeping = ctx.sleepPhase!=='awake';
      const waking=ctx.wakePhase!=='none';
      const bubbles=ctx.bubblesPhase&&ctx.bubblesPhase!=='none'&&(!ctx.bubbleHurrying||ctx.bubbleAlarm);
      const magic=ctx.magicPhase&&ctx.magicPhase!=='none'&&!ctx.magicHurrying;
      const happy=ctx.happyOwnsEyes?.()&&!ctx.level&&!recovering&&!entering;
      const selected = ctx.accessoryPreview ? ctx.headphoneEyes : waking ? (ctx.wakePhase==='startled' ? ctx.startledEyes : ctx.wakePhase==='checking' ? ctx.sneakEyes : ctx.wakePhase==='pretending' ? ctx.busyEyes : ctx.blinkEyes) : sleeping ? ctx.blinkEyes : magic ? ctx.magicEyes : bubbles ? (ctx.bubbleAlarm?ctx.bubbleHurryEyes:ctx.bubbleSmile?ctx.happyEyes:ctx.blinking?ctx.blinkEyes:ctx.openEyes) : ctx.looking ? (ctx.squint ? ctx.sneakEyes : ctx.openEyes) : (recovering || entering) ? ctx.blinkEyes : surge ? ctx.wideEyes : ctx.level ? ctx.busyEyes : happy ? ctx.happyEyes : ctx.blinking ? ctx.blinkEyes : ctx.openEyes;
      [ctx.openEyes, ctx.blinkEyes, ctx.busyEyes, ctx.wideEyes, ctx.sneakEyes, ctx.startledEyes,ctx.happyEyes,ctx.headphoneEyes,ctx.magicEyes,ctx.bubbleHurryEyes].filter(Boolean).forEach(el => el.setAttribute('display', el === selected ? 'inline' : 'none'));
      [ctx.openEyes,ctx.sneakEyes].forEach(el=>el.setAttribute('transform', `translate(${ctx.reduceMotion ? 0 : (waking ? ctx.wakeEyeX : ctx.eyeX)} ${ctx.reduceMotion ? 0 : (waking ? 0 : ctx.eyeY+(ctx.coolEyeY||0))})`));
      ctx.root.dataset.expression = ctx.accessoryPreview ? (ctx.accessoryExpression||'headphones') : waking ? ctx.wakePhase : sleeping ? 'sleeping' : magic ? 'magic' : bubbles ? (ctx.bubbleAlarm?'bubble-hurry':'bubbles') : ctx.looking ? (ctx.squint ? 'sneak' : 'looking') : recovering ? 'recovering' : entering ? 'entering' : surge ? 'wide' : ctx.level ? 'busy' : happy ? 'happy' : ctx.blinking ? 'blink' : 'open';
    }

    let restTimer=null,restStart=null;
    function stopBreathing(){clearTimeout(restTimer);restTimer=null;restStart=null;}
    function restingBreath(now){
      if(!ctx.breathingEnabled||ctx.reduceMotion||ctx.disposed||ctx.clearing||document.hidden||ctx.isAdjusting?.()||(ctx.bubblesPhase&&ctx.bubblesPhase!=='none')||(ctx.magicPhase&&ctx.magicPhase!=='none')){
        stopBreathing();return 0;
      }
      const free=ctx.sleepPhase==='awake'&&ctx.wakePhase==='none'&&!ctx.held.size&&!ctx.mouseMode&&!ctx.level&&!ctx.looking&&now>=ctx.recoveryUntil&&now-ctx.lastStroke>350&&(!ctx.coolPhase||['none','wearing'].includes(ctx.coolPhase));
      if(!free){stopBreathing();return 0;}
      if(restTimer===null)restTimer=setTimeout(()=>{restTimer=null;ctx.renderBody();},100);
      if(restStart===null)restStart=now;
      return -Math.round((.5-.5*Math.cos((now-restStart)*Math.PI*2/4200))*1000)/1000;
    }
    function renderBody() {
      if(ctx.gamingOwnsHands?.())return;
      const surge = ctx.level > 0 && performance.now() < ctx.surgeUntil;
      const now = performance.now();
      const breathing = now < ctx.recoveryUntil && now-ctx.lastStroke > 220 && !ctx.held.size;
      const breath = breathing ? Math.round(1.5-1.5*Math.cos((now-ctx.recoveryStart)*Math.PI*2/1000)) : 0;
      let bodyX=ctx.lookX, bodyY=ctx.bounceOffset+(surge ? -5 : 0)+breath+ctx.lookY+restingBreath(now);
      let handsX=ctx.lookX, handsY=Math.min(0,ctx.bounceOffset)+(surge ? -2 : 0)+ctx.lookY;
      if(ctx.sleepPhase==='stretch') {
        const progress=Math.min(1,ctx.sleepClock/650);
        bodyX=0;bodyY=-Math.round(4*progress);handsX=0;handsY=-Math.round(3*progress);
      } else if(ctx.sleepPhase==='settling') {
        const progress=Math.min(1,(ctx.sleepClock-1250)/1150);
        const eased=progress*progress*(3-2*progress);
        bodyX=-Math.round(2*eased);bodyY=Math.round(-4+9*eased);handsX=0;handsY=0;
      } else if(ctx.sleepPhase==='asleep') {
        const t=(ctx.sleepClock-2400)/3600;
        bodyX=-2;bodyY=5+Math.round(1-Math.cos(t*Math.PI*2));handsX=0;handsY=0;
      }
      if(ctx.wakePhase!=='none') {
        bodyX=ctx.wakeX;bodyY=ctx.wakeY+ctx.bounceOffset;
        handsX=ctx.wakeX;handsY=ctx.wakeY+Math.min(0,ctx.bounceOffset);
        if(ctx.wakePhase==='calming')bodyY+=Math.round(1-Math.cos((ctx.wakeClock-ctx.wakeCalmStart)*Math.PI*2/600));
      }
      bodyY+=ctx.coolBodyY||0;handsY+=ctx.coolBodyY||0;
      if(ctx.reduceMotion)bodyX=bodyY=handsX=handsY=0;
      let bodyTransform=`translate(${bodyX} ${bodyY})`;
      if(ctx.accessoryPreview){
        const p=ctx.accessoryPulse||0;
        bodyX=ctx.reduceMotion?0:-Math.round(p);bodyY=ctx.reduceMotion?0:Math.round(2*p);
        bodyTransform=`translate(${bodyX} ${bodyY}) translate(118 96) scale(${(1+.008*p).toFixed(4)} ${(1-.035*p).toFixed(4)}) translate(-118 -96)`;
        handsX=handsY=0;
      }
      ctx.body.setAttribute('transform',bodyTransform);
      ctx.hands.setAttribute('transform',`translate(${handsX} ${handsY})`);
      ctx.anchorHappy?.(bodyX,bodyY);
      ctx.anchorBubbles?.(handsX,handsY);
      const occlusion=ctx.accessoryPreview?bodyTransform:`translate(${bodyX-handsX} ${bodyY-handsY})`;
      ctx.armClip.setAttribute('transform',occlusion);
      ctx.raisedClip.setAttribute('transform',occlusion);

    }

    function refreshStatus() {
      const happyButton=ctx.root.querySelector('[data-action="happy"]');
      if(happyButton)happyButton.disabled=ctx.sleepPhase!=='awake'||ctx.wakePhase!=='none'||!!ctx.level||performance.now()<ctx.recoveryUntil;
      const wakeButton=ctx.root.querySelector('[data-action="wake"]');
      if(wakeButton)wakeButton.disabled=ctx.sleepPhase!=='asleep';
      if(ctx.paused){ctx.setStatus('已暂停','paused');return;}
      if(ctx.isAdjusting?.()){ctx.setStatus('试穿中','accessory');return;}
      if(ctx.gamingOwnsHands?.()){ctx.setStatus(ctx.gamingCaption||'摸鱼中','gaming');return;}
      if(ctx.wakePhase!=='none')ctx.setStatus(ctx.wakePhase==='startled' ? '哇！' : ctx.wakePhase==='checking' ? '谁、谁来了？' : ctx.wakePhase==='pretending' ? '我没睡！在敲呢！' : '呼……继续工作', 'waking');
      else if (ctx.sleepPhase==='asleep') ctx.setStatus(ctx.happyPhase==='dreaming'?'睡着了':'呼……Zzz', 'asleep');
      else if(ctx.sleepPhase!=='awake')ctx.setStatus('困困的……', 'sleepy');
      else if(ctx.magicPhase&&ctx.magicPhase!=='none'&&!ctx.magicHurrying)ctx.setStatus('变个小魔术','magic');
      else if(ctx.bubblesPhase&&ctx.bubblesPhase!=='none'&&!ctx.bubbleHurrying)ctx.setStatus('泡泡飘起来了','bubbles');
      else if(ctx.coolPhase&&ctx.coolPhase!=='none')ctx.setStatus(({fetching:'偷偷戴上',lifting:'戴墨镜',adjusting:'戴好了',wearing:'全工位最酷的小蟹',leaving:'耍帅结束，继续工作'})[ctx.coolPhase], 'cool');
      else if (ctx.looking) ctx.setStatus(ctx.lookCaption||'嗯？没人吧……', 'looking');
      else if (ctx.mouseMode) ctx.setStatus(ctx.root.dataset.left!=='idle' ? '打字和鼠标' : '移动鼠标', 'mouse');
      else if (ctx.level) ctx.setStatus(ctx.level === 2 ? (ctx.fastCaption||'Ultra Clawding!!') : '忙碌中', 'busy');
      else if (performance.now() < ctx.recoveryUntil) ctx.setStatus('呼……缓口气', 'recovering');
      else if(ctx.happyPhase==='smiling')ctx.setStatus('嘿嘿~', 'happy');
      else ctx.setStatus(ctx.active.size ? '打字中' : '等待输入', ctx.active.size ? 'typing' : 'idle');
    }

    function renderStretchArms(progress) {
      const frame=ctx.reduceMotion ? 0 : Math.round(Math.max(0,Math.min(1,progress))*8);
      if(frame===ctx.sleepArmFrame)return;
      ctx.sleepArmFrame=frame;
      for(const hand of ['left','right']) {
        ctx[hand].innerHTML=ctx.rig.stretchFrames[hand][frame];
        ctx.root.dataset[hand]=frame ? 'stretch' : 'idle';
        if(frame && hand==='right')ctx[hand].setAttribute('clip-path','url(#raised-arms-visible)');
        else if(hand==='right')ctx[hand].setAttribute('clip-path','url(#far-arm-visible)');
        else ctx[hand].removeAttribute('clip-path');
      }
    }

    function renderSleepSymbols() {
      const symbols=ctx.sleepSymbols.querySelectorAll('[data-sleep-z]');
      const cycle=(ctx.sleepClock-2400)%6200;
      symbols.forEach((el,i)=>{
        const age=cycle-i*650;
        const show=ctx.sleepPhase==='asleep'&&ctx.happyPhase!=='dreaming'&&(ctx.reduceMotion ? i===0 : age>=0&&age<2700);
        el.setAttribute('display',show ? 'inline' : 'none');
        if(!show)return;
        const t=ctx.reduceMotion ? .35 : age/2700;
        el.setAttribute('transform',`translate(${Math.round(172+15*t)} ${Math.round(49-20*t)}) scale(${(.6+1.25*t).toFixed(2)})`);
        el.setAttribute('opacity',String(ctx.reduceMotion ? .7 : Math.min(1,t*7,(1-t)*3)));
      });
    }

    function updateParticles(now) {
      ctx.particleFrame = null;
      ctx.particles = ctx.particles.filter(p => {
        const t = (now-p.birth)/p.life;
        if (t >= 1) { p.el.remove(); return false; }
        const x = p.x + p.side * (3 + 19*t);
        const y = p.y - 14*t + 8*t*t;
        p.el.setAttribute('transform', `translate(${Math.round(x)} ${Math.round(y)}) rotate(${p.side*35})`);
        p.el.setAttribute('opacity', String(Math.min(1,(1-t)*3)));
        return true;
      });
      if (ctx.particles.length && !ctx.disposed) ctx.particleFrame = requestAnimationFrame(ctx.updateParticles);
    }

    function emitDrop(now) {
      if (ctx.reduceMotion || ctx.particles.length >= 8) return;
      const side = ctx.dropSide; ctx.dropSide *= -1;
      const el = document.createElementNS('http://www.w3.org/2000/svg','path');
      el.setAttribute('d','M0 -4H1V-2H2V1H1V2H-2V1H-3V-1H-2V-2H-1V-3H0Z');
      el.setAttribute('fill', '#83b9c6');
      const x = side < 0 ? 77 : 169, y = side < 0 ? 54 : 65;
      el.setAttribute('transform', `translate(${x} ${y})`);
      ctx.sweat.appendChild(el);
      ctx.particles.push({el, side, x, y, birth:now, life:600+Math.random()*150});
      if (ctx.particleFrame === null || ctx.particleFrame === undefined) ctx.particleFrame = requestAnimationFrame(ctx.updateParticles);
    }

    function bumpBody() {
      if (performance.now()-ctx.lastBounce < (ctx.level || ctx.wakePhase==='pretending' ? 110 : 150)) return;
      ctx.lastBounce=performance.now(); clearTimeout(ctx.bodyTimer);
      ctx.bounceOffset=ctx.level===2 ? -4 : -3; ctx.renderBody();
      ctx.bodyTimer=setTimeout(()=>{
        ctx.bounceOffset=1;ctx.renderBody();
        ctx.bodyTimer=setTimeout(()=>{ctx.bounceOffset=0;ctx.renderBody();},ctx.level ? 40 : 65);
      },ctx.level ? 55 : 85);
    }

    function tapHand(hand) {
      if(ctx.gamingOwnsHands?.())return;
      if(ctx.magicOwnsHands?.())return;
      if(hand==='left'&&(ctx.coolOwnsLeft?.()||ctx.bubblesOwnsLeft?.()))return;
      ctx.cancelHand(hand);
      ctx.pose(hand, ctx.reduceMotion ? 'down' : 'up');
      if (!ctx.reduceMotion) ctx.handTimers[hand].push(setTimeout(()=>ctx.pose(hand,'down'),ctx.level || ctx.wakePhase==='pretending' ? 25 : 40));
      ctx.handTimers[hand].push(setTimeout(()=>ctx.pose(hand,'idle'),ctx.level || ctx.wakePhase==='pretending' ? 95 : 155));
      ctx.bumpBody();
    }
    return { stopBreathing,setStatus, pose, cancelHand, refreshEyes, renderBody, refreshStatus, renderStretchArms, renderSleepSymbols, updateParticles, emitDrop, bumpBody, tapHand };
  };
})(window);


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
        if(!ctx.tryIdleGaming?.())startSleep();
      },Math.max(delay,ctx.sleepDelayMs-2400-(performance.now()-ctx.idleSince)));
    }
    function startSleep() {
      if(ctx.disposed || ctx.wakePhase!=='none' || ctx.held.size || ctx.level || performance.now()<ctx.recoveryUntil || ctx.mouseMode || ctx.looking)return;
      ctx.stopGaming(false);ctx.stopEggTimer();ctx.stopMagic(false);ctx.stopBubbles(false);ctx.stopHappy(false);ctx.stopCool(false,true);clearTimeout(ctx.idleTimer);stopSleep();ctx.resetActivity();
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


/* Clawd: input. Private context belongs to one controller instance. */
(function (global) {
  'use strict';
  const modules = global.ClawdModules || (global.ClawdModules = {});
  modules.input = function (ctx) {
    function listen(target, name, fn, opts) {
      target.addEventListener(name, fn, opts);
      ctx.cleanup.push(() => target.removeEventListener(name, fn, opts));
    }

    function stopMouse() {
      clearTimeout(ctx.mouseTimer);
      if (!ctx.mouseMode) return;
      ctx.mouseMode = false;
      ctx.right.removeAttribute('transform');
      ctx.mouse.removeAttribute('transform');
      ctx.mouseX = ctx.mouseY = 0;
      ctx.lastMouse = null;
      ctx.pose('right', 'idle');
    }

    function press(code, options = {}) {
      if(ctx.isAdjusting?.())return false;
      const k = ctx.lookup.get(code);
      if (!k || ctx.disposed){if(!ctx.disposed&&(ctx.bubblesPhase!=='none'||ctx.gamingOwnsHands?.()))ctx.markActivity();return false;}
      let hand=k.hand;
      if(code==='Space'){ctx.alternateSpace=!ctx.alternateSpace;hand=ctx.mouseMode ? 'left' : ctx.alternateSpace ? 'left' : 'right';}
      ctx.markActivity();
      if(hand==='right')ctx.stopMouse();
      ctx.lastStroke=performance.now();
      if(hand==='left')ctx.lastLeftStroke=ctx.lastStroke;
      if (!options.repeat && !ctx.held.has(code) && !ctx.modifier.test(code)) {
        ctx.hits.push(performance.now());
        clearTimeout(ctx.activityTimer); ctx.activityTick();
      }
      ctx.held.add(code);
      clearTimeout(ctx.releaseTimers.get(code));
      ctx.releaseTimers.delete(code);
      ctx.active.add(code);
      ctx.started.set(code, performance.now());
      ctx.svg.querySelector('#key-' + code).classList.add('is-down');
      if(ctx.wakePhase==='none')ctx.tapHand(hand);
      ctx.lastKey.textContent = (k.label || 'Space') + ' · ' + (hand === 'left' ? '左手' : '右手');
      ctx.refreshStatus();
      return true;
    }

    function release(code, immediate = false) {
      if(ctx.isAdjusting?.())return false;
      if (!ctx.lookup.has(code)) return;
      if(ctx.held.has(code))ctx.markActivity();
      ctx.held.delete(code);
      clearTimeout(ctx.releaseTimers.get(code));
      const finish = () => {
        ctx.active.delete(code);
        ctx.started.delete(code);
        ctx.releaseTimers.delete(code);
        ctx.svg.querySelector('#key-' + code).classList.remove('is-down');
        ctx.refreshStatus();
      };
      const remaining = immediate ? 0 : Math.max(0, 90 - (performance.now() - (ctx.started.get(code) || 0)));
      if (remaining) ctx.releaseTimers.set(code, setTimeout(finish, remaining)); else finish();
    }

    function tap(code) {
      if (ctx.press(code)) ctx.release(code);
    }

    function moveMouse(dx, dy) {
      if(ctx.isAdjusting?.())return false;
      if (ctx.disposed) return;
      ctx.markActivity();
      if(ctx.wakePhase!=='none'){ctx.lastKey.textContent='Mouse · 被发现了';ctx.refreshStatus();return;}
      if(ctx.gamingOwnsHands?.()){ctx.refreshStatus();return;}
      const leftHeld=[...ctx.held].some(code=>ctx.lookup.get(code)?.hand==='left'||code==='Space');
      if(!leftHeld && performance.now()-ctx.lastLeftStroke>300&&!ctx.level)ctx.resetActivity();
      ctx.cancelHand('right');
      clearTimeout(ctx.mouseTimer);
      if (!ctx.mouseMode) {
        ctx.right.innerHTML = ctx.rig.mouse;
        ctx.root.dataset.right = 'mouse';
        ctx.mouseMode = true;
      }
      ctx.mouseX = ctx.reduceMotion ? 0 : Math.max(-3, Math.min(4, Math.round(dx)));
      ctx.mouseY = ctx.reduceMotion ? 0 : Math.max(-2, Math.min(3, Math.round(dy)));
      const transform = `translate(${ctx.mouseX} ${ctx.mouseY})`;
      ctx.right.innerHTML = ctx.rig.mouseFrames[ctx.mouseX + ',' + ctx.mouseY];
      ctx.mouse.setAttribute('transform', transform);
      ctx.lastKey.textContent = 'Mouse · 右手';
      ctx.refreshStatus();
      queueMouseRest();
    }

    function queueMouseRest(){
      clearTimeout(ctx.mouseTimer);ctx.mouseTimer=null;
      if(ctx.mouseButtons.size)return;
      ctx.mouseTimer=setTimeout(()=>{ctx.stopMouse();ctx.refreshStatus();},650);
    }

    function mouseButton(button, down) {
      if(ctx.isAdjusting?.())return false;
      if(button!==0 && button!==2)return;
      ctx.markActivity();
      if(down)ctx.mouseButtons.add(button);else ctx.mouseButtons.delete(button);
      if(ctx.mouseMode)queueMouseRest();
      const name = button === 2 ? 'right' : 'left';
      ctx.svg.querySelector('#mouse-' + name + '-button').classList.toggle('is-clicked', down);
    }

    function bindInput() {
    ctx.listen(ctx.root, 'keydown', e => {
      if (e.target.closest('button,[data-accessory-menu],[data-accessory-open]')) return;
      clearTimeout(ctx.demoTimer);
      cancelAnimationFrame(ctx.demoFrame);
      // KeyboardEvent.code tracks the physical position, including left/right Shift.
      // Do not cancel browser shortcuts or text editing behavior.
      press(e.code, {repeat:e.repeat});
    });
    ctx.listen(global, 'keyup', e => ctx.release(e.code));
    ctx.listen(global, 'blur', ctx.clearAll);
    ctx.listen(document, 'visibilitychange', () => { if (document.hidden) ctx.clearAll(); });
    ctx.listen(ctx.root, 'focusout', e => { if (e.relatedTarget && !ctx.root.contains(e.relatedTarget)) ctx.clearAll(); });
    ctx.listen(ctx.zone, 'pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      if (!ctx.lastMouse) ctx.lastMouse = {x:e.clientX, y:e.clientY};
      const dx=(e.clientX-ctx.lastMouse.x)/10, dy=(e.clientY-ctx.lastMouse.y)/10;
      if (Math.abs(dx)+Math.abs(dy) < .15) return;
      ctx.moveMouse(dx,dy);
    });
    ctx.listen(ctx.zone, 'pointerleave', () => { ctx.lastMouse=null; });
    ctx.listen(ctx.zone, 'pointerdown', e => {
      const key = e.target.closest('[data-code]');
      if (key) { ctx.tap(key.dataset.code); return; }
      ctx.moveMouse(ctx.mouseX, ctx.mouseY);
      ctx.mouseButton(e.button, true);
    });
    ctx.listen(global, 'pointerup', e => {if(!e.target?.closest?.('[data-accessory-menu],[data-accessory-open]'))ctx.mouseButton(e.button,false);});
    ctx.listen(global, 'pointercancel', () => { ctx.mouseButton(0,false);ctx.mouseButton(2,false); });
    ctx.listen(ctx.zone, 'contextmenu', e => e.preventDefault());
    
    }
    return { listen, stopMouse, press, release, tap, moveMouse, mouseButton, bindInput };
  };
})(window);


/* Clawd: demo. Private context belongs to one controller instance. */
(function (global) {
  'use strict';
  const modules = global.ClawdModules || (global.ClawdModules = {});
  modules.demo = function (ctx) {
    function prepareDemo(){
      if(ctx.coolPhase==='none'&&ctx.happyPhase==='none')ctx.clearAll();
      else {clearTimeout(ctx.demoTimer);cancelAnimationFrame(ctx.demoFrame);}
    }

    function demoTyping() {
      prepareDemo();
      const codes=['KeyC','KeyJ','KeyA','KeyK','KeyD','Space','KeyW','KeyO','KeyR','KeyL'];
      const delays=[380,380,350,320,280,240,210,180,160,140,120,110];
      let i=0;
      function next() {
        if (ctx.disposed || i>=72) return;
        ctx.tap(codes[i%codes.length]);
        const delay=i<delays.length ? delays[i] : i<35 ? 120 : 78;
        i++; if(i<72)ctx.demoTimer=setTimeout(next,delay);
      }
      next();
    }

    function demoMouse() {
      prepareDemo();
      const start = performance.now();
      function frame(now) {
        const t = Math.min(1, (now-start)/1000);
        ctx.moveMouse(Math.sin(t*Math.PI*2)*4, Math.cos(t*Math.PI*2)*2);
        if (t < 1) ctx.demoFrame = requestAnimationFrame(frame);
      }
      ctx.demoFrame = requestAnimationFrame(frame);
    }

    function demoMixed(){
      prepareDemo();let i=0;const codes=['KeyA','KeyW','KeyS','KeyD'];
      function next(){
        if(ctx.disposed||i>=12)return;
        ctx.moveMouse(Math.sin(i*.6)*3,Math.cos(i*.6)*2);ctx.tap(codes[i%codes.length]);
        i++;if(i<12)ctx.demoTimer=setTimeout(next,130);
      }
      next();
    }

    function bindDemo() {
    ctx.root.querySelectorAll('[data-action]').forEach(button => {
      ctx.listen(button, 'click', () => {
        if(ctx.isAdjusting?.())return;
        const action = button.dataset.action;
        if(action==='cool'){ctx.clearAll();ctx.startCool();}
        else if(action==='happy'){
          if(ctx.sleepPhase!=='awake'||ctx.wakePhase!=='none'||ctx.level||performance.now()<ctx.recoveryUntil)return;
          ctx.stopCool(false);ctx.stopHappy(false);if(ctx.looking)ctx.stopLook();ctx.startHappy(ctx.root.querySelector('[data-motif-select]')?.value);
        }
        else if(action==='dream'){ctx.clearAll();ctx.startSleep();ctx.demoTimer=setTimeout(()=>ctx.startDream(ctx.root.querySelector('[data-motif-select]')?.value),2600);}
        else if (action === 'left') { ctx.tap('KeyA'); }
        else if (action === 'right') { ctx.tap('KeyJ'); }
        else if (action === 'mouse') {if(ctx.sleepPhase==='asleep' || ctx.wakePhase!=='none')ctx.moveMouse(2,0);else ctx.demoMouse();}
        else if (action === 'wake') ctx.startWake();
        else if (action === 'demo') ctx.demoTyping();
        else if (action === 'mixed') demoMixed();
        else if (action === 'sleep') { ctx.clearAll({preserveSunglasses:true});ctx.startSleep(); }
        else if (action === 'look') { ctx.clearAll();ctx.lookCount=0;ctx.lookLimit=1;ctx.startLook(); }
      });
    });
    
    }
    return { demoTyping, demoMouse, bindDemo };
  };
})(window);


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


/* Experimental idle gaming animation. Uses the existing controller and arm roots. */
(function(global){
'use strict';
const NS='http://www.w3.org/2000/svg';
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const modules=global.ClawdModules||(global.ClawdModules={});
modules.gaming=function(ctx){
 const root=ctx.root,rig=ctx.rig,svg=ctx.svg,art={"front":"<g transform=\"translate(-121 -15)\"><path xmlns=\"http://www.w3.org/2000/svg\" d=\"M97 5L98 5L99 5L100 5L101 5L101 6L102 6L103 6L104 6L105 6L106 6L107 6L107 7L108 7L109 7L110 7L110 7L111 7L111 8L112 8L113 8L113 9L114 9L114 10L114 10L115 10L116 10L117 10L118 10L118 11L119 11L120 11L121 11L122 11L123 11L124 11L125 11L125 12L126 12L127 12L128 12L128 12L129 12L130 12L130 11L131 11L131 10L132 10L132 10L133 10L134 10L135 10L136 10L136 11L137 11L138 11L139 11L140 11L141 11L142 11L142 12L143 12L144 12L145 12L145 12L146 12L146 13L147 13L147 14L148 14L148 15L148 15L148 16L148 17L149 17L149 18L149 19L149 20L149 21L150 21L150 22L150 23L150 24L150 24L150 25L150 26L151 26L151 27L151 28L151 29L151 30L152 30L152 31L152 32L152 33L152 34L152 35L153 35L153 36L153 37L153 38L153 38L152 38L152 39L152 40L152 41L151 41L151 42L151 42L150 42L149 42L148 42L147 42L146 42L145 42L144 42L144 42L143 42L143 41L142 41L142 40L142 39L141 39L141 38L140 38L140 37L139 37L139 36L139 36L138 36L138 35L138 34L137 34L137 33L137 32L136 32L136 31L136 30L135 30L135 29L135 29L134 29L133 29L132 29L131 29L130 29L130 28L129 28L128 28L127 28L126 28L125 28L124 28L123 28L122 28L121 28L120 28L120 27L119 27L118 27L117 27L116 27L115 27L114 27L113 27L112 27L111 27L111 26L110 26L109 26L108 26L107 26L107 26L106 26L106 27L105 27L105 28L105 29L104 29L104 30L103 30L103 31L103 31L102 31L102 32L101 32L101 33L100 33L99 33L99 34L98 34L98 35L98 35L97 35L96 35L96 34L95 34L94 34L93 34L92 34L92 33L91 33L91 33L90 33L90 32L90 31L90 30L89 30L89 29L89 29L89 28L89 27L90 27L90 26L90 25L90 24L90 23L90 22L91 22L91 21L91 20L91 19L91 18L92 18L92 17L92 16L92 15L92 15L92 14L93 14L93 13L93 12L93 11L93 10L94 10L94 9L94 8L94 8L95 8L95 7L96 7L96 6L97 6L97 5Z\" fill=\"#444954\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M97 2L98 2L99 2L100 2L101 2L101 3L102 3L103 3L104 3L105 3L106 3L107 3L107 4L108 4L109 4L110 4L110 4L111 4L111 5L112 5L112 6L113 6L113 7L114 7L114 8L114 8L115 8L116 8L117 8L118 8L119 8L120 8L121 8L122 8L122 9L123 9L124 9L125 9L126 9L127 9L128 9L128 9L129 9L129 8L130 8L131 8L132 8L132 7L132 7L133 7L134 7L135 7L136 7L136 8L137 8L138 8L139 8L140 8L141 8L142 8L142 9L143 9L144 9L145 9L145 9L146 9L146 10L147 10L147 11L148 11L148 12L148 12L148 13L148 14L149 14L149 15L149 16L149 17L149 18L150 18L150 19L150 20L150 21L150 21L150 22L150 23L151 23L151 24L151 25L151 26L151 27L152 27L152 28L152 29L152 30L152 31L152 32L153 32L153 33L153 34L153 35L153 35L152 35L152 36L152 37L152 38L151 38L151 39L151 39L150 39L149 39L148 39L147 39L146 39L145 39L144 39L144 39L143 39L143 38L142 38L142 37L142 36L141 36L141 35L140 35L140 34L139 34L139 33L139 33L138 33L138 32L138 31L137 31L137 30L137 29L136 29L136 28L136 27L135 27L135 26L135 26L134 26L133 26L132 26L131 26L130 26L130 25L129 25L128 25L127 25L126 25L125 25L124 25L123 25L122 25L121 25L121 24L120 24L119 24L118 24L117 24L116 24L115 24L114 24L113 24L112 24L111 24L111 23L110 23L109 23L108 23L107 23L107 23L106 23L106 24L105 24L105 25L105 26L104 26L104 27L103 27L103 28L103 28L102 28L102 29L101 29L101 30L100 30L99 30L99 31L98 31L98 32L98 32L97 32L96 32L96 31L95 31L94 31L93 31L92 31L92 30L91 30L91 30L90 30L90 29L90 28L90 27L89 27L89 26L89 26L89 25L89 24L90 24L90 23L90 22L90 21L90 20L90 19L91 19L91 18L91 17L91 16L91 15L92 15L92 14L92 13L92 12L92 12L92 11L93 11L93 10L93 9L93 8L93 7L94 7L94 6L94 5L94 5L95 5L95 4L96 4L96 3L97 3L97 2Z\" fill=\"#656e7d\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M97 3L98 3L99 3L100 3L101 3L101 4L102 4L103 4L104 4L105 4L106 4L107 4L107 5L108 5L109 5L110 5L110 5L111 5L111 6L112 6L113 6L113 7L114 7L114 8L114 8L115 8L116 8L117 8L118 8L118 9L119 9L120 9L121 9L122 9L123 9L124 9L125 9L125 10L126 10L127 10L128 10L128 10L129 10L130 10L130 9L131 9L131 8L132 8L132 8L133 8L134 8L135 8L136 8L136 9L137 9L138 9L139 9L140 9L141 9L141 10L142 10L143 10L144 10L144 10L145 10L145 11L146 11L146 12L147 12L147 13L147 13L147 14L148 14L148 15L148 16L148 17L148 18L148 19L149 19L149 20L149 21L149 21L149 22L149 23L149 24L150 24L150 25L150 26L150 27L150 28L150 29L150 30L150 31L151 31L151 32L151 33L151 34L151 35L151 35L150 35L150 36L149 36L149 36L148 36L147 36L146 36L145 36L145 36L144 36L144 35L143 35L143 34L142 34L142 33L142 32L141 32L141 31L140 31L140 30L140 30L139 30L139 29L138 29L138 28L138 27L137 27L137 26L136 26L136 25L136 25L135 25L134 25L133 25L133 24L132 24L131 24L130 24L129 24L128 24L127 24L126 24L126 23L125 23L124 23L123 23L122 23L121 23L121 22L120 22L119 22L118 22L117 22L116 22L115 22L114 22L114 21L113 21L112 21L111 21L110 21L109 21L109 20L108 20L107 20L106 20L106 20L105 20L105 21L104 21L104 22L104 23L103 23L103 24L102 24L102 25L102 25L101 25L101 26L100 26L100 27L99 27L98 27L98 28L97 28L97 29L97 29L96 29L95 29L95 28L94 28L93 28L93 28L92 28L92 27L92 26L91 26L91 25L91 25L91 24L92 24L92 23L92 22L92 21L92 20L92 19L93 19L93 18L93 17L93 16L94 16L94 15L94 14L94 13L94 13L94 12L94 11L94 10L95 10L95 9L95 8L95 7L95 6L95 6L96 6L96 5L96 4L97 4L97 3Z\" fill=\"#dce2e7\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M97 1L98 1L99 1L100 1L100 2L101 2L102 2L103 2L104 2L105 2L106 2L107 2L107 3L108 3L109 3L109 3L110 3L110 4L110 5L110 5L109 5L108 5L107 5L106 5L106 4L105 4L104 4L103 4L102 4L101 4L100 4L100 3L99 3L98 3L97 3L97 3L97 2L97 1Z\" fill=\"#3e444f\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M133 6L134 6L135 6L136 6L136 7L137 7L138 7L139 7L140 7L141 7L142 7L142 8L143 8L144 8L144 8L144 9L145 9L145 10L145 10L144 10L143 10L142 10L141 10L141 9L140 9L139 9L138 9L137 9L136 9L135 9L135 8L134 8L133 8L132 8L132 8L132 7L133 7L133 6Z\" fill=\"#3e444f\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M98 4L99 4L100 4L101 4L101 5L102 5L103 5L104 5L105 5L106 5L107 5L107 6L108 6L109 6L109 6L110 6L110 7L111 7L111 8L112 8L113 8L113 9L113 9L114 9L115 9L116 9L116 10L117 10L118 10L119 10L120 10L121 10L122 10L122 11L123 11L124 11L125 11L126 11L127 11L127 12L128 12L129 12L129 12L130 12L130 11L131 11L131 10L132 10L133 10L133 9L133 9L134 9L135 9L136 9L136 10L137 10L138 10L139 10L140 10L141 10L141 11L142 11L143 11L143 11L144 11L144 12L144 12L143 12L142 12L141 12L140 12L140 11L139 11L138 11L137 11L136 11L135 11L135 10L134 10L133 10L132 10L132 10L131 10L130 10L130 11L129 11L129 12L128 12L128 12L127 12L126 12L125 12L124 12L124 11L123 11L122 11L121 11L120 11L119 11L118 11L117 11L117 10L116 10L115 10L114 10L114 10L113 10L113 9L112 9L112 8L111 8L110 8L110 7L110 7L109 7L108 7L107 7L107 6L106 6L105 6L104 6L103 6L102 6L101 6L100 6L100 5L99 5L98 5L98 5L98 4Z\" fill=\"#f6f8f5\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M101 9L102 9L103 9L104 9L105 9L105 9L105 10L105 11L105 12L105 12L106 12L107 12L107 13L108 13L108 13L108 14L108 15L108 16L108 17L108 17L107 17L106 17L106 16L105 16L105 16L105 17L105 18L105 19L105 19L104 19L103 19L102 19L101 19L101 19L101 18L101 17L101 16L101 16L100 16L99 16L99 15L98 15L98 15L98 14L98 13L98 12L98 11L98 11L99 11L100 11L100 12L101 12L101 12L101 11L101 10L101 9Z\" fill=\"#424750\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M137 12L138 12L139 12L139 12L140 12L140 13L140 13L140 14L140 15L140 15L139 15L139 16L139 16L138 16L137 16L137 16L136 16L136 15L136 15L136 14L136 13L136 13L137 13L137 12Z\" fill=\"#646c77\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M137 13L138 13L139 13L139 13L139 14L139 15L139 15L138 15L137 15L137 15L137 14L137 13Z\" fill=\"#7fbc93\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M142 17L143 17L143 18L144 18L144 18L145 18L145 19L145 19L145 20L145 21L145 21L144 21L144 22L144 22L143 22L142 22L142 21L142 21L141 21L141 20L141 20L141 19L141 18L141 18L142 18L142 17Z\" fill=\"#646c77\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M142 18L143 18L144 18L144 19L144 19L144 20L144 21L144 21L143 21L143 20L142 20L142 20L142 19L142 18Z\" fill=\"#d58488\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M137 22L138 22L139 22L139 22L140 22L140 23L140 23L140 24L140 25L140 25L139 25L139 26L139 26L138 26L137 26L137 26L136 26L136 25L136 25L136 24L136 23L136 23L137 23L137 22Z\" fill=\"#646c77\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M137 23L138 23L139 23L139 23L139 24L139 25L139 25L138 25L137 25L137 25L137 24L137 23Z\" fill=\"#d8b563\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M132 16L133 16L134 16L134 16L135 16L135 17L135 17L135 18L135 19L135 19L134 19L134 20L134 20L133 20L132 20L132 20L131 20L131 19L131 19L131 18L131 17L131 17L132 17L132 16Z\" fill=\"#646c77\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M132 17L133 17L134 17L134 17L134 18L134 19L134 19L133 19L132 19L132 19L132 18L132 17Z\" fill=\"#79a7d5\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M111 16L112 16L113 16L114 16L114 17L115 17L115 17L116 17L116 18L116 18L116 19L116 20L116 21L116 22L116 22L115 22L115 23L115 23L114 23L113 23L113 22L112 22L111 22L111 22L110 22L110 21L110 21L110 20L110 19L110 18L110 17L110 17L111 17L111 16Z\" fill=\"#929aa6\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M111 17L112 17L113 17L113 18L114 18L115 18L115 18L115 19L115 20L115 21L115 21L114 21L113 21L113 20L112 20L111 20L111 20L111 19L111 18L111 17Z\" fill=\"#49505b\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M125 18L126 18L127 18L128 18L128 19L129 19L129 19L130 19L130 20L130 20L130 21L130 22L130 23L130 24L130 24L129 24L129 25L129 25L128 25L127 25L127 24L126 24L125 24L125 24L124 24L124 23L124 23L124 22L124 21L124 20L124 19L124 19L125 19L125 18Z\" fill=\"#929aa6\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M125 19L126 19L127 19L127 20L128 20L129 20L129 20L129 21L129 22L129 23L129 23L128 23L127 23L127 22L126 22L125 22L125 22L125 21L125 20L125 19Z\" fill=\"#49505b\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M116 12L117 12L118 12L119 12L119 12L119 13L119 13L118 13L117 13L116 13L116 13L116 12Z\" fill=\"#7c8592\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M123 13L124 13L125 13L126 13L126 13L126 14L126 14L125 14L124 14L123 14L123 14L123 13Z\" fill=\"#7c8592\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M119 8L120 8L121 8L121 8L121 9L121 10L121 10L120 10L119 10L119 10L119 9L119 8Z\" fill=\"#83bec9\"/>\n    </g>","rear":"<g transform=\"translate(-110 -94)\"><path xmlns=\"http://www.w3.org/2000/svg\" d=\"M86 82L87 82L88 82L89 82L90 82L90 83L91 83L92 83L93 83L94 83L95 83L96 83L96 84L97 84L98 84L99 84L99 84L100 84L100 85L101 85L101 86L102 86L103 86L103 87L103 87L104 87L105 87L106 87L106 88L107 88L108 88L109 88L110 88L111 88L111 89L112 89L113 89L114 89L115 89L115 90L116 90L117 90L117 90L118 90L119 90L119 89L120 89L120 88L121 88L121 88L122 88L123 88L124 88L124 89L125 89L126 89L127 89L128 89L128 90L129 90L130 90L131 90L132 90L132 91L133 91L134 91L134 91L135 91L135 92L136 92L137 92L137 93L137 93L137 94L138 94L138 95L138 96L138 97L138 98L139 98L139 99L139 100L139 100L139 101L140 101L140 102L140 103L140 104L140 105L141 105L141 106L141 107L141 108L142 108L142 109L142 110L142 110L141 110L141 111L141 112L140 112L140 113L140 113L139 113L138 113L137 113L136 113L136 112L135 112L134 112L133 112L133 112L132 112L132 111L131 111L131 110L130 110L129 110L129 109L128 109L128 108L128 108L127 108L127 107L126 107L126 106L126 105L125 105L125 104L124 104L124 103L124 103L123 103L122 103L121 103L121 102L120 102L119 102L118 102L117 102L116 102L115 102L115 101L114 101L113 101L112 101L111 101L110 101L110 100L109 100L108 100L107 100L106 100L105 100L104 100L104 99L103 99L102 99L101 99L100 99L99 99L98 99L98 98L97 98L96 98L96 98L95 98L95 99L94 99L94 100L93 100L92 100L92 101L92 101L91 101L91 102L90 102L89 102L89 103L88 103L87 103L87 104L87 104L86 104L85 104L85 103L84 103L83 103L82 103L81 103L81 102L80 102L80 102L79 102L79 101L79 100L78 100L78 99L78 99L78 98L79 98L79 97L79 96L79 95L80 95L80 94L80 93L80 92L80 91L81 91L81 90L81 89L81 89L81 88L82 88L82 87L82 86L83 86L83 85L83 84L83 84L84 84L84 83L85 83L86 83L86 82Z\" fill=\"#444954\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M86 79L87 79L88 79L89 79L89 80L90 80L91 80L92 80L93 80L93 81L94 81L95 81L96 81L97 81L97 82L98 82L99 82L99 82L100 82L101 82L101 83L102 83L102 84L103 84L103 84L104 84L105 84L106 84L106 85L107 85L108 85L109 85L110 85L110 86L111 86L112 86L113 86L114 86L115 86L115 87L116 87L117 87L117 87L118 87L118 86L119 86L120 86L121 86L121 85L121 85L122 85L123 85L124 85L124 86L125 86L126 86L127 86L128 86L128 87L129 87L130 87L131 87L132 87L132 88L133 88L134 88L134 88L135 88L135 89L136 89L137 89L137 90L137 90L137 91L138 91L138 92L138 93L138 94L138 95L139 95L139 96L139 97L139 97L139 98L140 98L140 99L140 100L140 101L140 102L141 102L141 103L141 104L141 105L142 105L142 106L142 107L142 107L141 107L141 108L141 109L140 109L140 110L140 110L139 110L138 110L137 110L136 110L136 109L135 109L134 109L133 109L133 109L132 109L132 108L131 108L131 107L130 107L129 107L129 106L128 106L128 105L128 105L127 105L127 104L126 104L126 103L126 102L125 102L125 101L124 101L124 100L124 100L123 100L122 100L121 100L121 99L120 99L119 99L118 99L117 99L116 99L115 99L115 98L114 98L113 98L112 98L111 98L110 98L109 98L109 97L108 97L107 97L106 97L105 97L104 97L104 96L103 96L102 96L101 96L100 96L99 96L98 96L98 95L97 95L96 95L96 95L95 95L95 96L94 96L93 96L93 97L92 97L92 98L92 98L91 98L91 99L90 99L89 99L89 100L88 100L87 100L87 101L87 101L86 101L85 101L85 100L84 100L83 100L82 100L81 100L81 99L80 99L80 99L79 99L79 98L79 97L78 97L78 96L78 96L78 95L79 95L79 94L79 93L79 92L80 92L80 91L80 90L80 89L80 88L81 88L81 87L81 86L81 86L81 85L82 85L82 84L82 83L83 83L83 82L83 81L83 81L84 81L84 80L85 80L86 80L86 79Z\" fill=\"#656e7d\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M86 80L87 80L88 80L89 80L90 80L90 81L91 81L92 81L93 81L94 81L95 81L96 81L96 82L97 82L98 82L99 82L99 82L100 82L100 83L101 83L101 84L102 84L103 84L103 85L103 85L104 85L105 85L106 85L106 86L107 86L108 86L109 86L110 86L111 86L111 87L112 87L113 87L114 87L115 87L115 88L116 88L117 88L117 88L118 88L119 88L119 87L120 87L120 86L121 86L121 86L122 86L123 86L124 86L125 86L125 87L126 87L127 87L128 87L129 87L130 87L130 88L131 88L132 88L133 88L133 88L134 88L134 89L135 89L135 90L136 90L136 91L136 91L136 92L137 92L137 93L137 94L137 95L138 95L138 96L138 97L138 97L138 98L138 99L139 99L139 100L139 101L139 102L139 103L139 104L140 104L140 105L140 106L140 107L140 107L139 107L139 108L138 108L138 108L137 108L136 108L135 108L135 107L134 107L134 107L133 107L133 106L132 106L132 105L131 105L130 105L130 104L129 104L129 103L129 103L128 103L128 102L127 102L127 101L127 100L126 100L126 99L125 99L125 98L125 98L124 98L123 98L122 98L121 98L121 97L120 97L119 97L118 97L117 97L116 97L116 96L115 96L114 96L113 96L112 96L111 96L110 96L109 96L109 95L108 95L107 95L106 95L105 95L104 95L104 94L103 94L102 94L101 94L100 94L99 94L98 94L97 94L97 93L96 93L95 93L95 93L94 93L94 94L93 94L92 94L92 95L91 95L91 96L91 96L90 96L90 97L89 97L88 97L88 98L87 98L86 98L86 99L86 99L85 99L85 98L84 98L83 98L82 98L82 97L82 97L81 97L81 96L80 96L80 95L80 95L80 94L81 94L81 93L81 92L82 92L82 91L82 90L82 89L83 89L83 88L83 87L83 87L83 86L83 85L84 85L84 84L84 83L84 82L84 82L85 82L85 81L86 81L86 80Z\" fill=\"#c7cfd7\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M87 81L88 81L89 81L90 81L90 82L91 82L92 82L93 82L94 82L95 82L96 82L96 83L97 83L98 83L98 83L99 83L99 84L100 84L101 84L101 85L102 85L102 86L102 86L103 86L104 86L105 86L105 87L106 87L107 87L108 87L109 87L110 87L110 88L111 88L112 88L113 88L114 88L115 88L116 88L116 89L117 89L118 89L118 89L119 89L119 88L120 88L121 88L122 88L122 87L122 87L123 87L124 87L125 87L125 88L126 88L127 88L128 88L129 88L130 88L130 89L131 89L132 89L132 89L133 89L133 90L133 90L132 90L131 90L130 90L129 90L129 89L128 89L127 89L126 89L125 89L124 89L124 88L123 88L122 88L121 88L121 88L120 88L119 88L118 88L118 89L117 89L117 89L116 89L115 89L114 89L113 89L113 88L112 88L111 88L110 88L109 88L108 88L107 88L106 88L106 87L105 87L104 87L103 87L103 87L102 87L102 86L101 86L100 86L100 85L99 85L99 84L99 84L98 84L97 84L96 84L95 84L95 83L94 83L93 83L92 83L91 83L90 83L90 82L89 82L88 82L87 82L87 82L87 81Z\" fill=\"#f3f5f3\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M85 77L86 77L87 77L88 77L88 78L89 78L90 78L91 78L92 78L93 78L94 78L95 78L95 79L96 79L97 79L97 79L98 79L98 80L98 81L98 81L98 82L97 82L97 83L97 83L96 83L95 83L94 83L94 82L93 82L92 82L91 82L90 82L89 82L88 82L87 82L87 81L86 81L85 81L85 81L84 81L84 80L84 80L84 79L85 79L85 78L85 77Z\" fill=\"#444954\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M85 78L86 78L87 78L88 78L88 79L89 79L90 79L91 79L92 79L93 79L94 79L94 80L95 80L96 80L96 80L96 81L96 82L96 82L95 82L94 82L93 82L93 81L92 81L91 81L90 81L89 81L88 81L87 81L87 80L86 80L85 80L85 80L85 79L85 78Z\" fill=\"#7d8795\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M122 83L123 83L124 83L124 84L125 84L126 84L127 84L128 84L129 84L129 85L130 85L131 85L132 85L132 86L133 86L134 86L134 86L134 87L135 87L135 88L135 88L134 88L134 89L134 90L134 90L133 90L132 90L131 90L130 90L130 89L129 89L128 89L127 89L126 89L125 89L125 88L124 88L123 88L122 88L122 88L122 87L121 87L121 86L121 86L121 85L122 85L122 84L122 83Z\" fill=\"#444954\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M122 85L123 85L124 85L125 85L125 86L126 86L127 86L128 86L129 86L130 86L131 86L131 87L132 87L133 87L133 87L133 88L133 88L132 88L131 88L130 88L130 87L129 87L128 87L127 87L126 87L125 87L124 87L124 86L123 86L122 86L122 86L122 85Z\" fill=\"#7d8795\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M85 87L86 87L87 87L87 88L88 88L89 88L90 88L90 89L91 89L91 89L92 89L92 90L92 91L93 91L93 92L94 92L94 93L94 93L93 93L93 94L92 94L91 94L91 95L90 95L90 96L90 96L89 96L89 97L88 97L88 98L87 98L86 98L86 99L86 99L85 99L85 98L84 98L83 98L83 97L82 97L82 96L82 96L82 95L81 95L81 94L81 94L82 94L82 93L82 92L83 92L83 91L83 90L84 90L84 89L84 88L85 88L85 87Z\" fill=\"#a3aeba\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M135 96L135 97L136 97L136 98L136 99L137 99L137 100L137 101L138 101L138 102L138 103L139 103L139 104L139 105L139 105L138 105L138 106L138 107L138 107L137 107L136 107L135 107L134 107L134 107L133 107L133 106L132 106L132 105L131 105L130 105L130 104L129 104L129 103L129 103L128 103L128 102L128 101L127 101L127 100L126 100L126 99L126 99L127 99L127 98L128 98L128 97L129 97L129 96L129 96L130 96L131 96L132 96L133 96L134 96L135 96Z\" fill=\"#a3aeba\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M102 88L103 88L104 88L105 88L105 89L106 89L107 89L108 89L109 89L110 89L110 90L111 90L112 90L113 90L114 90L115 90L116 90L116 91L117 91L118 91L118 91L119 91L119 92L120 92L120 92L120 93L120 94L120 95L120 96L120 97L120 97L119 97L118 97L117 97L117 96L116 96L115 96L114 96L113 96L112 96L112 95L111 95L110 95L109 95L108 95L107 95L107 94L106 94L105 94L104 94L103 94L102 94L102 93L101 93L100 93L100 93L100 92L100 91L100 90L100 89L100 89L101 89L101 88L102 88Z\" fill=\"#b4bec9\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M102 89L103 89L104 89L105 89L106 89L106 90L107 90L108 90L109 90L110 90L111 90L112 90L113 90L114 90L115 90L115 91L116 91L117 91L118 91L118 91L118 92L118 92L117 92L116 92L115 92L115 91L114 91L113 91L112 91L111 91L110 91L110 90L109 90L108 90L107 90L106 90L105 90L104 90L104 89L103 89L102 89L102 89Z\" fill=\"#929daa\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M100 93L101 93L102 93L103 93L103 94L104 94L105 94L106 94L107 94L108 94L108 95L109 95L110 95L111 95L112 95L113 95L113 96L114 96L115 96L116 96L117 96L118 96L118 97L119 97L120 97L120 97L119 97L119 97L118 97L117 97L116 97L116 96L115 96L114 96L113 96L112 96L111 96L110 96L109 96L109 95L108 95L107 95L106 95L105 95L104 95L104 94L103 94L102 94L101 94L101 94L100 94L100 93Z\" fill=\"#e4e8e9\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M97 88L98 88L98 88L98 89L98 89L97 89L97 88L97 88Z\" fill=\"#798390\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M123 92L124 92L124 92L124 93L124 93L123 93L123 93L123 92Z\" fill=\"#798390\"/>\n      <path xmlns=\"http://www.w3.org/2000/svg\" d=\"M107 85L108 85L109 85L110 85L110 86L111 86L112 86L113 86L113 86L113 87L113 88L113 88L112 88L111 88L110 88L109 88L109 87L108 87L107 87L107 87L107 86L107 85Z\" fill=\"#49505b\"/>\n    </g>","sparks":"<g xmlns=\"http://www.w3.org/2000/svg\" transform=\"translate(65 16) scale(1)\">\n        <path d=\"M-1 -6L1 -6L1 -2L2 -2L2 -1L5 -1L5 1L2 1L2 2L1 2L1 6L-1 6L-1 2L-2 2L-2 1L-5 1L-5 -1L-2 -1L-2 -2L-1 -2Z\" fill=\"#dfbc6b\"/>\n      </g>\n      <g xmlns=\"http://www.w3.org/2000/svg\" transform=\"translate(184 57) scale(0.65)\">\n        <path d=\"M-1 -6L1 -6L1 -2L2 -2L2 -1L5 -1L5 1L2 1L2 2L1 2L1 6L-1 6L-1 2L-2 2L-2 1L-5 1L-5 -1L-2 -1L-2 -2L-1 -2Z\" fill=\"#dfbc6b\"/>\n      </g>\n    "};
 const $=id=>svg.querySelector('#'+id);
 const body=$('body-motion'),hands=$('hands-motion'),left=$('left-hand'),right=$('right-hand');
 const stage=body.parentNode;
 const make=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 const overlay=make('g',{'id':'gaming-overlay','pointer-events':'none','shape-rendering':'crispEdges',display:'none'});stage.appendChild(overlay);
 const controller=make('g',{id:'gaming-controller'});overlay.appendChild(controller);
 const front=make('g',{id:'gaming-front'}),rear=make('g',{id:'gaming-rear'});controller.appendChild(front);controller.appendChild(rear);
 front.innerHTML=art.front;rear.innerHTML=art.rear;
 const sparks=make('g',{id:'gaming-sparks'});sparks.innerHTML=art.sparks;overlay.appendChild(sparks);
 const screen=make('g',{id:'gaming-screen',transform:'matrix(1 .18 0 1 48 76)',display:'none'});overlay.appendChild(screen);
 screen.innerHTML=`<path d="M3 0H93V2H96V43H93V45H3V43H0V2H3Z" fill="#234e68" fill-opacity=".20" stroke="#80d6e3" stroke-width=".65" stroke-opacity=".78"/>
 <path d="M4 5H92M4 40H92" fill="none" stroke="#a7edf0" stroke-opacity=".38" stroke-width=".6"/>
 <path d="M5 34H91M15 30H30V27H44M61 30H75V25H88" fill="none" stroke="#9cdee5" stroke-opacity=".65" stroke-width="1"/>
 <g id="game-player" fill="#d4f5ed" opacity=".85"><path d="M0 0H2V-2H3V0H5V-2H6V0H8V7H6V9H2V7H0Z"/><path d="M2 2H3V4H2ZM5 2H6V4H5Z" fill="#336077"/></g>
 <g id="game-obstacle" fill="#8ccee0" opacity=".7"><path d="M0 0H5V9H0ZM-2 4H7V6H-2Z"/></g>
 <g id="game-stars" fill="#e9d28c" opacity=".8"><path d="M32 16H34V14H36V16H38V18H36V20H34V18H32ZM72 12H74V10H76V12H78V14H76V16H74V14H72Z"/></g>
 <path id="game-scan" d="M4 9H92" stroke="#a7edf0" stroke-opacity=".12" stroke-width=".6"/>`;
 const player=$('game-player'),obstacle=$('game-obstacle'),scan=$('game-scan');
 const panicEyes=make('g',{id:'gaming-eyes-panic',display:'none',fill:'#27221f'});body.appendChild(panicEyes);
 const chevron='M89 60H91V61H93V62H95V63H97V64H99V66H97V67H95V68H93V69H91V70H89V68H91V67H93V66H95V64H93V63H91V62H89Z';
 panicEyes.appendChild(make('path',{d:chevron}));panicEyes.appendChild(make('path',{d:chevron,transform:'translate(226 7) scale(-1 1)'}));
 const alarm=make('g',{id:'gaming-alert',display:'none',transform:'translate(178 7)'});overlay.appendChild(alarm);
 alarm.innerHTML='<path d="M3 0H19V2H22V20H19V23H9L3 28V23H2V21H0V3H3Z" fill="#bb9565"/><path d="M3 1H18V3H21V19H18V22H8L4 25V22H3V20H1V4H3Z" fill="#fff3dc"/><path d="M10 5H13V14H10ZM10 17H13V20H10Z" fill="#c05f42"/>';
 const eyeNames=['gaming-eyes-panic','eyes-open','eyes-blink','eyes-busy','eyes-wide','eyes-sneak','eyes-startled','eyes-happy','eyes-headphones'];
 let phase='none',mode='none',start=0,frame=null,lastPose=null,lastTick=-Infinity,closeFrom=null;const reactionStyle='side';
 const paused=false;let disposed=false;ctx.gamingPhase='none';
 const reduced=ctx.reduceMotion;
 const phaseTimes={checking:2500,fetching:480,lifting:650,showing:1000,turning:650,opening:320};
 function status(text){ctx.gamingCaption=text;ctx.gamingPhase=phase;ctx.refreshStatus();}
 function eyes(id,dx=0){for(const name of eyeNames){const e=$(name);if(e)e.setAttribute('display',name===id?'inline':'none');} $('eyes-open').setAttribute('transform',`translate(${dx} 0)`);$('eyes-sneak').setAttribute('transform',`translate(${dx} 0)`);}
 function path(pts){return 'M'+pts.map(p=>p.map(Math.round).join(' ')).join('L')+'Z';}
 // This is the original arm's block construction: fixed width (11,2), depth 11.
 // Only its endpoint moves; no separate hand is introduced.
 function rod(node,hand,end){
  const A=hand==='left'?[158,74]:[70,61],B=[A[0]+11,A[1]+2],D=end,C=[D[0]+11,D[1]+2],depth=11;
  const down=p=>[p[0],p[1]+depth];
  const face=(pts,fill)=>`<path d="${path(pts)}" fill="${fill}"/>`;
  // Explicit side walls preserve the shaded far edge when the right arm angles inward.
  // Paint the top last, so hidden walls cannot cover its lit surface.
  node.innerHTML=face([A,D,down(D),down(A)],'#bc6049')+
   face([B,C,down(C),down(B)],'#bc6049')+
   face([D,C,down(C),down(D)],'#d97757')+
   face([A,B,down(B),down(A)],'#bc6049')+
   face([A,B,C,D],'#e89170');
 }
 const idleLeft=[151,86],idleRight=[65,73],liftLeft=[162,42],playLeft=[128,94],playRight=[79,85];
 const vec=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
 function pose(p){
  lastPose={...p,left:[...p.left],right:[...p.right]};
  if(p.originalRight){right.innerHTML=rig.right.idle;right.setAttribute('clip-path','url(#far-arm-visible)');}
  else{right.removeAttribute('clip-path');rod(right,'right',p.right);}
  left.removeAttribute('clip-path');rod(left,'left',p.left);
  const jump=p.jump||0;
  body.setAttribute('transform',`translate(${p.lean||0} ${jump})`);hands.setAttribute('transform',`translate(0 ${jump})`);overlay.setAttribute('transform',`translate(0 ${jump})`);
  controller.setAttribute('transform',`translate(${p.cx} ${p.cy}) rotate(${p.angle} 0 0) scale(${p.sx??1} 1)`);
  controller.setAttribute('opacity',String(p.opacity??1));
  front.setAttribute('display',p.rear?'none':'inline');rear.setAttribute('display',p.rear?'inline':'none');
  sparks.setAttribute('display',p.spark?'inline':'none');
  eyes(p.eye||'eyes-open',p.eyeX||0);
 }
 // Asset origin is centered; coordinates reproduce the two agreed static poses.
 const lift={cx:146,cy:27,angle:8};
 const playing={cx:110,cy:94,angle:0};
 function snapshot(overrides={}){return {left:idleLeft,right:idleRight,cx:lift.cx,cy:lift.cy,angle:lift.angle,rear:false,originalRight:true,...overrides};}
 function hide(){overlay.removeAttribute('transform');panicEyes.setAttribute('display','none');alarm.setAttribute('display','none');overlay.setAttribute('display','none');screen.setAttribute('display','none');sparks.setAttribute('display','none');}
 function stopGaming(reschedule=true){
  const active=mode==='gaming';cancelAnimationFrame(frame);frame=null;hide();phase='none';mode='none';ctx.gamingPhase='none';closeFrom=lastPose=null;
  if(active){ctx.cancelHand('left');ctx.cancelHand('right');ctx.pose('left','idle');ctx.pose('right','idle');right.setAttribute('clip-path','url(#far-arm-visible)');ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();if(reschedule&&!ctx.disposed){ctx.queueLook();ctx.queueEgg();}}
 }
 function startGaming(){
  if(ctx.disposed||ctx.paused||ctx.isAdjusting?.()||ctx.isClickReacting?.()||ctx.sleepPhase!=='awake'||ctx.wakePhase!=='none'||mode==='gaming'||ctx.held.size||ctx.level)return false;
  ctx.stopEggTimer();ctx.stopHappy(false);ctx.stopCool(false);ctx.stopBubbles(false);ctx.stopMagic(false);ctx.stopLook();clearTimeout(ctx.idleTimer);clearTimeout(ctx.bodyTimer);ctx.stopBreathing();ctx.bounceOffset=0;ctx.cancelHand('left');ctx.cancelHand('right');
  overlay.setAttribute('display','inline');mode='gaming';phase='checking';ctx.gamingPhase=phase;start=performance.now();lastTick=-Infinity;closeFrom=null;tick(start);return true;
 }
 function tryIdleGaming(){if(!ctx.gamingEnabled)return false;if(ctx.idleChoice==null)ctx.idleChoice=Math.random()<.5?'sleep':'gaming';return ctx.idleChoice==='gaming'&&startGaming();}
 function gamingOwnsHands(){return mode==='gaming';}
 function close(){
  if(mode!=='gaming'||phase==='closing')return;
  // Screen vanishes synchronously on the first input. Repeated inputs never restart closing.
  screen.setAttribute('display','none');sparks.setAttribute('display','none');
  closeFrom=lastPose||snapshot();phase='closing';ctx.gamingPhase=phase;start=performance.now();eyes('gaming-eyes-panic');alarm.setAttribute('display','inline');alarm.setAttribute('opacity','1');status('有人来了！快收起来！');
 }
 function tick(now){
  frame=null;if(ctx.disposed||ctx.paused||mode!=='gaming')return;
  if(now-lastTick<30){frame=requestAnimationFrame(tick);return;}lastTick=now;
  let elapsed=now-start;
  const stages=['checking','fetching','lifting','showing','turning','opening'];
  if(phase!=='closing'){
   let at=elapsed;phase='playing';
   for(const name of stages){if(at<phaseTimes[name]){phase=name;elapsed=at;break;}at-=phaseTimes[name];}
   if(phase==='playing')elapsed=at;
  }
  if(phase==='checking'){
   const x=elapsed<350?mix(0,-4,ease(elapsed/350)):elapsed<950?-4:elapsed<1400?mix(-4,4,ease((elapsed-950)/450)):elapsed<2100?4:mix(4,0,ease((elapsed-2100)/400));
   pose(snapshot({opacity:0,left:idleLeft,right:idleRight,eye:elapsed>300&&elapsed<2150?'eyes-sneak':'eyes-open',eyeX:reduced?0:Math.round(x),lean:reduced?0:Math.round(x*.4)}));
   left.innerHTML=rig.left.idle;status('左右看看……没人吧？');
  }else if(phase==='fetching'){
   const f=ease(elapsed/phaseTimes.fetching);
   const down=[155,104];
   pose(snapshot({left:vec(idleLeft,down,f),cx:160,cy:122-f*4,angle:22,opacity:Math.max(0,(f-.75)*4),eye:'eyes-sneak'}));status('偷偷摸出手柄');
  }else if(phase==='lifting'){
   const f=ease(elapsed/phaseTimes.lifting);
   pose(snapshot({left:vec([155,104],liftLeft,f),cx:mix(160,lift.cx,f),cy:mix(118,lift.cy,f),angle:mix(22,lift.angle,f),eye:f>.55?'eyes-happy':'eyes-open'}));status('嘿嘿，终于可以玩了！');
  }else if(phase==='showing'){
   pose(snapshot({left:liftLeft,...lift,eye:'eyes-happy',spark:true}));status('嘿嘿，终于可以玩了！');
  }else if(phase==='turning'){
   const f=ease(elapsed/phaseTimes.turning),flip=f<.5?1-1.75*f:.125+(f-.5)*1.75;
   pose(snapshot({left:vec(liftLeft,playLeft,f),right:vec(idleRight,playRight,f),cx:mix(lift.cx,playing.cx,f),cy:mix(lift.cy,playing.cy,f),angle:mix(lift.angle,0,f),sx:reduced?1:flip,rear:f>=.5,originalRight:false,eye:f<.35?'eyes-happy':'eyes-open'}));status('拿稳手柄……');
  }else if(phase==='opening'||phase==='playing'){
   const t=phase==='playing'?elapsed:0,wiggle=reduced?0:Math.sin(t/610)*.8,lean=reduced?0:Math.sin(t/1250)*.7;
   pose(snapshot({left:[playLeft[0]+wiggle,playLeft[1]],right:[playRight[0]+wiggle,playRight[1]],cx:playing.cx+wiggle,cy:playing.cy,angle:reduced?0:Math.sin(t/850)*.6,rear:true,originalRight:false,lean}));
   screen.setAttribute('display','inline');
   const unfold=phase==='opening'?ease(elapsed/phaseTimes.opening):1;
   screen.setAttribute('opacity',String(unfold));screen.setAttribute('transform',`matrix(${unfold} ${.18*unfold} 0 1 ${48+48*(1-unfold)} 76)`);
   const run=reduced?.2:(t%2400)/2400,jump=Math.max(0,Math.sin(run*Math.PI*2));
   player.setAttribute('transform',`translate(23 ${25-(reduced?0:jump*12)})`);obstacle.setAttribute('transform',`translate(${85-run*75} 25)`);scan.setAttribute('transform',`translate(0 ${reduced?0:(t/140)%28})`);
   status('摸鱼中……只玩一小会儿');
  }else if(phase==='closing'){
   const duration=reduced?320:1450,f=ease(elapsed/duration);
   const hopTime=360;
   const jump=reduced?0:elapsed<hopTime?-8*Math.sin(Math.PI*clamp(elapsed/hopTime)):elapsed<460?.8*Math.sin(Math.PI*(elapsed-hopTime)/100):0;
   const wave=clamp((elapsed-hopTime)/(duration-hopTime));
   const rightEnd=vec(closeFrom.right,idleRight,f),shake=reduced?0:Math.sin(wave*Math.PI*4)*5;
   rightEnd[1]+=shake;
   if(reactionStyle==='side'&&!reduced){
    // Swing a rigid arm OUTSIDE the body, twice, around its existing root.
    const root=[70,61],length=29,angle=-.5*Math.cos(clamp((elapsed-250)/950)*Math.PI*4);
    const raised=[root[0]-length*Math.cos(-.5),root[1]+length*Math.sin(-.5)];
    if(elapsed<250){const out=vec(closeFrom.right,raised,ease(elapsed/250));rightEnd[0]=out[0];rightEnd[1]=out[1];}
    else if(elapsed<=1200){rightEnd[0]=root[0]-length*Math.cos(angle);rightEnd[1]=root[1]+length*Math.sin(angle);}
    else{const back=vec(raised,idleRight,ease((elapsed-1200)/250));rightEnd[0]=back[0];rightEnd[1]=back[1];}
   }
   alarm.setAttribute('display','inline');alarm.setAttribute('opacity',String(1-clamp((elapsed/duration-.82)/.18)));
   const pop=reduced?1:1+.06*Math.sin(Math.PI*clamp(elapsed/130));alarm.setAttribute('transform',`translate(178 7) translate(11 12) scale(${pop}) translate(-11 -12)`);
   screen.setAttribute('display','none');
   pose({...closeFrom,left:vec(closeFrom.left,idleLeft,f),right:rightEnd,originalRight:false,cx:mix(closeFrom.cx,155,f),cy:mix(closeFrom.cy,123,f),angle:mix(closeFrom.angle,48,f),opacity:1-clamp((f-.32)/.5),spark:false,eye:'gaming-eyes-panic',lean:0,jump});
   if(elapsed>=duration){stopGaming();return;}
  }
  frame=requestAnimationFrame(tick);
 }
 ctx.cleanup.push(()=>{disposed=true;cancelAnimationFrame(frame);panicEyes.remove();overlay.remove();});
 return{startGaming,stopGaming,tryIdleGaming,gamingOwnsHands,interruptGaming:close};
};
})(window);


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


/* Five visible accessory tiles; arrows browse without changing the fitting selection. */
(function(global){
 'use strict';
 global.createClawdAccessoryCarousel=function(panel,options={}){
  const viewport=panel?.querySelector('[data-accessory-viewport]');
  const prev=panel?.querySelector('[data-accessory-prev]'),next=panel?.querySelector('[data-accessory-next]');
  if(!viewport||!prev||!next)return {refresh(){},reveal(){},destroy(){}};
  const items=[...viewport.querySelectorAll('label')],visible=5,cleanup=[];
  let step=0,target=null,disposed=false;
  const clamp=i=>Math.max(0,Math.min(Math.max(0,items.length-visible),i));
  function listen(node,name,fn){node.addEventListener(name,fn);cleanup.push(()=>node.removeEventListener(name,fn));}
  function width(){return viewport.clientWidth||viewport.getBoundingClientRect?.().width||0;}
  function setArrow(button,enabled){
   button.disabled=!enabled;button.tabIndex=enabled?0:-1;
   if(!enabled&&document.activeElement===button)viewport.focus?.({preventScroll:true});
  }
  function sync(){
   if(disposed)return;
   const max=Math.max(0,viewport.scrollWidth-width()),x=Math.max(0,viewport.scrollLeft||0);
   setArrow(prev,max>1&&x>1);setArrow(next,max>1&&x<max-1);
   if(target!==null&&Math.abs(x-target*step)<1)target=null;
  }
  function go(index,animate=true){
   if(disposed||!step)return;
   target=clamp(index);const left=target*step;
   if(viewport.scrollTo)viewport.scrollTo({left,behavior:animate&&!options.reduceMotion?'smooth':'auto'});
   else viewport.scrollLeft=left;
   sync();
  }
  function refresh(){
   if(disposed)return;
   const w=width();if(!w){setArrow(prev,false);setArrow(next,false);return;}
   const index=step?Math.round((viewport.scrollLeft||0)/step):0;
   const style=global.getComputedStyle?.(viewport),gap=parseFloat(style?.columnGap||style?.gap)||6;
   step=(w-(visible-1)*gap)/visible+gap;
   go(index,false);
  }
  function reveal(value){
   if(disposed||!width())return;refresh();
   const index=items.findIndex(item=>item.querySelector('input')?.value===value);if(index<0)return;
   const start=clamp(Math.round((viewport.scrollLeft||0)/step));
   if(index<start)go(index,false);else if(index>=start+visible)go(index-visible+1,false);
  }
  listen(prev,'click',()=>go((target??Math.round((viewport.scrollLeft||0)/step))-1));
  listen(next,'click',()=>go((target??Math.round((viewport.scrollLeft||0)/step))+1));
  listen(viewport,'scroll',sync);
  // Native touch/trackpad horizontal scrolling uses CSS snap and the same edge indicators.
  listen(viewport,'pointerdown',()=>target=null);listen(viewport,'wheel',()=>target=null);
  let observer=null;
  if(global.ResizeObserver){observer=new global.ResizeObserver(refresh);observer.observe(viewport);}
  else listen(global,'resize',refresh);
  refresh();
  return {refresh,reveal,getState:()=>({start:step?clamp(Math.round((viewport.scrollLeft||0)/step)):0,count:items.length,canPrev:!prev.disabled,canNext:!next.disabled}),destroy(){if(disposed)return;disposed=true;observer?.disconnect();cleanup.forEach(fn=>fn());}};
 };
})(window);


/* Cowboy fitting: a bright plastic toy pops a rose, then returns to work. */
(function(global){
 'use strict';
 const NS='http://www.w3.org/2000/svg',duration=2700;
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const between=(t,a,b)=>ease((t-a)/(b-a));
 function path(points,close=true){
  const q=points.map(([x,y])=>[Math.round(x),Math.round(y)]);let d=`M${q[0].join(' ')}`;
  for(let i=1;i<q.length+(close?1:0);i++){
   const a=q[(i-1)%q.length],b=q[i%q.length],n=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));let old=a;
   for(let k=1;k<=n;k++){const p=[Math.round(a[0]+(b[0]-a[0])*k/n),Math.round(a[1]+(b[1]-a[1])*k/n)];if(p[0]!==old[0]&&p[1]!==old[1])d+=`H${p[0]}`;d+=`L${p.join(' ')}`;old=p;}
  }return d+(close?'Z':'');
 }
 global.createClawdCowboyAnimation=function(ctx){
  const hat=ctx.svg.querySelector('#cowboy-hat-front');if(!hat)return null;
  const make=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const toy=make('g',{id:'cowboy-toy',display:'none','shape-rendering':'crispEdges','pointer-events':'none'});
  const flower=make('g',{id:'cowboy-rose',display:'none'});
  const keyboard=ctx.svg.querySelector('#keyboard');keyboard.parentNode.insertBefore(toy,keyboard);
  function part(parent,points,fill){const node=make('path',{fill});parent.appendChild(node);return{node,points};}
  const gunParts=[
   part(toy,[[-4,-15],[17,-15],[19,-13],[26,-13],[28,-11],[28,-6],[11,-6],[7,3],[1,4],[-3,2],[-1,-6],[-4,-6]],'#487e92'),
   part(toy,[[6,-8],[13,-8],[13,-3],[11,-1],[6,-1],[5,-3]],'#f3c586'),
   part(toy,[[8,-6],[11,-6],[11,-3],[8,-3]],'#4f7381'),
   part(toy,[[-3,-15],[17,-15],[19,-13],[24,-13],[24,-8],[-3,-8]],'#8dcdd7'),
   part(toy,[[-2,-15],[16,-15],[18,-13],[2,-13],[-2,-12]],'#c6eced'),
   part(toy,[[-1,-8],[6,-8],[4,1],[1,2],[-2,0]],'#f2ab77'),
   part(toy,[[0,-7],[2,-7],[0,0],[-1,-1]],'#ffd3a1'),
   part(toy,[[23,-14],[27,-14],[28,-12],[28,-7],[23,-7]],'#f29b68'),
   part(toy,[[24,-13],[26,-13],[27,-12],[27,-8],[25,-8]],'#ffd09c'),
   part(toy,[[5,-12],[8,-12],[8,-10],[5,-10]],'#fff0c4')
  ];
  toy.appendChild(flower);
  const roseParts=[
   part(flower,[[26,-12],[39,-12],[39,-10],[26,-10]],'#649657'),
   part(flower,[[31,-12],[29,-16],[33,-15],[35,-12]],'#8db66b'),
   part(flower,[[33,-10],[34,-7],[37,-7],[36,-10]],'#7da75f'),
   part(flower,[[36,-15],[38,-17],[42,-17],[44,-15],[46,-15],[47,-12],[46,-9],[44,-7],[40,-6],[37,-8],[35,-11],[35,-14]],'#a74055'),
   part(flower,[[36,-14],[38,-16],[41,-16],[43,-14],[45,-14],[46,-12],[44,-10],[43,-8],[40,-7],[38,-9],[36,-10]],'#de6875'),
   part(flower,[[37,-14],[39,-16],[41,-15],[40,-13],[38,-12],[37,-12]],'#f8a0a3'),
   part(flower,[[40,-14],[43,-14],[44,-12],[42,-10],[40,-10],[39,-12]],'#b7455f'),
   part(flower,[[40,-13],[42,-13],[42,-11],[40,-11]],'#f58f98')
  ];
  const armSource=make('g');armSource.innerHTML=ctx.rig.left.idle;
  const faces=[...armSource.querySelectorAll('path')].map(n=>({fill:n.getAttribute('fill'),points:[...n.getAttribute('d').matchAll(/[ML]\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g)].map(m=>[+m[1],+m[2]])}));
  let active=false,armParent=null,armNext=null;
  const poses=[[0,156.5,87],[120,156.5,87],[350,174,96],[650,178,64],[850,178,61],[1660,178,61],[2110,178,61],[2450,174,96],[2640,156.5,87],[2700,156.5,87]];
  function arm(x,y){
   const origin=[163.5,75],u=[-7,12],len=Math.hypot(...u),base=[u[0]/len,u[1]/len],v=[x-origin[0],y-origin[1]],size=Math.hypot(...v),axis=v.map(n=>n/size);
   const projected=faces.map(face=>{const points=face.points.map(([px,py])=>{const dx=px-origin[0],dy=py-origin[1],along=(dx*base[0]+dy*base[1])*size/len,across=-dx*base[1]+dy*base[0];return[origin[0]+axis[0]*along-axis[1]*across,origin[1]+axis[1]*along+axis[0]*across];});return`<path fill="${face.fill}" d="${path(points)}"/>`;}).join('');
   ctx.left.innerHTML='<g id="paw-left-motion">'+projected+'</g>';
  }
  function paint(ms){
   if(!active){armParent=ctx.left.parentNode;armNext=ctx.left.nextSibling;toy.parentNode.insertBefore(ctx.left,toy);}
   active=true;ctx.cowboyPhase=ms<350?'fetching':ms<850?'lifting':ms<1060?'aiming':ms<1430?'blooming':ms<1850?'proud':ms<2110?'retracting':'stowing';
   ctx.headphoneEyes=ms>=1100&&ms<1850?ctx.happyEyes:ctx.openEyes;
   let i=0;while(i<poses.length-2&&ms>poses[i+1][0])i++;
   const a=poses[i],b=poses[i+1],f=between(ms,a[0],b[0]);let x=a[1]+(b[1]-a[1])*f,y=a[2]+(b[2]-a[2])*f;
   const kick=ctx.reduceMotion?0:Math.sin(Math.PI*between(ms,1040,1220));
   x-=1.8*kick;y+=.5*kick;
   if(ctx.reduceMotion){x=ms>=350&&ms<2450?178:156.5;y=ms>=350&&ms<2450?61:87;}
   arm(x,y);ctx.root.dataset.left='cowboy';
   const show=ms>=350&&ms<(ctx.reduceMotion?2450:2530);toy.setAttribute('display',show?'inline':'none');
   if(show){
    const angle=Math.atan2(y-75,x-163.5)+(28-4*kick)*Math.PI/180;
    const project=points=>points.map(([px,py])=>[x+px*Math.cos(angle)-py*Math.sin(angle),y+px*Math.sin(angle)+py*Math.cos(angle)]);
    gunParts.forEach(p=>p.node.setAttribute('d',path(project(p.points))));
    const pop=ctx.reduceMotion?(ms>=1100&&ms<1850?1:0):(between(ms,1060,1250)+.16*Math.sin(Math.PI*between(ms,1170,1430)))*(1-between(ms,1850,2110));
    flower.setAttribute('display',pop>0?'inline':'none');
    roseParts.forEach(p=>p.node.setAttribute('d',path(project(p.points.map(([px,py])=>[26+(px-26)*pop,-11+(py+11)*(.6+.4*pop)])))));
   }
   const tilt=ctx.reduceMotion?0:1.1*Math.sin(Math.PI*between(ms,1220,1720));
   hat.setAttribute('transform',`rotate(${tilt.toFixed(3)} 123 37)`);
  }

  function reset(){
   toy.setAttribute('display','none');flower.setAttribute('display','none');hat.removeAttribute('transform');ctx.cowboyPhase='none';
   if(active){armParent.insertBefore(ctx.left,armNext?.parentNode===armParent?armNext:null);ctx.pose('left','idle');active=false;armParent=armNext=null;}
  }
  ctx.cleanup.push(()=>toy.remove());
  return {duration,paint,reset};
 };
})(window);


/* Detective fitting: inspect the keys, then magnify one eye. */
(function(global){
 'use strict';
 const NS='http://www.w3.org/2000/svg',duration=4400;
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const between=(t,a,b)=>ease((t-a)/(b-a));
 function path(points,close=true){
  const q=points.map(([x,y])=>[Math.round(x),Math.round(y)]);let d=`M${q[0].join(' ')}`;
  for(let i=1;i<q.length+(close?1:0);i++){
   const a=q[(i-1)%q.length],b=q[i%q.length],n=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));let old=a;
   for(let k=1;k<=n;k++){const p=[Math.round(a[0]+(b[0]-a[0])*k/n),Math.round(a[1]+(b[1]-a[1])*k/n)];if(p[0]!==old[0]&&p[1]!==old[1])d+=`H${p[0]}`;d+=`L${p.join(' ')}`;old=p;}
  }return d+(close?'Z':'');
 }
 global.createClawdDetectiveAnimation=function(ctx){
  const hat=ctx.svg.querySelector('#detective-hat-front');if(!hat)return null;
  const make=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const glass=make('g',{id:'detective-magnifier',display:'none','shape-rendering':'crispEdges','pointer-events':'none'});
  const keyboard=ctx.svg.querySelector('#keyboard');keyboard.parentNode.insertBefore(glass,keyboard);
  const handle=make('path',{fill:'#514267'}),handleFront=make('path',{fill:'#8470ac'});
  const backing=make('path',{fill:'#d97757',opacity:'0'}),tint=make('path',{fill:'#b6e2e8',opacity:'.18'});
  const bigEye=make('path',{fill:'#27221f',opacity:'0'}),rim=make('path',{fill:'#66527f','fill-rule':'evenodd'}),shine=make('path',{fill:'none',stroke:'#cfbedf','stroke-width':'1',opacity:'.8'});
  [handle,handleFront,backing,tint,bigEye,rim,shine].forEach(n=>glass.appendChild(n));
  const detectiveEyes=make('g',{id:'eyes-detective',display:'none',fill:'#27221f'}),leftEye=make('path'),rightEye=make('path',{d:'M130 65H135V78H130Z'});
  detectiveEyes.appendChild(leftEye);detectiveEyes.appendChild(rightEye);ctx.body.appendChild(detectiveEyes);
  const circle=(r,cy=-20)=>Array.from({length:65},(_,i)=>{const t=i/64*Math.PI*2;return[Math.cos(t)*r,cy+Math.sin(t)*r];});
  let active=false,armParent=null,armNext=null;
  const poses=[[0,156.5,87,48],[160,156.5,87,48],[440,174,96,48],[720,155,101,-18],[1100,167,100,8],[1470,155,101,-18],[2040,140.6,89.8,-24],[3100,140.6,89.8,-24],[3660,174,96,48],[3940,156.5,87,48],[4000,156.5,87,48]];
  function arm(x,y){
   const a=[158,74],b=[169,76],d=[x-5.5,y-1],c=[x+5.5,y+1],lower=p=>[p[0],p[1]+11];
   const faces=[[[a,b,lower(b),lower(a)],'#bc6049'],[[b,c,lower(c),lower(b)],'#bc6049'],[[d,a,lower(a),lower(d)],'#bc6049'],[[a,b,c,d],'#e89170'],[[d,c,lower(c),lower(d)],'#d97757']];
   ctx.left.innerHTML='<g id="paw-left-motion">'+faces.map(([points,fill])=>`<path fill="${fill}" d="${path(points)}"/>`).join('')+'</g>';
  }
  function paint(ms){
   // Spend 1150ms on the 750ms keyboard sweep; later beats keep their pacing.
   if(ms>720)ms=ms<1870?720+(ms-720)*750/1150:ms-400;
   if(!active){armParent=ctx.left.parentNode;armNext=ctx.left.nextSibling;glass.parentNode.insertBefore(ctx.left,glass);}
   active=true;ctx.detectivePhase=ms<440?'fetching':ms<1470?'inspecting':ms<2040?'lifting':ms<3100?'magnifying':'stowing';
   ctx.headphoneEyes=detectiveEyes;
   const focus=ctx.reduceMotion?(ms>=2040&&ms<3100?1:0):between(ms,1880,2040)*(1-between(ms,3100,3290));
   const wink=ms>=1940&&ms<3240;
   leftEye.setAttribute('d',wink?'M89 64L98 66V69L89 67Z':'M91 58H96V71H91Z');
   detectiveEyes.setAttribute('transform',`translate(0 ${ms>=600&&ms<1550?2:0})`);
   let i=0;while(i<poses.length-2&&ms>poses[i+1][0])i++;
   const a=poses[i],b=poses[i+1],f=between(ms,a[0],b[0]);let x=a[1]+(b[1]-a[1])*f,y=a[2]+(b[2]-a[2])*f,angle=a[3]+(b[3]-a[3])*f;
   if(ctx.reduceMotion){const held=ms>=440&&ms<3660;x=held?140.6:156.5;y=held?89.8:87;angle=held?-24:48;}
   arm(x,y);ctx.root.dataset.left='detective';
   const show=ms>=440&&ms<3780;glass.setAttribute('display',show?'inline':'none');
   if(show){
    const rad=angle*Math.PI/180,project=points=>points.map(([px,py])=>[x+px*Math.cos(rad)-py*Math.sin(rad),y+px*Math.sin(rad)+py*Math.cos(rad)]);
    const center=project([[0,-20]])[0],outer=project(circle(14)),inner=project(circle(11.3));
    handle.setAttribute('d',path(project([[-3,-9],[3,-9],[4,4],[-3,4]])));
    handleFront.setAttribute('d',path(project([[-2,-8],[1,-8],[2,3],[-2,3]])));
    rim.setAttribute('d',path(outer)+path(inner));
    backing.setAttribute('d',path(inner));backing.setAttribute('opacity',String(focus));
    tint.setAttribute('d',path(inner));
    const w=5+4*focus,h=13+6*focus;
    bigEye.setAttribute('d',path([[center[0]-w/2,center[1]-h/2],[center[0]+w/2,center[1]-h/2],[center[0]+w/2,center[1]+h/2],[center[0]-w/2,center[1]+h/2]]));bigEye.setAttribute('opacity',String(focus));
    shine.setAttribute('d',path(outer.slice(34,47),false));
   }
   const tilt=ctx.reduceMotion?0:1.1*Math.sin(Math.PI*between(ms,600,1470));hat.setAttribute('transform',`rotate(${tilt.toFixed(3)} 123 37)`);
  }
  function reset(){
   glass.setAttribute('display','none');detectiveEyes.setAttribute('display','none');detectiveEyes.removeAttribute('transform');hat.removeAttribute('transform');ctx.detectivePhase='none';
   if(active){armParent.insertBefore(ctx.left,armNext?.parentNode===armParent?armNext:null);ctx.pose('left','idle');active=false;armParent=armNext=null;}
  }
  ctx.cleanup.push(()=>{glass.remove();detectiveEyes.remove();});
  return{duration,paint,reset};
 };
})(window);


/* Persistent head accessory and its exclusive, cancellable fitting preview. */
(function(global){
  'use strict';
  const modules=global.ClawdModules||(global.ClawdModules={});
  const duration=1200;
  const beats=[[0,0],[100,0],[270,1],[480,0],[620,0],[790,1],[1030,0],[1200,0]];
  function sample(ms){
    let i=0;while(i<beats.length-2&&ms>beats[i+1][0])i++;
    const a=beats[i],b=beats[i+1],t=Math.max(0,Math.min(1,(ms-a[0])/(b[0]-a[0]))),f=t*t*(3-2*t);
    return a[1]+(b[1]-a[1])*f;
  }
  global.ClawdHeadphonesTimeline={duration,sample};
  modules.headphones=function(ctx){
    const rear=ctx.svg.querySelector('#headphones-rear'),front=ctx.svg.querySelector('#headphones-front');
    const eyes=ctx.svg.querySelector('#eyes-headphones'),notes=ctx.svg.querySelector('#headphones-notes');
    const noteNodes=notes?[...notes.children]:[];
    const variants={headphones:{rear,front,eyes,name:'天蓝耳机'},'cat-headphones':{
      rear:ctx.svg.querySelector('#cat-headphones-rear'),front:ctx.svg.querySelector('#cat-headphones-front'),eyes:ctx.happyEyes,name:'猫耳耳机'},
      sprout:{front:ctx.svg.querySelector('#sprout-front'),eyes:ctx.openEyes,name:'小苗',duration:1500},
      'cowboy-hat':{front:ctx.svg.querySelector('#cowboy-hat-front'),eyes:ctx.openEyes,name:'牛仔帽',duration:2700},
      'detective-hat':{front:ctx.svg.querySelector('#detective-hat-front'),eyes:ctx.openEyes,name:'侦探帽',duration:4400},
      duck:{front:ctx.svg.querySelector('#duck-front'),eyes:ctx.openEyes,name:'小黄鸭',duration:1300}};
    const sproutMotion=ctx.svg.querySelector('#sprout-motion');
    const duckMotion=ctx.svg.querySelector('#duck-motion'),duckContact=ctx.svg.querySelector('#duck-contact');
    const leaves=['left','right'].map(side=>ctx.svg.querySelector('#sprout-'+side+'-leaf'));
    const cowboy=global.createClawdCowboyAnimation?.(ctx);
    const detective=global.createClawdDetectiveAnimation?.(ctx);
    const panel=ctx.root.querySelector('[data-accessory-menu]');
    const opener=ctx.root.querySelector('[data-accessory-open]');
    const carousel=global.createClawdAccessoryCarousel?.(panel,{reduceMotion:ctx.reduceMotion});
    if(carousel)ctx.cleanup.push(()=>carousel.destroy());
    let frame=null,started=0,committed='none',draft='none',confirmedSpeech=null;
    ctx.menuOpen=false;ctx.accessoryPreview=false;ctx.accessoryPulse=0;ctx.headphoneEyes=eyes;
    function isAdjusting(){return ctx.paused||ctx.menuOpen||ctx.accessoryPreview;}
    function wear(value){
      Object.entries(variants).forEach(([id,v])=>[v.rear,v.front].filter(Boolean).forEach(n=>n.setAttribute('display',id===value?'inline':'none')));
      ctx.headphoneEyes=variants[value]?.eyes||eyes;
      ctx.accessoryExpression=['sprout','duck','cowboy-hat','detective-hat'].includes(value)?value:'headphones';
      ctx.accessoryCaption=value==='detective-hat'?'发现线索了。':value==='cowboy-hat'?'老板，来杯牛奶。':value==='duck'?'坐稳啦':value==='sprout'?'啵，长高一点点':'跟着节奏敲~';
      const colors=value==='cat-headphones'?['#d98eaf','#edabc7','#c5a56b']:['#5598bd','#82c5e6','#c5a56b'];
      noteNodes.forEach((n,i)=>n.querySelector('path')?.setAttribute('fill',colors[i]));
      ctx.root.dataset.accessory=value;
    }
    function resetSprout(){
      [sproutMotion,...leaves].filter(Boolean).forEach(n=>n.removeAttribute('transform'));
      ctx.sproutPhase='none';
    }
    function resetDuck(){
      [duckMotion,duckContact].filter(Boolean).forEach(n=>{n.removeAttribute('transform');n.removeAttribute('opacity');});
      ctx.duckPhase='none';
    }
    const ease=(ms,a,b)=>{const t=Math.max(0,Math.min(1,(ms-a)/(b-a)));return t*t*(3-2*t);};
    const sproutPoses=[[0,1,1,0],[100,1.03,.92,-1],[280,1.06,1.2,4],
      [480,1.015,1.1,-1.5],[700,1.015,1.1,0],[850,1.015,1.1,0],
      [1250,1,1,0],[1500,1,1,0]];
    function paintSprout(ms){
      ctx.headphoneEyes=ms>=180&&ms<1300?ctx.happyEyes:ctx.openEyes;
      ctx.sproutPhase=ms<480?'growing':ms<1250?'smiling':'settling';
      let i=0;while(i<sproutPoses.length-2&&ms>sproutPoses[i+1][0])i++;
      const a=sproutPoses[i],b=sproutPoses[i+1],t=ease(ms,a[0],b[0]);
      const pose=a.slice(1).map((value,j)=>value+(b[j+1]-value)*t);
      const [sx,sy,angle]=ctx.reduceMotion?[1,1,0]:pose;
      sproutMotion.setAttribute('transform',`translate(123 35) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-123 -35)`);
      leaves.forEach((n,j)=>n.setAttribute('transform',`rotate(${((j===0?-1:1)*angle).toFixed(3)} ${j===0?124:125} 23)`));
    }
    const duckPoses=[[0,-7,1,1,-5],[100,-5,1,1,-3],[280,0,1.1,.86,0],
      [430,-2,.98,1.06,2],[620,0,1,1,0],[1300,0,1,1,0]];
    function paintDuck(ms){
      ctx.headphoneEyes=ms>=240&&ms<1100?ctx.happyEyes:ctx.openEyes;
      ctx.duckPhase=ms<280?'landing':ms<620?'bouncing':'smiling';
      let i=0;while(i<duckPoses.length-2&&ms>duckPoses[i+1][0])i++;
      const a=duckPoses[i],b=duckPoses[i+1],t=ease(ms,a[0],b[0]);
      const pose=a.slice(1).map((value,j)=>value+(b[j+1]-value)*t);
      const [y,sx,sy,angle]=ctx.reduceMotion?[0,1,1,0]:pose;
      duckMotion.setAttribute('transform',`translate(0 ${y.toFixed(3)}) translate(123 34) rotate(${angle.toFixed(3)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-123 -34)`);
      duckContact.setAttribute('opacity',ctx.reduceMotion?'1':(.2+.8*ease(ms,100,280)).toFixed(4));
    }
    function syncMenu(){
      if(panel)panel.hidden=!ctx.menuOpen;
      if(opener)opener.setAttribute('aria-expanded',String(ctx.menuOpen));
      const area=ctx.root.querySelector('.input-area');if(area)area.inert=isAdjusting();
      ctx.root.querySelectorAll('[name="clawd-accessory"]').forEach(n=>{n.checked=n.value===draft;});
      const summary=ctx.root.querySelector('[data-accessory-summary]');
      if(summary)summary.textContent=(ctx.menuOpen?'调整中 · ':'')+(variants[draft]?.name||'不戴装饰');
    }
    function resumeWork(){
      if(ctx.disposed||isAdjusting())return;
      ctx.idleSince=performance.now();ctx.lookCount=0;ctx.queueLook();ctx.queueEgg();
      if(!ctx.reduceMotion)ctx.scheduleBlink();
      ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();syncMenu();
    }
    function stopAccessoryPreview(resume=true){
      confirmedSpeech=null;
      cancelAnimationFrame(frame);frame=null;ctx.accessoryPreview=false;ctx.accessoryPulse=0;
      resetSprout();
      resetDuck();
      cowboy?.reset();detective?.reset();
      if(notes){notes.setAttribute('display','none');noteNodes.forEach(n=>{n.setAttribute('display','none');n.removeAttribute('transform');n.removeAttribute('opacity');});}
      if(eyes)eyes.setAttribute('display','none');
      ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();syncMenu();
      if(resume)resumeWork();
    }
    function announceConfirmation(speech){
      if(speech&&!ctx.disposed&&!ctx.paused&&!ctx.menuOpen&&!ctx.accessoryPreview&&committed===speech.id)
        ctx.onAccessoryConfirmed?.(speech.text);
    }
    function paint(now){
      const elapsed=now-started;
      if(draft==='detective-hat'&&detective){
        ctx.accessoryPulse=0;detective.paint(elapsed);notes.setAttribute('display','none');
        ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();return;
      }
      if(draft==='cowboy-hat'&&cowboy){
        ctx.accessoryPulse=0;cowboy.paint(elapsed);notes.setAttribute('display','none');
        ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();return;
      }
      if(draft==='sprout'||draft==='duck'){
        ctx.accessoryPulse=0;
        if(draft==='duck')paintDuck(elapsed);else paintSprout(elapsed);
        notes.setAttribute('display','none');ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();return;
      }
      ctx.accessoryPulse=ctx.reduceMotion?0:sample(elapsed);
      ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();
      notes.setAttribute('display','inline');
      noteNodes.forEach((n,i)=>{
        const age=elapsed-[240,760,870][i],life=ctx.reduceMotion?220:420;
        const visible=age>=0&&age<life;n.setAttribute('display',visible?'inline':'none');
        if(!visible)return;
        const t=age/life,x=[64,176,56][i],y=[33,38,49][i];
        n.setAttribute('transform',`translate(${x+(ctx.reduceMotion?0:Math.round((i===1?3:-3)*t))} ${y-(ctx.reduceMotion?0:Math.round(7*t))})`);
        n.setAttribute('opacity',String(ctx.reduceMotion?.8:Math.min(1,t*6,(1-t)*4)));
      });
    }
    function startAccessoryPreview(){
      const v=variants[draft];
      if(!ctx.menuOpen||!v?.front||!v?.eyes||!notes||ctx.disposed)return false;
      stopAccessoryPreview(false);ctx.accessoryPreview=true;started=performance.now();
      function tick(now){
        frame=null;if(ctx.disposed||!ctx.accessoryPreview)return;
        if(now-started>=(v.duration||duration)){
          const speech=confirmedSpeech;stopAccessoryPreview();announceConfirmation(speech);return;
        }
        paint(now);frame=requestAnimationFrame(tick);
      }
      paint(started);frame=requestAnimationFrame(tick);return true;
    }
    function openAccessoryMenu(){
      if(ctx.disposed||ctx.menuOpen)return false;
      ctx.menuOpen=true;ctx.clearAll();
      clearTimeout(ctx.blinkTimer);clearTimeout(ctx.blinkEnd);ctx.blinkTimer=ctx.blinkEnd=null;ctx.blinking=false;
      draft=committed;wear(draft);syncMenu();ctx.refreshEyes();ctx.renderBody();ctx.refreshStatus();
      carousel?.refresh();carousel?.reveal(draft);
      ctx.root.querySelector('[name="clawd-accessory"]:checked')?.focus({preventScroll:true});return true;
    }
    function selectAccessory(value){
      if(!ctx.menuOpen||!(value==='none'||Object.hasOwn(variants,value))||ctx.disposed)return false;
      stopAccessoryPreview(false);draft=value;wear(draft);syncMenu();carousel?.reveal(draft);
      if(variants[value])startAccessoryPreview();return true;
    }
    function closeAccessoryMenu(confirm=true){
      if(!ctx.menuOpen||ctx.disposed)return false;
      if(confirm){
        committed=draft;
        confirmedSpeech=variants[draft]?{id:draft,text:ctx.accessoryCaption}:null;
        if(ctx.accessoryStorage)try{global.localStorage?.setItem('clawd-lab-accessory',committed);}catch{}
      }
      else {stopAccessoryPreview(false);draft=committed;wear(draft);}
      ctx.menuOpen=false;syncMenu();opener?.focus({preventScroll:true});
      // A confirmed preview may finish; regular behavior resumes only afterward.
      if(!ctx.accessoryPreview){
        const speech=confirmedSpeech;confirmedSpeech=null;resumeWork();announceConfirmation(speech);
      }else ctx.refreshStatus();return true;
    }
    function bindAccessories(){
      if(!panel||!opener)return;
      ctx.listen(opener,'click',openAccessoryMenu);
      ctx.root.querySelectorAll('[name="clawd-accessory"]').forEach(n=>ctx.listen(n,'change',()=>{if(n.checked)selectAccessory(n.value);}));
      ctx.listen(ctx.root.querySelector('[data-accessory-confirm]'),'click',()=>closeAccessoryMenu(true));
      ctx.listen(ctx.root.querySelector('[data-accessory-cancel]'),'click',()=>closeAccessoryMenu(false));
      ctx.listen(panel,'keydown',e=>{
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeAccessoryMenu(false);}
        if(e.key==='Tab'){
          const items=[...panel.querySelectorAll('input,button')],first=items[0],last=items[items.length-1];
          if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
        }
      });
    }
    if(ctx.accessoryStorage)try{const stored=global.localStorage?.getItem('clawd-lab-accessory');if(Object.hasOwn(variants,stored))committed=draft=stored;}catch{}
    function restoreAccessory(value){
      if(ctx.menuOpen||ctx.accessoryPreview||!(value==='none'||Object.hasOwn(variants,value)))return false;
      committed=draft=value;wear(value);syncMenu();ctx.refreshEyes();return true;
    }
    wear(draft);syncMenu();
    return {isAdjusting,stopAccessoryPreview,startAccessoryPreview,openAccessoryMenu,selectAccessory,closeAccessoryMenu,restoreAccessory,bindAccessories,
      accessoryState:()=>({selected:committed,draft,menuOpen:ctx.menuOpen,preview:ctx.accessoryPreview,pulse:ctx.accessoryPulse,phase:(draft==='detective-hat'?ctx.detectivePhase:draft==='cowboy-hat'?ctx.cowboyPhase:draft==='duck'?ctx.duckPhase:ctx.sproutPhase)||'none'})};
  };
})(window);


/* Clawd controller: instance setup, public API and lifecycle. */
(function (global) {
  'use strict';
  function createClawdController(root, rig, options={}) {
    const svg = root.querySelector('#clawd-scene');
    const ctx = {
      root, rig, svg,paused:false,breathingEnabled:options.breathingEnabled===true,accessoryStorage:options.accessoryStorage!==false,coolEnabled:options.sunglassesEnabled===true,happyEnabled:options.happyEnabled===true,bubblesEnabled:options.bubblesEnabled===true,magicEnabled:options.magicEnabled===true,gamingEnabled:options.gamingEnabled===true,idleChoice:null,
      sleepEnabled:options.sleepEnabled!==false,sleepDelayMs:90000,idleSince:performance.now(),
      onAccessoryConfirmed:typeof options.onAccessoryConfirmed==='function'?options.onAccessoryConfirmed:null,
      zone:root.querySelector('[data-mouse-zone]'),
      status:root.querySelector('[data-status]'), lastKey:root.querySelector('[data-last-key]'),
      lookup:new Map(rig.keys.map(k=>[k.code,k])),
      mouseButtons:new Set(),lastLeftStroke:-Infinity,active:new Set(), held:new Set(), started:new Map(), releaseTimers:new Map(),
      handTimers:{left:[],right:[]}, cleanup:[],
      wakePhase:'none',wakeStart:0,wakeClock:0,wakeTimer:null,wakeX:0,wakeY:0,wakeEyeX:0,wakeNextTap:0,wakeHand:0,
      sleepArmFrame:-1,sleepPhase:'awake',sleepStart:0,sleepClock:0,sleepTimer:null,
      lastBounce:-Infinity, idleTimer:null, lookTimer:null, looking:false,
      lookStart:0, lookCount:0, lookLimit:1, lookX:0, lookY:0, eyeX:0, eyeY:0, squint:false,
      lookFrames:[
        [0,0,0,0,0],[180,-3,0,0,0],[420,-4,-1,-2,-1],[900,-4,-1,-2,-1],
        [1200,3,0,0,0],[1500,4,-1,2,-2],[2050,4,-1,2,-2],[2400,0,0,0,0],[2700,0,0,0,0]
      ],
      activityTimer:null, particleFrame:null, hits:[], particles:[], level:0, rate:0,
      recoveryUntil:0,recoveryStart:0,lastStroke:-Infinity,enteringUntil:0,
      nextSurge:Infinity,surgeUntil:0,blinking:false,bounceOffset:0,nextDrop:0,dropSide:1,
      modifier:/^(Shift|Control|Alt|Meta)|^ContextMenu$/,
      bodyTimer:null,mouseTimer:null,blinkTimer:null,blinkEnd:null,demoTimer:null,demoFrame:null,
      alternateSpace:false,disposed:false,mouseMode:false,lastMouse:null,mouseX:0,mouseY:0,
      reduceMotion:global.matchMedia('(prefers-reduced-motion: reduce)').matches
    };
    const nodes = {
      left:'left-hand',right:'right-hand',body:'body-motion',hands:'hands-motion',mouse:'mouse-motion',
      openEyes:'eyes-open',blinkEyes:'eyes-blink',busyEyes:'eyes-busy',wideEyes:'eyes-wide',
      startledEyes:'eyes-startled',wakeBubble:'wake-bubble',sneakEyes:'eyes-sneak',sweat:'sweat-particles',sleepSymbols:'sleep-symbols',armClip:'far-arm-visible',raisedClip:'raised-arms-visible'
    };
    for (const [name,id] of Object.entries(nodes)) ctx[name]=svg.querySelector('#'+id);
    for (const name of ['renderer','behavior','sleep','wake','input','demo','cool','happy','bubbles','magic','gaming','eggs','headphones']) {
      if (!global.ClawdModules?.[name]) throw new Error('Missing Clawd module: '+name);
      Object.assign(ctx,global.ClawdModules[name](ctx));
    }
    function clearAll(options={}) {
      ctx.clearing=true;ctx.stopBreathing();
      ctx.stopGaming(false);ctx.stopMagic(false);ctx.stopBubbles(false);ctx.stopAccessoryPreview?.(false);
      ctx.stopEggTimer();ctx.stopHappy(false);
      if(!options.preserveSunglasses)ctx.stopCool(false);
      clearTimeout(ctx.idleTimer);ctx.stopWake();ctx.stopSleep();ctx.stopLook();
      clearTimeout(ctx.demoTimer);
      cancelAnimationFrame(ctx.demoFrame);
      clearTimeout(ctx.bodyTimer);
      ctx.lastBounce = -Infinity;
      for (const t of ctx.releaseTimers.values()) clearTimeout(t);
      ctx.mouseButtons.clear();ctx.lastLeftStroke=-Infinity;
      ctx.releaseTimers.clear(); ctx.active.clear(); ctx.held.clear(); ctx.started.clear();
      ctx.svg.querySelectorAll('.is-down,.is-clicked').forEach(el => el.classList.remove('is-down', 'is-clicked'));
      ctx.cancelHand('left'); ctx.cancelHand('right');
      ctx.stopMouse(); ctx.pose('left', 'idle'); ctx.pose('right', 'idle');
      ctx.bounceOffset=0; ctx.resetActivity();
      ctx.body.removeAttribute('transform'); ctx.hands.removeAttribute('transform');
      ctx.refreshStatus();ctx.setStatus('工作中', 'idle');ctx.clearing=false;
    }
    function configure(prefs={}) {
      if(typeof prefs.breathingEnabled==='boolean')ctx.breathingEnabled=prefs.breathingEnabled;
      ctx.renderBody();
      if(typeof prefs.sleepEnabled==='boolean')ctx.sleepEnabled=prefs.sleepEnabled;
      if(Number.isFinite(prefs.sleepSeconds))ctx.sleepDelayMs=Math.max(30,Math.min(3600,prefs.sleepSeconds))*1000;
      clearTimeout(ctx.idleTimer);
      if(!ctx.sleepEnabled&&ctx.sleepPhase!=='awake'){ctx.stopSleep();ctx.refreshStatus();}
      ctx.queueLook();
    }
    ctx.clearAll=clearAll;
    function setPaused(value){
      if(ctx.disposed||ctx.paused===!!value)return;
      ctx.paused=!!value;
      if(ctx.paused){
        clearAll();clearTimeout(ctx.blinkTimer);clearTimeout(ctx.blinkEnd);
        ctx.blinkTimer=ctx.blinkEnd=null;ctx.blinking=false;ctx.refreshEyes();
      }else if(!ctx.isAdjusting()){
        ctx.idleSince=performance.now();ctx.lookCount=0;ctx.queueLook();ctx.queueEgg();ctx.renderBody();
        if(!ctx.reduceMotion)ctx.scheduleBlink();
      }
      ctx.refreshStatus();
    }
    for(const name of ['startCool','startHappy','startDream','startLook','startSleep','startWake','startBubbles','startMagic','startGaming']){
      const fn=ctx[name];ctx[name]=(...args)=>ctx.isAdjusting()?false:fn(...args);
    }
    configure(options);
    ctx.queueEgg();
    if(options.bindInput!==false)ctx.bindInput();
    if(options.bindDemo!==false){ctx.bindDemo();ctx.bindAccessories();}
    ctx.lookLimit=1+Math.floor(Math.random()*2); ctx.queueLook();
    if (!ctx.reduceMotion) ctx.scheduleBlink();
    return {
      press:ctx.press, release:ctx.release, tap:ctx.tap, moveMouse:ctx.moveMouse,mouseButton:ctx.mouseButton,stopMouse:ctx.stopMouse,
      openAccessoryMenu:ctx.openAccessoryMenu,selectAccessory:ctx.selectAccessory,closeAccessoryMenu:ctx.closeAccessoryMenu,restoreAccessory:ctx.restoreAccessory,setPaused,
      clearAll,configure,resumeIdle:()=>{ctx.idleSince=performance.now();ctx.lookCount=0;ctx.queueLook();ctx.queueEgg();ctx.renderBody();}, showSunglasses:ctx.startCool,showHappy:ctx.startHappy,showDream:ctx.startDream,showBubbles:ctx.startBubbles,showMagic:ctx.startMagic,showGaming:ctx.startGaming, lookAround:ctx.startLook, sleep:ctx.startSleep, wake:ctx.startWake,
      getState:()=>({
        gaming:ctx.gamingPhase,paused:ctx.paused,breathingEnabled:ctx.breathingEnabled,accessory:ctx.accessoryState(),bubbles:ctx.bubblesPhase,magic:ctx.magicPhase,magicFlat:ctx.magicOwnsHands(),happy:ctx.happyPhase,happyMode:ctx.happyMode,bubbleMotif:ctx.happyMotif,cool:ctx.coolPhase,coolClock:ctx.coolClock,coolLeftOwned:ctx.coolOwnsLeft(),keys:[...ctx.active],left:root.dataset.left||'idle',right:root.dataset.right||'idle',
        sleepEnabled:ctx.sleepEnabled,sleepSeconds:ctx.sleepDelayMs/1000,
        wake:ctx.wakePhase,wakeClock:ctx.wakeClock,sleep:ctx.sleepPhase,sleepArmFrame:ctx.sleepArmFrame,mouse:ctx.mouseMode,looking:ctx.looking,idleLooks:ctx.lookCount,idleLookLimit:ctx.lookLimit,
        busy:ctx.level,recovering:performance.now()<ctx.recoveryUntil,rate:ctx.rate,
        expression:root.dataset.expression||'open',particles:ctx.particles.length
      }),
      destroy() {
        ctx.disposed=true;clearAll();
        clearTimeout(ctx.blinkTimer);clearTimeout(ctx.blinkEnd);
        ctx.cleanup.forEach(fn=>fn());ctx.blinking=false;ctx.refreshEyes();
      }
    };
  }
  global.createClawdController=createClawdController;
})(window);
