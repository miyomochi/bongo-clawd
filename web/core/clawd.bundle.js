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
      const surge = ctx.level > 0 && performance.now() < ctx.surgeUntil;
      const recovering = performance.now() < ctx.recoveryUntil;
      const entering = ctx.level > 0 && performance.now() < ctx.enteringUntil;
      const sleeping = ctx.sleepPhase!=='awake';
      const waking=ctx.wakePhase!=='none';
      const happy=ctx.happyOwnsEyes?.()&&!ctx.level&&!recovering&&!entering;
      const selected = ctx.accessoryPreview ? ctx.headphoneEyes : waking ? (ctx.wakePhase==='startled' ? ctx.startledEyes : ctx.wakePhase==='checking' ? ctx.sneakEyes : ctx.wakePhase==='pretending' ? ctx.busyEyes : ctx.blinkEyes) : sleeping ? ctx.blinkEyes : ctx.looking ? (ctx.squint ? ctx.sneakEyes : ctx.openEyes) : (recovering || entering) ? ctx.blinkEyes : surge ? ctx.wideEyes : ctx.level ? ctx.busyEyes : happy ? ctx.happyEyes : ctx.blinking ? ctx.blinkEyes : ctx.openEyes;
      [ctx.openEyes, ctx.blinkEyes, ctx.busyEyes, ctx.wideEyes, ctx.sneakEyes, ctx.startledEyes,ctx.happyEyes,ctx.headphoneEyes].filter(Boolean).forEach(el => el.setAttribute('display', el === selected ? 'inline' : 'none'));
      [ctx.openEyes,ctx.sneakEyes].forEach(el=>el.setAttribute('transform', `translate(${ctx.reduceMotion ? 0 : (waking ? ctx.wakeEyeX : ctx.eyeX)} ${ctx.reduceMotion ? 0 : (waking ? 0 : ctx.eyeY+(ctx.coolEyeY||0))})`));
      ctx.root.dataset.expression = ctx.accessoryPreview ? (ctx.accessoryExpression||'headphones') : waking ? ctx.wakePhase : sleeping ? 'sleeping' : ctx.looking ? (ctx.squint ? 'sneak' : 'looking') : recovering ? 'recovering' : entering ? 'entering' : surge ? 'wide' : ctx.level ? 'busy' : happy ? 'happy' : ctx.blinking ? 'blink' : 'open';
    }

    let restTimer=null,restStart=null;
    function stopBreathing(){clearTimeout(restTimer);restTimer=null;restStart=null;}
    function restingBreath(now){
      if(!ctx.breathingEnabled||ctx.reduceMotion||ctx.disposed||ctx.clearing||document.hidden||ctx.isAdjusting?.()){
        stopBreathing();return 0;
      }
      const free=ctx.sleepPhase==='awake'&&ctx.wakePhase==='none'&&!ctx.held.size&&!ctx.mouseMode&&!ctx.level&&!ctx.looking&&now>=ctx.recoveryUntil&&now-ctx.lastStroke>350&&(!ctx.coolPhase||['none','wearing'].includes(ctx.coolPhase));
      if(!free){stopBreathing();return 0;}
      if(restTimer===null)restTimer=setTimeout(()=>{restTimer=null;ctx.renderBody();},100);
      if(restStart===null)restStart=now;
      return -Math.round((.5-.5*Math.cos((now-restStart)*Math.PI*2/4200))*1000)/1000;
    }
    function renderBody() {
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
      if(ctx.wakePhase!=='none')ctx.setStatus(ctx.wakePhase==='startled' ? '哇！' : ctx.wakePhase==='checking' ? '谁、谁来了？' : ctx.wakePhase==='pretending' ? '我没睡！在敲呢！' : '呼……继续工作', 'waking');
      else if (ctx.sleepPhase==='asleep') ctx.setStatus(ctx.happyPhase==='dreaming'?'睡着了':'呼……Zzz', 'asleep');
      else if(ctx.sleepPhase!=='awake')ctx.setStatus('困困的……', 'sleepy');
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
      if(hand==='left'&&ctx.coolOwnsLeft?.())return;
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
      if ((ctx.coolPhase&&ctx.coolPhase!=='none')||(ctx.happyPhase&&ctx.happyPhase!=='none')){if(ctx.sleepEnabled)ctx.queueSleep(0);return;}
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
      ctx.idleSince=performance.now();
      clearTimeout(ctx.idleTimer);
      if(ctx.sleepPhase==='asleep')ctx.startWake();
      else if(ctx.sleepPhase!=='awake')ctx.stopSleep();
      if(ctx.looking)ctx.stopLook();
      ctx.lookCount=0; ctx.lookLimit=1+Math.floor(Math.random()*2);
      ctx.queueLook();ctx.queueEgg();
    }

    function startLook() {
      if((ctx.coolPhase&&ctx.coolPhase!=='none')||(ctx.happyPhase&&ctx.happyPhase!=='none'))return;
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
      if (!k || ctx.disposed) return false;
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
    function eligible(){return !ctx.disposed&&ctx.happyPhase==='none'&&ctx.sleepPhase==='awake'&&ctx.wakePhase==='none'&&!ctx.held.size&&!ctx.active.size&&!ctx.mouseButtons.size&&!ctx.mouseMode&&!ctx.level&&performance.now()>=ctx.recoveryUntil&&!ctx.looking;}
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
    function canStartHappy(){return available&&!ctx.disposed&&ctx.happyPhase==='none'&&ctx.coolPhase==='none'&&ctx.sleepPhase==='awake'&&ctx.wakePhase==='none'&&!ctx.looking&&!ctx.level&&performance.now()>=ctx.recoveryUntil;}
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
      duck:{front:ctx.svg.querySelector('#duck-front'),eyes:ctx.openEyes,name:'小黄鸭',duration:1300}};
    const sproutMotion=ctx.svg.querySelector('#sprout-motion');
    const duckMotion=ctx.svg.querySelector('#duck-motion'),duckContact=ctx.svg.querySelector('#duck-contact');
    const leaves=['left','right'].map(side=>ctx.svg.querySelector('#sprout-'+side+'-leaf'));
    const panel=ctx.root.querySelector('[data-accessory-menu]');
    const opener=ctx.root.querySelector('[data-accessory-open]');
    let frame=null,started=0,committed='none',draft='none',confirmedSpeech=null;
    ctx.menuOpen=false;ctx.accessoryPreview=false;ctx.accessoryPulse=0;ctx.headphoneEyes=eyes;
    function isAdjusting(){return ctx.paused||ctx.menuOpen||ctx.accessoryPreview;}
    function wear(value){
      Object.entries(variants).forEach(([id,v])=>[v.rear,v.front].filter(Boolean).forEach(n=>n.setAttribute('display',id===value?'inline':'none')));
      ctx.headphoneEyes=variants[value]?.eyes||eyes;
      ctx.accessoryExpression=['sprout','duck'].includes(value)?value:'headphones';
      ctx.accessoryCaption=value==='duck'?'坐稳啦':value==='sprout'?'啵，长高一点点':'跟着节奏敲~';
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
      ctx.root.querySelector('[name="clawd-accessory"]:checked')?.focus({preventScroll:true});return true;
    }
    function selectAccessory(value){
      if(!ctx.menuOpen||!(value==='none'||Object.hasOwn(variants,value))||ctx.disposed)return false;
      stopAccessoryPreview(false);draft=value;wear(draft);syncMenu();
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
      accessoryState:()=>({selected:committed,draft,menuOpen:ctx.menuOpen,preview:ctx.accessoryPreview,pulse:ctx.accessoryPulse,phase:(draft==='duck'?ctx.duckPhase:ctx.sproutPhase)||'none'})};
  };
})(window);


/* Clawd controller: instance setup, public API and lifecycle. */
(function (global) {
  'use strict';
  function createClawdController(root, rig, options={}) {
    const svg = root.querySelector('#clawd-scene');
    const ctx = {
      root, rig, svg,paused:false,breathingEnabled:options.breathingEnabled===true,accessoryStorage:options.accessoryStorage!==false,coolEnabled:options.sunglassesEnabled===true,happyEnabled:options.happyEnabled===true,
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
    for (const name of ['renderer','behavior','sleep','wake','input','demo','cool','happy','eggs','headphones']) {
      if (!global.ClawdModules?.[name]) throw new Error('Missing Clawd module: '+name);
      Object.assign(ctx,global.ClawdModules[name](ctx));
    }
    function clearAll(options={}) {
      ctx.clearing=true;ctx.stopBreathing();
      ctx.stopAccessoryPreview?.(false);
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
    for(const name of ['startCool','startHappy','startDream','startLook','startSleep','startWake']){
      const fn=ctx[name];ctx[name]=(...args)=>ctx.isAdjusting()?false:fn(...args);
    }
    configure(options);
    ctx.queueEgg();
    if(options.bindInput!==false)ctx.bindInput();
    if(options.bindDemo!==false){ctx.bindDemo();ctx.bindAccessories();}
    ctx.lookLimit=1+Math.floor(Math.random()*2); ctx.queueLook();
    if (!ctx.reduceMotion) ctx.scheduleBlink();
    return {
      press:ctx.press, release:ctx.release, tap:ctx.tap, moveMouse:ctx.moveMouse,mouseButton:ctx.mouseButton,
      openAccessoryMenu:ctx.openAccessoryMenu,selectAccessory:ctx.selectAccessory,closeAccessoryMenu:ctx.closeAccessoryMenu,restoreAccessory:ctx.restoreAccessory,setPaused,
      clearAll,configure,resumeIdle:()=>{ctx.idleSince=performance.now();ctx.lookCount=0;ctx.queueLook();ctx.queueEgg();ctx.renderBody();}, showSunglasses:ctx.startCool,showHappy:ctx.startHappy,showDream:ctx.startDream, lookAround:ctx.startLook, sleep:ctx.startSleep, wake:ctx.startWake,
      getState:()=>({
        paused:ctx.paused,breathingEnabled:ctx.breathingEnabled,accessory:ctx.accessoryState(),happy:ctx.happyPhase,happyMode:ctx.happyMode,bubbleMotif:ctx.happyMotif,cool:ctx.coolPhase,coolClock:ctx.coolClock,coolLeftOwned:ctx.coolOwnsLeft(),keys:[...ctx.active],left:root.dataset.left||'idle',right:root.dataset.right||'idle',
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
