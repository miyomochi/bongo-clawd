(function(){
  'use strict';
  const bridge=window.clawdDesktop;
  // Same backend keys as before; sideButtons / bubbleLines are new and default to on when missing.
  const ids=['alwaysOnTop','showOnStartup','breathingEnabled','statisticsEnabled','sideButtons','bubbleLines','mirrored'];
  const defaultOff=new Set(['statisticsEnabled','mirrored']);
  const $=id=>document.getElementById(id);
  const scale=$('scale'),output=$('scale-output'),seconds=$('sleepSeconds'),status=$('save-status'),custom=$('custom-sleep');
  const presets=[60,90,300,900];
  let active=true,customOpen=false,current={};
  const phases={starting:'连接中',listening:'联动中',paused:'已暂停',locked:'锁屏暂停',error:'连不上了',unsupported:'系统不支持联动'};
  function clampSeconds(n){return Math.max(30,Math.min(3600,Math.round(Number.isFinite(n)?n:90)));}
  function paintScale(){
    output.textContent=scale.value+'%';
    scale.style.setProperty('--fill',((scale.value-60)/100*100)+'%');
    document.querySelectorAll('[data-scale]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scale===scale.value)));
  }
  function paintSleep(value){
    const enabled=value.sleepEnabled!==false,secs=value.sleepSeconds||90;
    const choice=!enabled?'never':customOpen||!presets.includes(secs)?'custom':String(secs);
    document.querySelectorAll('[data-sleep]').forEach(b=>{const on=b.dataset.sleep===choice;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;});
    custom.hidden=choice!=='custom';
    if(document.activeElement!==seconds)seconds.value=secs;
  }
  function render(value){
    current=value;
    $('autostartEnabled').checked=value.autostartEnabled===true;
    $('install-note').textContent=value.installed?'卸载后保留个人设置。':'便携版无需安装；退出后删除程序文件夹即可。';
    for(const id of ids)$(id).checked=defaultOff.has(id)?value[id]===true:value[id]!==false;
    if(document.activeElement!==scale)scale.value=Math.round((value.scale||1)*100);
    paintScale();paintSleep(value);
    $('about-version').textContent='Bongo Clawd '+(value.version||'')+(value.edition?' · '+value.edition:'');
    $('about-phase').textContent=phases[value.phase]||'连接中';
    $('retry-input').disabled=value.phase==='listening'&&value.running!==false;
  }
  async function update(patch){
    status.textContent='保存中…';status.classList.remove('is-error');
    try{await bridge.updateSettings(patch);if(active)status.textContent='自动保存';}
    catch{if(active){status.textContent='没保存上，请重试';status.classList.add('is-error');}}
  }
  for(const id of ids)$(id).addEventListener('change',e=>update({[id]:e.target.checked}));
  scale.addEventListener('input',()=>{paintScale();update({scale:Number(scale.value)/100});});
  document.querySelectorAll('[data-scale]').forEach(b=>b.addEventListener('click',()=>{scale.value=b.dataset.scale;paintScale();update({scale:Number(b.dataset.scale)/100});}));
  document.querySelectorAll('[data-sleep]').forEach(b=>b.addEventListener('click',()=>{
    const v=b.dataset.sleep;
    if(v==='never'){customOpen=false;paintSleep({...current,sleepEnabled:false});update({sleepEnabled:false});return;}
    if(v==='custom'){customOpen=true;paintSleep({...current,sleepEnabled:true});seconds.focus();seconds.select?.();if(current.sleepEnabled===false)update({sleepEnabled:true});return;}
    customOpen=false;const n=Number(v);paintSleep({...current,sleepEnabled:true,sleepSeconds:n});update({sleepEnabled:true,sleepSeconds:n});
  }));
  $('sleep-chips').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    const items=[...document.querySelectorAll('[data-sleep]')],i=items.indexOf(document.activeElement);if(i<0)return;
    e.preventDefault();const next=items[(i+(e.key==='ArrowLeft'||e.key==='ArrowUp'?items.length-1:1))%items.length];next.focus();next.click();
  });
  function commitSeconds(){
    const raw=Number(seconds.value);
    const n=clampSeconds(seconds.value===''?(current.sleepSeconds||90):raw);
    seconds.value=n;customOpen=!presets.includes(n)||customOpen;
    update({sleepEnabled:true,sleepSeconds:n});
  }
  seconds.addEventListener('change',commitSeconds);
  seconds.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitSeconds();}});
  // Tabs (arrow keys move between them).
  const tabs=[...document.querySelectorAll('[data-tab]')];
  function select(tab){
    tabs.forEach(t=>{const on=t===tab;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;});
    document.querySelectorAll('[data-panel]').forEach(p=>{p.hidden=p.dataset.panel!==tab.dataset.tab;});
    closeSheets();
  }
  tabs.forEach(t=>t.addEventListener('click',()=>select(t)));
  document.querySelector('.tabs').addEventListener('keydown',e=>{
    const i=tabs.indexOf(document.activeElement);if(i<0)return;
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const t=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];t.focus();select(t);}
  });
  // "?" help and 关于 sheets cover the panel area; one at a time.
  const sheets={help:[$('help'),$('help-toggle')],about:[$('about'),$('about-toggle')]};
  function closeSheets(except){for(const [k,[sheet,btn]] of Object.entries(sheets))if(k!==except){sheet.hidden=true;btn.setAttribute('aria-expanded','false');}}
  for(const [k,[sheet,btn]] of Object.entries(sheets))btn.addEventListener('click',()=>{const open=sheet.hidden;closeSheets(k);sheet.hidden=!open;btn.setAttribute('aria-expanded',String(open));});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheets();});
  $('usage').addEventListener('click',()=>Promise.resolve(bridge.usage?.()).catch(()=>{}));
  $('retry-input').addEventListener('click',()=>Promise.resolve(bridge.retry?.()).catch(()=>{}));
  async function systemAction(button,action){
    button.disabled=true;$('system-status').textContent='处理中…';
    try{await action();$('system-status').textContent='';}
    catch(e){$('system-status').textContent=e?.message||String(e)||'操作未完成，请重试';}
    finally{button.disabled=false;}
  }
  $('autostartEnabled').addEventListener('change',e=>{
    const enabled=e.target.checked;
    systemAction(e.target,async()=>{try{await bridge.autostart(enabled);}catch(e){$('autostartEnabled').checked=current.autostartEnabled===true;throw e;}});
  });
  $('check-updates').addEventListener('click',e=>systemAction(e.currentTarget,()=>bridge.checkUpdates()));
  $('uninstall').addEventListener('click',e=>systemAction(e.currentTarget,()=>bridge.uninstall()));
  const unsubscribe=bridge.state(render);bridge.snapshot().then(render);
  window.addEventListener('beforeunload',()=>{active=false;unsubscribe();});
})();
