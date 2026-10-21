"""Check the requested release channel and emit package provenance; no broad test suite."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess
p=argparse.ArgumentParser();p.add_argument('edition',choices=['stable','beta']);a=p.parse_args()
root=Path(__file__).resolve().parents[1];read=lambda n:(root/n).read_text(encoding='utf-8')
version={'stable':'0.3.0','beta':'0.3.1-beta'}[a.edition]
assert json.loads(read('src-tauri/tauri.conf.json'))['version']==version
assert re.search(r'^version = "'+re.escape(version)+'"$',read('src-tauri/Cargo.toml'),re.M)
assert 'name = "bongo-clawd-lite"\nversion = "'+version+'"' in read('src-tauri/Cargo.lock')
assert ('mod update_service;' in read('src-tauri/src/main.rs'))==(a.edition=='beta')
assert ('autoCheckUpdates' in read('web/settings.html'))==(a.edition=='beta')
assert ('clawd-update-visuals.js' in read('web/index.html'))==(a.edition=='beta')
assert (root/'src-tauri/src/update_service.rs').exists()==(a.edition=='beta')
if a.edition=='beta':
 assert 'auto_check_updates: false' in read('src-tauri/src/preferences.rs')
 assert '/updates/beta.json' in read('src-tauri/src/system.rs')
 assert "runtime.update?.phase" in read('web/desktop-renderer.js')
else:
 assert '/updates/latest.json' in read('src-tauri/src/system.rs')
assert 'pointer-events:none' not in next(s for s in read('web/desktop.css').splitlines() if s.startswith('.scene svg{'))
assert 'if(active)return false;' in read('web/core/clawd-reactions.js')
assert 'ctx.isClickReacting?.()?false:api[name](...args)' in read('web/core/clawd-reactions.js')
assert 'if(controller.getReaction()){forgetInput();return;}' in read('web/desktop-renderer.js')
assert 'nativeDragging=true;controller.cancelReaction()' not in read('web/desktop-renderer.js')
assert 'icon-background' in read('src-tauri/icons/icon.svg')
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
shared=['web/desktop.css','web/core/clawd-reactions.js','src-tauri/icons/icon.svg','src-tauri/icons/icon.png','src-tauri/icons/icon.ico']
base={'stable':'2ab3032aed2ab42aa8b7617bbfb88b9db55bab07','beta':'e17be70268b668295d829bc8561bef6f60a7ed28'}[a.edition]
for n in ['src-tauri/src/input.rs','src-tauri/src/statistics.rs']:
 assert (root/n).read_bytes()==subprocess.check_output(['git','show',base+':'+n],cwd=root), 'Native statistics/input changed'
report={'edition':a.edition,'version':version,'source_commit':source,'automatic_updates_experimental':a.edition=='beta','native_statistics_unchanged':True,'shared_asset_sha256':{n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in shared}}
(root/'EDITION.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
