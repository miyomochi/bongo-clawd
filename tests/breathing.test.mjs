import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './fixture.mjs';
const transform=s=>s.document.querySelector('#body-motion').getAttribute('transform');
test('resting breath is gentle, anchored, and yields to work and pause',()=>{
 const s=setup({breathingEnabled:true,sleepEnabled:false,accessoryStorage:false});
 s.c.restoreAccessory('duck');const original=transform(s);s.advance(2100);
 assert.equal(transform(s),'translate(0 -1)');assert.notEqual(transform(s),original);
 assert(s.document.querySelector('#body-motion #duck-front'));
 assert.equal(s.document.querySelector('#far-arm-visible').getAttribute('transform'),'translate(0 -1)');
 s.c.press('KeyA');s.advance(40);assert.equal(transform(s),'translate(0 -3)');
 s.c.release('KeyA');s.advance(4000);s.c.setPaused(true);
 const frozen=transform(s);s.advance(600000);assert.equal(transform(s),frozen);assert.equal(s.timers.size,0);
 s.c.setPaused(false);s.advance(2100);assert.equal(transform(s),'translate(0 -1)');
 s.destroy();assert.equal(s.timers.size,0);
});
test('fitting uses its own motion and normal breathing returns afterward',()=>{
 const s=setup({breathingEnabled:true,sleepEnabled:false});s.advance(2100);
 s.c.openAccessoryMenu();s.c.selectAccessory('headphones');s.advance(272);
 assert.match(transform(s),/scale\(/);s.c.closeAccessoryMenu(true);s.advance(3500);
 assert.equal(s.c.getState().accessory.preview,false);assert.match(transform(s),/^translate\(0 -/);
 s.destroy();assert.equal(s.timers.size,0);
});
test('breathing setting and reduced motion keep the resting body still',()=>{
 for(const reduced of [false,true]){
  const s=setup({breathingEnabled:true,reduced,sleepEnabled:false});
  if(!reduced)s.c.configure({breathingEnabled:false});
  s.advance(5000);assert.equal(transform(s),'translate(0 0)');s.destroy();assert.equal(s.timers.size,0);
 }
});
