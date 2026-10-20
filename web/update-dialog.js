(function(global){
 'use strict';
 global.createClawdUpdateDialog=function(root,bridge){
  const $=s=>root.querySelector(s),title=$('[data-update-title]'),message=$('[data-update-message]'),version=$('[data-update-version]'),notes=$('[data-update-notes]'),noteBlock=$('[data-update-notes-block]'),progress=$('[data-update-progress]'),fill=$('[data-update-fill]'),primary=$('[data-update-primary]'),later=$('[data-update-later]'),close=$('[data-update-close]'),snooze=$('[data-update-snooze]'),snoozeLabel=$('[data-update-snooze-label]'),error=$('[data-update-local-error]');
  let value={phase:'idle'},disposed=false,acting=false;
  const busy=()=>['checking','downloading','verifying','installing'].includes(value.phase);
  function render(next){
   if(disposed)return;if(next?.phase==='available'&&value.phase!=='available')snooze.checked=false;value=next||{phase:'idle'};
   const phase=value.phase;
   title.textContent=({idle:'小蟹更新',checking:'小蟹正在检查更新',current:'已经是最新版本',available:'发现小蟹新版本！',downloading:'正在下载更新',verifying:'正在校验更新包',installing:'准备打开安装向导',success:'更新完成！',error:'这次更新没成功'})[phase]||'小蟹更新';
   message.textContent=phase==='error'?value.error||'请稍后重试。':({checking:'正在查看有没有新版本…',current:'小蟹已经准备好继续工作。',available:value.installed?'安装向导会更新当前安装位置，并保留个人设置。':'将下载并打开安装版向导，个人设置会保留。',downloading:'下载完成后会核对 SHA-256，再打开安装向导。',verifying:'确认下载内容完整且与发布版本一致。',installing:'小蟹将退出，随后打开安装向导。',success:value.message||'小蟹变得更厉害了一点！'})[phase]||'';
   version.textContent=value.release?.version?'版本 '+value.release.version:'';
   noteBlock.hidden=!['available','current'].includes(phase);notes.textContent=value.release?.notes||'发布者暂未提供更新日志。';
   progress.hidden=!busy();const finite=phase==='downloading'&&Number.isFinite(value.progress);progress.classList.toggle('is-indeterminate',!finite);fill.style.width=finite?Math.round(Math.max(0,Math.min(1,value.progress))*100)+'%':'28%';if(finite)progress.setAttribute('aria-valuenow',String(Math.round(value.progress*100)));else progress.removeAttribute('aria-valuenow');progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');progress.setAttribute('aria-label',finite?'下载进度 '+Math.round(value.progress*100)+'%':'处理中');
   close.disabled=busy()||acting;later.hidden=busy();later.disabled=acting;later.textContent=phase==='available'?'稍后':'知道啦';
   primary.hidden=!['available','error'].includes(phase);primary.disabled=acting;primary.textContent=phase==='error'?'重新检查':value.installed?'下载并更新':'下载安装版';
   snoozeLabel.hidden=phase!=='available';error.hidden=true;
  }
  async function action(fn){if(acting)return;acting=true;error.hidden=true;primary.disabled=later.disabled=close.disabled=true;try{await fn();}catch(e){error.textContent=e?.message||String(e);error.hidden=false;}finally{acting=false;if(!disposed){const text=error.textContent,failed=!error.hidden;render(value);if(failed){error.textContent=text;error.hidden=false;}}}}
  const dismiss=()=>{if(!busy())return action(()=>bridge.dismissUpdate(snooze.checked));};
  const onPrimary=()=>action(()=>value.phase==='error'?bridge.checkUpdates():bridge.installUpdate());
  const onKey=e=>{if(e.key==='Escape'&&!busy()){e.preventDefault();dismiss();}};
  primary.addEventListener('click',onPrimary);later.addEventListener('click',dismiss);close.addEventListener('click',dismiss);root.addEventListener('keydown',onKey);
  const unsubscribe=bridge.updates(render);bridge.updateSnapshot().then(render).catch(e=>render({phase:'error',error:e?.message||String(e)}));
  return {render,destroy(){disposed=true;unsubscribe?.();primary.removeEventListener('click',onPrimary);later.removeEventListener('click',dismiss);close.removeEventListener('click',dismiss);root.removeEventListener('keydown',onKey);}};
 };
})(window);
