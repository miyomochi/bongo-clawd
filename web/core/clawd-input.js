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
