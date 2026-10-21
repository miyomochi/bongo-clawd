/* Real browser hit-testing of the shipped desktop HTML/CSS, with the native bridge mocked. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:900,height:700},offline:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
   const prefs={phase:'listening',enabled:true,running:true,scale:1,sleepEnabled:false,breathingEnabled:false,accessory:'none',sideButtons:true,bubbleLines:true};
   const listeners={};window.nativeCalls=[];
   window.sendNative=(name,payload)=>(listeners[name]||[]).forEach(f=>f({payload}));
   window.setTestPrefs=patch=>{Object.assign(prefs,patch);window.sendNative('clawd:state',{...prefs});};
   window.__TAURI__={
    core:{invoke:async(name)=>{window.nativeCalls.push(name);return {...prefs};}},
    event:{listen:async(name,fn)=>{(listeners[name]||=[]).push(fn);return()=>{};}},
    window:{getCurrentWindow:()=>({startDragging:async()=>window.nativeCalls.push('native-drag')})}
   };
  });
  await page.goto(pathToFileURL(path.resolve(__dirname,'../web/index.html')).href);
  await page.waitForFunction(()=>window.clawdDesktopController);
  const state=()=>page.evaluate(()=>({reaction:window.clawdDesktopController.getReaction(),mouse:window.clawdDesktopController.getState().mouse}));
  const reset=()=>page.evaluate(()=>window.clawdDesktopController.clearAll());
  const raw=events=>page.evaluate(events=>window.sendNative('clawd:input-batch',events),events);
  const point=()=>page.locator('#body-front').evaluate(n=>{const r=n.getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.4};});

  for(const mirrored of [false,true])for(const scale of [.6,1,1.17,1.6]){
   await page.evaluate(patch=>window.setTestPrefs(patch),{mirrored,scale});await reset();
   const p=await point();
   const hit=await page.evaluate(({x,y})=>{const n=document.elementFromPoint(x,y);return {tag:n?.tagName,id:n?.id,body:!!n?.closest('#body-motion,#left-hand,#right-hand')};},p);
   assert(hit.body,'Actual CSS hit test missed the body: '+JSON.stringify({mirrored,scale,hit}));
   await page.mouse.move(p.x,p.y);
   await raw([{type:'move',dx:4,dy:2}]);
   assert.equal((await state()).mouse,false,'Body hover must suppress native mouse animation');
   await page.mouse.down();await raw([{type:'button',button:0,down:true}]);await page.mouse.up();
   await raw([{type:'button',button:0,down:false},{type:'move',dx:1,dy:0}]);
   assert((await state()).reaction,'Actual coordinate click must trigger a reaction');
   assert.equal((await state()).mouse,false);
   const reaction=(await state()).reaction;
   await raw([{type:'key',code:'KeyA',down:true},{type:'key',code:'KeyA',down:false},{type:'move',dx:15,dy:6}]);
   assert.equal((await state()).reaction,reaction,'Keyboard and mouse must not interrupt the reaction');
   await page.waitForFunction(()=>window.clawdDesktopController.getReaction()===null);
   assert.equal(await page.evaluate(()=>window.clawdDesktopController.getState().keys.length),0,'No queued keystrokes');
  }
  await page.evaluate(()=>window.setTestPrefs({mirrored:false,scale:1}));await reset();
  let p=await point();await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();
  assert.equal((await state()).reaction,null,'Long hold is not a tap');
  p=await point();await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+14,p.y+9);await page.mouse.up();
  assert.equal((await state()).reaction,null,'Drag is not a tap');
  assert.equal(await page.evaluate(()=>window.nativeCalls.filter(x=>x==='native-drag').length),1);
  p=await point();await page.mouse.click(p.x,p.y,{button:'right'});
  assert.equal((await state()).reaction,null,'Right click is not a tap');
  assert(await page.evaluate(()=>window.nativeCalls.includes('clawd_menu')));
  await page.evaluate(()=>window.setTestPrefs({settingsOpen:true}));
  p=await point();await page.mouse.click(p.x,p.y);
  assert.equal((await state()).reaction,null,'Settings pause reactions');
  await page.evaluate(()=>window.setTestPrefs({settingsOpen:false}));await reset();
  p=await point();await page.touchscreen.tap(p.x,p.y);
  assert((await state()).reaction,'Touch uses the same real body hit target');
  assert.deepEqual(errors,[]);
  console.log('Desktop pointer browser checks passed: actual HTML/CSS body hits, 8 scale/mirror cases, clicks, raw mouse suppression, full playthrough, hold, drag, right click, settings and touch. Native Windows input remains a device test.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
