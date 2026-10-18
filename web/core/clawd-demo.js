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
