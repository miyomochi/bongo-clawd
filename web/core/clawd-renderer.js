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
