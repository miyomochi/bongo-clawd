import test from 'node:test';import assert from 'node:assert/strict';
import {setup} from './fixture.mjs';
const attr=(s,id,name)=>s.document.querySelector('#'+id).getAttribute(name);
test('menu pauses work and natural timers without buffering input',()=>{
 const s=setup({happyEnabled:true});s.c.tap('KeyA');s.c.showHappy();
 assert.equal(s.c.openAccessoryMenu(),true);
 assert.equal(s.c.getState().happy,'none');assert.equal(s.c.getState().cool,'none');
 for(let i=0;i<20;i++){s.c.tap('KeyA');s.c.moveMouse(3,2);s.c.mouseButton(0,true);}
 s.advance(600000);const state=s.c.getState();
 assert.equal(state.accessory.menuOpen,true);assert.equal(state.sleep,'awake');assert.equal(state.looking,false);
 assert.equal(state.keys.length,0);assert.equal(state.busy,0);assert.equal(state.left,'idle');assert.equal(state.right,'idle');
 assert.equal(s.timers.size,0);s.destroy();assert.equal(s.timers.size,0);
});
test('selection nods forward twice, inherits headphones motion and emits notes',()=>{
 const s=setup();s.c.openAccessoryMenu();s.c.selectAccessory('headphones');
 assert.equal(s.c.getState().expression,'headphones');assert.equal(attr(s,'headphones-front','display'),'inline');
 s.advance(272);assert.ok(s.c.getState().accessory.pulse>.95);
 assert.match(attr(s,'body-motion','transform'),/scale\(1\.0080 0\.9650\)/);
 assert.equal(s.document.querySelector('#headphones-front').parentNode.id,'body-motion');
 assert.equal(attr(s,'hands-motion','transform'),'translate(0 0)');
 assert.ok([...s.document.querySelectorAll('[data-headphone-note]')].some(n=>n.getAttribute('display')==='inline'));
 s.advance(248);assert.ok(s.c.getState().accessory.pulse<.01);
 s.advance(272);assert.ok(s.c.getState().accessory.pulse>.95);
 s.advance(500);assert.equal(s.c.getState().accessory.preview,false);assert.equal(attr(s,'headphones-notes','display'),'none');
 assert.equal(s.c.getState().accessory.menuOpen,true);assert.equal(s.timers.size,0);s.destroy();
});
test('switching off hard interrupts and a cancelled choice restores the committed outfit',()=>{
 const s=setup();s.c.openAccessoryMenu();s.c.selectAccessory('headphones');s.advance(300);
 s.c.selectAccessory('none');assert.equal(s.c.getState().accessory.preview,false);
 assert.equal(attr(s,'body-motion','transform'),'translate(0 0)');assert.equal(attr(s,'headphones-notes','display'),'none');
 s.c.selectAccessory('headphones');s.advance(260);s.c.closeAccessoryMenu(false);
 assert.equal(s.c.getState().accessory.selected,'none');assert.equal(attr(s,'headphones-front','display'),'none');
 assert.equal(s.c.getState().expression,'open');s.c.tap('KeyJ');assert.ok(s.c.getState().keys.includes('KeyJ'));s.destroy();
});
test('confirmation finishes the current preview once then resumes, with persistent decoration',()=>{
 const s=setup({happyEnabled:true});s.c.openAccessoryMenu();s.c.selectAccessory('headphones');s.advance(250);s.c.closeAccessoryMenu(true);
 assert.equal(s.c.getState().accessory.menuOpen,false);assert.equal(s.c.getState().accessory.preview,true);
 assert.equal(s.c.press('KeyA'),false);assert.equal(s.c.showHappy(),false);assert.equal(s.c.showSunglasses(),false);
 s.advance(1000);assert.equal(s.c.getState().accessory.preview,false);assert.equal(s.c.getState().expression,'open');
 assert.equal(attr(s,'headphones-front','display'),'inline');assert.equal(s.c.press('KeyA'),true);s.c.release('KeyA');
 s.c.openAccessoryMenu();assert.equal(s.c.getState().accessory.preview,false);
 s.c.selectAccessory('none');s.c.closeAccessoryMenu(false);assert.equal(attr(s,'headphones-front','display'),'inline');
 s.c.clearAll();assert.equal(attr(s,'headphones-front','display'),'inline');s.destroy();assert.equal(s.timers.size,0);
});
test('reduced motion retains closed eyes and static notes without squash or drift',()=>{
 const s=setup({reduced:true});s.c.openAccessoryMenu();s.c.selectAccessory('headphones');s.advance(280);
 assert.equal(s.c.getState().accessory.pulse,0);assert.match(attr(s,'body-motion','transform'),/scale\(1\.0000 1\.0000\)/);
 assert.equal(s.c.getState().expression,'headphones');assert.equal(attr(s,'headphones-notes','display'),'inline');
 s.c.closeAccessoryMenu(true);s.advance(1200);assert.equal(s.c.getState().expression,'open');s.destroy();assert.equal(s.timers.size,0);
});
test('menu controls use the same preview lifecycle and ignore ordinary demo actions',()=>{
 const s=setup({bindDemo:true});const click=selector=>s.root.querySelector(selector).dispatchEvent(new s.window.Event('click',{bubbles:true}));
 click('[data-accessory-open]');assert.equal(s.c.getState().accessory.menuOpen,true);
 const radio=s.root.querySelector('[value="headphones"]');radio.checked=true;radio.dispatchEvent(new s.window.Event('change',{bubbles:true}));
 assert.equal(s.c.getState().accessory.preview,true);click('[data-action="demo"]');click('[data-action="cool"]');
 assert.equal(s.c.getState().cool,'none');assert.equal(s.c.getState().keys.length,0);
 click('[data-accessory-confirm]');s.advance(1300);assert.equal(s.c.getState().accessory.selected,'headphones');
 click('[data-accessory-open]');click('[data-accessory-cancel]');assert.equal(s.c.getState().accessory.menuOpen,false);s.destroy();
});

test('destroying a live preview releases its animation frame and all paused work timers',()=>{
 const s=setup();s.c.openAccessoryMenu();s.c.selectAccessory('headphones');s.advance(300);
 s.destroy();assert.equal(s.timers.size,0);assert.equal(attr(s,'headphones-notes','display'),'none');
 assert.ok([null,'translate(0 0)'].includes(attr(s,'body-motion','transform')));
});
test('confirmed headphones remain body-anchored through normal typing, sleep and waking',()=>{
 const s=setup();s.c.openAccessoryMenu();s.c.selectAccessory('headphones');s.advance(1300);s.c.closeAccessoryMenu(true);
 s.c.tap('KeyA');s.advance(200);assert.equal(attr(s,'headphones-front','display'),'inline');
 s.c.sleep();s.advance(2500);assert.equal(s.c.getState().sleep,'asleep');assert.equal(attr(s,'headphones-front','display'),'inline');
 s.c.wake();s.advance(5000);assert.equal(attr(s,'headphones-front','display'),'inline');
 const body=s.document.querySelector('#body-motion'),front=s.document.querySelector('#headphones-front');
 assert.equal(front.parentNode,body);assert.ok([...body.children].indexOf(front)>[...body.children].findIndex(n=>n.id==='cool-stage'));
 s.destroy();assert.equal(s.timers.size,0);
});
test('pink cat-ear selection reuses happy eyes without starting a happy bubble',()=>{
 const s=setup({happyEnabled:true});s.c.openAccessoryMenu();assert.equal(s.c.selectAccessory('cat-headphones'),true);s.advance(300);
 assert.equal(attr(s,'cat-headphones-front','display'),'inline');assert.equal(attr(s,'cat-headphones-rear','display'),'inline');
 assert.equal(attr(s,'headphones-front','display'),'none');assert.equal(attr(s,'eyes-happy','display'),'inline');
 assert.equal(attr(s,'eyes-headphones','display'),'none');assert.equal(s.c.getState().happy,'none');assert.equal(attr(s,'happy-overlay','display'),'none');
 assert.equal(s.document.querySelector('#headphones-note-0-shape').getAttribute('fill'),'#d98eaf');
 s.c.closeAccessoryMenu(true);s.advance(1000);assert.equal(s.c.getState().expression,'open');assert.equal(attr(s,'eyes-happy','display'),'none');
 assert.equal(attr(s,'cat-headphones-front','display'),'inline');s.destroy();
});
test('switching headphone variants immediately replaces eyes, notes and the previous outfit',()=>{
 const s=setup();s.c.openAccessoryMenu();s.c.selectAccessory('headphones');s.advance(300);
 s.c.selectAccessory('cat-headphones');assert.equal(s.c.getState().accessory.pulse,0);
 assert.equal(attr(s,'headphones-front','display'),'none');assert.equal(attr(s,'cat-headphones-front','display'),'inline');
 assert.equal(attr(s,'eyes-happy','display'),'inline');
 assert.ok([...s.document.querySelectorAll('[data-headphone-note]')].every(n=>n.getAttribute('display')==='none'));
 s.advance(300);s.c.selectAccessory('headphones');assert.equal(attr(s,'cat-headphones-front','display'),'none');
 assert.equal(attr(s,'eyes-happy','display'),'none');assert.equal(attr(s,'eyes-headphones','display'),'inline');
 assert.equal(s.document.querySelector('#headphones-note-0-shape').getAttribute('fill'),'#5598bd');s.destroy();assert.equal(s.timers.size,0);
});
test('cancel restores committed pink variant and all SVG ids remain unique',()=>{
 const s=setup();s.c.openAccessoryMenu();s.c.selectAccessory('cat-headphones');s.c.closeAccessoryMenu(true);s.advance(1300);
 s.c.openAccessoryMenu();s.c.selectAccessory('headphones');s.advance(250);s.c.closeAccessoryMenu(false);
 assert.equal(s.c.getState().accessory.selected,'cat-headphones');assert.equal(attr(s,'cat-headphones-front','display'),'inline');
 assert.equal(attr(s,'headphones-front','display'),'none');assert.equal(s.c.getState().accessory.preview,false);
 const ids=[...s.document.querySelector('#clawd-scene').querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);
 s.destroy();assert.equal(s.timers.size,0);
});
