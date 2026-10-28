import test from'node:test';import assert from'node:assert/strict';import{setup}from'./fixture.mjs';
const node=(s,id)=>s.document.querySelector('#'+id);
function typeToBusy(...scenes){for(let i=0;i<50;i++){for(const s of scenes)s.c.tap(i%2?'KeyA':'KeyJ');for(const s of scenes)s.advance(80);if(scenes[0].c.getState().busy)return;}assert.fail('fast mode did not start');}
test('bubble hurry uses squeezed eyes then frees the paw, keeping already born bubbles',()=>{
 const s=setup();s.c.showBubbles();s.advance(1800);typeToBusy(s);
 assert.equal(s.c.getState().bubbles,'hurrying');assert.equal(s.c.getState().expression,'bubble-hurry');assert.equal(node(s,'eyes-bubbles-hurry').getAttribute('display'),'inline');
 const born=s.document.querySelectorAll('[data-soap-bubble][display="inline"]').length;assert(born>0);
 s.advance(450);assert.equal(node(s,'left-hand').parentNode.id,'hands-motion');assert.equal(node(s,'bubble-wand').getAttribute('display'),'none');assert.notEqual(s.c.getState().expression,'bubble-hurry');
 s.c.tap('KeyA');s.advance(45);assert.equal(s.c.getState().left,'down');assert.equal(node(s,'eyes-bubbles-hurry').getAttribute('display'),'none');s.advance(5000);assert.equal(s.c.getState().bubbles,'none');s.destroy();assert.equal(s.timers.size,0);
});
test('magic withdraws before transformation or uses 600ms smoke after transformation',()=>{
 for(const at of[200,5600,8200,10000]){
  const s=setup();s.c.showMagic();s.advance(at);typeToBusy(s);
  assert.equal(s.c.getState().magic,'hurrying');const flat=s.c.getState().magicFlat;
  if(flat){s.advance(180);assert.equal(node(s,'magic-smoke').getAttribute('display'),'inline');assert(s.c.getState().magicFlat);s.advance(140);assert(!s.c.getState().magicFlat);s.advance(320);}
  else s.advance(270);
  assert.equal(s.c.getState().magic,'none');assert.equal(node(s,'body-motion').getAttribute('visibility'),null);assert.equal(node(s,'hands-motion').getAttribute('visibility'),null);s.destroy();assert.equal(s.timers.size,0);
 }
});
test('smoke and bubble stowing do not alter fast-mode entry, exit, recovery or input rate',()=>{
 for(const egg of['Bubbles','Magic']){
  const s=setup(),baseline=setup();s.c['show'+egg]();const at=egg==='Magic'?7200:1500;s.advance(at);baseline.advance(at);typeToBusy(s,baseline);
  for(let i=0;i<85;i++){
   const a=s.c.getState(),b=baseline.c.getState();for(const key of['busy','recovering','rate'])assert.equal(a[key],b[key],egg+': '+key);
   s.advance(100);baseline.advance(100);
  }
  assert.equal(s.c.getState().busy,0);assert(!s.c.getState().recovering);s.destroy();baseline.destroy();assert.equal(s.timers.size,0);assert.equal(baseline.timers.size,0);
 }
});
test('clear/pause/destroy safely interrupt a hurried exit without queued work',()=>{
 for(const reduced of[false,true])for(const egg of['Bubbles','Magic'])for(const action of['clearAll','pause','destroy']){
  const s=setup({reduced});s.c['show'+egg]();s.advance(egg==='Magic'?7200:1500);typeToBusy(s);s.advance(100);
  if(action==='pause')s.c.setPaused(true);else if(action==='destroy')s.destroy();else s.c.clearAll();
  assert.equal(s.c.getState()[egg.toLowerCase()],'none');assert.equal(node(s,'body-motion').getAttribute('visibility'),null);if(action!=='destroy')s.destroy();assert.equal(s.timers.size,0);
 }
});
