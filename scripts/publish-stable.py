"""Publish the verified stable build, migrate both feeds, and withdraw the preview."""
from pathlib import Path
import base64, hashlib, json, os, subprocess, tempfile, zipfile

root = Path(__file__).resolve().parents[1]
repo = os.environ['GITHUB_REPOSITORY']
commit = os.environ['GITHUB_SHA']
version = json.loads((root/'src-tauri/tauri.conf.json').read_text())['version']
assert repo == 'miyomochi/bongo-clawd' and version == '0.4.0'
assert os.environ['GITHUB_REF_NAME'] == 'release/stable-0.4.0'
tag = 'v'+version

def gh(*args, payload=None):
    if payload is None:
        return subprocess.check_output(['gh', *args], text=True)
    with tempfile.NamedTemporaryFile('w', suffix='.json', encoding='utf-8', delete=False) as f:
        json.dump(payload, f, ensure_ascii=False); name = f.name
    try:
        return subprocess.check_output(['gh', *args, '--input', name], text=True)
    finally:
        Path(name).unlink()

def api(path, payload=None, method=None):
    args = ['api', 'repos/'+repo+'/'+path]
    if method:
        args += ['--method', method]
    return json.loads(gh(*args, payload=payload))

assert api('git/ref/heads/release/stable-0.4.0')['object']['sha'] == commit
old_head = api('git/ref/heads/main')['object']['sha']
old_tree = api('git/commits/'+old_head)['tree']['sha']
for channel, expected in [('latest','0.3.0'),('beta','0.4.0-beta')]:
    data = api(f'contents/updates/{channel}.json?ref={old_head}')
    assert json.loads(base64.b64decode(data['content']))['version'] == expected
names = [f'Bongo-Clawd-{version}-Windows-x64.zip', f'Bongo-Clawd-{version}-Windows-x64-Setup.zip']
paths = [root/'dist'/n for n in names]
checksums = root/'dist/SHA256SUMS.txt'
for p in paths:
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None
    assert hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name in checksums.read_text()
assert subprocess.run(['gh','release','view',tag,'--repo',repo],capture_output=True).returncode != 0
gh('release','create',tag,'--repo',repo,'--target',commit,'--draft','--latest=false',
   '--title',version,'--notes-file',str(root/'releases/v0.4.0.md'),*map(str,paths),str(checksums))
with tempfile.TemporaryDirectory() as folder:
    gh('release','download',tag,'--repo',repo,'--dir',folder)
    for p in paths:
        assert hashlib.sha256((Path(folder)/p.name).read_bytes()).digest() == hashlib.sha256(p.read_bytes()).digest()
gh('release','edit',tag,'--repo',repo,'--draft=false','--prerelease=false','--latest')
manifest = {
    'version':version,
    'download_url':f'https://github.com/{repo}/releases/download/{tag}/{names[1]}',
    'sha256':hashlib.sha256(paths[1].read_bytes()).hexdigest(),
    'notes':(root/'releases/v0.4.0.md').read_text(encoding='utf-8').strip(),
}
text = json.dumps(manifest,ensure_ascii=False,indent=2)+'\n'
tree = api('git/trees',payload={'base_tree':old_tree,'tree':[
    {'path':f'updates/{channel}.json','mode':'100644','type':'blob','content':text}
    for channel in ['latest','beta']]},method='POST')
change = api('git/commits',payload={
    'message':'release: publish 0.4.0 stable update feeds [skip ci]',
    'tree':tree['sha'],'parents':[old_head]},method='POST')
api('git/refs/heads/main',payload={'sha':change['sha'],'force':False},method='PATCH')
# The old experimental release remains unchanged apart from this user-verified note.
old = api('releases/tags/v0.3.1-beta')
note = '自动检查更新功能已通过作者实机验证。'
body = old.get('body') or ''
if note not in body:
    api('releases/'+str(old['id']),payload={'body':body.rstrip()+'\n\n'+note},method='PATCH')
# Withdraw the public preview only after a stable installer and both feeds are ready.
preview = api('releases/tags/v0.4.0-beta')
api('releases/'+str(preview['id']),payload={'draft':True},method='PATCH')
for channel in ['latest','beta']:
    data = api(f'contents/updates/{channel}.json?ref=main')
    assert json.loads(base64.b64decode(data['content'])) == manifest
print(f'Published https://github.com/{repo}/releases/tag/{tag}; both update feeds advanced; beta preview withdrawn.')
