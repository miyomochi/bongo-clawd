import test from'node:test';import assert from'node:assert/strict';import{setup}from'./fixture.mjs';
const node=(s,id)=>s.document.querySelector('#'+id);
test('gaming04 completes its entrance, interrupts synchronously and preserves key accounting',()=>{
 const s=setup();assert(s.c.showGaming());s.advance(6000);assert.equal(s.c.getState().gaming,'playing');assert.equal(node(s,'gaming-screen').getAttribute('display'),'inline');
 assert.equal(s.c.showBubbles(),false);assert.equal(s.c.showMagic(),false);assert.equal(s.c.showSunglasses(),false);
 s.c.press('KeyA');assert.equal(node(s,'gaming-screen').getAttribute('display'),'none');assert.equal(s.c.getState().gaming,'closing');assert(s.c.getState().keys.includes('KeyA'));assert.equal(s.c.getState().rate,.5);
 s.advance(500);const first=node(s,'right-hand').innerHTML;s.c.press('KeyJ');s.advance(300);assert.notEqual(node(s,'right-hand').innerHTML,first);assert(s.c.getState().keys.includes('KeyJ'));
 s.advance(700);assert.equal(s.c.getState().gaming,'none');assert(s.c.getState().keys.includes('KeyA'));s.c.release('KeyA');s.c.release('KeyJ');s.c.tap('KeyJ');s.advance(45);assert.equal(s.c.getState().right,'down');s.destroy();assert.equal(s.timers.size,0);
});
test('mouse and unmapped keys close gaming, and repeated input does not restart the reaction',()=>{
 for(const input of['mouse','button','unmapped']){
  const s=setup();s.c.showGaming();s.advance(6000);if(input==='mouse')s.c.moveMouse(2,1);else if(input==='button')s.c.mouseButton(0,true);else s.c.press('UnmappedKey');
  assert.equal(node(s,'gaming-screen').getAttribute('display'),'none');s.advance(1000);s.c.moveMouse(2,1);s.advance(500);assert.equal(s.c.getState().gaming,'none');s.destroy();assert.equal(s.timers.size,0);
 }
});
test('idle choice shares the sleep deadline, can pick either branch, and respects disabled sleep',()=>{
 for(const random of[.2,.8]){const s=setup({gamingEnabled:true,sleepSeconds:30,random});s.advance(32000);if(random<.5)assert.equal(s.c.getState().sleep,'asleep');else assert.notEqual(s.c.getState().gaming,'none');s.destroy();assert.equal(s.timers.size,0);}
 const s=setup({gamingEnabled:true,sleepEnabled:false,random:.8});s.advance(180000);assert.equal(s.c.getState().gaming,'none');s.destroy();assert.equal(s.timers.size,0);
});
test('pause, fitting, manual sleep, clear and destroy release gaming at every stage',()=>{
 for(const reduced of[false,true])for(const at of[1000,3500,6500])for(const action of['pause','fitting','sleep','clear','destroy']){
  const s=setup({reduced});s.c.showGaming();s.advance(at);if(action==='pause')s.c.setPaused(true);if(action==='fitting')s.c.openAccessoryMenu();if(action==='sleep')s.c.sleep();if(action==='clear')s.c.clearAll();if(action==='destroy')s.destroy();assert.equal(s.c.getState().gaming,'none');if(action!=='destroy')assert.equal(node(s,'gaming-overlay').getAttribute('display'),'none');if(action!=='destroy')s.destroy();assert.equal(s.timers.size,0);
 }
});
