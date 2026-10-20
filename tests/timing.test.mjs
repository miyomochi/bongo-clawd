import test from 'node:test';import assert from 'node:assert/strict';
import {setup} from './fixture.mjs';
function type(s,count,interval=70){for(let i=0;i<count;i++){s.c.tap(i%2?'KeyA':'KeyJ');s.advance(interval);}}
test('brief acceleration does not enter busy; sustained typing waits out entry dwell',()=>{
 const s=setup();type(s,16);assert.equal(s.c.getState().busy,0);
 type(s,16);assert.equal(s.c.getState().busy,2);s.destroy();assert.equal(s.timers.size,0);
});
test('sentence pauses and a mouse adjustment preserve busy; a real rest eventually recovers',()=>{
 const s=setup();type(s,40);assert.equal(s.c.getState().busy,2);
 for(let sentence=0;sentence<3;sentence++){
  s.advance(1600);assert.equal(s.c.getState().busy,2);assert.equal(s.c.getState().recovering,false);
  s.c.moveMouse(1,0);assert.equal(s.c.getState().busy,2);
  type(s,32);assert.equal(s.c.getState().busy,2);assert.equal(s.c.getState().recovering,false);
 }
 s.advance(4100);assert.equal(s.c.getState().busy,0);assert.equal(s.c.getState().recovering,true);
 s.destroy();assert.equal(s.timers.size,0);
});
test('pause clears entry and exit dwell, and slow ongoing typing eventually leaves busy',()=>{
 const s=setup();type(s,16);s.c.setPaused(true);s.c.setPaused(false);
 s.advance(1000);assert.equal(s.c.getState().busy,0);
 type(s,40);assert.equal(s.c.getState().busy,2);
 type(s,30,400);assert.equal(s.c.getState().busy,0);
 s.destroy();assert.equal(s.timers.size,0);
});
test('fitting lines wait for confirmation and the remaining preview, exactly once',()=>{
 const lines=[],s=setup({onAccessoryConfirmed:line=>lines.push(line)});
 s.c.openAccessoryMenu();s.c.selectAccessory('headphones');s.advance(300);assert.deepEqual(lines,[]);
 s.c.closeAccessoryMenu(true);s.advance(500);assert.deepEqual(lines,[]);
 s.advance(500);assert.deepEqual(lines,['跟着节奏敲~']);s.advance(1000);assert.equal(lines.length,1);
 s.c.openAccessoryMenu();s.c.selectAccessory('duck');s.advance(1500);assert.equal(lines.length,1);
 s.c.closeAccessoryMenu(true);assert.deepEqual(lines,['跟着节奏敲~','坐稳啦']);
 s.destroy();assert.equal(s.timers.size,0);
});
test('switch, cancellation, reopening and pause discard the superseded fitting line',()=>{
 const lines=[],s=setup({onAccessoryConfirmed:line=>lines.push(line)});
 s.c.openAccessoryMenu();s.c.selectAccessory('sprout');s.advance(200);s.c.selectAccessory('duck');
 s.c.closeAccessoryMenu(true);s.advance(1500);assert.deepEqual(lines,['坐稳啦']);
 s.c.openAccessoryMenu();s.c.selectAccessory('sprout');s.c.closeAccessoryMenu(false);s.advance(2000);assert.equal(lines.length,1);
 s.c.openAccessoryMenu();s.c.selectAccessory('headphones');s.c.closeAccessoryMenu(true);s.advance(100);
 s.c.openAccessoryMenu();s.c.selectAccessory('sprout');s.c.closeAccessoryMenu(true);s.advance(1700);assert.deepEqual(lines,['坐稳啦','啵，长高一点点']);
 s.c.openAccessoryMenu();s.c.selectAccessory('duck');s.c.closeAccessoryMenu(true);s.c.setPaused(true);s.advance(2000);assert.equal(lines.length,2);
 s.destroy();assert.equal(s.timers.size,0);
});
