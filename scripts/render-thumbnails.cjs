/* Render the decoration-menu thumbnails (web/thumbs/*.png) from the real scene SVG with each accessory applied.
   Needs playwright-core and a Chromium: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node scripts/render-thumbnails.cjs
   The pet art is not redrawn; this only crops the head area of the shipped SVG. */
const {chromium}=require('playwright-core');const path=require('node:path');const fs=require('node:fs');const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'web/thumbs');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 const page=await b.newPage({viewport:{width:400,height:300},deviceScaleFactor:1});
 await page.addInitScript(()=>{const l={};window.__TAURI__={core:{invoke:async()=>({phase:'paused',enabled:true,running:false,accessory:'none',sideButtons:true})},event:{listen:async(n,f)=>{(l[n]||=[]).push(f);return()=>{};}},window:{getCurrentWindow:()=>({startDragging:async()=>{}})}};});
 await page.goto(pathToFileURL(path.join(root,'web/index.html')).href);await page.waitForFunction(()=>window.clawdDesktopController);
 await page.addStyleTag({content:'body>*{visibility:hidden}#clawd-scene{visibility:visible;position:fixed;left:0;top:0;width:128px!important;height:88px!important;filter:none!important}html,body{background:transparent!important}'});
 for(const id of ['none','headphones','cat-headphones','sprout','duck','cowboy-hat','detective-hat']){
  await page.evaluate(id=>{const c=window.clawdDesktopController;c.setPaused(true);c.restoreAccessory(id);
   const s=document.getElementById('clawd-scene');s.setAttribute('viewBox','50 -9 146 100.4');s.setAttribute('preserveAspectRatio','xMidYMid meet');
   ['body-motion','hands-motion'].forEach(i=>document.getElementById(i)?.removeAttribute('transform'));},id);
  await page.waitForTimeout(120);
  await page.screenshot({path:path.join(out,id+'.png'),clip:{x:0,y:0,width:128,height:88},omitBackground:true});
 }
 await b.close();console.log('Rendered 7 thumbnails into web/thumbs');
})().catch(e=>{console.error(e);process.exit(1)});
