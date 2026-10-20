import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {DOMParser} from './dom-test-worker.mjs';
const base=new URL('../',import.meta.url);
function setup(reduced=false){
 const html=fs.readFileSync(new URL('dist/previews/Clawd-Arm-Reach-Lab.html',base),'utf8');
 const svg=html.match(/<svg\b[^]*?<\/svg>/)[0];
 const doc=new DOMParser().parseFromString('<main id="lab">'+svg+'<span data-status=""/><span data-last-key=""/></main>','application/xml');
 const window=doc.defaultView;window.matchMedia=()=>({matches:reduced});
 let now=0,id=0;const timers=new Map();
 const set=(fn,ms=0)=>{timers.set(++id,{fn,at:now+ms});return id;};
 const ctx=vm.createContext({window,document:doc,Math,performance:{now:()=>now},setTimeout:set,clearTimeout:i=>timers.delete(i),requestAnimationFrame:fn=>set(()=>fn(now),16),cancelAnimationFrame:i=>timers.delete(i)});
 const scripts=[...html.matchAll(/<script>([^]*?)<\/script>/g)].map(m=>m[1]);
 vm.runInContext(scripts[0],ctx);vm.runInContext(scripts[1],ctx);
 const rig=JSON.parse(html.match(/<script type="application\/json" id="clawd-rig-data">([^]*?)<\/script>/)[1]);
 const root=doc.querySelector('#lab'),c=window.createClawdController(root,rig,{bindInput:false,bindDemo:false,sunglassesEnabled:true,happyEnabled:true,sleepEnabled:false});
 function advance(dt){const end=now+dt;let n=0;while(true){let first;for(const e of timers)if(e[1].at<=end&&(!first||e[1].at<first[1].at))first=e;if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();assert(++n<100000);}now=end;}
 return {doc,rig,root,c,advance,timers};
}
const f=setup(),{c,root,rig,doc,advance}=f;
assert.equal(c.getReachEnabled(),false);
c.tap('KeyQ');advance(65);assert.equal(root.dataset.left,'down');assert.equal(doc.querySelector('[data-reaching-arm]'),null);c.clearAll();
c.setReachEnabled(true);
for(const k of rig.keys){
 c.clearAll();c.tap(k.code);advance(65);
 const hand=k.code==='Space'?'left':k.hand,arm=doc.querySelector(`[data-reaching-arm="${hand}"]`);
 assert(arm,k.code);assert.equal(arm.querySelectorAll('path').length,5);assert.equal(arm.querySelector('path path'),null);
 assert(!arm.outerHTML.includes('NaN')&&!arm.outerHTML.includes('Infinity'),k.code);
 if(hand==='right'){for(const m of arm.outerHTML.matchAll(/M(-?\d+) (-?\d+)h(\d+)/g))assert(+m[1]+ +m[3]<=84,'right arm stays near its original silhouette');}
 if(hand==='right')assert.equal(doc.querySelector('#right-hand').getAttribute('clip-path'),'url(#far-arm-visible)');
 advance(220);assert.equal(root.dataset[hand],'idle');assert.equal(doc.querySelector('[data-reaching-arm]'),null);
}
c.tap('KeyQ');c.tap('KeyJ');advance(70);assert.equal(doc.querySelectorAll('[data-reaching-arm]').length,2);
c.clearAll();c.tap('Space');advance(70);assert(doc.querySelector('[data-reaching-arm="right"]'),'space alternates after earlier all-key sweep');
c.clearAll();
for(let i=0;i<100;i++){c.tap(['KeyQ','KeyJ','KeyZ','KeyP'][i%4]);advance(70);}
assert.equal(c.getState().busy,2);advance(300);assert.equal(doc.querySelector('[data-reaching-arm]'),null);
c.tap('KeyQ');advance(30);c.setReachEnabled(false);advance(300);assert.equal(doc.querySelector('[data-reaching-arm]'),null);
c.setReachEnabled(true);c.tap('KeyJ');advance(60);c.moveMouse(2,1);assert.equal(doc.querySelector('#right-hand').getAttribute('clip-path'),'url(#far-arm-visible)');advance(300);assert.equal(c.getState().mouse,true);
c.clearAll();c.tap('KeyJ');advance(30);c.setPaused(true);advance(400);assert.equal(doc.querySelector('[data-reaching-arm]'),null);c.setPaused(false);
c.clearAll();c.sleep();advance(2700);assert.equal(c.getState().sleep,'asleep');c.tap('KeyQ');advance(400);assert.equal(doc.querySelector('[data-reaching-arm]'),null);
c.clearAll();c.showSunglasses();advance(500);c.tap('KeyQ');advance(60);assert.equal(doc.querySelector('[data-reaching-arm="left"]'),null,'sunglasses own the left hand');
c.destroy();advance(1000);assert.equal(f.timers.size,0);
const g=setup(true);g.c.setReachEnabled(true);g.c.tap('KeyQ');g.advance(30);assert.equal(g.doc.querySelector('[data-reaching-arm]'),null);g.c.destroy();
console.log(`Reach lab: ${rig.keys.length} keys, two hands, space, rapid typing, switching, mouse, pause, sleep, sunglasses, reduced motion and cleanup passed.`);
