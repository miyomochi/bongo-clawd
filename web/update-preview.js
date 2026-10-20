(function(){
 'use strict';
 const root=document.getElementById('update-preview'),dialogRoot=document.getElementById('update-dialog'),host=document.querySelector('.dialog-host'),idle=document.querySelector('[data-idle-note]'),pref=document.querySelector('[data-auto-check]'),daily=document.querySelector('[data-daily-status]');
 const rig=JSON.parse(document.getElementById('clawd-rig-data').textContent);
 const c=window.createClawdController(root,rig,{bindInput:false,bindDemo:false,accessoryStorage:false,sleepEnabled:false,breathingEnabled:false});window.clawdLabController=c;
 let state={phase:'idle'},timers=new Set(),listeners=new Set(),failure=false,audio=null;
 const key='clawd-update-preview-v1',today=()=>{const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
 let saved={enabled:true,checked:'',snoozed:''};try{saved={...saved,...JSON.parse(localStorage.getItem(key)||'{}')};}catch{}
 pref.checked=saved.enabled;
 const release={version:'0.3.0',notes:'这是预览用的示例版本与日志，并非已发布版本。\n\n• 小短手按远近、内外分区伸缩\n• 点击小蟹时出现互动回应\n• 每天首次启动自动检查更新，可关闭\n• 新版提醒显示更新日志\n• 下载校验、安装衔接与成功庆祝'};
 function persist(){try{localStorage.setItem(key,JSON.stringify(saved));}catch{}daily.textContent=saved.snoozed===today()?'今天已选择不再提醒':saved.checked===today()?'今天已经检查过了':'下次模拟启动可以自动检查';}
 function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;}
 function chime(success=false){if(!document.querySelector('[data-sound]').checked||!audio)return;try{const begin=audio.currentTime;for(const [i,hz]of (success?[1046,1318]:[880,660]).entries()){const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(0,begin+i*.16);g.gain.linearRampToValueAtTime(.055,begin+i*.16+.015);g.gain.exponentialRampToValueAtTime(.001,begin+i*.16+.22);o.connect(g);g.connect(audio.destination);o.start(begin+i*.16);o.stop(begin+i*.16+.24);}}catch{}}
 document.addEventListener('click',()=>{try{const A=window.AudioContext||window.webkitAudioContext;if(A){audio=audio||new A();audio.resume();}}catch{}},{capture:true});
 function set(next){state={installed:true,...next};c.setUpdateState(state);const show=state.phase!=='idle'&&state.phase!=='success'&&(state.phase!=='checking'||state.manual);host.hidden=!show;idle.hidden=show;idle.textContent=state.phase==='success'?'新版已启动，小蟹在庆祝！':'选择一个场景，或模拟每天首次启动。';listeners.forEach(fn=>fn(state));window.clawdUpdatePreviewState=state;}
 function reset(){timers.forEach(clearTimeout);timers.clear();set({phase:'idle'});}
 function check(scenario='found',manual=true){reset();failure=scenario==='download-error';saved.checked=today();persist();set({phase:'checking',manual});later(()=>{if(scenario==='check-error'){set({phase:'error',manual,error:'连接更新服务器失败。请检查网络后重试。'});return;}if(scenario==='current'){set({phase:'current',manual,release:{version:'0.2.1',notes:'当前已是最新版。'}});if(!manual)later(()=>set({phase:'idle'}),1100);return;}set({phase:'available',manual,release});chime();},1800);}
 const bridge={updates(fn){listeners.add(fn);return()=>listeners.delete(fn);},updateSnapshot:async()=>state,checkUpdates:async()=>check(),dismissUpdate:async snooze=>{if(snooze){saved.snoozed=today();persist();}reset();},installUpdate:async()=>{
  set({phase:'downloading',release,progress:0});let p=0;
  function step(){p=Math.min(1,p+.065);if(failure&&p>=.42){set({phase:'error',error:'下载连接中断，更新尚未安装。关闭提示后可以继续工作。'});return;}set({phase:'downloading',release,progress:p});if(p<1){later(step,150);return;}later(()=>{set({phase:'verifying',release});later(()=>{set({phase:'installing',release});later(()=>{set({phase:'idle'});later(()=>{set({phase:'success',message:'模拟新版已成功启动'});chime(true);later(()=>set({phase:'idle'}),4000);},350);},1200);},1000);},250);}later(step,150);
 }};
 const dialog=window.createClawdUpdateDialog(dialogRoot,bridge);
 document.querySelectorAll('[data-update-scenario]').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.updateScenario;if(v==='success'){reset();set({phase:'success'});chime(true);later(()=>set({phase:'idle'}),4000);}else check(v);}));
 document.querySelector('[data-simulate-start]').addEventListener('click',()=>{if(['checking','downloading','verifying','installing'].includes(state.phase))return;if(saved.enabled&&saved.checked!==today()&&saved.snoozed!==today())check('found',false);else{reset();idle.textContent=saved.enabled?'今天已经检查过，直接开始工作。':'自动检查已关闭，直接开始工作。';}});
 document.querySelector('[data-new-day]').addEventListener('click',()=>{saved.checked=saved.snoozed='';persist();reset();});
 pref.addEventListener('change',()=>{saved.enabled=pref.checked;persist();});persist();set({phase:'idle'});
 window.addEventListener('pagehide',()=>{timers.forEach(clearTimeout);timers.clear();dialog.destroy();c.destroy();audio?.close();},{once:true});
})();
