/* Update animations consume backend states; percentages are never invented here. */
(function(global){
 'use strict';
 const instances=new WeakMap(),renderer=global.ClawdModules.renderer;
 const phases=new Set(['checking','current','available','downloading','verifying','installing','success','error']);
 global.ClawdModules.renderer=function(ctx){
  const api=renderer(ctx),ns='http://www.w3.org/2000/svg';
  let value={phase:'idle'},started=0,frame=null,now=0,drawn={left:null,right:null};
  const layer=document.createElementNS(ns,'g');layer.id='update-effects';layer.setAttribute('display','none');layer.setAttribute('pointer-events','none');ctx.svg.append(layer);
  layer.innerHTML='<g data-tech-screen transform="matrix(1 .185 -.12 1 84 62)"><rect width="82" height="38" rx="1" fill="#54b9ed" fill-opacity=".2" stroke="#68bfe8" stroke-width=".8"/><path d="M0 7V0H8 M74 0H82V7 M82 31V38H74 M8 38H0V31" fill="none" stroke="#81dcff" stroke-width="1.5"/><text x="5" y="8" font-family="DejaVu Sans, monospace" font-size="4" fill="#287da9" data-screen-label>CHECK</text><g data-screen-bars></g><g data-screen-blocks></g><path data-screen-check display="none" d="M30 19L36 25L49 12" fill="none" stroke="#73b8a5" stroke-width="3"/></g><g data-update-bulb><path d="M-4-7H4V-6H6V-4H7V2H5V4H4V7H-3V4H-5V2H-6V-4H-5V-6H-4Z" fill="#ffeeb1" stroke="#d8b75e" stroke-width=".6"/><path d="M-3 7H4V9H-3Z M-2 10H3V12H-2Z" fill="#a19d94"/><path d="M-11-4H-8 M10-4H13 M0-14V-11 M-9-12L-6-9 M9-12L6-9" stroke="#e8c76c" stroke-width="1.5" data-bulb-rays/></g><g data-update-wand><path d="M0 0H3V-3H6V-6H9V-9H12V-12H15V-15H12V-12H9V-9H6V-6H3V-3H0Z" fill="#93958d"/><path d="M13-24H16V-21H19V-18H22V-15H18V-12H14V-15H10V-19H13Z" fill="#fff0af"/></g><g data-update-sparks></g><g data-update-errors></g><text data-update-caption x="119" y="12" text-anchor="middle" font-family="DejaVu Sans, monospace" font-size="5" fill="#8c7765"></text>';
  const screen=layer.querySelector('[data-tech-screen]'),label=layer.querySelector('[data-screen-label]'),bars=layer.querySelector('[data-screen-bars]'),blocks=layer.querySelector('[data-screen-blocks]'),check=layer.querySelector('[data-screen-check]'),bulb=layer.querySelector('[data-update-bulb]'),wand=layer.querySelector('[data-update-wand]'),sparks=layer.querySelector('[data-update-sparks]'),errors=layer.querySelector('[data-update-errors]'),caption=layer.querySelector('[data-update-caption]');
  for(let i=0;i<3;i++){const g=document.createElementNS(ns,'g');g.innerHTML=`<rect x="5" y="${12+i*7}" width="72" height="3" fill="#77cfff" opacity=".17"/><rect x="5" y="${12+i*7}" width="15" height="3" fill="#69c4ef" data-scan="${i}"/>`;bars.append(g);}
  for(let i=0;i<8;i++){const r=document.createElementNS(ns,'rect');r.setAttribute('x',String(6+i*9));r.setAttribute('y','18');r.setAttribute('width','6');r.setAttribute('height','9');r.setAttribute('fill','#78d1ef');blocks.append(r);}
  for(let i=0;i<7;i++){const p=document.createElementNS(ns,'path');p.setAttribute('d','M-1-4H1V-1H4V1H1V4H-1V1H-4V-1H-1Z');p.setAttribute('fill',i%2?'#fff0af':'#e3c274');sparks.append(p);}
  for(let i=0;i<3;i++){const t=document.createElementNS(ns,'text');t.textContent='ERROR';t.setAttribute('font-family','DejaVu Sans, monospace');t.setAttribute('font-size',i===1?'9':'8');t.setAttribute('fill','#e33535');errors.append(t);}
  const dizzy=document.createElementNS(ns,'g');dizzy.id='update-dizzy';dizzy.setAttribute('display','none');dizzy.innerHTML='<path d="M90 59H98V71H90V62H95V68H93V65 M129 66H137V78H129V69H134V75H132V72" fill="none" stroke="#27221f" stroke-width="1.5"/>';ctx.body.append(dizzy);
  function pose(hand,state){if(drawn[hand]!==state){api.pose(hand,state);drawn[hand]=state;}}
  function clearKeys(){ctx.svg.querySelectorAll('.key.is-down').forEach(n=>n.classList.remove('is-down'));}
  function refreshEyes(){
   api.refreshEyes();dizzy.setAttribute('display',value.phase==='error'?'inline':'none');if(value.phase==='idle')return;
   const selected=value.phase==='error'?null:['available','current','success'].includes(value.phase)?ctx.happyEyes:ctx.openEyes;
   for(const n of [ctx.openEyes,ctx.blinkEyes,ctx.busyEyes,ctx.wideEyes,ctx.sneakEyes,ctx.startledEyes,ctx.happyEyes,ctx.headphoneEyes].filter(Boolean))n.setAttribute('display',n===selected?'inline':'none');
  }
  function renderBody(){
   const breathing=ctx.breathingEnabled;if(value.phase!=='idle')ctx.breathingEnabled=false;api.renderBody();ctx.breathingEnabled=breathing;if(value.phase==='idle')return;
   const t=now-started,phase=value.phase;
   let y=0,angle=0;
   if(!ctx.reduceMotion){if(['checking','downloading'].includes(phase))y=-Math.max(0,Math.sin(t*Math.PI/220))*1.5;if(phase==='error')angle=3+Math.sin(t/500);if(phase==='success')y=-Math.abs(Math.sin(t/260))*1.5;}
   const motion=` translate(0 ${y.toFixed(2)}) rotate(${angle.toFixed(2)} 118 94)`;
   ctx.body.setAttribute('transform',(ctx.body.getAttribute('transform')||'')+motion);ctx.hands.setAttribute('transform',(ctx.hands.getAttribute('transform')||'')+motion);
   layer.setAttribute('display','inline');
   const typing=['checking','downloading','verifying'].includes(phase);
   if(typing&&!ctx.reduceMotion){
    for(const [hand,offset] of [['left',0],['right',180]]){const beat=(t+offset)%360;pose(hand,beat<65?'up':beat<155?'down':'idle');}
    clearKeys();const keys=['KeyA','KeyJ','KeyS','KeyK','KeyD','KeyL'];ctx.svg.querySelector('#key-'+keys[Math.floor(t/180)%keys.length])?.classList.add('is-down');
   }else {clearKeys();if(!['available','success'].includes(phase)){pose('left','idle');pose('right','idle');}}
   const shown=['checking','current','downloading','verifying','installing'].includes(phase)||(phase==='error'&&t<350);
   screen.setAttribute('display',shown?'inline':'none');
   label.textContent=({checking:'CHECKING',current:'UP TO DATE',downloading:'DOWNLOADING',verifying:'VERIFYING',installing:'INSTALL',error:'ERROR'})[phase]||'';
   bars.setAttribute('display',['checking','verifying'].includes(phase)?'inline':'none');
   bars.querySelectorAll('[data-scan]').forEach((n,i)=>{const x=ctx.reduceMotion?25:5+((t/18+i*19)%57);n.setAttribute('x',x.toFixed(2));});
   blocks.setAttribute('display',['downloading','installing'].includes(phase)?'inline':'none');
   [...blocks.children].forEach((n,i)=>{const finite=Number.isFinite(value.progress),lit=finite?i<Math.floor(Math.max(0,Math.min(1,value.progress))*8):Math.floor(t/170)%8===i;n.setAttribute('opacity',lit?'1':'.15');});
   if(phase==='downloading'&&Number.isFinite(value.progress))label.textContent='DOWNLOAD '+Math.round(Math.max(0,Math.min(1,value.progress))*100)+'%';
   check.setAttribute('display',phase==='current'?'inline':'none');
   bulb.setAttribute('display',phase==='available'?'inline':'none');wand.setAttribute('display',phase==='success'?'inline':'none');
   if(phase==='available'||phase==='success'){
    ctx.left.innerHTML=ctx.rig.stretchFrames.left[8];drawn.left='prop';pose('right','idle');
    const a=phase==='success'&&!ctx.reduceMotion?-10+Math.sin(t/220)*14:0;
    ctx.left.setAttribute('transform',`rotate(${a.toFixed(2)} 163 76)`);
    const radians=a*Math.PI/180,x=163+18*Math.cos(radians)+16*Math.sin(radians),wy=76+18*Math.sin(radians)-16*Math.cos(radians);
    bulb.setAttribute('transform','translate(181 47)');bulb.querySelector('[data-bulb-rays]').setAttribute('opacity',String(ctx.reduceMotion?.8:.65+.35*Math.sin(t/220)));
    wand.setAttribute('transform',`translate(${x.toFixed(2)} ${wy.toFixed(2)}) rotate(${a.toFixed(2)})`);
   }else ctx.left.removeAttribute('transform');
   sparks.setAttribute('display',phase==='success'?'inline':'none');
   [...sparks.children].forEach((n,i)=>{const p=ctx.reduceMotion?.5:((t+i*250)%1500)/1500,alpha=ctx.reduceMotion?.8:Math.sin(p*Math.PI);n.setAttribute('transform',`translate(${[190,205,177,64,80,170,197][i]+(i%2?1:-1)*p*4} ${[22,40,12,48,22,40,65][i]-p*8}) scale(${(.35+alpha*.35).toFixed(2)})`);n.setAttribute('opacity',String(alpha));});
   errors.setAttribute('display',phase==='error'?'inline':'none');
   [...errors.children].forEach((n,i)=>{n.setAttribute('x',String([48,174,177][i]));n.setAttribute('y',String([37,18,89][i]+(ctx.reduceMotion?0:Math.sin(t/450+i)*2)));n.setAttribute('opacity',String(ctx.reduceMotion?.8:.7+.2*Math.sin(t/500+i)));});
   caption.textContent=({checking:'Checking for updates',current:'All up to date',available:'New version!',downloading:'Downloading update',verifying:'Checking package',installing:'Opening installer',success:'Upgrade complete!',error:'Oops...'})[phase]||'';
  }
  function tick(time){frame=null;if(ctx.disposed||value.phase==='idle')return;clearTimeout(ctx.idleTimer);ctx.stopEggTimer();now=time;refreshEyes();renderBody();frame=requestAnimationFrame(tick);}
  function stop(){
   const wasActive=value.phase!=='idle';value={phase:'idle'};cancelAnimationFrame(frame);frame=null;layer.setAttribute('display','none');dizzy.setAttribute('display','none');clearKeys();ctx.left.removeAttribute('transform');drawn={left:null,right:null};api.pose('left','idle');api.pose('right','idle');api.refreshEyes();api.renderBody();if(wasActive&&!ctx.disposed&&!ctx.paused){ctx.idleSince=performance.now();ctx.lookCount=0;ctx.queueLook();ctx.queueEgg();if(ctx.blinkTimer===null&&!ctx.reduceMotion)ctx.scheduleBlink();}
  }
  function setUpdateState(next){
   const phase=phases.has(next?.phase)?next.phase:'idle';
   if(phase===value.phase){value={...value,...next,phase};return;}
   stop();if(phase==='idle')return;ctx.clearAll();clearTimeout(ctx.blinkTimer);clearTimeout(ctx.blinkEnd);ctx.blinkTimer=ctx.blinkEnd=null;ctx.blinking=false;ctx.stopBreathing();value={...next,phase};now=started=performance.now();tick(now);
  }
  instances.set(ctx.root,{setUpdateState,stopUpdateVisuals:stop});return {...api,renderBody,refreshEyes};
 };
 const create=global.createClawdController;
 global.createClawdController=function(root,rig,options={}){const c=create(root,rig,options),extra=instances.get(root);Object.assign(c,extra);const destroy=c.destroy;c.destroy=()=>{extra.stopUpdateVisuals();destroy();};return c;};
})(window);
