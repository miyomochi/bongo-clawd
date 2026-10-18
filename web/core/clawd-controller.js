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
