"""Publish this built beta, then advance only the beta update manifest."""
from pathlib import Path
import base64, hashlib, json, os, subprocess, tempfile, zipfile

root = Path(__file__).resolve().parents[1]
repo = os.environ['GITHUB_REPOSITORY']
commit = os.environ['GITHUB_SHA']
version = json.loads((root/'src-tauri/tauri.conf.json').read_text())['version']
assert repo == 'miyomochi/bongo-clawd'
assert version == '0.4.0-beta'
assert os.environ['GITHUB_REF_NAME'] == 'release/beta-0.4.0'
tag = 'v'+version

def gh(*args, payload=None):
    args = ['gh', *args]
    if payload is None:
        return subprocess.check_output(args, text=True)
    with tempfile.NamedTemporaryFile('w', suffix='.json', encoding='utf-8', delete=False) as f:
        json.dump(payload, f, ensure_ascii=False)
        name = f.name
    try:
        return subprocess.check_output([*args, '--input', name], text=True)
    finally:
        Path(name).unlink()

def api(path):
    return json.loads(gh('api', 'repos/'+repo+'/'+path))

stable = api('contents/updates/latest.json?ref=main')['sha']
before = api('contents/updates/beta.json?ref=main')
old = json.loads(base64.b64decode(before['content']))
assert old['version'] == '0.3.1-beta', 'Beta feed changed; review before advancing it'
names = [f'Bongo-Clawd-{version}-Windows-x64.zip', f'Bongo-Clawd-{version}-Windows-x64-Setup.zip']
paths = [root/'dist'/n for n in names]
for p in paths:
    assert p.is_file()
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None
checksums = root/'dist/SHA256SUMS.txt'
for p in paths:
    assert hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name in checksums.read_text()
existing = subprocess.run(['gh','release','view',tag,'--repo',repo], capture_output=True)
assert existing.returncode != 0, 'Release already exists; inspect it before retrying publication'
gh('release','create',tag,'--repo',repo,'--target',commit,'--draft','--prerelease','--latest=false',
   '--title','0.4.0-beta · 新服饰与待机彩蛋', '--notes-file',str(root/'releases/v0.4.0-beta.md'),
   *map(str, paths), str(checksums))
with tempfile.TemporaryDirectory() as folder:
    gh('release','download',tag,'--repo',repo,'--dir',folder)
    for p in paths:
        assert hashlib.sha256((Path(folder)/p.name).read_bytes()).digest() == hashlib.sha256(p.read_bytes()).digest()
gh('release','edit',tag,'--repo',repo,'--draft=false','--prerelease','--latest=false')
manifest = {
    'version': version,
    'download_url': f'https://github.com/{repo}/releases/download/{tag}/{names[1]}',
    'sha256': hashlib.sha256(paths[1].read_bytes()).hexdigest(),
    'notes': '新增衣柜翻页、牛仔帽玫瑰玩具枪、侦探帽放大镜、待机摸鱼、吹泡泡和魔法变身彩蛋；补齐普通键鼠及快速敲击衔接。继承上一Beta的自动检查更新、下载校验和安装向导升级机制。仍为试验版，等待Windows实机更新及新功能验收。',
}
gh('api', 'repos/'+repo+'/contents/updates/beta.json', '--method','PUT', payload={
    'message': 'release: advance beta update feed to 0.4.0-beta [skip ci]',
    'sha': before['sha'], 'branch':'main',
    'content': base64.b64encode((json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()).decode(),
})
assert api('contents/updates/latest.json?ref=main')['sha'] == stable
print(f'Published https://github.com/{repo}/releases/tag/{tag}; beta feed updated; stable feed unchanged.')
