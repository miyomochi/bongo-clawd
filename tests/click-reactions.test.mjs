import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {parseHTML} from './dom-test-worker.mjs';
const page=fs.readFileSync(new URL('../dist/previews/Clawd-Click-Reactions-Lab.html',import.meta.url),'utf8');
function setup(reduced=false){
 const {window,document}=parseHTML(page);window.matchMedia=()=>({matches:reduced});window.innerWidth=1000;window.innerHeight=900;
 let now=0,id=0;const timers=new Map();const set=(fn,ms=0)=>{timers.set(++id,{fn,at:now+ms});return id;};
 const math=Object.create(Math);math.random=()=>.31;
 const ctx=vm.createContext({window,document,Math:math,performance:{now:()=>now},setTimeout:set,clearTimeout:i=>timers.delete(i),requestAnimationFrame:fn=>set(()=>fn(now),16),cancelAnimationFrame:i=>timers.delete(i)});
 for(const m of page.matchAll(/<script>([^]*?)<\/script>/g))vm.runInContext(m[1],ctx);
 const c=window.clawdLabController;
 function advance(dt){const end=now+dt;let n=0;while(true){let first;for(const e of timers)if(e[1].at<=end&&(!first||e[1].at<first[1].at))first=e;if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();assert(++n<100000);}now=end;}
 function emit(target,type,fields={}){const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,button:0,clientX:200,clientY:200},fields);target.dispatchEvent(e);return e;}
 return {window,document,c,advance,emit,timers};
}
const f=setup(),{window:w,document:d,c,advance,emit}=f,body=d.querySelector('#body-front'),scene=d.querySelector('.scene');
for(const kind of ['curious','shy','jelly','sing']){
 assert(c.react(kind));advance(kind==='curious'?850:450);assert.equal(c.getReaction(),kind);assert.equal(c.getState().mouse,false);
 assert(!d.querySelector('#body-motion').getAttribute('transform').includes('NaN'));
 if(kind==='curious')assert(d.querySelector('#left-hand').hasAttribute('transform'));
 if(kind==='shy')assert.equal(d.querySelector('#click-blush').getAttribute('display'),'inline');
 advance(3000);assert.equal(c.getReaction(),null);assert.equal(d.querySelector('#left-hand').getAttribute('transform'),null);assert.equal(d.querySelector('#click-reaction-overlay').getAttribute('display'),'none');
}
emit(body,'pointerdown');assert.equal(c.getReaction(),null,'react on release only');advance(100);emit(w,'pointerup');assert(c.getReaction());assert.equal(c.getState().mouse,false);c.clearAll();
emit(body,'pointermove',{movementX:10,movementY:10});assert.equal(c.getState().mouse,false,'body hover is inert');
emit(body,'pointerdown');advance(350);emit(w,'pointerup');assert.equal(c.getReaction(),null,'long hold is not a tap');
emit(body,'pointerdown');emit(scene,'pointermove',{clientX:225,clientY:210});advance(80);emit(w,'pointerup',{clientX:225,clientY:210});assert.equal(c.getReaction(),null,'drag does not react');assert.equal(d.querySelector('.station').style.transform,'translate(25px,10px)');assert.equal(c.getState().mouse,false);
emit(body,'pointerdown',{button:2});emit(body,'contextmenu',{button:2});emit(w,'pointerup',{button:2});assert.equal(d.querySelector('[data-context-menu]').hidden,false);assert.equal(c.getReaction(),null);assert.equal(c.getState().mouse,false,'right click does not use the mouse');
emit(body,'pointerdown');emit(scene,'pointercancel');emit(w,'pointerup');assert.equal(c.getReaction(),null);
emit(body,'pointerdown');emit(scene,'lostpointercapture');emit(w,'pointerup');assert.equal(c.getReaction(),null);
d.querySelector('[data-reaction-choice="curious"]').click();advance(850);emit(w,'keydown',{code:'KeyJ',repeat:false});advance(70);assert.equal(c.getReaction(),null,'typing interrupts reaction');assert(d.querySelector('[data-reaching-arm="right"]'));emit(w,'keyup',{code:'KeyJ'});advance(300);
d.querySelector('[data-reaction-choice="shy"]').click();advance(500);emit(w,'blur');assert.equal(c.getReaction(),null);assert.equal(d.querySelector('#click-blush').getAttribute('display'),'none');
c.react('sing');advance(200);c.setPaused(true);assert.equal(c.getReaction(),null);c.setPaused(false);
c.react('curious');advance(800);c.moveMouse(2,0);assert.equal(c.getReaction(),null);assert.equal(d.querySelector('#left-hand').getAttribute('transform'),null);c.clearAll();
let prev;for(let i=0;i<12;i++){c.react('random');assert.notEqual(c.getReaction(),prev);prev=c.getReaction();advance(3000);}
emit(w,'pagehide');advance(1000);assert.equal(f.timers.size,0);
const g=setup(true);g.c.react('jelly');g.advance(350);assert(g.document.querySelector('#body-motion').getAttribute('transform').includes('scale(1.0000 1.0000)'));g.emit(g.window,'pagehide');g.advance(1000);assert.equal(g.timers.size,0);
console.log('Click preview: four reactions, actual pointer/key event routes, tap/drag/right-click/hold/cancel separation, body mouse suppression, work interruption, reduced motion and cleanup passed.');
