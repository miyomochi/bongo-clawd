import {parseHTML} from './dom-test-worker.mjs';
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const page=fs.readFileSync(new URL('../Clawd-lab.html',import.meta.url),'utf8');
export function setup(options={}){
 const {window,document}=parseHTML(page);window.matchMedia=()=>({matches:!!options.reduced});
 let now=0,id=0;const timers=new Map();
 const set=(fn,ms=0)=>{timers.set(++id,{fn,at:now+ms});return id;};const clear=id=>timers.delete(id);
 const math=Object.create(Math);math.random=()=>options.random??.2;
 const context=vm.createContext({window,document,Math:math,performance:{now:()=>now},setTimeout:set,clearTimeout:clear,requestAnimationFrame:fn=>set(()=>fn(now),16),cancelAnimationFrame:clear});
 vm.runInContext(fs.readFileSync(new URL('../web/core/clawd.bundle.js',import.meta.url),'utf8'),context);
 const root=document.querySelector('#clawd-keyboard-study');const rig=JSON.parse(document.querySelector('#clawd-rig-data').textContent);
 const c=window.createClawdController(root,rig,{bindInput:false,bindDemo:false,sunglassesEnabled:true,...options});
 const advance=dt=>{const end=now+dt;let n=0;while(true){let first;for(const [i,t]of timers)if(t.at<=end&&(!first||t.at<first[1].at))first=[i,t];if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();assert(++n<100000);}now=end;};
 return {window,document,root,c,timers,advance,destroy:()=>c.destroy()};
}
