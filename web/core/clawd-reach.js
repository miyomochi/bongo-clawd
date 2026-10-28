/* Desktop hand motion and interaction extension. */
(function(global){
  'use strict';
  const instances=new WeakMap();
  const renderer=global.ClawdModules.renderer, input=global.ClawdModules.input;
  // Fill integer pixel rows so every new arm keeps the scene's staircase edges.
  function polygon(points){
    const low=Math.floor(Math.min(...points.map(p=>p[1]))), high=Math.ceil(Math.max(...points.map(p=>p[1])));
    let d='';
    for(let y=low;y<high;y++){
      const xs=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],scan=y+.5;
        if((a[1]<=scan&&b[1]>scan)||(b[1]<=scan&&a[1]>scan))xs.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      xs.sort((a,b)=>a-b);
      for(let i=0;i+1<xs.length;i+=2){const x=Math.ceil(xs[i]-.5),w=Math.ceil(xs[i+1]-.5)-x;if(w>0)d+=`M${x} ${y}h${w}v1H${x}Z`;}
    }
    return d;
  }
  function arm(hand,end){
    const a=hand==='left'?[158,74]:[70,61],b=[a[0]+11,a[1]+2];
    const d=[Math.round(end.x-5.5),Math.round(end.y-1)],c=[d[0]+11,d[1]+2];
    const lower=p=>[p[0],p[1]+11];
    const faces=[[[a,b,lower(b),lower(a)],'#bc6049'],[[b,c,lower(c),lower(b)],'#bc6049'],[[d,a,lower(a),lower(d)],'#bc6049'],[[a,b,c,d],'#e89170'],[[d,c,lower(c),lower(d)],'#d97757']];
    return `<g data-reaching-arm="${hand}">`+faces.map(([pts,fill])=>`<path fill="${fill}" d="${polygon(pts)}"/>`).join('')+'</g>';
  }
  global.ClawdModules.renderer=function(ctx){
    const api=renderer(ctx), home={left:{x:156.5,y:87},right:{x:70.5,y:74}}, ends={left:{...home.left},right:{...home.right}},targets={left:null,right:null};
    let enabled=false;
    // Coarse zones suggest reach while keeping the original silhouette.
    function zoneTarget(k,hand=k.hand){
      const depth=k.y<=16?'far':k.y>=30?'near':'middle';
      const side=hand==='left'?(k.x>=32?'inner':k.x<19?'outer':'center'):(k.x<64?'inner':k.x>=89?'outer':'center');
      const x=home[hand].x+(hand==='left'?{inner:-13,outer:4,center:0}[side]:{inner:4,outer:-2,center:1}[side]);
      const y=hand==='left'?{near:89,middle:94,far:100}[depth]:{near:76,middle:79,far:82}[depth];
      return {x,y,zone:depth+'-'+side};
    }
    const centers=new Map(ctx.rig.keys.map(k=>[k.code,zoneTarget(k)]));
    const paint=(hand,end,state)=>{ends[hand]={...end};ctx[hand].innerHTML=arm(hand,end);if(hand==='right')ctx.right.setAttribute('clip-path','url(#far-arm-visible)');ctx.root.dataset[hand]=state;};
    function reset(hand){ends[hand]={...home[hand]};targets[hand]=null;}
    const pose=(hand,state)=>{reset(hand);api.pose(hand,state);if(hand==='right')ctx.right.setAttribute('clip-path','url(#far-arm-visible)');};
    function setReachEnabled(value){
      if(ctx.root.dataset.reach===(value?'on':'off'))return;
      enabled=!!value;ctx.cancelHand('left');ctx.cancelHand('right');
      pose('left','idle');
      if(!ctx.mouseMode)pose('right','idle');
      ctx.root.dataset.reach=enabled?'on':'off';
    }
    instances.set(ctx.root,{setReachEnabled,getReachEnabled:()=>enabled});
    ctx.reachTargets=targets;ctx.reachCenters=centers;ctx.reachZoneTarget=zoneTarget;
    return {...api,pose,cancelHand(hand){api.cancelHand(hand);if(hand==='right')ctx.right.setAttribute('clip-path','url(#far-arm-visible)');},tapHand(hand){
      if(ctx.gamingOwnsHands?.())return;
      if(ctx.magicOwnsHands?.())return;
      if(!enabled||!targets[hand]||ctx.reduceMotion||ctx.sleepPhase!=='awake'||ctx.wakePhase!=='none')return api.tapHand(hand);
      if(hand==='left'&&(ctx.coolOwnsLeft?.()||ctx.bubblesOwnsLeft?.()))return;
      ctx.cancelHand(hand);
      const start={...ends[hand]},begin=performance.now(),quick=!!ctx.level;
      const neutralY=hand==='left'?89:76,amount=quick?.65:1,raw=targets[hand];
      const target={x:home[hand].x+(raw.x-home[hand].x)*amount,y:neutralY+(raw.y-neutralY)*amount};
      const reachMs=quick?34:60,holdUntil=quick?66:100,finish=quick?145:245;
      const ease=t=>t*t*(3-2*t);
      function frame(){
        if(ctx.disposed)return;
        const t=performance.now()-begin;
        if(t>=finish){pose(hand,'idle');return;}
        let end,state;
        if(t<reachMs){
          const p=Math.min(1,t/reachMs),e=ease(p);
          end={x:start.x+(target.x-start.x)*e,y:start.y+(target.y-start.y)*e-Math.sin(p*Math.PI)*(quick?3:hand==='right'?4:8)};state=p<.75?'up':'down';
        }else if(t<holdUntil){end={...target};state='down';}
        else {const p=ease((t-holdUntil)/(finish-holdUntil));end={x:target.x+(home[hand].x-target.x)*p,y:target.y+(home[hand].y-target.y)*p};state='returning';}
        paint(hand,end,state);
        ctx.handTimers[hand].push(setTimeout(frame,16));
      }
      frame();ctx.bumpBody();
    }};
  };
  global.ClawdModules.input=function(ctx){
    const api=input(ctx);
    function targetFor(code){
      const k=ctx.lookup.get(code);
      if(k&&!ctx.disposed&&!ctx.isAdjusting?.()){
        const hand=code==='Space'?(ctx.mouseMode||!ctx.alternateSpace?'left':'right'):k.hand;
        ctx.reachTargets[hand]=code==='Space'?ctx.reachZoneTarget({...k,x:hand==='left'?30:60},hand):ctx.reachCenters.get(code);
      }
    }
    return {...api,press(code,options){targetFor(code);return api.press(code,options);},bindInput(){
      // Native bindInput closes over its own press function, so prepare the
      // target in capture phase as well as through the public controller API.
      ctx.listen(ctx.root,'keydown',e=>{
        if(e.target.closest('button,select,[data-accessory-menu],[data-accessory-open]'))return;
        targetFor(e.code);
      },true);
      api.bindInput();
    }};
  };

  const create=global.createClawdController;
  global.createClawdController=function(root,rig,options={}){
    const controller=create(root,rig,options),extra=instances.get(root);
    Object.assign(controller,extra);controller.setReachEnabled(options.reachEnabled===true);
    return controller;
  };
})(window);
