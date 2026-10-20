import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {parseHTML} from './dom-test-worker.mjs';
const page=fs.readFileSync(new URL('../dist/previews/Clawd-Arm-Reach-Lab.html',import.meta.url),'utf8');
const {window,document}=parseHTML(page);window.matchMedia=()=>({matches:false});
const textarea=document.querySelector('textarea');textarea.focus=()=>{};
let now=0,id=0;const timers=new Map();const set=(fn,ms=0)=>{timers.set(++id,{fn,at:now+ms});return id;};
const context=vm.createContext({window,document,Math,performance:{now:()=>now},setTimeout:set,clearTimeout:i=>timers.delete(i),requestAnimationFrame:fn=>set(()=>fn(now),16),cancelAnimationFrame:i=>timers.delete(i)});
for(const m of page.matchAll(/<script>([^]*?)<\/script>/g))vm.runInContext(m[1],context);
const c=window.clawdLabController;
function advance(dt){const end=now+dt;let n=0;while(true){let first;for(const e of timers)if(e[1].at<=end&&(!first||e[1].at<first[1].at))first=e;if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();assert(++n<100000);}now=end;}
function key(type,code){const e=new window.Event(type,{bubbles:true,cancelable:true});e.code=code;e.repeat=false;window.dispatchEvent(e);}
key('keydown','KeyQ');advance(70);assert(document.querySelector('[data-reaching-arm="left"]'),'real keyboard listener drives reach');key('keyup','KeyQ');advance(230);
key('keydown','KeyJ');key('keydown','KeyA');advance(70);assert.equal(document.querySelectorAll('[data-reaching-arm]').length,2);key('keyup','KeyJ');key('keyup','KeyA');advance(230);
for(let i=0;i<100;i++){const code=['KeyQ','KeyJ','KeyW','KeyP'][i%4];key('keydown',code);key('keyup',code);advance(70);}assert.equal(c.getState().busy,2);
document.querySelector('[data-mode="off"]').click();assert.equal(c.getReachEnabled(),false);key('keydown','KeyJ');advance(70);assert.equal(document.querySelector('[data-reaching-arm]'),null);key('keyup','KeyJ');
document.querySelector('[data-mode="on"]').click();key('keydown','KeyJ');advance(70);assert(document.querySelector('[data-reaching-arm="right"]'));key('keyup','KeyJ');
window.dispatchEvent(new window.Event('blur'));advance(300);assert.equal(document.querySelector('[data-reaching-arm]'),null);
window.dispatchEvent(new window.Event('pagehide'));advance(1000);assert.equal(timers.size,0);
console.log('Standalone keyboard preview: actual key events, simultaneous hands, rapid typing, mode switching, focus loss and cleanup passed.');
