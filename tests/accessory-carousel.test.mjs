import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import test from 'node:test';import {parseHTML} from './dom-test-worker.mjs';
const page=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
function setup(count=6,width=344,gap=6){
 const {window,document}=parseHTML(page),panel=document.querySelector('[data-accessory-menu]'),v=panel.querySelector('[data-accessory-viewport]');
 while(v.querySelectorAll('label').length>count)v.lastElementChild.remove();
 for(let n=v.querySelectorAll('label').length;n<count;n++){const item=v.firstElementChild.cloneNode(true);item.querySelector('input').value='extra-'+n;v.appendChild(item);}
 let w=width,g=gap,scroll=0,smooth=[],selected=0;
 Object.defineProperties(v,{clientWidth:{get:()=>w},scrollWidth:{get:()=>count*((w-4*g)/5+g)-g},scrollLeft:{get:()=>scroll,set:n=>{scroll=n;}}});
 window.getComputedStyle=()=>({columnGap:String(g)});
 v.scrollTo=({left,behavior})=>{smooth.push({left,behavior});scroll=Math.max(0,Math.min(v.scrollWidth-w,left));v.dispatchEvent(new window.Event('scroll'));};
 v.addEventListener('change',()=>selected++);
 vm.runInContext(fs.readFileSync(new URL('../web/core/clawd-accessory-carousel.js',import.meta.url),'utf8'),vm.createContext({window,document}));
 const c=window.createClawdAccessoryCarousel(panel),prev=panel.querySelector('[data-accessory-prev]'),next=panel.querySelector('[data-accessory-next]');
 const click=node=>node.dispatchEvent(new window.Event('click'));
 return {c,v,prev,next,document,window,smooth,click,get selected(){return selected;},resize(width,gap=g){w=width;g=gap;c.refresh();}};
}
test('six cards show five, move one tile, disable edge arrows without selecting outfits',()=>{
 const s=setup();assert.equal(s.prev.disabled,true);assert.equal(s.next.disabled,false);const before=s.v.querySelector('input:checked').value;
 s.click(s.next);assert.equal(s.c.getState().start,1);assert.equal(s.prev.disabled,false);assert.equal(s.next.disabled,true);assert.equal(s.next.disabled,true);
 assert.equal(s.v.querySelector('input:checked').value,before);assert.equal(s.selected,0);assert.equal(s.smooth.at(-1).behavior,'smooth');
 s.click(s.prev);assert.equal(s.c.getState().start,0);assert.equal(s.prev.disabled,true);s.c.destroy();
});
test('when all cards fit both arrows stay disabled',()=>{
 for(const count of [1,4,5]){const s=setup(count);assert.equal(s.prev.disabled,true);assert.equal(s.next.disabled,true);s.c.destroy();}
});
test('more cards browse in single steps and revealing a selected offscreen outfit preserves it',()=>{
 const s=setup(9);s.click(s.next);s.click(s.next);assert.equal(s.c.getState().start,2);assert.equal(s.prev.disabled,false);assert.equal(s.next.disabled,false);
 s.c.reveal('extra-8');assert.equal(s.c.getState().start,4);assert.equal(s.next.disabled,true);s.c.reveal('none');assert.equal(s.c.getState().start,0);assert.equal(s.selected,0);s.c.destroy();
});
test('native horizontal scroll updates arrows and narrow layout remains aligned',()=>{
 const s=setup(8);s.v.scrollLeft=3*((344-24)/5+6);s.v.dispatchEvent(new s.window.Event('scroll'));assert.equal(s.next.disabled,true);
 s.resize(324,5);assert.equal(s.c.getState().start,3);assert.equal(s.next.disabled,true);assert(Math.abs(s.v.scrollLeft-3*((324-20)/5+5))<.01);s.c.destroy();
});
test('destroyed carousel has no active click listeners',()=>{
 const s=setup();s.c.destroy();s.click(s.next);assert.equal(s.v.scrollLeft,0);
});
