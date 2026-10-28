"""Inline the actual desktop accessory UI for an offline six-tile carousel study."""
from pathlib import Path
import re,base64
root=Path(__file__).resolve().parents[1]
s=(root/'web/index.html').read_text()
css=(root/'web/desktop.css').read_text()
# Keep the desktop menu's exact geometry; only the outer page adapts to the browser.
css+='''
html,body{height:auto;min-height:100%;overflow:auto;background:#191917}
body{padding:14px 10px 22px}#preview-frame{position:relative;margin:0 auto;width:388px;height:466px}
#clawd-desktop{position:absolute;left:0;top:0;transform-origin:top left}
#preview-controls{display:flex;align-items:center;justify-content:center;gap:18px;max-width:388px;margin:8px auto;color:var(--sub);font-size:12px}
#preview-controls label{display:flex;align-items:center;gap:5px;white-space:nowrap}
#preview-controls button{border:1px solid var(--line);border-radius:3px;background:var(--bg);padding:5px 14px;cursor:pointer}
[data-settings]{visibility:hidden}
'''
s=s.replace('<link rel="stylesheet" href="desktop.css">','<style>'+css+'</style>')
s=s.replace('<title>Bongo Clawd</title>','<title>Clawd · 衣柜翻页试验</title>')
s=s.replace('<main id="clawd-desktop"','<div id="preview-frame"><main id="clawd-desktop"')
s=s.replace('  </main>','''  </main></div>
  <div id="preview-controls"><button type="button" id="preview-open">装饰</button><label><input type="checkbox" id="preview-narrow">紧凑</label><label><input type="checkbox" id="preview-mirror">镜像</label></div>''')
bridge='''(function(){
 const listeners={state:null,input:null,accessory:null};
 const prefs={phase:'listening',enabled:true,running:true,accessory:'cat-headphones',sideButtons:true,bubbleLines:false,statisticsEnabled:false,sleepEnabled:false};
 const notify=patch=>{Object.assign(prefs,patch);listeners.state?.({...prefs});};
 window.clawdPreviewPrefs=prefs;
 window.clawdDesktop={snapshot:()=>Promise.resolve({...prefs}),state:fn=>{listeners.state=fn;return()=>listeners.state=null;},input:fn=>{listeners.input=fn;return()=>listeners.input=null;},accessories:fn=>{listeners.accessory=fn;return()=>listeners.accessory=null;},
  adjustment:async open=>{listeners.input?.({type:'reset'});notify({accessoryOpen:open,phase:open?'paused':'listening',running:!open});},
  updateSettings:async patch=>{notify(patch);return {...prefs};},statistics:async()=>({total:0,perMinute:0}),
  toggle:()=>{notify({enabled:!prefs.enabled,running:!prefs.enabled,phase:prefs.enabled?'paused':'listening'});},settings(){},drag(){},hide(){},menu(){},retry(){},
  open:()=>listeners.accessory?.(),previewPatch:notify
 };
})();'''
def inline(m):
 name=m.group(1)
 return '<script>'+ (bridge if name=='lite-bridge.js' else (root/'web'/name).read_text())+'</script>'
s=re.sub(r'<script\b[^>]*\bsrc="([^"]+)"[^>]*></script>',inline,s)
for name in ['none','headphones','cat-headphones','sprout','duck','cowboy-hat','detective-hat']:
 encoded=base64.b64encode((root/'web/thumbs'/f'{name}.png').read_bytes()).decode()
 s=s.replace('thumbs/'+name+'.png','data:image/png;base64,'+encoded)
init='''<script>(function(){
 const frame=document.getElementById('preview-frame'),pet=document.getElementById('clawd-desktop');
 function fit(){const narrow=document.getElementById('preview-narrow').checked,width=narrow?352:388,ratio=Math.min(1,(innerWidth-20)/width);frame.style.width=(width*ratio)+'px';frame.style.height=(466*ratio)+'px';pet.style.scale=String(ratio);}
 document.getElementById('preview-open').addEventListener('click',()=>window.clawdDesktop.open());
 document.getElementById('preview-narrow').addEventListener('change',e=>{window.clawdDesktop.previewPatch({sideButtons:!e.target.checked});fit();});
 document.getElementById('preview-mirror').addEventListener('change',e=>window.clawdDesktop.previewPatch({mirrored:e.target.checked}));
 addEventListener('resize',fit);fit();
 setTimeout(()=>window.clawdDesktop.open(),100);
})();</script>'''
s=s.replace('</body>',init+'</body>')
out=root/'dist/previews/Clawd-accessory-carousel-preview.html';out.write_text(s)
print(out)

# Dedicated first-look preview: replay the same fitting and its confirmation line.
cowboy=s.replace("accessory:'cat-headphones'", "accessory:'cowboy-hat'").replace('bubbleLines:false','bubbleLines:true')
cowboy=cowboy.replace('setTimeout(()=>window.clawdDesktop.open(),100);', 'setTimeout(()=>window.clawdCowboyReplay(),180);')
cowboy=cowboy.replace('<button type="button" id="preview-open">', '<button type="button" id="preview-replay">再来一次</button><button type="button" id="preview-open">')
replay="""<script>window.clawdCowboyReplay=function(){
 const c=window.clawdDesktopController;if(!c)return;
 c.clearAll();c.openAccessoryMenu();c.selectAccessory('cowboy-hat');c.closeAccessoryMenu(true);
};document.getElementById('preview-replay').addEventListener('click',window.clawdCowboyReplay);</script>"""
cowboy=cowboy.replace('</body>',replay+'</body>')
cowboy=cowboy.replace('<title>Clawd · 衣柜翻页试验</title>','<title>Clawd · 牛仔小蟹</title>')
(root/'dist/previews/Clawd-cowboy-rose-v3-preview.html').write_text(cowboy)

detective=cowboy.replace("accessory:'cowboy-hat'", "accessory:'detective-hat'").replace("c.selectAccessory('cowboy-hat')", "c.selectAccessory('detective-hat')").replace('牛仔小蟹','侦探小蟹')
(root/'dist/previews/Clawd-detective-v2-preview.html').write_text(detective)

# Idle bubble vignette uses the same controller and retains wardrobe selection.
bubbles=s.replace("accessory:'cat-headphones'", "accessory:'none'").replace('<title>Clawd · 衣柜翻页试验</title>','<title>Clawd · 吹泡泡</title>')
bubbles=bubbles.replace('setTimeout(()=>window.clawdDesktop.open(),100);','setTimeout(()=>window.clawdBubbleReplay(),180);')
bubbles=bubbles.replace('<button type="button" id="preview-open">','<button type="button" id="preview-bubbles">再吹一次</button><button type="button" id="preview-tap">敲一下</button><button type="button" id="preview-open">')
play="""<script>window.clawdBubbleReplay=async function(){
 const c=window.clawdDesktopController;if(!c)return;
 if(c.getState().accessory.menuOpen){c.closeAccessoryMenu(false);await window.clawdDesktop.adjustment(false);}
 window.clawdPreviewStopFast?.();c.clearAll();c.showBubbles();
};document.getElementById('preview-bubbles').addEventListener('click',window.clawdBubbleReplay);
document.getElementById('preview-tap').addEventListener('click',()=>window.clawdDesktopController.tap('KeyJ'));
addEventListener('keydown',e=>window.clawdDesktopController.press(e.code,{repeat:e.repeat}));
addEventListener('keyup',e=>window.clawdDesktopController.release(e.code));
let lastPointer=null;
addEventListener('pointermove',e=>{
 if(e.pointerType&&e.pointerType!=='mouse')return;
 const previous=lastPointer;lastPointer={x:e.clientX,y:e.clientY};if(!previous)return;
 const dx=e.clientX-previous.x,dy=e.clientY-previous.y;if(Math.abs(dx)+Math.abs(dy)<2)return;
 window.clawdDesktopController.moveMouse(dx/10,dy/10);
});</script>"""
bubbles=bubbles.replace('<button type="button" id="preview-tap">','<button type="button" id="preview-fast">快速敲击</button><button type="button" id="preview-tap">')
play+="""<script>(function(){
 let timer=null,count=0;
 window.clawdPreviewStopFast=()=>{clearTimeout(timer);timer=null;};
 document.getElementById('preview-fast').addEventListener('click',()=>{
  window.clawdPreviewStopFast();count=0;
  function tick(){window.clawdDesktopController.tap(count++%2?'KeyA':'KeyJ');if(count<40)timer=setTimeout(tick,80);else timer=null;}
  tick();
 });
 addEventListener('beforeunload',window.clawdPreviewStopFast);
})();</script><style>#preview-controls{flex-wrap:wrap;gap:10px}</style>"""
bubbles=bubbles.replace('</body>',play+'</body>')
(root/'dist/previews/Clawd-bubbles-v3-preview.html').write_text(bubbles)

magic=bubbles.replace('Clawd · 吹泡泡','Clawd · 星星小魔术').replace('再吹一次','再变一次').replace('clawdBubbleReplay','clawdMagicReplay').replace('c.showBubbles()','c.showMagic()')
(root/'dist/previews/Clawd-magic-v4-preview.html').write_text(magic)
