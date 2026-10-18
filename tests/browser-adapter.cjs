const {chromium}=require('playwright-core');const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const projectRoot=path.resolve(__dirname,'..');
(async()=>{
const b=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
const page=await b.newPage({viewport:{width:900,height:700},offline:true});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>{
 const prefs={phase:'listening',enabled:true,running:true,scale:1,showTopBar:true,showBottomBar:true,sleepEnabled:true,sleepSeconds:90};const listeners={};window.calls=[];window.fire=(name,payload)=>(listeners[name]||[]).forEach(f=>f({payload}));window.testPrefs=prefs;
 window.__TAURI__={core:{invoke:async(name,args)=>{window.calls.push(name);if(name==='clawd_update_settings'){Object.assign(prefs,args.patch);window.fire('clawd:state',prefs);}if(name==='clawd_toggle'){prefs.enabled=!prefs.enabled;prefs.running=prefs.enabled;prefs.phase=prefs.enabled?'listening':'paused';window.fire('clawd:state',prefs);}return {...prefs};}},event:{listen:async(name,fn)=>{(listeners[name]||=[]).push(fn);return()=>{listeners[name]=listeners[name].filter(x=>x!==fn);};}},window:{getCurrentWindow:()=>({startDragging:async()=>window.calls.push('native-drag')})}};
});
await page.goto(pathToFileURL(path.join(projectRoot,'web/index.html')).href);await page.waitForFunction(()=>window.clawdDesktopController);
assert.equal(await page.locator('[data-connection]').innerText(),'全局联动中');
await page.locator('[data-settings]').click();assert((await page.evaluate(()=>window.calls)).includes('clawd_settings'));assert(!(await page.evaluate(()=>window.calls)).includes('native-drag'));
await page.locator('.scene').click({position:{x:200,y:80}});assert((await page.evaluate(()=>window.calls)).includes('native-drag'));
await page.locator('.scene').click({button:'right',position:{x:200,y:80}});assert((await page.evaluate(()=>window.calls)).includes('clawd_menu'));
await page.evaluate(()=>{window.fire('clawd:input-batch',[{type:'key',code:'KeyA',down:true},{type:'key',code:'KeyJ',down:true}]);});
assert.equal(await page.locator('.key.is-down').count(),2);
await page.evaluate(()=>window.fire('clawd:input-batch',[{type:'reset'}]));assert.equal(await page.locator('.key.is-down').count(),0);
await page.evaluate(()=>{Object.assign(window.testPrefs,{scale:1.17,showTopBar:false,showBottomBar:false});window.fire('clawd:state',window.testPrefs);});assert.equal(await page.locator('.handle').isVisible(),false);assert.equal(await page.locator('.footer').isVisible(),false);assert.equal(await page.locator('#clawd-desktop').evaluate(x=>x.style.zoom),'1.17');

await page.goto(pathToFileURL(path.join(projectRoot,'web/settings.html')).href);
await page.locator('#scale').fill('117');await page.locator('#scale').dispatchEvent('input');assert.equal(await page.locator('#scale-output').innerText(),'117%');
await page.locator('#sleepSeconds').fill('120');await page.locator('#sleepSeconds').dispatchEvent('change');await page.locator('#sleepEnabled').uncheck();assert(await page.locator('#sleepSeconds').isDisabled());
await page.locator('#showTopBar').uncheck();await page.locator('#showBottomBar').uncheck();await page.locator('#showOnStartup').uncheck();assert.equal(await page.evaluate(()=>window.testPrefs.sleepSeconds),120);
await page.locator('#done').click();assert((await page.evaluate(()=>window.calls)).includes('clawd_close_settings'));
assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:'Chromium mock (not Windows WebView2)',checks:['bridge initialization','settings button','native drag delegation','right-click menu','two-hand key lights','reset clears keys','117% zoom and hidden bars','sleep and startup preferences','settings close'],pageErrors:errors}));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
