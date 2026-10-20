import test from 'node:test';import assert from 'node:assert/strict';
import {setup} from './fixture.mjs';
const attr=(s,id,key)=>s.document.querySelector('#'+id).getAttribute(key);
test('duck lands, squashes and rebounds with happy eyes, then remains seated',()=>{
 const s=setup();s.c.openAccessoryMenu();assert.equal(s.c.selectAccessory('duck'),true);
 assert.equal(attr(s,'duck-front','display'),'inline');assert.equal(s.c.getState().accessory.phase,'landing');
 assert.match(attr(s,'duck-motion','transform'),/translate\(0 -7.000\)/);
 s.advance(288);assert.equal(s.c.getState().accessory.phase,'bouncing');
 assert.match(attr(s,'duck-motion','transform'),/scale\(1\.09\d+ 0\.86\d+\)/);
 assert.equal(attr(s,'eyes-happy','display'),'inline');assert.equal(attr(s,'happy-overlay','display'),'none');
 assert.equal(attr(s,'headphones-notes','display'),'none');
 s.advance(160);assert.match(attr(s,'duck-motion','transform'),/translate\(0 -1\.\d+\)/);
 s.advance(900);assert.equal(s.c.getState().accessory.preview,false);
 assert.equal(attr(s,'duck-motion','transform'),null);assert.equal(attr(s,'duck-contact','opacity'),null);
 assert.equal(attr(s,'duck-front','display'),'inline');assert.equal(s.c.getState().expression,'open');
 s.destroy();assert.equal(s.timers.size,0);
});
test('duck switching, confirmation and cancel use the shared accessory lifecycle',()=>{
 const s=setup();s.c.openAccessoryMenu();s.c.selectAccessory('duck');s.advance(288);s.c.closeAccessoryMenu(true);
 assert.equal(s.c.press('KeyA'),false);s.advance(1100);assert.equal(s.c.getState().accessory.selected,'duck');
 assert.equal(s.c.press('KeyA'),true);s.c.release('KeyA');s.c.openAccessoryMenu();
 assert.equal(s.c.getState().accessory.preview,false);s.c.selectAccessory('sprout');s.advance(300);s.c.closeAccessoryMenu(false);
 assert.equal(attr(s,'duck-front','display'),'inline');assert.equal(attr(s,'sprout-front','display'),'none');
 s.c.openAccessoryMenu();s.c.selectAccessory('duck');s.advance(288);s.c.selectAccessory('cat-headphones');
 assert.equal(attr(s,'duck-motion','transform'),null);assert.equal(attr(s,'duck-front','display'),'none');
 assert.equal(attr(s,'cat-headphones-front','display'),'inline');s.destroy();assert.equal(s.timers.size,0);
});
test('reduced motion keeps duck seated; work, sleep and destruction retain clean state',()=>{
 const s=setup({reduced:true});s.c.openAccessoryMenu();s.c.selectAccessory('duck');s.advance(288);
 assert.match(attr(s,'duck-motion','transform'),/translate\(0 0.000\).*scale\(1.0000 1.0000\)/);
 assert.equal(attr(s,'eyes-happy','display'),'inline');s.advance(1100);s.c.closeAccessoryMenu(true);
 assert.equal(s.document.querySelector('#duck-front').parentNode.id,'body-motion');
 s.c.tap('KeyA');s.advance(200);s.c.sleep();s.advance(2500);assert.equal(s.c.getState().sleep,'asleep');
 assert.equal(attr(s,'duck-front','display'),'inline');s.c.openAccessoryMenu();s.c.selectAccessory('duck');s.advance(288);s.destroy();
 assert.equal(attr(s,'duck-motion','transform'),null);assert.equal(s.timers.size,0);
});
