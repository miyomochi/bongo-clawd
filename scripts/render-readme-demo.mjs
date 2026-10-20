// Export the existing desktop SVG animation for the README. Requires Node, sharp and ffmpeg.
// Run: node scripts/render-readme-demo.mjs [output-frame-directory]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseHTML} from '../tests/dom-test-worker.mjs';
const sharp=createRequire(import.meta.url)('sharp');
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2]||path.join(base,'dist/readme-frames'));
fs.mkdirSync(output,{recursive:true});
const {window,document}=parseHTML(fs.readFileSync(path.join(base,'web/index.html'),'utf8'));
window.matchMedia=()=>({matches:false});
let now=0,sequence=0;
const timers=new Map();
const schedule=(fn,delay=0)=>{const id=++sequence;timers.set(id,{fn,at:now+delay});return id;};
const clear=id=>timers.delete(id);
const math=Object.create(Math);math.random=()=>0.31;
const context=vm.createContext({window,document,Math:math,performance:{now:()=>now},setTimeout:schedule,clearTimeout:clear,
  requestAnimationFrame:fn=>schedule(()=>fn(now),16),cancelAnimationFrame:clear});
vm.runInContext(fs.readFileSync(path.join(base,'web/core/clawd.bundle.js'),'utf8'),context);
const root=document.querySelector('#clawd-desktop');
const controller=window.createClawdController(root,JSON.parse(fs.readFileSync(path.join(base,'web/rig-data.json'),'utf8')),
  {bindInput:false,bindDemo:false,accessoryStorage:false,sleepEnabled:false,sunglassesEnabled:false,happyEnabled:false,breathingEnabled:false});
controller.restoreAccessory('headphones');
const codes=['KeyA','KeyJ','KeyS','KeyK','KeyD','KeyL','KeyF','Space'];
for(let t=200,i=0;t<8400;t+=400,i++)schedule(()=>controller.tap(codes[i%codes.length]),t);
schedule(()=>controller.showHappy('heart'),1800);
function advance(end){
  let count=0;
  while(true){let next;
    for(const entry of timers)if(entry[1].at<=end&&(!next||entry[1].at<next[1].at))next=entry;
    if(!next)break;
    now=next[1].at;timers.delete(next[0]);next[1].fn();
    if(++count>100000)throw new Error('Animation timer loop');
  }
  now=end;
}
const svg=document.querySelector('#clawd-scene');
svg.setAttribute('width','432');svg.setAttribute('height','326');
const style=document.createElement('style');style.textContent='.key.is-down .key-top,.is-clicked{fill:#f2bf72}';svg.prepend(style);
for(let i=0;i<180;i++){
  advance(i*50);
  await sharp(Buffer.from(svg.outerHTML)).flatten({background:'#f8f6f3'}).png()
    .toFile(path.join(output,`${String(i).padStart(4,'0')}.png`));
}
controller.destroy();
const target=path.join(base,'docs/assets/clawd-demo.gif');
fs.mkdirSync(path.dirname(target),{recursive:true});
const result=spawnSync('ffmpeg',['-v','error','-framerate','20','-i',path.join(output,'%04d.png'),
  '-filter_complex','[0:v]split[a][b];[a]palettegen=max_colors=96:reserve_transparent=1:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
  '-loop','0','-y',target],{stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)throw new Error('GIF encoding failed');
console.log(`Rendered 9-second looping animation: ${target}`);
