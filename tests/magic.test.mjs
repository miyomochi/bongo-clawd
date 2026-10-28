import test from'node:test';import assert from'node:assert/strict';import{setup}from'./fixture.mjs';
const node=(s,id)=>s.document.querySelector('#'+id);
test('wand tracks around the head while both hands, keyboard mapping and counts remain live',()=>{
 const s=setup();assert(s.c.showMagic());s.advance(1000);assert.equal(s.c.getState().magic,'orbiting');
 const first=node(s,'eyes-magic').querySelector('rect').getAttribute('transform');
 s.c.press('KeyA');s.c.press('KeyJ');assert.equal(s.c.getState().rate,1);assert.equal(s.c.getState().keys.length,2);
 s.advance(45);assert.equal(s.c.getState().left,'down');assert.equal(s.c.getState().right,'down');s.c.release('KeyA');s.c.release('KeyJ');
 s.advance(1200);assert.notEqual(node(s,'eyes-magic').querySelector('rect').getAttribute('transform'),first);
 assert.equal(s.c.showBubbles(),false);assert.equal(s.c.showSunglasses(),false);assert.equal(s.c.showHappy(),false);
 s.destroy();assert.equal(s.timers.size,0);
});
test('flat sprite blocks only paw animation, keeps keys/counts live and restores without queued taps',()=>{
 const s=setup();s.c.showMagic();s.advance(7200);assert.equal(s.c.getState().magicFlat,true);assert.equal(node(s,'body-motion').getAttribute('visibility'),'hidden');assert.equal(node(s,'hands-motion').getAttribute('visibility'),'hidden');
 const left=node(s,'left-hand').innerHTML,right=node(s,'right-hand').innerHTML;
 for(const code of['KeyA','KeyJ','Space']){s.c.press(code);assert(node(s,'key-'+code).classList.contains('is-down'));s.c.release(code);s.advance(160);}
 assert.equal(s.c.getState().rate,1.5);assert.equal(node(s,'left-hand').innerHTML,left);assert.equal(node(s,'right-hand').innerHTML,right);
 s.advance(900);assert.equal(node(s,'magic-flat-squeeze').getAttribute('display'),'inline');const transform=node(s,'magic-flat-clawd').getAttribute('transform');s.advance(200);assert.notEqual(node(s,'magic-flat-clawd').getAttribute('transform'),transform);
 s.c.press('KeyA');s.advance(3500);assert.equal(s.c.getState().magicFlat,false);assert(s.c.getState().keys.includes('KeyA'));assert.equal(node(s,'body-motion').getAttribute('visibility'),null);assert.equal(s.c.getState().left,'idle');
 s.c.release('KeyA');s.c.tap('KeyJ');s.advance(45);assert.equal(s.c.getState().right,'down');s.advance(1200);assert.equal(s.c.getState().magic,'none');s.destroy();assert.equal(s.timers.size,0);
});
test('mouse movement/buttons stay mapped during flat mode and the mouse hand returns normally',()=>{
 const s=setup();s.c.showMagic();s.advance(7500);s.c.moveMouse(2,1);s.c.mouseButton(0,true);s.c.press('KeyA');s.advance(4700);
 assert.equal(s.c.getState().magicFlat,false);assert(s.c.getState().mouse);assert.equal(s.c.getState().right,'mouse');assert(node(s,'mouse-left-button').classList.contains('is-clicked'));assert(s.c.getState().keys.includes('KeyA'));
 s.c.mouseButton(0,false);s.c.release('KeyA');s.advance(1000);s.destroy();assert.equal(s.timers.size,0);
});
test('pause, wardrobe, sleep and clear restore every temporary layer at each stage',()=>{
 for(const at of[300,2000,4800,5600,7500,9200,9800])for(const action of['clear','pause','wardrobe','sleep']){
  const s=setup();s.c.showMagic();s.advance(at);if(action==='clear')s.c.clearAll();if(action==='pause')s.c.setPaused(true);if(action==='wardrobe')s.c.openAccessoryMenu();if(action==='sleep')s.c.sleep();
  assert.equal(s.c.getState().magic,'none');assert.equal(node(s,'body-motion').getAttribute('visibility'),null);assert.equal(node(s,'hands-motion').getAttribute('visibility'),null);assert.equal(node(s,'magic-flat-clawd').getAttribute('display'),'none');assert.equal(node(s,'magic-in-front').getAttribute('display'),'none');s.destroy();assert.equal(s.timers.size,0);
 }
});
test('automatic deadline preempts magic, reduced motion avoids orbit and rocking',()=>{
 const s=setup({sleepSeconds:30});s.advance(25000);s.c.showMagic();s.advance(5500);assert.equal(s.c.getState().sleep,'asleep');assert.equal(s.c.getState().magic,'none');s.destroy();assert.equal(s.timers.size,0);
 const r=setup({reduced:true});r.c.showMagic();r.advance(1200);const t=node(r,'magic-star-wand').getAttribute('transform');r.advance(1500);assert.equal(node(r,'magic-star-wand').getAttribute('transform'),t);r.advance(4500);const p=node(r,'magic-flat-clawd').getAttribute('transform');r.advance(600);assert.equal(node(r,'magic-flat-clawd').getAttribute('transform'),p);r.destroy();assert.equal(r.timers.size,0);
});
test('magic participates in shared rare cooldown without overlapping other eggs',()=>{
 const s=setup({magicEnabled:true,sunglassesEnabled:false,happyEnabled:false,sleepEnabled:false});s.advance(407000);let found=false;for(let i=0;i<300;i++){s.advance(100);if(s.c.getState().magic!=='none'){found=true;break;}}assert(found);s.c.tap('KeyA');assert.notEqual(s.c.getState().magic,'none');s.advance(15000);assert.equal(s.c.getState().magic,'none');s.advance(60000);assert.equal(s.c.getState().magic,'none');s.destroy();assert.equal(s.timers.size,0);
 const b=setup();b.c.showBubbles();assert.equal(b.c.showMagic(),false);b.destroy();assert.equal(b.timers.size,0);
});
