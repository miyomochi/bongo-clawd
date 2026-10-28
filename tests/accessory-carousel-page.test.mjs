import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import{parseHTML}from'./dom-test-worker.mjs';
test('standalone preview boots, browses to cowboy, confirms and reopens its selected card',async()=>{
 const html=fs.readFileSync(new URL('../dist/previews/Clawd-accessory-carousel-preview.html',import.meta.url),'utf8');
 const {window,document}=parseHTML(html);window.matchMedia=()=>({matches:false});window.getComputedStyle=()=>({columnGap:'6'});
 const v=document.querySelector('[data-accessory-viewport]');let scroll=0;
 Object.defineProperties(v,{clientWidth:{get:()=>344},scrollWidth:{get:()=>414},scrollLeft:{get:()=>scroll,set:x=>scroll=x}});
 v.scrollTo=({left})=>{scroll=Math.max(0,Math.min(70,left));v.dispatchEvent(new window.Event('scroll'));};
 let now=0,id=0;const timers=new Map(),set=(fn,ms=0)=>{timers.set(++id,{fn,at:now+ms});return id;};
 const ctx=vm.createContext({window,document,innerWidth:390,addEventListener:window.addEventListener.bind(window),MutationObserver:window.MutationObserver,Math,performance:{now:()=>now},setTimeout:set,clearTimeout:i=>timers.delete(i),requestAnimationFrame:fn=>set(()=>fn(now),16),cancelAnimationFrame:i=>timers.delete(i)});
 for(const s of document.querySelectorAll('script'))if(s.getAttribute('type')!=='application/json')vm.runInContext(s.textContent,ctx);
 const flush=()=>new Promise(setImmediate);await flush();
 function advance(dt){const end=now+dt;let n=0;while(true){let first;for(const e of timers)if(e[1].at<=end&&(!first||e[1].at<first[1].at))first=e;if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();assert(++n<100000);}now=end;}
 advance(150);await flush();assert.equal(window.clawdDesktopController.getState().accessory.menuOpen,true);
 document.querySelector('[data-accessory-next]').dispatchEvent(new window.Event('click'));assert.equal(scroll,70);assert.equal(window.clawdDesktopController.getState().accessory.draft,'cat-headphones');
 const radio=document.querySelector('[value="cowboy-hat"]');radio.checked=true;radio.dispatchEvent(new window.Event('change'));document.querySelector('[data-accessory-confirm]').dispatchEvent(new window.Event('click'));await flush();assert.equal(window.clawdPreviewPrefs.accessory,'cowboy-hat');
 document.getElementById('preview-open').dispatchEvent(new window.Event('click'));await flush();assert.equal(document.querySelector('[data-accessory-next]').disabled,true);assert.equal(window.clawdDesktopController.getState().accessory.draft,'cowboy-hat');window.dispatchEvent(new window.Event('beforeunload'));
});
