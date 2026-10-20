import test from 'node:test';import assert from 'node:assert/strict';
import {setup} from './fixture.mjs';
const attr=(s,id,key)=>s.document.querySelector('#'+id).getAttribute(key);
test('sprout pops from its fixed root with happy eyes then returns to the approved pose',()=>{
 const s=setup();s.c.openAccessoryMenu();assert.equal(s.c.selectAccessory('sprout'),true);
 assert.equal(attr(s,'sprout-front','display'),'inline');assert.equal(s.c.getState().expression,'sprout');
 s.advance(288);assert.equal(s.c.getState().accessory.phase,'growing');
 const transform=attr(s,'sprout-motion','transform');
 assert.match(transform,/translate\(123 35\) scale\(1\.0\d+ 1\.19\d+\) translate\(-123 -35\)/);
 assert.equal(attr(s,'eyes-happy','display'),'inline');assert.equal(attr(s,'happy-overlay','display'),'none');
 assert.equal(attr(s,'headphones-notes','display'),'none');
 s.advance(350);assert.equal(s.c.getState().accessory.phase,'smiling');
 s.advance(1000);assert.equal(s.c.getState().accessory.preview,false);
 assert.equal(attr(s,'sprout-motion','transform'),null);assert.equal(attr(s,'sprout-left-leaf','transform'),null);
 assert.equal(s.c.getState().expression,'open');assert.equal(attr(s,'sprout-front','display'),'inline');
 assert.equal(s.timers.size,0);s.destroy();
});
test('switching to headphones or none cancels the sprout pop and restores its geometry',()=>{
 const s=setup();s.c.openAccessoryMenu();s.c.selectAccessory('sprout');s.advance(288);
 s.c.selectAccessory('cat-headphones');assert.equal(attr(s,'sprout-front','display'),'none');
 assert.equal(attr(s,'sprout-motion','transform'),null);assert.equal(attr(s,'cat-headphones-front','display'),'inline');
 s.advance(300);s.c.selectAccessory('sprout');assert.equal(attr(s,'headphones-notes','display'),'none');
 assert.equal(attr(s,'cat-headphones-front','display'),'none');
 s.advance(288);s.c.selectAccessory('none');assert.equal(attr(s,'sprout-motion','transform'),null);
 assert.equal(s.c.getState().accessory.preview,false);s.destroy();assert.equal(s.timers.size,0);
});
test('confirm completes the current pop once; cancel restores the committed sprout',()=>{
 const s=setup();s.c.openAccessoryMenu();s.c.selectAccessory('sprout');s.advance(250);s.c.closeAccessoryMenu(true);
 assert.equal(s.c.press('KeyA'),false);s.advance(900);assert.equal(s.c.getState().accessory.preview,true);
 s.advance(450);assert.equal(s.c.getState().accessory.preview,false);
 assert.equal(s.c.getState().accessory.selected,'sprout');assert.equal(s.c.press('KeyA'),true);s.c.release('KeyA');
 s.c.openAccessoryMenu();assert.equal(s.c.getState().accessory.preview,false);
 s.c.selectAccessory('headphones');s.advance(300);s.c.closeAccessoryMenu(false);
 assert.equal(attr(s,'sprout-front','display'),'inline');assert.equal(attr(s,'headphones-front','display'),'none');
 assert.equal(attr(s,'sprout-motion','transform'),null);s.destroy();assert.equal(s.timers.size,0);
});
test('reduced motion keeps the sprout still and uses only the brief happy expression',()=>{
 const s=setup({reduced:true});s.c.openAccessoryMenu();s.c.selectAccessory('sprout');s.advance(300);
 assert.equal(attr(s,'sprout-motion','transform'),'translate(123 35) scale(1.0000 1.0000) translate(-123 -35)');
 assert.equal(attr(s,'sprout-left-leaf','transform'),'rotate(0.000 124 23)');
 assert.equal(attr(s,'eyes-happy','display'),'inline');s.advance(1300);
 assert.equal(attr(s,'sprout-motion','transform'),null);assert.equal(s.c.getState().expression,'open');
 s.destroy();assert.equal(s.timers.size,0);
});
test('sprout follows work and sleep; destroying a live pop releases every preview frame',()=>{
 const s=setup();s.c.openAccessoryMenu();s.c.selectAccessory('sprout');s.advance(1600);s.c.closeAccessoryMenu(true);
 assert.equal(s.document.querySelector('#sprout-front').parentNode.id,'body-motion');
 s.c.tap('KeyA');s.advance(200);s.c.sleep();s.advance(2500);
 assert.equal(s.c.getState().sleep,'asleep');assert.equal(attr(s,'sprout-front','display'),'inline');
 s.c.openAccessoryMenu();s.c.selectAccessory('sprout');s.advance(288);s.destroy();
 assert.equal(attr(s,'sprout-motion','transform'),null);assert.equal(s.timers.size,0);
});
