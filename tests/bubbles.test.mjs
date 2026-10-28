import test from'node:test';import assert from'node:assert/strict';import{setup}from'./fixture.mjs';
const node=(s,id)=>s.document.querySelector('#'+id);
test('idle bubbles finish and restore the original paw without adding a mouth',()=>{
 const s=setup({happyEnabled:true});assert.equal(s.c.showBubbles(),true);s.advance(3400);
 assert.equal(s.c.getState().bubbles,'bubbling');assert.equal(node(s,'bubble-wand').getAttribute('display'),'inline');
 assert.equal(s.c.getState().expression,'bubbles');assert(s.document.querySelectorAll('[data-soap-bubble][display="inline"]').length>=2);
 assert.equal(s.c.showHappy(),false);assert.equal(s.c.showSunglasses(),false);assert.equal(s.c.lookAround(),undefined);
 s.advance(4000);assert.equal(s.c.getState().bubbles,'none');assert.equal(node(s,'left-hand').parentNode.id,'hands-motion');assert.deepEqual([...node(s,'left-hand').querySelectorAll('path')].map(n=>[n.getAttribute('d'),n.getAttribute('fill')]),[...JSON.parse(s.document.querySelector('#clawd-rig-data').textContent).left.idle.matchAll(/<path d="([^"]+)" fill="([^"]+)"/g)].map(m=>[m[1],m[2]]));
 assert.equal(node(s,'bubble-wand').getAttribute('display'),'none');assert.equal(node(s,'idle-soap-bubbles').getAttribute('display'),'none');s.destroy();assert.equal(s.timers.size,0);
});
test('keyboard and mouse keep bubbles playing with independent mapping and counting',()=>{
 for(const time of[100,700,2500,5500,6600])for(const input of['key','mouse','unmapped']){
  const s=setup();s.c.showBubbles();s.advance(time);
  const phase=s.c.getState().bubbles,left=node(s,'left-hand').innerHTML;
  if(input==='key')s.c.press('KeyA');else if(input==='mouse')s.c.moveMouse(2,1);else assert.equal(s.c.press('UnmappedKey'),false);
  assert.equal(s.c.getState().bubbles,phase);if(time<6200)assert.equal(node(s,'left-hand').innerHTML,left);
  if(input==='key'){assert(s.c.getState().keys.includes('KeyA'));assert(node(s,'key-KeyA').classList.contains('is-down'));assert.equal(s.c.getState().rate,.5);s.c.press('KeyA',{repeat:true});assert.equal(s.c.getState().rate,.5);s.c.release('KeyA');s.advance(100);assert(!node(s,'key-KeyA').classList.contains('is-down'));}
  if(input==='mouse'){assert(s.c.getState().mouse);s.c.mouseButton(0,true);assert(node(s,'mouse-left-button').classList.contains('is-clicked'));s.c.mouseButton(0,false);}
  s.advance(7400);assert.equal(s.c.getState().bubbles,'none');assert.equal(node(s,'left-hand').parentNode.id,'hands-motion');
  s.destroy();assert.equal(s.timers.size,0);
 }
});
test('sleep deadline, pause and fitting can preempt bubbles and free the original arm',()=>{
 const s=setup({sleepSeconds:30});s.advance(25000);assert(s.c.showBubbles());s.advance(5500);assert.equal(s.c.getState().sleep,'asleep');assert.equal(s.c.getState().bubbles,'none');s.destroy();
 for(const action of['pause','fitting']){const f=setup();f.c.showBubbles();f.advance(3000);if(action==='pause')f.c.setPaused(true);else f.c.openAccessoryMenu();assert.equal(f.c.getState().bubbles,'none');assert.equal(node(f,'left-hand').parentNode.id,'hands-motion');assert.equal(f.c.showBubbles(),false);f.destroy();assert.equal(f.timers.size,0);}
});
test('bubble slot respects other eggs and active input',()=>{
 const s=setup({happyEnabled:true});s.c.showSunglasses();assert.equal(s.c.showBubbles(),false);s.c.clearAll();s.c.showHappy();assert.equal(s.c.showBubbles(),false);s.c.clearAll();s.c.press('KeyA');assert.equal(s.c.showBubbles(),false);s.c.release('KeyA',true);s.c.clearAll();s.c.moveMouse(1,0);assert.equal(s.c.showBubbles(),false);s.destroy();assert.equal(s.timers.size,0);
});
test('shared cooldown can naturally choose bubbles after a genuinely idle interval',()=>{
 const s=setup({bubblesEnabled:true,sunglassesEnabled:false,happyEnabled:false,sleepEnabled:false});s.advance(407000);assert.equal(s.c.getState().bubbles,'none');let found=false;
 for(let i=0;i<300;i++){s.advance(100);if(s.c.getState().bubbles!=='none'){found=true;break;}}assert(found);s.c.tap('KeyA');assert.notEqual(s.c.getState().bubbles,'none');s.advance(60000);assert.equal(s.c.getState().bubbles,'none');s.destroy();assert.equal(s.timers.size,0);
});
test('reduced motion keeps fixed bubbles while the free paw works',()=>{
 const s=setup({reduced:true});s.c.showBubbles();s.advance(1800);const first=s.document.querySelector('[data-soap-bubble="0"] path').getAttribute('d');s.c.press('KeyA');s.c.moveMouse(1,0);s.advance(300);assert.equal(s.document.querySelector('[data-soap-bubble="0"] path').getAttribute('d'),first);assert.equal(s.c.getState().bubbles,'bubbling');assert(s.c.getState().mouse);s.c.release('KeyA');s.destroy();assert.equal(s.timers.size,0);
});
