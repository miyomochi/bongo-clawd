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
