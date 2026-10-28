import {parseHTML} from './dom-test-worker.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const page=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
function setup(random=.2,preferences={}){
  const {window,document}=parseHTML(page);window.matchMedia=()=>({matches:false});
  let now=0,id=0,inputListener,stateListener,accessoryListener;const timers=new Map();
  const set=(fn,ms=0)=>{timers.set(++id,{fn,at:now+ms});return id;};
  const clear=id=>timers.delete(id);const math=Object.create(Math);math.random=()=>random;
  const saved={phase:'listening',enabled:true,running:true,accessory:'none',directionalArms:false,...preferences};
  let failSave=false;
  const notify=patch=>{Object.assign(saved,patch);stateListener?.({...saved});};
  window.clawdDesktop={
    statistics:async()=>({total:1234,perMinute:87}),
    input:fn=>{inputListener=fn;return()=>{inputListener=null;}},state:fn=>{stateListener=fn;return()=>{stateListener=null;}},
    accessories:fn=>{accessoryListener=fn;return()=>{accessoryListener=null;}},snapshot:()=>({then:fn=>fn({...saved})}),
    async adjustment(open){inputListener?.({type:'reset'});notify({accessoryOpen:open,phase:open?'paused':'listening',running:!open});},
    async updateSettings(patch){if(failSave)throw new Error('save failed');notify(patch);return {...saved};},
    toggle(){notify({enabled:!saved.enabled,running:!saved.enabled,phase:saved.enabled?'paused':'listening'});},
    settings(){notify({settingsOpen:true,phase:'paused',running:false});},menu(){},hide(){}
  };
  const context=vm.createContext({window,document,Math:math,performance:{now:()=>now},setTimeout:set,clearTimeout:clear,requestAnimationFrame:fn=>set(()=>fn(now),16),cancelAnimationFrame:clear});
  vm.runInContext(fs.readFileSync(new URL('../web/core/clawd.bundle.js',import.meta.url),'utf8'),context);
  for(const file of ['clawd-reach','clawd-reactions','clawd-update-visuals'])vm.runInContext(fs.readFileSync(new URL('../web/core/'+file+'.js',import.meta.url),'utf8'),context);
  vm.runInContext(fs.readFileSync(new URL('../web/desktop-renderer.js',import.meta.url),'utf8'),context);
  const advance=dt=>{const end=now+dt;let n=0;while(true){let first;for(const [i,t] of timers)if(t.at<=end&&(!first||t.at<first[1].at))first=[i,t];if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();assert(++n<100000);}now=end;};
  return {window,document,c:window.clawdDesktopController,timers,advance,saved,failSave:()=>{failSave=true;},openAccessories:()=>accessoryListener(),click:selector=>document.querySelector(selector).dispatchEvent(new window.Event('click',{bubbles:true})),input:v=>inputListener(v),state:v=>notify(v),destroy:()=>window.dispatchEvent(new window.Event('beforeunload'))};
}
test('background key events light the real keys, including simultaneous hands',()=>{
  const s=setup();s.input({type:'key',code:'KeyA',down:true});s.input({type:'key',code:'KeyJ',down:true});
  s.advance(45);assert.equal(s.c.getState().left,'down');assert.equal(s.c.getState().right,'down');assert.equal(s.c.getState().keys.length,2);
  s.window.dispatchEvent(new s.window.Event('blur'));assert.equal(s.c.getState().keys.length,2);
  s.input({type:'key',code:'KeyA',down:false});s.input({type:'key',code:'KeyJ',down:false});s.advance(100);assert.equal(s.c.getState().keys.length,0);s.destroy();assert.equal(s.timers.size,0);
});
test('bubbles reserve only the near paw while desktop keys, reach and mouse remain live',()=>{
 for(const directionalArms of[false,true]){
  const s=setup(.2,{directionalArms});assert(s.c.showBubbles());s.advance(2400);
  const left=s.document.querySelector('#left-hand'),wand=s.document.querySelector('#bubble-wand');
  const markup=left.innerHTML;
  for(const code of['KeyA','KeyJ','Space','Space']){
   s.input({type:'key',code,down:true});assert(s.c.getState().keys.includes(code));assert(s.document.querySelector('#key-'+code).classList.contains('is-down'));
   assert.equal(left.innerHTML,markup,'left-hand input must not overwrite the held ring even before the next frame');
   if(code==='KeyJ')assert.notEqual(s.c.getState().right,'idle');
   s.advance(48);assert.equal(s.c.getState().left,'bubbles');assert.equal(left.getAttribute('transform'),s.document.querySelector('#hands-motion').getAttribute('transform'));assert.equal(wand.getAttribute('transform'),left.getAttribute('transform'));
   s.input({type:'key',code,down:false});s.advance(252);
  }
  assert.equal(s.c.getState().rate,2,'both hands and Space are counted normally');
  s.input({type:'move',dx:2,dy:1});s.advance(20);s.input({type:'button',button:0,down:true});
  assert.equal(s.c.getState().right,'mouse');s.advance(900);assert(s.c.getState().mouse);assert.equal(s.c.getState().bubbles,'bubbling');
  s.input({type:'button',button:0,down:false});s.advance(900);assert.equal(s.c.getState().bubbles,'stowing');
  s.advance(1000);assert.equal(left.parentNode.id,'hands-motion');assert.equal(left.getAttribute('transform'),null);
  s.input({type:'key',code:'KeyA',down:true});s.advance(48);assert.equal(s.c.getState().left,'down');assert.equal(s.c.getState().bubbles,'drifting');
  s.input({type:'key',code:'KeyA',down:false});s.advance(1200);assert.equal(s.c.getState().bubbles,'none');s.destroy();assert.equal(s.timers.size,0);
 }
});
test('magic keeps native input mapped through flat mode in both arm modes and restores clothing',()=>{
 for(const directionalArms of[false,true]){
  const s=setup(.2,{directionalArms,accessory:'detective-hat'});assert(s.c.showMagic());s.advance(1200);
  for(const code of['KeyA','KeyJ'])s.input({type:'key',code,down:true});s.advance(48);assert.equal(s.c.getState().left,'down');assert.equal(s.c.getState().right,'down');
  for(const code of['KeyA','KeyJ'])s.input({type:'key',code,down:false});s.advance(6000);assert(s.c.getState().magicFlat);
  const left=s.document.querySelector('#left-hand').innerHTML,right=s.document.querySelector('#right-hand').innerHTML;
  for(const code of['KeyA','KeyJ','Space']){s.input({type:'key',code,down:true});assert(s.c.getState().keys.includes(code));s.input({type:'key',code,down:false});s.advance(180);}
  assert.equal(s.document.querySelector('#left-hand').innerHTML,left);assert.equal(s.document.querySelector('#right-hand').innerHTML,right);assert.equal(s.c.getState().rate,1.5);
  s.advance(5600);assert.equal(s.c.getState().magic,'none');assert.equal(s.document.querySelector('#body-motion').getAttribute('visibility'),null);assert.equal(s.document.querySelector('#detective-hat-front').getAttribute('display'),'inline');
  s.input({type:'key',code:'KeyA',down:true});s.advance(48);assert.equal(s.c.getState().left,'down');s.input({type:'key',code:'KeyA',down:false});
  s.c.clearAll();s.c.showMagic();s.advance(7100);assert(s.c.react('jelly'));assert.equal(s.c.getState().magic,'none');assert.equal(s.document.querySelector('#hands-motion').getAttribute('visibility'),null);s.destroy();assert.equal(s.timers.size,0);
 }
});
test('native repeats do not create false busy speed and Pause cannot stick',()=>{
  const s=setup();s.input({type:'key',code:'KeyA',down:true});for(let i=0;i<30;i++){s.advance(80);s.input({type:'key',code:'KeyA',down:true});}assert.equal(s.c.getState().busy,0);
  s.input({type:'key',code:'KeyA',down:false});s.input({type:'key',code:'Pause',down:true});s.advance(100);assert.equal(s.c.getState().keys.length,0);s.destroy();assert.equal(s.timers.size,0);
});
test('global mouse movement and both buttons are reflected, pause clears held input',()=>{
  const s=setup();s.input({type:'move',dx:2,dy:1});s.advance(20);assert(s.c.getState().mouse);
  s.input({type:'button',button:2,down:true});assert(s.document.querySelector('#mouse-right-button').classList.contains('is-clicked'));
  s.input({type:'button',button:2,down:false});assert(!s.document.querySelector('#mouse-right-button').classList.contains('is-clicked'));
  s.input({type:'key',code:'KeyA',down:true});s.state({phase:'paused',enabled:false,running:false});assert.equal(s.c.getState().keys.length,0);assert(!s.c.getState().mouse);
  s.state({phase:'listening',enabled:true,running:true});s.advance(92000);assert.equal(s.c.getState().sleep,'asleep');s.input({type:'move',dx:1,dy:1});s.advance(20);assert.equal(s.c.getState().wake,'startled');s.destroy();assert.equal(s.timers.size,0);
});
test('initial idle sleep, startled sequence and pretend typing remain independent of actual input',()=>{
  const s=setup();s.advance(92000);assert.equal(s.c.getState().sleep,'asleep');s.input({type:'key',code:'KeyA',down:true});s.input({type:'key',code:'KeyA',down:false});s.advance(1200);assert.equal(s.c.getState().wake,'pretending');assert.equal(s.c.getState().keys.length,0);s.advance(3200);assert.equal(s.c.getState().wake,'pretending');s.advance(300);assert.equal(s.c.getState().wake,'calming');s.advance(600);assert.equal(s.c.getState().wake,'none');s.destroy();assert.equal(s.timers.size,0);
});

test('left keyboard and right mouse act independently, including a stationary drag',()=>{
  const s=setup();s.input({type:'move',dx:2,dy:1});s.advance(20);s.input({type:'button',button:0,down:true});
  s.input({type:'key',code:'KeyA',down:true});s.advance(45);assert.equal(s.c.getState().left,'down');assert.equal(s.c.getState().right,'mouse');assert(s.c.getState().mouse);
  s.advance(900);assert.equal(s.c.getState().right,'mouse');assert(s.c.getState().mouse);assert(s.c.getState().keys.includes('KeyA'));
  s.input({type:'key',code:'Space',down:true});s.advance(45);assert.equal(s.c.getState().right,'mouse');assert.equal(s.c.getState().left,'down');
  s.input({type:'key',code:'KeyA',down:false});s.input({type:'key',code:'Space',down:false});s.input({type:'button',button:0,down:false});s.advance(700);assert(!s.c.getState().mouse);s.destroy();assert.equal(s.timers.size,0);
});
test('right keyboard takes its own hand back while mouse motion preserves a left tap',()=>{
  const s=setup();s.input({type:'key',code:'KeyA',down:true});s.advance(40);s.input({type:'move',dx:2,dy:1});s.advance(20);assert.equal(s.c.getState().left,'down');assert.equal(s.c.getState().right,'mouse');
  s.input({type:'key',code:'KeyJ',down:true});s.advance(45);assert(!s.c.getState().mouse);assert.equal(s.c.getState().right,'down');s.destroy();assert.equal(s.timers.size,0);
});
test('mouse movement does not erase sustained real left-hand typing speed',()=>{
  const s=setup();for(let i=0;i<20;i++){s.input({type:'move',dx:1,dy:0});s.advance(16);s.input({type:'key',code:'KeyA',down:true});s.input({type:'key',code:'KeyA',down:false});s.advance(114);}assert(s.c.getState().busy>0);assert(s.c.getState().mouse);s.destroy();assert.equal(s.timers.size,0);
});

test('default sleep waits 90 seconds and restarts from the last release',()=>{
  const s=setup();s.advance(85000);assert.equal(s.c.getState().sleep,'awake');
  s.input({type:'key',code:'KeyA',down:true});s.advance(10000);assert.equal(s.c.getState().sleep,'awake');
  s.input({type:'key',code:'KeyA',down:false});s.advance(87000);assert.equal(s.c.getState().sleep,'awake');
  s.advance(3100);assert.equal(s.c.getState().sleep,'asleep');s.destroy();assert.equal(s.timers.size,0);
});
test('sleep timing can change live and disabled sleep preserves idle looks and manual preview',()=>{
  const s=setup();s.c.configure({sleepSeconds:60});s.advance(60100);assert.equal(s.c.getState().sleep,'asleep');
  s.c.configure({sleepEnabled:false});assert.equal(s.c.getState().sleep,'awake');s.advance(180000);assert.equal(s.c.getState().sleep,'awake');
  s.c.sleep();s.advance(2500);assert.equal(s.c.getState().sleep,'asleep');s.destroy();assert.equal(s.timers.size,0);
});
test('appearance preferences (side buttons, legacy bar keys) do not reset held input or sleep countdown',()=>{
  const s=setup();s.advance(70000);
  assert.equal(s.document.querySelector('.handle'),null);assert.equal(s.document.querySelector('.footer'),null);
  s.state({phase:'listening',enabled:true,running:true,showTopBar:false,showBottomBar:false,sideButtons:false,scale:1.17,sleepSeconds:90});
  assert(s.document.querySelector('#clawd-desktop').classList.contains('no-side'));
  assert.equal(s.document.querySelector('#clawd-desktop').style.width,'352px');
  s.advance(20100);assert.equal(s.c.getState().sleep,'asleep');
  s.state({sideButtons:true});assert.equal(s.document.querySelector('#clawd-desktop').style.width,'388px');
  s.destroy();assert.equal(s.timers.size,0);
});


test('the 30-second minimum chooses gaming once after the idle looks',()=>{
  const s=setup(.99);s.c.configure({sleepSeconds:30});s.advance(26900);assert.equal(s.c.getState().sleep,'awake');
  s.advance(3200);assert.equal(s.c.getState().sleep,'awake');assert.notEqual(s.c.getState().gaming,'none');s.destroy();assert.equal(s.timers.size,0);
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('idle look captions rotate once per episode and remain steady through its animation',()=>{
 const s=setup();const lines=[];
 for(let i=0;i<4;i++){
  s.c.lookAround();const line=s.document.querySelector('[data-status]').textContent;lines.push(line);
  for(let j=0;j<4;j++){s.advance(400);assert.equal(s.document.querySelector('[data-status]').textContent,line);}
  s.c.clearAll();
 }
 assert.deepEqual(lines,['好安静啊','……人呢？','嗯？没人吧……','好安静啊']);
 s.destroy();assert.equal(s.timers.size,0);
});
test('fast typing captions alternate across sessions, without changing every activity tick',()=>{
 const s=setup();const lines=[];
 for(let session=0;session<2;session++){
  let line;
  for(let i=0;i<65;i++){
   s.input({type:'key',code:'KeyA',down:true});s.input({type:'key',code:'KeyA',down:false});s.advance(70);
   if(s.c.getState().busy===2){
    const text=s.document.querySelector('[data-status]').textContent;
    if(line)assert.equal(text,line);else line=text;
   }
  }
  assert(line);lines.push(line);s.advance(6500);assert.equal(s.c.getState().busy,0);
 }
 assert.deepEqual(lines,['忙不过来了！','Ultra Clawding!!']);
 s.destroy();assert.equal(s.timers.size,0);
});
test('saved head accessory is restored on startup without playing a fitting animation',()=>{
 const s=setup(.2,{accessory:'duck'});
 assert.equal(s.c.getState().accessory.selected,'duck');assert.equal(s.c.getState().accessory.preview,false);
 assert.equal(s.document.querySelector('#duck-front').getAttribute('display'),'inline');
 s.advance(1000);assert.equal(s.c.getState().happy,'none');s.destroy();assert.equal(s.timers.size,0);
});
test('native menu opens fitting, drops global inputs and reset events, then confirms without replay',async()=>{
 const s=setup();s.input({type:'key',code:'KeyA',down:true});s.openAccessories();await flush();
 assert.equal(s.c.getState().accessory.menuOpen,true);assert.equal(s.c.getState().keys.length,0);
 assert.equal(s.document.querySelector('#clawd-desktop').style.height,'466px');
 const radio=s.document.querySelector('[value="duck"]');radio.checked=true;radio.dispatchEvent(new s.window.Event('change',{bubbles:true}));
 s.advance(288);assert.equal(s.c.getState().expression,'duck');
 for(let i=0;i<20;i++){s.input({type:'key',code:'KeyJ',down:true});s.input({type:'move',dx:2,dy:1});}
 s.input({type:'reset'});assert.equal(s.c.getState().accessory.preview,true);assert.equal(s.c.getState().keys.length,0);
 s.click('[data-accessory-confirm]');await flush();assert.equal(s.saved.accessory,'duck');
 assert.equal(s.c.getState().accessory.menuOpen,false);assert.equal(s.c.getState().accessory.preview,true);
 s.advance(1100);assert.equal(s.c.getState().accessory.preview,false);s.input({type:'key',code:'KeyJ',down:true});
 assert.deepEqual([...s.c.getState().keys],['KeyJ']);s.destroy();assert.equal(s.timers.size,0);
});
test('cancel restores persisted accessory and failed saves keep the fitting menu open',async()=>{
 const s=setup(.2,{accessory:'sprout'});s.openAccessories();await flush();
 s.c.selectAccessory('cat-headphones');s.advance(300);s.click('[data-accessory-cancel]');await flush();
 assert.equal(s.saved.accessory,'sprout');assert.equal(s.c.getState().accessory.selected,'sprout');
 s.openAccessories();await flush();s.c.selectAccessory('duck');s.failSave();s.click('[data-accessory-confirm]');await flush();
 assert.equal(s.c.getState().accessory.menuOpen,true);assert.equal(s.saved.accessory,'sprout');
 assert.equal(s.document.querySelector('[data-accessory-error]').hidden,false);s.destroy();assert.equal(s.timers.size,0);
});
test('fitting speech is silent in-menu, waits after early confirm, and survives ordinary narration',async()=>{
 const s=setup(),bubble=s.document.querySelector('[data-bubble]'),text=s.document.querySelector('[data-bubble-text]');
 s.openAccessories();await flush();s.c.selectAccessory('sprout');await flush();s.advance(300);await flush();
 assert.equal(bubble.hidden,true);
 s.click('[data-accessory-confirm]');await flush();s.advance(800);await flush();assert.equal(bubble.hidden,true);
 s.advance(500);await flush();assert.equal(bubble.hidden,false);assert.equal(text.textContent,'啵，长高一点点');
 s.input({type:'key',code:'KeyA',down:true});s.input({type:'key',code:'KeyA',down:false});await flush();assert.equal(bubble.hidden,false);
 s.advance(3000);assert.equal(bubble.hidden,true);s.destroy();assert.equal(s.timers.size,0);
});
test('an ended preview speaks immediately on confirm, while cancellation stays silent',async()=>{
 const s=setup(),bubble=s.document.querySelector('[data-bubble]');
 s.openAccessories();await flush();s.c.selectAccessory('duck');s.advance(1500);await flush();assert.equal(bubble.hidden,true);
 s.click('[data-accessory-confirm]');await flush();assert.equal(bubble.hidden,false);
 s.openAccessories();await flush();assert.equal(bubble.hidden,true);s.c.selectAccessory('headphones');s.advance(100);
 s.click('[data-accessory-cancel]');await flush();s.advance(2000);await flush();assert.equal(bubble.hidden,true);
 s.destroy();assert.equal(s.timers.size,0);
});
test('settings and native popup pause all natural behavior and resume without queued input',()=>{
 const s=setup();s.c.showHappy();s.state({settingsOpen:true,phase:'paused',running:false});
 assert.equal(s.c.getState().paused,true);assert.equal(s.c.getState().happy,'none');
 s.input({type:'key',code:'KeyA',down:true});s.advance(600000);
 assert.equal(s.c.getState().sleep,'awake');assert.equal(s.c.getState().looking,false);assert.equal(s.timers.size,0);
 s.state({settingsOpen:false,phase:'listening',running:true});s.input({type:'key',code:'KeyA',down:true});
 assert(s.c.getState().keys.includes('KeyA'));
 s.state({popupOpen:true});s.advance(10000);assert.equal(s.c.getState().keys.length,0);assert.equal(s.timers.size,0);
 s.state({popupOpen:false});s.advance(92000);assert.equal(s.c.getState().sleep,'asleep');s.destroy();assert.equal(s.timers.size,0);
});
test('manual pause rejects input and no awake egg starts during the pause',()=>{
 const s=setup();s.state({phase:'paused',enabled:false,running:false});s.advance(700000);
 s.input({type:'key',code:'KeyA',down:true});assert.equal(s.c.getState().keys.length,0);
 assert.equal(s.c.getState().cool,'none');assert.equal(s.c.getState().happy,'none');assert.equal(s.timers.size,0);
 s.state({phase:'listening',enabled:true,running:true});s.input({type:'key',code:'KeyA',down:true});
 assert(s.c.getState().keys.includes('KeyA'));s.destroy();assert.equal(s.timers.size,0);
});

test('optional one-line statistics use native aggregates and reset when disabled',async()=>{
 const s=setup();assert(s.document.querySelector('[data-statistics]').hidden);
 s.state({statisticsEnabled:true});await flush();
 assert.equal(s.document.querySelector('#clawd-desktop').style.height,'300px');
 assert.equal(s.document.querySelector('[data-statistics]').textContent,'敲击 1234　速度 87/分');
 s.state({showTopBar:false,showBottomBar:false});
 assert.equal(s.document.querySelector('[data-statistics]').hidden,false);
 s.state({statisticsEnabled:false});await flush();
 assert(s.document.querySelector('[data-statistics]').hidden);
 assert.equal(s.document.querySelector('[data-statistics]').textContent,'敲击 0　速度 0/分');
 s.destroy();assert.equal(s.timers.size,0);
});
test('statistics abbreviate at ten thousand as x.x万 without rounding up',()=>{
 const s=setup();const f=s.window.clawdDesktopFormat;
 assert.equal(f(0),'0');assert.equal(f(9999),'9999');assert.equal(f(10000),'1.0万');assert.equal(f(12345),'1.2万');
 assert.equal(f(19999),'1.9万');assert.equal(f(1234567),'123.4万');assert.equal(f(-1),'—');assert.equal(f(NaN),'—');
 s.destroy();
});
test('manual pause turns the pause block into the status card and the card click resumes',()=>{
 const s=setup();const root=s.document.querySelector('#clawd-desktop'),toggle=s.document.querySelector('[data-toggle]');
 assert(!root.classList.contains('is-paused'));
 s.click('[data-toggle]');assert.equal(s.saved.enabled,false);assert(root.classList.contains('is-paused'));
 assert.equal(toggle.getAttribute('aria-label'),'已暂停 · 点一下继续');assert.equal(s.c.getState().paused,true);
 s.click('[data-toggle]');assert.equal(s.saved.enabled,true);assert(!root.classList.contains('is-paused'));
 s.destroy();assert.equal(s.timers.size,0);
});
test('connection error shows the orange retry bubble only while the phase is error',()=>{
 const s=setup(.2,{phase:'error',running:false});let retried=0;s.window.clawdDesktop.retry=async()=>{retried++;};
 const retry=s.document.querySelector('[data-retry]');
 assert.equal(retry.hidden,false);assert.equal(retry.textContent,'连不上了 · 点我重试');
 s.click('[data-retry]');assert.equal(retried,1);
 s.state({phase:'listening',running:true});assert.equal(retry.hidden,true);
 s.destroy();assert.equal(s.timers.size,0);
});
test('removed bars leave no top/bottom chrome and the status text stays narration-only',()=>{
 const s=setup();
 assert.equal(s.document.querySelector('[data-status]').textContent,'工作中');
 assert.equal(s.document.querySelector('[data-connection]').textContent,'联动中');
 s.state({settingsOpen:true});assert.equal(s.document.querySelector('[data-connection]').textContent,'调整中');
 s.destroy();
});
test('speech lines wait out the built-in thought bubble, then only the still-valid line shows after ~200ms',async()=>{
 const s=setup();const status=s.document.querySelector('[data-status]'),bubble=s.document.querySelector('[data-bubble]'),text=s.document.querySelector('[data-bubble-text]');
 const say=async t=>{status.textContent=t;await new Promise(r=>setImmediate(r));};
 const MO=s.window.MutationObserver;assert.ok(MO,'DOM provides MutationObserver');
 assert.ok(s.c.showHappy());assert.notEqual(s.c.getState().happy,'none');
 await say('哇！');assert.equal(bubble.hidden,true,'suppressed while the thought bubble is up');
 await say('困困的……');s.advance(3000);assert.equal(bubble.hidden,true);
 let t=0;while(s.c.getState().happy!=='none'&&t<10000){s.advance(16);t+=16;}
 assert.equal(s.c.getState().happy,'none');
 await say('嗯？没人吧……');            // latest line, still valid now
 s.advance(120);assert.equal(bubble.hidden,true,'not before the settle delay');
 s.advance(200);assert.equal(bubble.hidden,false);assert.equal(text.textContent,'嗯？没人吧……','stale lines dropped, no queue');
 s.advance(3000);assert.equal(bubble.hidden,true);
 // When the state moved on to narration, nothing pops up afterwards.
 assert.ok(s.c.showHappy());await say('哇！');let u=0;while(s.c.getState().happy!=='none'&&u<10000){s.advance(16);u+=16;}
 await say('等待输入');s.advance(400);assert.equal(bubble.hidden,true);
 s.destroy();
});

test('speech remains silent while settings or native menus pause the controller',async()=>{
 const s=setup(),status=s.document.querySelector('[data-status]'),bubble=s.document.querySelector('[data-bubble]');
 status.textContent='哇！';await flush();assert.equal(bubble.hidden,false);
 s.state({settingsOpen:true,phase:'paused',running:false});await flush();
 assert.equal(bubble.hidden,true);
 status.textContent='困困的……';await flush();assert.equal(bubble.hidden,true);
 s.advance(5000);assert.equal(bubble.hidden,true);s.destroy();assert.equal(s.timers.size,0);
});
test('interrupted thought-bubble waiting leaves no polling or speech after pause',async()=>{
 const s=setup(),status=s.document.querySelector('[data-status]');
 s.c.showHappy();status.textContent='哇！';await flush();
 s.state({popupOpen:true,phase:'paused',running:false});await flush();
 assert.equal(s.document.querySelector('[data-bubble]').hidden,true);
 assert.equal(s.timers.size,0);s.destroy();
});

test('mirror toggles the workstation without rewriting statistics or speech',async()=>{
 const s=setup(.2,{statisticsEnabled:true,mirrored:true});await flush();
 const root=s.document.querySelector('#clawd-desktop');
 assert(root.classList.contains('is-mirrored'));
 assert.equal(s.document.querySelector('[data-statistics-total]').textContent,'1234');
 const status=s.document.querySelector('[data-status]');status.textContent='哇！';await flush();
 assert.equal(s.document.querySelector('[data-bubble-text]').textContent,'哇！');
 s.state({mirrored:false});assert(!root.classList.contains('is-mirrored'));
 s.state({mirrored:true,sideButtons:false});assert(root.classList.contains('is-mirrored'));assert(root.classList.contains('no-side'));
 assert.equal(s.document.querySelector('[data-statistics-total]').textContent,'1234');
 s.destroy();assert.equal(s.timers.size,0);
});

function pointer(s,target,type,props={}){
 const e=new s.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,button:0,clientX:100,clientY:100,...props});target.dispatchEvent(e);
}
test('directional arms are optional and preference updates keep the chosen animation',()=>{
 const s=setup(.2,{directionalArms:true});assert(s.c.getReachEnabled());
 s.input({type:'key',code:'KeyA',down:true});s.advance(80);assert(s.document.querySelector('[data-reaching-arm]'));
 s.state({directionalArms:false});assert.equal(s.c.getReachEnabled(),false);
 s.input({type:'key',code:'KeyA',down:false});s.advance(300);s.input({type:'key',code:'KeyJ',down:true});s.advance(80);
 assert.equal(s.document.querySelector('[data-reaching-arm]'),null);s.destroy();assert.equal(s.timers.size,0);
});
test('desktop body tap plays through keyboard input before work resumes',()=>{
 const s=setup(),body=s.document.querySelector('#body-motion');
 pointer(s,body,'pointerover');s.input({type:'move',dx:4,dy:2});s.advance(20);assert.equal(s.c.getState().mouse,false);
 pointer(s,body,'pointerdown');s.input({type:'button',button:0,down:true});s.advance(80);
 pointer(s,body,'pointerup');assert(s.c.getReaction());assert.equal(s.c.getState().mouse,false);
 s.input({type:'button',button:0,down:false});s.input({type:'move',dx:1,dy:0});s.advance(20);assert(s.c.getReaction());
 const reaction=s.c.getReaction();
 s.input({type:'key',code:'KeyA',down:true});s.input({type:'key',code:'KeyA',down:false});assert.equal(s.c.getReaction(),reaction);assert.equal(s.c.getState().keys.length,0);
 s.advance(2700);assert.equal(s.c.getReaction(),null);assert.equal(s.c.getState().keys.length,0);
 s.input({type:'key',code:'KeyJ',down:true});assert(s.c.getState().keys.includes('KeyJ'));
 s.destroy();assert.equal(s.timers.size,0);
});
test('all four click reactions play through mouse, reset and repeated taps without replaying input',()=>{
 for(const [kind,duration] of [['curious',2100],['shy',1900],['jelly',1200],['sing',2600]]){
  const s=setup();assert(s.c.react(kind));s.advance(400);
  s.input({type:'move',dx:12,dy:3});s.input({type:'button',button:0,down:true});s.input({type:'button',button:0,down:false});
  s.input({type:'key',code:'KeyA',down:true});s.input({type:'reset'});
  assert.equal(s.c.press('KeyJ'),false);s.c.moveMouse(5,1);s.c.mouseButton(2,true);s.c.tap('Space');
  assert.equal(s.c.react('random'),false);assert.equal(s.c.getReaction(),kind);
  assert.equal(s.c.getState().mouse,false);assert.equal(s.c.getState().keys.length,0);
  s.advance(duration-450);assert.equal(s.c.getReaction(),kind,'play the final frames');
  s.advance(100);assert.equal(s.c.getReaction(),null);assert.equal(s.c.getState().keys.length,0);assert.equal(s.c.getState().mouse,false);
  s.input({type:'key',code:'KeyA',down:false});s.input({type:'key',code:'KeyJ',down:true});assert(s.c.getState().keys.includes('KeyJ'));
  s.input({type:'key',code:'KeyJ',down:false});s.input({type:'move',dx:2,dy:1});s.advance(20);assert.equal(s.c.getState().mouse,true);
  s.destroy();assert.equal(s.timers.size,0);
 }
});
test('desktop drag, long press, right click and pointer cancellation never trigger a tap',async()=>{
 const s=setup(),body=s.document.querySelector('#body-motion');let drags=0;s.window.clawdDesktop.drag=async()=>{drags++;};
 pointer(s,body,'pointerdown');pointer(s,body,'pointermove',{clientX:110});pointer(s,body,'pointerup',{clientX:110});await flush();assert.equal(drags,1);assert.equal(s.c.getReaction(),null);
 pointer(s,body,'pointerdown');s.advance(350);pointer(s,body,'pointerup');assert.equal(s.c.getReaction(),null);
 pointer(s,body,'pointerdown',{button:2});pointer(s,body,'pointerup',{button:2});assert.equal(s.c.getReaction(),null);
 pointer(s,body,'pointerdown');pointer(s,body,'pointercancel');pointer(s,body,'pointerup');assert.equal(s.c.getReaction(),null);
 s.destroy();assert.equal(s.timers.size,0);
});
test('update ownership survives native reset events and blocks global input until dismissed',()=>{
 const s=setup();s.state({update:{phase:'checking'},settingsOpen:true,phase:'paused',running:false});s.advance(500);
 assert.equal(s.c.getState().paused,false);assert.equal(s.document.querySelector('#update-effects').getAttribute('display'),'inline');
 s.input({type:'reset'});s.input({type:'move',dx:6,dy:6});s.input({type:'key',code:'KeyQ',down:true});s.advance(200);
 assert.equal(s.c.getState().mouse,false);assert.equal(s.c.getState().keys.length,0);
 s.advance(100000);assert.equal(s.c.getState().sleep,'awake');assert.equal(s.c.getState().looking,false);
 s.state({update:{phase:'error',error:'offline'}});s.advance(400);assert.equal(s.document.querySelector('#update-dizzy').getAttribute('display'),'inline');
 s.state({update:{phase:'idle'},settingsOpen:false,phase:'listening',running:true});s.input({type:'key',code:'KeyQ',down:true});s.advance(45);assert.equal(s.c.getState().left,'down');
 assert.equal(s.document.querySelector('#update-dizzy').getAttribute('display'),'none');s.destroy();assert.equal(s.timers.size,0);
});

test('update visuals interrupt click reactions, reject body taps, and use large red ERROR',()=>{
 const s=setup(),body=s.document.querySelector('#body-motion');
 s.c.react('shy');assert(s.c.getReaction());s.state({update:{phase:'error'}});assert.equal(s.c.getReaction(),null);
 pointer(s,body,'pointerdown');s.advance(60);pointer(s,body,'pointerup');assert.equal(s.c.getReaction(),null);
 for(const text of s.document.querySelectorAll('[data-update-errors] text')){assert.equal(text.getAttribute('fill'),'#e33535');assert(Number(text.getAttribute('font-size'))>=8);}
 s.destroy();assert.equal(s.timers.size,0);
});

test('a secondary-button release cannot complete a pending left tap',()=>{
 const s=setup(),body=s.document.querySelector('#body-motion');
 pointer(s,body,'pointerdown');pointer(s,body,'pointerup',{button:2});assert.equal(s.c.getReaction(),null);
 pointer(s,body,'pointercancel');s.destroy();assert.equal(s.timers.size,0);
});

test('cowboy fitting confirms the hat, orders milk and restores saved clothing',async()=>{
 const s=setup(.2,{accessory:'cat-headphones'});s.openAccessories();await flush();
 assert.equal(s.c.selectAccessory('cowboy-hat'),true);assert.equal(s.c.getState().accessory.preview,true);
 for(const id of ['cat-headphones-front','cat-headphones-rear','headphones-front','sprout-front','duck-front'])assert.equal(s.document.querySelector('#'+id).getAttribute('display'),'none');
 s.click('[data-accessory-confirm]');await flush();assert.equal(s.saved.accessory,'cowboy-hat');assert.equal(s.document.querySelector('[data-bubble]').hidden,true);s.advance(2800);assert.equal(s.document.querySelector('[data-bubble-text]').textContent,'老板，来杯牛奶。');assert.equal(s.document.querySelector('#cowboy-toy').getAttribute('display'),'none');assert.equal(s.document.querySelector('#cowboy-hat-front').getAttribute('display'),'inline');s.destroy();
 const again=setup(.2,{accessory:'cowboy-hat'});assert.equal(again.c.getState().accessory.selected,'cowboy-hat');again.openAccessories();await flush();again.c.selectAccessory('headphones');again.c.closeAccessoryMenu(false);assert.equal(again.c.getState().accessory.selected,'cowboy-hat');again.destroy();
});

test('detective fitting magnifies an eye, confirms and restores without replay on startup',async()=>{
 const s=setup();s.openAccessories();await flush();s.c.selectAccessory('detective-hat');s.advance(2700);
 assert.equal(s.c.getState().accessory.phase,'magnifying');assert.equal(s.document.querySelector('#eyes-detective').getAttribute('display'),'inline');
 s.click('[data-accessory-confirm]');await flush();assert.equal(s.saved.accessory,'detective-hat');s.advance(1800);
 assert.equal(s.document.querySelector('[data-bubble-text]').textContent,'发现线索了。');assert.equal(s.document.querySelector('#detective-magnifier').getAttribute('display'),'none');
 assert.equal(s.document.querySelector('#left-hand').parentNode.id,'hands-motion');s.destroy();
 const again=setup(.2,{accessory:'detective-hat'});assert.equal(again.c.getState().accessory.preview,false);assert.equal(again.document.querySelector('#detective-hat-front').getAttribute('display'),'inline');again.destroy();
});

test('native fast input releases bubble and flat-magic arms in both reach modes',()=>{
 for(const directionalArms of[false,true])for(const egg of['Bubbles','Magic']){
  const s=setup(.2,{directionalArms});s.c['show'+egg]();s.advance(egg==='Magic'?7200:1200);
  for(let i=0;i<40;i++){const code=i%2?'KeyA':'KeyJ';s.input({type:'key',code,down:true});s.input({type:'key',code,down:false});s.advance(80);}
  assert(s.c.getState().busy>0);assert.equal(s.c.getState().magicFlat,false);assert.equal(s.document.querySelector('#left-hand').parentNode.id,'hands-motion');assert.equal(s.document.querySelector('#body-motion').getAttribute('visibility'),null);
  s.input({type:'key',code:'KeyA',down:true});s.advance(45);assert.notEqual(s.c.getState().left,'bubbles');assert(s.c.getState().keys.includes('KeyA'));s.input({type:'key',code:'KeyA',down:false});s.advance(8500);assert.equal(s.c.getState().busy,0);assert.equal(s.c.getState().recovering,false);s.destroy();assert.equal(s.timers.size,0);
 }
});
