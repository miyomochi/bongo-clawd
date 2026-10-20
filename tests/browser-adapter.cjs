const {chromium}=require('playwright-core');const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const projectRoot=path.resolve(__dirname,'..');
(async()=>{
const b=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
const page=await b.newPage({viewport:{width:900,height:700},offline:true});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>{
 const prefs={phase:'listening',enabled:true,running:true,scale:1,showTopBar:true,showBottomBar:true,sleepEnabled:true,sleepSeconds:90,accessory:'duck',sideButtons:true,bubbleLines:true};const listeners={};window.calls=[];window.fire=(name,payload)=>(listeners[name]||[]).forEach(f=>f({payload}));window.testPrefs=prefs;
 window.__TAURI__={core:{invoke:async(name,args)=>{window.calls.push(name);if(name==='clawd_autostart'){prefs.autostartEnabled=args.enabled;window.fire('clawd:state',prefs);}if(name==='clawd_statistics')return {total:12345,perMinute:186};if(name==='clawd_adjustment'){Object.assign(prefs,{accessoryOpen:args.open,running:!args.open,phase:args.open?'paused':'listening'});window.fire('clawd:input-batch',[{type:'reset'}]);window.fire('clawd:state',prefs);}if(name==='clawd_update_settings'){Object.assign(prefs,args.patch);window.fire('clawd:state',prefs);}if(name==='clawd_toggle'){prefs.enabled=!prefs.enabled;prefs.running=prefs.enabled;prefs.phase=prefs.enabled?'listening':'paused';window.fire('clawd:state',prefs);}if(name==='clawd_retry'){prefs.phase='listening';prefs.running=true;window.fire('clawd:state',prefs);}return {...prefs};}},event:{listen:async(name,fn)=>{(listeners[name]||=[]).push(fn);return()=>{listeners[name]=listeners[name].filter(x=>x!==fn);};}},window:{getCurrentWindow:()=>({startDragging:async()=>window.calls.push('native-drag')})}};
});
const calls=()=>page.evaluate(()=>window.calls);const height=()=>page.locator('#clawd-desktop').evaluate(n=>n.style.height);
await page.goto(pathToFileURL(path.join(projectRoot,'web/index.html')).href);await page.waitForFunction(()=>window.clawdDesktopController);
// No top/bottom bars; three side blocks.
assert.equal(await page.locator('.handle,.footer').count(),0);
assert.equal(await page.locator('.block').count(),3);
assert.equal(await height(),'300px');
await page.locator('[data-settings]').click();assert((await calls()).includes('clawd_settings'));assert(!(await calls()).includes('native-drag'));
// Keycap travels inward while its back stays fixed.
const sink=await page.locator('[data-settings]').evaluate(async n=>{const svg=n.querySelector('svg');const a=svg.getBoundingClientRect().top;return a;});
const back=await page.locator('[data-settings] .cube-back').getAttribute('points');
await page.locator('[data-settings]').hover();await page.mouse.down();await page.waitForTimeout(120);const pressed=await page.locator('[data-settings] .cube-cap').getAttribute('transform');await page.mouse.up();
assert.equal(pressed,'translate(-4 -2)');assert.equal(await page.locator('[data-settings] .cube-back').getAttribute('points'),back);assert(sink>0);
// Drag by holding the pet body; right-click opens the native menu.
await page.locator('.scene').click({position:{x:180,y:120}});assert((await calls()).includes('native-drag'));
await page.locator('.scene').click({button:'right',position:{x:180,y:120}});assert((await calls()).includes('clawd_menu'));
await page.evaluate(()=>{window.fire('clawd:input-batch',[{type:'key',code:'KeyA',down:true},{type:'key',code:'KeyJ',down:true}]);});
assert.equal(await page.locator('.key.is-down').count(),2);
await page.evaluate(()=>window.fire('clawd:input-batch',[{type:'reset'}]));assert.equal(await page.locator('.key.is-down').count(),0);
// Bubble: speech lines only, above the head, on top of everything.
await page.evaluate(()=>{document.querySelector('[data-status]').textContent='打字中';});await page.waitForTimeout(50);
assert.equal(await page.locator('[data-bubble]').isVisible(),false,'narration does not bubble');
await page.evaluate(()=>{document.querySelector('[data-status]').textContent='Ultra Clawding!!';});await page.waitForTimeout(50);
assert.equal(await page.locator('[data-bubble]').isVisible(),true);assert.equal(await page.locator('[data-bubble-text]').innerText(),'Ultra Clawding!!');
const bub=await page.locator('[data-bubble]').evaluate(n=>({z:getComputedStyle(n).zIndex,r:n.getBoundingClientRect().toJSON()}));
assert.equal(bub.z,'50');assert(bub.r.top>=0&&bub.r.right<=388&&bub.r.left<=124&&bub.r.bottom<=54,'bubble shifts left and up, leaving room above head accessories');
await page.waitForTimeout(3000);assert.equal(await page.locator('[data-bubble]').isVisible(),false,'bubble hides after a while');
// Long line near the edge shifts diagonally (up and sideways) but stays inside.
await page.evaluate(()=>{window.testPrefs.sideButtons=false;window.fire('clawd:state',window.testPrefs);document.querySelector('[data-status]').textContent='全工位最酷的小蟹';});
await page.evaluate(()=>{document.querySelector('[data-bubble-text]').textContent='全工位最酷的小蟹全工位最酷的小蟹';window.fire('clawd:state',window.testPrefs);});
const edge=await page.locator('[data-bubble]').evaluate(n=>n.getBoundingClientRect().toJSON());assert(edge.right<=352,'bubble shifted inside the narrow window');
await page.evaluate(()=>{window.testPrefs.sideButtons=true;window.testPrefs.bubbleLines=false;window.fire('clawd:state',window.testPrefs);document.querySelector('[data-status]').textContent='嘿嘿~';});await page.waitForTimeout(50);
assert.equal(await page.locator('[data-bubble]').isVisible(),false,'台词 toggle off hides bubbles');
await page.evaluate(()=>{window.testPrefs.bubbleLines=true;window.fire('clawd:state',window.testPrefs);});
// Side buttons toggle.
await page.evaluate(()=>{window.testPrefs.sideButtons=false;window.fire('clawd:state',window.testPrefs);});
assert.equal(await page.locator('[data-settings]').isVisible(),false);assert.equal(await page.locator('[data-toggle]').isVisible(),false);
assert.equal(await page.locator('#clawd-desktop').evaluate(n=>n.style.width),'352px');
await page.evaluate(()=>{window.testPrefs.sideButtons=true;window.fire('clawd:state',window.testPrefs);});
// Pause → centred status card; drag moves the window; click resumes.
await page.locator('[data-toggle]').click();await page.waitForTimeout(500);
assert.equal(await page.evaluate(()=>window.testPrefs.enabled),false);
const card=await page.locator('[data-toggle]').boundingBox();assert(Math.abs(card.x+card.width/2-194)<12&&Math.abs(card.y+card.height/2-150)<12,'card centred');
assert.equal(await page.locator('.scene').evaluate(n=>getComputedStyle(n).opacity),'0');
const before=(await calls()).filter(c=>c==='native-drag').length;
await page.mouse.move(card.x+60,card.y+30);await page.mouse.down();await page.mouse.move(card.x+80,card.y+40,{steps:4});await page.mouse.up();
assert.equal((await calls()).filter(c=>c==='native-drag').length,before+1,'card drag delegates to native dragging');
assert.equal(await page.evaluate(()=>window.testPrefs.enabled),false,'drag does not resume');
await page.locator('[data-toggle]').click();assert.equal(await page.evaluate(()=>window.testPrefs.enabled),true);await page.waitForTimeout(450);
// Hidden-side pause card stays centred in its narrower native window.
await page.evaluate(()=>{window.testPrefs.sideButtons=false;window.fire('clawd:state',window.testPrefs);});
await page.locator('[data-toggle]').evaluate(n=>n.click());await page.waitForTimeout(450);
const narrowCard=await page.locator('[data-toggle]').boundingBox();assert(Math.abs(narrowCard.x+narrowCard.width/2-176)<1,'narrow pause card centred');
await page.locator('[data-toggle]').click();await page.evaluate(()=>{window.testPrefs.sideButtons=true;window.fire('clawd:state',window.testPrefs);});await page.waitForTimeout(450);
// Error bubble retries the input service.
await page.evaluate(()=>{Object.assign(window.testPrefs,{phase:'error',running:false});window.fire('clawd:state',window.testPrefs);});
assert.equal(await page.locator('[data-retry]').innerText(),'连不上了 · 点我重试');
const err=await page.locator('[data-retry]').evaluate(n=>getComputedStyle(n).boxShadow);assert(err.includes('217, 119, 79'),'orange outline');
await page.locator('[data-retry]').click();await page.waitForTimeout(20);assert((await calls()).includes('clawd_retry'));assert.equal(await page.locator('[data-retry]').isVisible(),false);
// Decorations: 5 thumbnail tiles, select = preview, 取消 / 戴上.
await page.locator('[data-accessory-open]').click();
await page.locator('[data-accessory-menu]').waitFor({state:'visible'});
assert.equal(await page.evaluate(()=>window.scrollY),0,'fitting focus never scrolls the page');
assert.equal(await page.locator('[data-accessory-menu]').isVisible(),true);
assert.equal(await height(),'466px');
assert.equal(await page.locator('.accessory-options img').count(),5);
assert.deepEqual(await page.locator('.accessory-options img').evaluateAll(ns=>ns.map(n=>n.naturalWidth>0)),[true,true,true,true,true],'thumbnails load');
assert.deepEqual(await page.locator('.actions button').allInnerTexts(),['取消','戴上']);
await page.locator('[value="cat-headphones"]').check({force:true});await page.waitForTimeout(300);
assert.equal(await page.locator('[value="cat-headphones"] + .tile').evaluate(n=>getComputedStyle(n).borderTopColor),'rgb(217, 119, 79)');
await page.evaluate(()=>window.fire('clawd:input-batch',[{type:'key',code:'KeyJ',down:true}]));
assert.equal(await page.locator('.key.is-down').count(),0);
const fit=await page.locator('[data-accessory-menu]').evaluate(n=>({client:n.clientHeight,scroll:n.scrollHeight,bottom:n.getBoundingClientRect().bottom}));
assert(fit.scroll<=fit.client,'fitting menu overflows');assert(fit.bottom<=466,'fitting panel clipped by native window');
await page.waitForTimeout(1000);
await page.locator('#clawd-desktop').screenshot({path:process.env.CLAWD_SCREENSHOT||'/tmp/clawd-desktop-fitting.png'});
await page.locator('[data-accessory-confirm]').click();
assert.equal(await page.evaluate(()=>window.testPrefs.accessory),'cat-headphones');
assert.equal(await height(),'300px');
await page.evaluate(()=>window.fire('clawd:accessory-open',{}));await page.locator('[value="duck"]').check({force:true});
await page.locator('[data-accessory-cancel]').click();assert.equal(await page.evaluate(()=>window.testPrefs.accessory),'cat-headphones');
// One-line statistics, skewed along the keyboard.
await page.evaluate(()=>{window.testPrefs.statisticsEnabled=true;window.fire('clawd:state',window.testPrefs);});
await page.waitForFunction(()=>document.querySelector('[data-statistics-total]').textContent==='1.2万');
assert.equal(await page.locator('[data-statistics]').innerText(),'敲击 1.2万　速度 186/分');
assert.match(await page.locator('[data-statistics]').evaluate(n=>getComputedStyle(n).transform),/^matrix\(1, 0\.18/);
const bounds=await page.locator('[data-statistics]').boundingBox();assert(bounds.y+bounds.height<=300);
// Busy wallpaper cannot bleed through the statistics; both labels and values remain readable.
const contrast=await page.locator('[data-statistics]').evaluate(n=>{
 const s=getComputedStyle(n),value=getComputedStyle(n.querySelector('b'));
 const luminance=color=>{const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
 const ratio=color=>{const a=luminance(color),b=luminance(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 return {background:s.backgroundColor,label:ratio(s.color),value:ratio(value.color)};
});
assert.equal(contrast.background,'rgb(47, 43, 39)');assert(contrast.label>=4.5&&contrast.value>=4.5,'statistics contrast');
await page.evaluate(()=>{window.testPrefs.statisticsEnabled=false;window.fire('clawd:state',window.testPrefs);});
assert.equal(await page.locator('[data-statistics]').isVisible(),false);
await page.evaluate(()=>{Object.assign(window.testPrefs,{scale:1.17,showTopBar:false,showBottomBar:false});window.fire('clawd:state',window.testPrefs);});assert.equal(await page.locator('#clawd-desktop').evaluate(x=>x.style.zoom),'1.17');

// Both native widths and all size extremes keep the fitting tiles within the window.
for(const sideButtons of [true,false])for(const scale of [.6,1,1.6]){
 const w=(sideButtons?388:352)*scale;
 await page.setViewportSize({width:Math.ceil(w),height:Math.ceil(466*scale)});
 await page.evaluate(({sideButtons,scale})=>{Object.assign(window.testPrefs,{sideButtons,scale,statisticsEnabled:true});window.fire('clawd:state',window.testPrefs);window.fire('clawd:accessory-open',{});},{sideButtons,scale});
 const tiles=await page.locator('.tile').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {right:r.right,bottom:r.bottom};}));
 assert(tiles.every(r=>r.right<=w+1&&r.bottom<=466*scale),'fitting tiles clipped at zoom '+scale);
 const stats=await page.locator('[data-statistics]').boundingBox();assert(stats.x>=0&&stats.x+stats.width<=w&&stats.y+stats.height<=300*scale+1,'statistics clipped at zoom '+scale);
 await page.locator('[data-accessory-cancel]').click();
}
// Mirror the workstation and controls, but preserve the text reading direction.
await page.setViewportSize({width:900,height:700});
await page.evaluate(()=>{Object.assign(window.testPrefs,{enabled:true,running:true,phase:'listening',scale:1,sideButtons:true,statisticsEnabled:true,mirrored:false,settingsOpen:false,popupOpen:false,accessoryOpen:false,breathingEnabled:false});window.fire('clawd:state',window.testPrefs);});
await page.waitForTimeout(80);
const normalButton=await page.locator('[data-settings]').boundingBox();
const normalSlope=await page.locator('.statistics>span').evaluate(n=>{const r=document.createRange();r.selectNodeContents(n.firstChild);return {first:r.getBoundingClientRect().top,last:n.querySelector('[data-statistics-rate]').getBoundingClientRect().top};});
await page.evaluate(()=>{window.testPrefs.mirrored=true;window.fire('clawd:state',window.testPrefs);});
const mirrorButton=await page.locator('[data-settings]').boundingBox();assert(mirrorButton.x<normalButton.x);
const mirrorText=await page.locator('.statistics>span').evaluate(n=>{const r=document.createRange();r.selectNodeContents(n.firstChild);const a=r.getBoundingClientRect(),b=n.querySelector('[data-statistics-rate]').getBoundingClientRect();return {firstX:a.x,lastX:b.x,firstY:a.top,lastY:b.top};});
assert(mirrorText.firstX<mirrorText.lastX,'statistics read left to right');
assert(normalSlope.first<normalSlope.last,'normal statistics follow the keyboard slope');
assert(mirrorText.firstY>mirrorText.lastY,'mirrored statistics follow the opposite keyboard slope');
if(process.env.CLAWD_PREVIEW_FONT){await page.addStyleTag({content:`@font-face{font-family:PreviewCJK;src:url("${pathToFileURL(process.env.CLAWD_PREVIEW_FONT).href}")} .statistics,.bubble{font-family:PreviewCJK,sans-serif}`});await page.evaluate(()=>document.fonts.ready);}
if(process.env.CLAWD_MIRROR_SCREENSHOT)await page.locator('#clawd-desktop').screenshot({path:process.env.CLAWD_MIRROR_SCREENSHOT});

// Settings card: tabs, size chips, sleep presets, custom clamp, footer.
await page.setViewportSize({width:340,height:372});
await page.goto(pathToFileURL(path.join(projectRoot,'web/settings.html')).href);await page.waitForTimeout(100);
assert.deepEqual(await page.locator('[data-tab]').allInnerTexts(),['外观','休息','统计']);
await page.locator('#scale').fill('117');await page.locator('#scale').dispatchEvent('input');assert.equal(await page.locator('#scale-output').innerText(),'117%');
await page.locator('[data-scale="125"]').click();assert.equal(await page.evaluate(()=>window.testPrefs.scale),1.25);assert.equal(await page.locator('#scale-output').innerText(),'125%');
await page.locator('label:has(#sideButtons)').click();assert.equal(await page.evaluate(()=>window.testPrefs.sideButtons),false);
await page.locator('label:has(#bubbleLines)').click();assert.equal(await page.evaluate(()=>window.testPrefs.bubbleLines),false);
await page.locator('[data-tab="rest"]').click();assert.equal(await page.locator('#panel-rest').isVisible(),true);assert.equal(await page.locator('#panel-appearance').isVisible(),false);
assert.deepEqual(await page.locator('[data-sleep]').allInnerTexts(),['1分钟','90秒','5分钟','15分钟','从不','自定义']);
assert.equal(await page.locator('[data-sleep="90"]').getAttribute('aria-checked'),'true');
await page.locator('[data-sleep="300"]').click();assert.equal(await page.evaluate(()=>window.testPrefs.sleepSeconds),300);
await page.locator('[data-sleep="never"]').click();assert.equal(await page.evaluate(()=>window.testPrefs.sleepEnabled),false);
await page.locator('[data-sleep="custom"]').click();assert.equal(await page.evaluate(()=>window.testPrefs.sleepEnabled),true);assert.equal(await page.locator('#sleepSeconds').isVisible(),true);
await page.locator('#sleepSeconds').fill('5');await page.locator('#sleepSeconds').press('Enter');assert.equal(await page.evaluate(()=>window.testPrefs.sleepSeconds),30);assert.equal(await page.locator('#sleepSeconds').inputValue(),'30');
await page.locator('#sleepSeconds').fill('99999');await page.locator('#sleepSeconds').press('Enter');assert.equal(await page.evaluate(()=>window.testPrefs.sleepSeconds),3600);
await page.locator('#sleepSeconds').fill('240');await page.locator('#sleepSeconds').press('Enter');assert.equal(await page.evaluate(()=>window.testPrefs.sleepSeconds),240);
await page.locator('label:has(#breathingEnabled)').click();assert.equal(await page.evaluate(()=>window.testPrefs.breathingEnabled),false);
await page.locator('[data-tab="stats"]').click();await page.locator('label:has(#statisticsEnabled)').click();assert.equal(await page.evaluate(()=>window.testPrefs.statisticsEnabled),true);
assert.equal(await page.locator('#panel-stats .note').innerText(),'只记录次数，不读取输入内容');
await page.locator('label:has(#showOnStartup)').click();assert.equal(await page.evaluate(()=>window.testPrefs.showOnStartup),false);
await page.locator('[data-tab="system"]').click();
await page.locator('label:has(#autostartEnabled)').click();assert.equal(await page.evaluate(()=>window.testPrefs.autostartEnabled),true);
await page.locator('#check-updates').click();await page.locator('#uninstall').click();
assert((await calls()).includes('clawd_check_updates'));assert((await calls()).includes('clawd_uninstall'));
if(process.env.CLAWD_SYSTEM_SCREENSHOT)await page.screenshot({path:process.env.CLAWD_SYSTEM_SCREENSHOT});

await page.locator('[data-help]').click();assert.equal(await page.locator('#help').isVisible(),true);
await page.locator('[data-about]').click();assert.equal(await page.locator('#help').isVisible(),false);assert.equal(await page.locator('#about').isVisible(),true);
await page.locator('#usage').click();await page.locator('#retry-input').click({force:true});
assert((await calls()).includes('clawd_usage'));
const settingsFit=await page.locator('.card').boundingBox();assert(settingsFit.height<=372&&settingsFit.width<=340);
assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:'Chromium mock (not Windows WebView2)',checks:['no top/bottom bars','three side blocks + fixed-back inward press','settings block','native drag on pet body','right-click menu','two-hand key lights','reset clears keys','speech bubble only for lines, top z-index, auto-hide','bubble edge shift','台词 toggle','side buttons toggle + narrow window','pause card centred, drag vs click','narrow pause card centred','fitting widths at 60/100/160%' ,'orange retry bubble','decorations: 5 thumbnails, preview border, 取消/戴上','fitting ignores global input','fitting layout fits native window','confirm and cancel persistence','one-line skewed statistics with 万','117% zoom','settings tabs, size chips, sleep presets, custom clamp 30–3600, help/about, usage'],pageErrors:errors}));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
