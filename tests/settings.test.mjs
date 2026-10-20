import {parseHTML} from './dom-test-worker.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
  const {window,document}=parseHTML(fs.readFileSync(new URL('../web/settings.html',import.meta.url),'utf8'));
  let listener,fail=false;const calls=[];
  let state={scale:1,sleepSeconds:90,phase:'listening',version:'0.2.1',autostartEnabled:false,installed:true};
  const notify=patch=>{state={...state,...patch};listener?.(state);};
  window.clawdDesktop={state(fn){listener=fn;return()=>{};},snapshot:async()=>state,
    updateSettings:async patch=>{calls.push(['preferences',patch]);notify(patch);},
    autostart:async enabled=>{calls.push(['autostart',enabled]);if(fail)throw new Error('registry denied');notify({autostartEnabled:enabled});},
    checkUpdates:async()=>{calls.push(['update']);},uninstall:async()=>{calls.push(['uninstall']);}};
  vm.runInContext(fs.readFileSync(new URL('../web/settings-renderer.js',import.meta.url),'utf8'),vm.createContext({window,document}));
  return {document,window,calls,notify,fail:()=>{fail=true;},click:id=>document.getElementById(id).dispatchEvent(new window.Event('click',{bubbles:true})),change:(id,value)=>{const input=document.getElementById(id);input.checked=value;input.dispatchEvent(new window.Event('change',{bubbles:true}));}};
}
test('system settings call native actions independently of display preferences',async()=>{
  const s=setup();await flush();s.click('tab-system');
  assert.equal(s.document.getElementById('panel-system').hidden,false);
  s.change('autostartEnabled',true);await flush();assert.equal(s.document.getElementById('autostartEnabled').checked,true);
  s.click('check-updates');await flush();s.click('uninstall');await flush();
  assert.deepEqual(s.calls,[['autostart',true],['update'],['uninstall']]);
  s.change('mirrored',true);await flush();assert.equal(s.calls[3][1].mirrored,true);
});
test('failed autostart write restores the actual checkbox and reports failure',async()=>{
  const s=setup();await flush();s.fail();s.change('autostartEnabled',true);await flush();
  assert.equal(s.document.getElementById('autostartEnabled').checked,false);
  assert.equal(s.document.getElementById('autostartEnabled').disabled,false);
  assert.match(s.document.getElementById('system-status').textContent,/registry denied/);
  s.notify({installed:false});assert.match(s.document.getElementById('install-note').textContent,/便携版/);
});

test('appearance can persist the original short-hand mode and restore directional mode',async()=>{
 const s=setup();await flush();assert.equal(s.document.getElementById('directionalArms').checked,true);
 s.change('directionalArms',false);await flush();assert.equal(s.calls[0][1].directionalArms,false);
 s.notify({directionalArms:false});assert.equal(s.document.getElementById('directionalArms').checked,false);
 s.change('directionalArms',true);await flush();assert.equal(s.calls[1][1].directionalArms,true);
});
