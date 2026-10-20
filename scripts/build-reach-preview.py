"""Build the isolated, offline hand-motion preview; leave desktop assets alone."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
out=root/'dist/previews/Clawd-Arm-Reach-Lab.html'
svg=(root/'web/clawd-scene.svg').read_text(encoding='utf-8')
rig=(root/'web/rig-data.json').read_text(encoding='utf-8')
engine=(root/'web/core/clawd.bundle.js').read_text(encoding='utf-8')
reach=(root/'web/core/clawd-reach.js').read_text(encoding='utf-8')
css='''*{box-sizing:border-box}html{color-scheme:light}body{margin:0;background:#f5f2eb;color:#514638;font:15px/1.6 system-ui,"Microsoft YaHei",sans-serif;padding:24px 14px}main{max-width:760px;margin:auto;background:#faf7f0;border:1px solid #ded5c5;border-radius:18px;overflow:hidden}header{padding:20px 24px 0}h1{font-size:20px;margin:0 0 6px}p{margin:0;color:#8a7a66;font-size:13px}.scene{padding:0 12px}.scene svg{display:block;width:100%;max-height:450px}.controls{padding:0 24px 24px}.modes{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px}button{border:1px solid #d8cfc1;background:#f0e9dc;border-radius:8px;padding:8px 16px;color:inherit;font:inherit;cursor:pointer}button[aria-pressed="true"]{background:#d97757;color:#fff;border-color:#d97757}textarea{display:block;width:100%;min-height:100px;resize:vertical;border:1px solid #d8cfc1;border-radius:10px;padding:12px 14px;background:#fffdf8;color:#514638;font:16px/1.6 system-ui}textarea:focus{outline:2px solid #ddb8a3;outline-offset:2px}.key.is-down .key-top{fill:#f2bf72}.key.is-down .key-legend{fill:#3c3126}[data-last-key]{font:13px ui-monospace,monospace;color:#b46c50}[data-status]{font-size:12px;color:#8a7a66;margin-left:auto}.hint{margin:10px 0;color:#8a7a66;font-size:12px}@media(max-width:480px){body{padding:10px}header{padding:16px 16px 0}.controls{padding:0 16px 18px}.scene{padding:0}}'''
init='''(function(){
 const root=document.getElementById('hand-preview'),textarea=root.querySelector('textarea');
 const c=window.createClawdController(root,JSON.parse(document.getElementById('clawd-rig-data').textContent),{bindInput:false,bindDemo:false,reachEnabled:true,accessoryStorage:false,sleepEnabled:false,sunglassesEnabled:false,happyEnabled:false,breathingEnabled:false});
 window.clawdLabController=c;
 function setMode(on){c.clearAll();c.setReachEnabled(on);root.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.mode==='on')===on)));textarea.focus({preventScroll:true});}
 root.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode==='on')));
 const down=e=>{
   if(!document.hasFocus?.()&&document.hasFocus)return;
   c.press(e.code,{repeat:e.repeat});
   // Keep typing/editing and browser shortcuts intact. When the page itself
   // has focus, avoid scrolling or activating the mode button with Space.
   if(e.target!==textarea&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 };
 const up=e=>c.release(e.code);
 window.addEventListener('keydown',down);window.addEventListener('keyup',up);
 const reset=()=>c.clearAll();window.addEventListener('blur',reset);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 window.addEventListener('pagehide',()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',reset);c.destroy();},{once:true});
 textarea.focus({preventScroll:true});
})();'''
page='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Clawd · 小幅伸手预览</title><style>'''+css+'''</style></head><body><main id="hand-preview"><header><h1>小短手 · 分区伸手预览</h1><p>不追逐每个键，只用几种远近和内外的小动作。右手已限制伸长幅度。</p></header><div class="scene" data-mouse-zone>'''+svg+'''</div><div class="controls"><div class="modes"><button type="button" data-mode="on" aria-pressed="true">分区伸手</button><button type="button" data-mode="off" aria-pressed="false">原版</button><span data-status></span></div><label for="typing">直接用键盘敲，也可以在这里输入：</label><p class="hint">左手试 Q / Z / T / B；右手试 P / J / Enter / 方向键。切换后可继续打字。</p><textarea id="typing" spellcheck="false" placeholder="啪嗒啪嗒……两只小短手准备好了。"></textarea><div class="hint" data-last-key>等待按键</div></div></main><script type="application/json" id="clawd-rig-data">'''+rig+'''</script><script>'''+engine+'''</script><script>'''+reach+'''</script><script>'''+init+'''</script></body></html>'''
out.parent.mkdir(exist_ok=True,parents=True);out.write_text(page,encoding='utf-8',newline='\n')
print(out)
