import {parseHTML} from './dom-test-worker.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const page=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
function setup(random=.2){
  const {window,document}=parseHTML(page);window.matchMedia=()=>({matches:false});
  let now=0,id=0,inputListener,stateListener;const timers=new Map();
  const set=(fn,ms=0)=>{timers.set(++id,{fn,at:now+ms});return id;};
  const clear=id=>timers.delete(id);const math=Object.create(Math);math.random=()=>random;
  window.clawdDesktop={input:fn=>{inputListener=fn;return()=>{inputListener=null;}},state:fn=>{stateListener=fn;return()=>{stateListener=null;}},snapshot:()=>({then:fn=>fn({phase:'listening',enabled:true,running:true})}),toggle(){},menu(){},hide(){}};
  const context=vm.createContext({window,document,Math:math,performance:{now:()=>now},setTimeout:set,clearTimeout:clear,requestAnimationFrame:fn=>set(()=>fn(now),16),cancelAnimationFrame:clear});
  vm.runInContext(fs.readFileSync(new URL('../web/core/clawd.bundle.js',import.meta.url),'utf8'),context);
  vm.runInContext(fs.readFileSync(new URL('../web/desktop-renderer.js',import.meta.url),'utf8'),context);
  const advance=dt=>{const end=now+dt;let n=0;while(true){let first;for(const [i,t] of timers)if(t.at<=end&&(!first||t.at<first[1].at))first=[i,t];if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();assert(++n<100000);}now=end;};
  return {window,document,c:window.clawdDesktopController,timers,advance,input:v=>inputListener(v),state:v=>stateListener(v),destroy:()=>window.dispatchEvent(new window.Event('beforeunload'))};
}
test('background key events light the real keys, including simultaneous hands',()=>{
  const s=setup();s.input({type:'key',code:'KeyA',down:true});s.input({type:'key',code:'KeyJ',down:true});
  s.advance(45);assert.equal(s.c.getState().left,'down');assert.equal(s.c.getState().right,'down');assert.equal(s.c.getState().keys.length,2);
  s.window.dispatchEvent(new s.window.Event('blur'));assert.equal(s.c.getState().keys.length,2);
  s.input({type:'key',code:'KeyA',down:false});s.input({type:'key',code:'KeyJ',down:false});s.advance(100);assert.equal(s.c.getState().keys.length,0);s.destroy();assert.equal(s.timers.size,0);
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
  const s=setup();s.advance(92000);assert.equal(s.c.getState().sleep,'asleep');s.input({type:'key',code:'KeyA',down:true});s.input({type:'key',code:'KeyA',down:false});s.advance(1200);assert.equal(s.c.getState().wake,'pretending');assert.equal(s.c.getState().keys.length,0);s.advance(3200);assert.equal(s.c.getState().wake,'none');s.destroy();assert.equal(s.timers.size,0);
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
test('appearance preferences hide bars without resetting held input or sleep countdown',()=>{
  const s=setup();s.advance(70000);
  s.state({phase:'listening',enabled:true,running:true,showTopBar:false,showBottomBar:false,scale:1.17,sleepSeconds:90});
  assert(s.document.querySelector('.handle').hidden);assert(s.document.querySelector('.footer').hidden);
  s.advance(20100);assert.equal(s.c.getState().sleep,'asleep');s.destroy();assert.equal(s.timers.size,0);
});


test('the 30-second minimum still includes two slow idle looks without missing the sleep deadline',()=>{
  const s=setup(.99);s.c.configure({sleepSeconds:30});s.advance(26900);assert.equal(s.c.getState().sleep,'awake');
  s.advance(3200);assert.equal(s.c.getState().sleep,'asleep');s.destroy();assert.equal(s.timers.size,0);
});
