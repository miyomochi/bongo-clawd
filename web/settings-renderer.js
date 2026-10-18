(function(){
  'use strict';
  const bridge=window.clawdDesktop;
  const ids=['alwaysOnTop','showTopBar','showBottomBar','showOnStartup','sleepEnabled'];
  const scale=document.getElementById('scale'),output=document.getElementById('scale-output'),seconds=document.getElementById('sleepSeconds'),status=document.getElementById('save-status');
  let active=true;
  function render(value){
    for(const id of ids)document.getElementById(id).checked=value[id]!==false;
    if(document.activeElement!==scale)scale.value=Math.round((value.scale||1)*100);
    output.textContent=scale.value+'%';
    if(document.activeElement!==seconds)seconds.value=value.sleepSeconds||90;
    seconds.disabled=value.sleepEnabled===false;
    document.getElementById('toggle-input').textContent=value.enabled?'暂停全局联动':'启用全局联动';
  }
  async function update(patch){
    status.textContent='正在保存…';
    try{await bridge.updateSettings(patch);if(active)status.textContent='设置会自动保存';}
    catch{if(active)status.textContent='未能应用，请重试';}
  }
  for(const id of ids)document.getElementById(id).addEventListener('change',e=>update({[id]:e.target.checked}));
  scale.addEventListener('input',()=>{output.textContent=scale.value+'%';update({scale:Number(scale.value)/100});});
  seconds.addEventListener('change',()=>{if(seconds.checkValidity())update({sleepSeconds:Number(seconds.value)});else seconds.reportValidity();});
  document.getElementById('reset-size').addEventListener('click',()=>{scale.value=100;update({scale:1});});
  document.getElementById('toggle-input').addEventListener('click',()=>bridge.toggle());
  document.getElementById('done').addEventListener('click',()=>bridge.closeSettings());
  const unsubscribe=bridge.state(render);bridge.snapshot().then(render);
  window.addEventListener('beforeunload',()=>{active=false;unsubscribe();});
})();
