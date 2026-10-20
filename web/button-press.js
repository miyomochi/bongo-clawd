/* Side-plane keycaps: fixed back, short inward travel, and a quiet release. */
(function(){
  'use strict';
  const root=document.getElementById('clawd-desktop');
  const reduced=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const face=[[25,26],[77,6],[77,50],[25,70]];
  const back=face.map(([x,y])=>[x-14,y-6]);
  const points=vertices=>vertices.map(p=>p.join(',')).join(' ');
  const states=[],cleanup=[];
  function listen(node,event,fn){node.addEventListener(event,fn);cleanup.push(()=>node.removeEventListener(event,fn));}
  root.querySelectorAll('.block').forEach(button=>{
    const cap=button.querySelector('.cube-cap'),top=button.querySelector('.cube-top'),side=button.querySelector('.cube-side'),svg=button.querySelector('.cube');
    if(!cap||!top||!side)return;
    let progress=0,target=0,frame=null,timer=null,keyboard=false,pressedAt=-Infinity;
    const available=()=>!button.disabled&&!button.classList.contains('is-card')&&!root.classList.contains('is-paused');
    function render(value){
      progress=value;
      const dx=-4*value,dy=-2*value,f=face.map(([x,y])=>[x+dx,y+dy]);
      top.setAttribute('points',points([back[0],back[1],f[1],f[0]]));
      side.setAttribute('points',points([back[0],f[0],f[3],back[3]]));
      cap.setAttribute('transform','translate('+dx+' '+dy+')');
      if(value)svg.style.filter='drop-shadow('+(2-value)+'px '+(3-2*value)+'px 0 #0003)';
      else svg.style.removeProperty('filter');
    }
    function press(value){
      clearTimeout(timer);timer=null;
      if(target===value&&progress===value)return;
      if(value)pressedAt=performance.now();
      target=value;cancelAnimationFrame(frame);frame=null;
      if(reduced){render(value);return;}
      const from=progress,start=performance.now(),duration=value?70:140;
      function tick(now){
        const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,value?2:3);
        render(from+(value-from)*ease);
        if(t<1)frame=requestAnimationFrame(tick);else frame=null;
      }
      frame=requestAnimationFrame(tick);
    }
    function reset(){keyboard=false;clearTimeout(timer);cancelAnimationFrame(frame);timer=frame=null;target=0;render(0);}
    function release(){
      keyboard=false;if(!available()){reset();return;}
      const remaining=90-(performance.now()-pressedAt);
      if(target===1&&remaining>0){clearTimeout(timer);timer=setTimeout(()=>press(0),remaining);}
      else press(0);
    }
    states.push({button,reset});
    listen(button,'pointerdown',e=>{if(e.button===0&&available()){button.setPointerCapture(e.pointerId);press(1);}});
    for(const name of ['pointerup','lostpointercapture'])listen(button,name,release);
    for(const name of ['pointercancel','blur'])listen(button,name,reset);
    listen(button,'keydown',e=>{
      if((e.code==='Space'||e.code==='Enter')&&!e.repeat&&available()){keyboard=true;press(1);}
    });
    listen(button,'keyup',e=>{if(e.code==='Space'||e.code==='Enter')release();});
    listen(button,'click',e=>{
      if(e.detail===0&&!keyboard&&available()){press(1);timer=setTimeout(release,90);}
    });
    render(0);
  });
  const resetAll=()=>states.forEach(s=>s.reset());
  const observer=new MutationObserver(()=>{
    if(root.classList.contains('is-paused')||document.hidden)resetAll();
    else states.filter(s=>s.button.disabled||s.button.classList.contains('is-card')).forEach(s=>s.reset());
  });
  observer.observe(root,{attributes:true,subtree:true,attributeFilter:['class','disabled']});
  listen(window,'blur',resetAll);
  listen(document,'visibilitychange',()=>{if(document.hidden)resetAll();});
  listen(window,'beforeunload',()=>{observer.disconnect();resetAll();cleanup.forEach(fn=>fn());});
})();
