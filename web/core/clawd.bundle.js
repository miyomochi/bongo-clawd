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
      const selected = waking ? (ctx.wakePhase==='startled' ? ctx.startledEyes : ctx.wakePhase==='checking' ? ctx.sneakEyes : ctx.wakePhase==='pretending' ? ctx.busyEyes : ctx.blinkEyes) : sleeping ? ctx.blinkEyes : ctx.looking ? (ctx.squint ? ctx.sneakEyes : ctx.openEyes) : (recovering || entering) ? ctx.blinkEyes : surge ? ctx.wideEyes : ctx.level ? ctx.busyEyes : ctx.blinking ? ctx.blinkEyes : ctx.openEyes;
      [ctx.openEyes, ctx.blinkEyes, ctx.busyEyes, ctx.wideEyes, ctx.sneakEyes, ctx.startledEyes].forEach(el => el.setAttribute('display', el === selected ? 'inline' : 'none'));
      [ctx.openEyes,ctx.sneakEyes].forEach(el=>el.setAttribute('transform', `translate(${ctx.reduceMotion ? 0 : (waking ? ctx.wakeEyeX : ctx.eyeX)} ${ctx.reduceMotion ? 0 : (waking ? 0 : ctx.eyeY)})`));
      ctx.root.dataset.expression = waking ? ctx.wakePhase : sleeping ? 'sleeping' : ctx.looking ? (ctx.squint ? 'sneak' : 'looking') : recovering ? 'recovering' : entering ? 'entering' : surge ? 'wide' : ctx.level ? 'busy' : ctx.blinking ? 'blink' : 'open';
    }

    function renderBody() {
      const surge = ctx.level > 0 && performance.now() < ctx.surgeUntil;
      const now = performance.now();
      const breathing = now < ctx.recoveryUntil && now-ctx.lastStroke > 220 && !ctx.held.size;
      const breath = breathing ? Math.round(1.5-1.5*Math.cos((now-ctx.recoveryStart)*Math.PI*2/1000)) : 0;
      let bodyX=ctx.lookX, bodyY=ctx.bounceOffset+(surge ? -5 : 0)+breath+ctx.lookY;
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
        if(ctx.wakePhase==='calming')bodyY+=Math.round(1-Math.cos((ctx.wakeClock-3600)*Math.PI*2/600));
      }
      if(ctx.reduceMotion)bodyX=bodyY=handsX=handsY=0;
      ctx.body.setAttribute('transform',`translate(${bodyX} ${bodyY})`);
      ctx.hands.setAttribute('transform',`translate(${handsX} ${handsY})`);
      const occlusion=`translate(${bodyX-handsX} ${bodyY-handsY})`;
      ctx.armClip.setAttribute('transform',occlusion);
      ctx.raisedClip.setAttribute('transform',occlusion);

    }

    function refreshStatus() {
      const wakeButton=ctx.root.querySelector('[data-action="wake"]');
      if(wakeButton)wakeButton.disabled=ctx.sleepPhase!=='asleep';
      if(ctx.wakePhase!=='none')ctx.setStatus(ctx.wakePhase==='startled' ? '哇！' : ctx.wakePhase==='checking' ? '谁、谁来了？' : ctx.wakePhase==='pretending' ? '我没睡！我在敲！' : '呼……继续工作', 'waking');
      else if (ctx.sleepPhase==='asleep') ctx.setStatus('呼……Zzz', 'asleep');
      else if(ctx.sleepPhase!=='awake')ctx.setStatus('伸个懒腰……困了', 'sleepy');
      else if (ctx.looking) ctx.setStatus('偷偷看看……没人吧？', 'looking');
      else if (ctx.mouseMode) ctx.setStatus(ctx.root.dataset.left!=='idle' ? '左手啪嗒，右手挪鼠标' : '小幅挪动鼠标', 'mouse');
      else if (ctx.level) ctx.setStatus(ctx.level === 2 ? '啪嗒啪嗒，忙不过来了！' : '小蟹正在奋力工作', 'busy');
      else if (performance.now() < ctx.recoveryUntil) ctx.setStatus(performance.now()-ctx.lastStroke < 220 || ctx.held.size ? '一边缓口气，一边啪嗒' : '呼……缓口气', 'recovering');
      else ctx.setStatus(ctx.active.size ? '啪嗒，正在敲键盘' : '等你敲下一下', ctx.active.size ? 'typing' : 'idle');
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
        const show=ctx.sleepPhase==='asleep'&&(ctx.reduceMotion ? i===0 : age>=0&&age<2700);
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
      ctx.cancelHand(hand);
      ctx.pose(hand, ctx.reduceMotion ? 'down' : 'up');
      if (!ctx.reduceMotion) ctx.handTimers[hand].push(setTimeout(()=>ctx.pose(hand,'down'),ctx.level || ctx.wakePhase==='pretending' ? 25 : 40));
      ctx.handTimers[hand].push(setTimeout(()=>ctx.pose(hand,'idle'),ctx.level || ctx.wakePhase==='pretending' ? 95 : 155));
      ctx.bumpBody();
    }
    return { setStatus, pose, cancelHand, refreshEyes, renderBody, refreshStatus, renderStretchArms, renderSleepSymbols, updateParticles, emitDrop, bumpBody, tapHand };
  };
})(window);


/* Clawd: behavior. Private context belongs to one controller instance. */
(function (global) {
  'use strict';
  const modules = global.ClawdModules || (global.ClawdModules = {});
  modules.behavior = function (ctx) {
    function stopLook() {
      clearTimeout(ctx.lookTimer); ctx.lookTimer=null;
      ctx.looking=false; ctx.lookX=ctx.lookY=ctx.eyeX=ctx.eyeY=0; ctx.squint=false;
      ctx.refreshEyes(); ctx.renderBody();
    }

    function queueLook(delay=12000+Math.random()*6000) {
      clearTimeout(ctx.idleTimer);
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
      ctx.queueLook();
    }

    function startLook() {
      if(ctx.disposed || ctx.sleepPhase!=='awake' || ctx.wakePhase!=='none' || ctx.held.size || ctx.level || performance.now()<ctx.recoveryUntil || ctx.mouseMode) return;
      clearTimeout(ctx.idleTimer); ctx.stopLook();
      ctx.looking=true;ctx.lookStart=performance.now();ctx.lookCount++;
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
      const next = recent && sustained ? (ctx.rate >= (ctx.level===2 ? 7.5 : 9) ? 2 : ctx.rate >= (ctx.level ? 4.5 : 6) ? 1 : 0) : 0;
      if (next && !ctx.level) { ctx.enteringUntil=now+240; ctx.nextSurge=now+1400+Math.random()*500; }
      if (!next && ctx.level) { ctx.enteringUntil=0; ctx.recoveryStart=now; ctx.recoveryUntil=now+3500; }
      if (next) ctx.recoveryUntil=0;
      if (ctx.recoveryUntil && now>=ctx.recoveryUntil) ctx.recoveryUntil=0;
      ctx.root.dataset.recovering=String(now<ctx.recoveryUntil);
      ctx.level=next; ctx.root.dataset.busy=String(ctx.level);
      if (!ctx.level) { ctx.nextSurge=Infinity; ctx.surgeUntil=0; }
      else {
        if (now >= ctx.nextSurge) { ctx.surgeUntil=now+650; ctx.nextSurge=now+4000+Math.random()*2500; }
        if (now >= ctx.nextDrop) { ctx.emitDrop(now); ctx.nextDrop=now+(ctx.level===2 ? 155 : 380); }
      }
      ctx.refreshEyes(); ctx.renderBody(); ctx.refreshStatus();
      if (ctx.hits.length || ctx.level || now<ctx.recoveryUntil) ctx.activityTimer=setTimeout(ctx.activityTick,80);
    }

    function resetActivity() {
      clearTimeout(ctx.activityTimer); ctx.activityTimer=null;
      cancelAnimationFrame(ctx.particleFrame); ctx.particleFrame=null;
      ctx.hits=[]; ctx.particles.forEach(p=>p.el.remove()); ctx.particles=[];
      ctx.recoveryUntil=ctx.recoveryStart=ctx.enteringUntil=0; ctx.lastStroke=-Infinity; ctx.root.dataset.recovering='false';
      ctx.level=ctx.rate=0; ctx.nextSurge=Infinity; ctx.surgeUntil=0; ctx.nextDrop=0;
      ctx.root.dataset.busy='0'; ctx.refreshEyes(); ctx.renderBody();
    }

    function scheduleBlink() {
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
      clearTimeout(ctx.sleepTimer);ctx.sleepTimer=null;
      const wasSleeping=ctx.sleepPhase!=='awake';
      ctx.sleepPhase='awake';ctx.sleepClock=0;ctx.sleepArmFrame=-1;
      if(wasSleeping){ctx.pose('left','idle');ctx.pose('right','idle');}
      ctx.left.removeAttribute('clip-path');ctx.right.setAttribute('clip-path','url(#far-arm-visible)');
      ctx.renderSleepSymbols();ctx.refreshEyes();ctx.renderBody();
    }
    function queueSleep(delay=2200) {
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
      clearTimeout(ctx.idleTimer);stopSleep();ctx.resetActivity();
      clearTimeout(ctx.bodyTimer);ctx.bounceOffset=0;
      ctx.cancelHand('left');ctx.cancelHand('right');
      ctx.pose('left','idle');ctx.pose('right','idle');ctx.sleepArmFrame=-1;
      ctx.sleepStart=performance.now();ctx.sleepClock=0;ctx.sleepPhase='stretch';
      function tick() {
        if(ctx.disposed || ctx.sleepPhase==='awake')return;
        ctx.sleepClock=performance.now()-ctx.sleepStart;
        const phase=ctx.sleepClock<1250 ? 'stretch' : ctx.sleepClock<2400 ? 'settling' : 'asleep';
        ctx.sleepPhase=phase;
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
        if(t>=4200) {
          stopWake();clearTimeout(ctx.activityTimer);ctx.activityTick();ctx.queueLook();ctx.refreshStatus();return;
        }
        ctx.wakePhase=t<440 ? 'startled' : t<1000 ? 'checking' : t<3600 ? 'pretending' : 'calming';
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
      if (ctx.disposed) return;
      ctx.markActivity();
      if(ctx.wakePhase!=='none'){ctx.lastKey.textContent='Mouse · 被发现了';ctx.refreshStatus();return;}
      const leftHeld=[...ctx.held].some(code=>ctx.lookup.get(code)?.hand==='left'||code==='Space');
      if(!leftHeld && performance.now()-ctx.lastLeftStroke>300)ctx.resetActivity();
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
      if(button!==0 && button!==2)return;
      ctx.markActivity();
      if(down)ctx.mouseButtons.add(button);else ctx.mouseButtons.delete(button);
      if(ctx.mouseMode)queueMouseRest();
      const name = button === 2 ? 'right' : 'left';
      ctx.svg.querySelector('#mouse-' + name + '-button').classList.toggle('is-clicked', down);
    }

    function bindInput() {
    ctx.listen(ctx.root, 'keydown', e => {
      if (e.target.closest('button')) return;
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
    ctx.listen(global, 'pointerup', e => ctx.mouseButton(e.button,false));
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
    function demoTyping() {
      ctx.clearAll();
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
      ctx.clearAll();
      const start = performance.now();
      function frame(now) {
        const t = Math.min(1, (now-start)/1000);
        ctx.moveMouse(Math.sin(t*Math.PI*2)*4, Math.cos(t*Math.PI*2)*2);
        if (t < 1) ctx.demoFrame = requestAnimationFrame(frame);
      }
      ctx.demoFrame = requestAnimationFrame(frame);
    }

    function demoMixed(){
      ctx.clearAll();let i=0;const codes=['KeyA','KeyW','KeyS','KeyD'];
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
        const action = button.dataset.action;
        if (action === 'left') { ctx.tap('KeyA'); }
        else if (action === 'right') { ctx.tap('KeyJ'); }
        else if (action === 'mouse') {if(ctx.sleepPhase==='asleep' || ctx.wakePhase!=='none')ctx.moveMouse(2,0);else ctx.demoMouse();}
        else if (action === 'wake') ctx.startWake();
        else if (action === 'demo') ctx.demoTyping();
        else if (action === 'mixed') demoMixed();
        else if (action === 'sleep') { ctx.clearAll();ctx.startSleep(); }
        else if (action === 'look') { ctx.clearAll();ctx.lookCount=0;ctx.lookLimit=1;ctx.startLook(); }
      });
    });
    
    }
    return { demoTyping, demoMouse, bindDemo };
  };
})(window);


/* Clawd controller: instance setup, public API and lifecycle. */
(function (global) {
  'use strict';
  function createClawdController(root, rig, options={}) {
    const svg = root.querySelector('#clawd-scene');
    const ctx = {
      root, rig, svg,
      sleepEnabled:options.sleepEnabled!==false,sleepDelayMs:90000,idleSince:performance.now(),
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
    for (const name of ['renderer','behavior','sleep','wake','input','demo']) {
      if (!global.ClawdModules?.[name]) throw new Error('Missing Clawd module: '+name);
      Object.assign(ctx,global.ClawdModules[name](ctx));
    }
    function clearAll() {
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
      ctx.refreshStatus();ctx.setStatus('小蟹就位', 'idle');
    }
    function configure(prefs={}) {
      if(typeof prefs.sleepEnabled==='boolean')ctx.sleepEnabled=prefs.sleepEnabled;
      if(Number.isFinite(prefs.sleepSeconds))ctx.sleepDelayMs=Math.max(30,Math.min(3600,prefs.sleepSeconds))*1000;
      clearTimeout(ctx.idleTimer);
      if(!ctx.sleepEnabled&&ctx.sleepPhase!=='awake'){ctx.stopSleep();ctx.refreshStatus();}
      ctx.queueLook();
    }
    ctx.clearAll=clearAll;
    configure(options);
    if(options.bindInput!==false)ctx.bindInput();
    if(options.bindDemo!==false)ctx.bindDemo();
    ctx.lookLimit=1+Math.floor(Math.random()*2); ctx.queueLook();
    if (!ctx.reduceMotion) ctx.scheduleBlink();
    return {
      press:ctx.press, release:ctx.release, tap:ctx.tap, moveMouse:ctx.moveMouse,mouseButton:ctx.mouseButton,
      clearAll,configure,resumeIdle:()=>{ctx.idleSince=performance.now();ctx.lookCount=0;ctx.queueLook();}, lookAround:ctx.startLook, sleep:ctx.startSleep, wake:ctx.startWake,
      getState:()=>({
        keys:[...ctx.active],left:root.dataset.left||'idle',right:root.dataset.right||'idle',
        sleepEnabled:ctx.sleepEnabled,sleepSeconds:ctx.sleepDelayMs/1000,
        wake:ctx.wakePhase,wakeClock:ctx.wakeClock,sleep:ctx.sleepPhase,sleepArmFrame:ctx.sleepArmFrame,mouse:ctx.mouseMode,looking:ctx.looking,idleLooks:ctx.lookCount,idleLookLimit:ctx.lookLimit,
        busy:ctx.level,recovering:performance.now()<ctx.recoveryUntil,rate:ctx.rate,
        expression:root.dataset.expression||'open',particles:ctx.particles.length
      }),
      destroy() {
        clearAll();ctx.disposed=true;
        clearTimeout(ctx.blinkTimer);clearTimeout(ctx.blinkEnd);
        ctx.cleanup.forEach(fn=>fn());ctx.blinking=false;ctx.refreshEyes();
      }
    };
  }
  global.createClawdController=createClawdController;
})(window);
