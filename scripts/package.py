"""Package an already-built Windows EXE and source; standard library only."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import struct
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--exe', type=Path, default=root/'src-tauri/target/x86_64-pc-windows-msvc/release/bongo-clawd-lite.exe')
args = parser.parse_args()
exe = args.exe.read_bytes()
pe = struct.unpack_from('<I', exe, 0x3c)[0]
assert exe[:2] == b'MZ' and exe[pe:pe+4] == b'PE\0\0'
assert struct.unpack_from('<H', exe, pe+4)[0] == 0x8664
out = root/'dist'
version = '0.2.1'
package = out/f'Bongo-Clawd-{version}-Windows-x64'
package.mkdir(parents=True, exist_ok=True)
(package/'Bongo-Clawd.exe').write_bytes(exe)
for name in ['README-FIRST.txt', 'COMPARISON.md', 'VALIDATION.md', 'THIRD-PARTY-NOTICES.md', 'LICENSE-CODE.txt', 'VALIDATION-RESULTS.json']:
    shutil.copyfile(root/name, package/name)
shutil.copytree(root/'rust-licenses', package/'rust-licenses', dirs_exist_ok=True)
metadata = {
    'version': '0.2.1', 'exe_bytes': len(exe),
    'exe_sha256': hashlib.sha256(exe).hexdigest(),
    'runtime_bundled': False, 'runtime': 'System Microsoft Edge WebView2',
    'windows_runtime_tested': json.loads((root/'VALIDATION-RESULTS.json').read_text()).get('checks', {}).get('windows_runtime') == 'user_reported_passed',
    'checks': json.loads((root/'VALIDATION-RESULTS.json').read_text()).get('checks', {}),
    'size_note': 'Portable file bytes exclude system WebView2 and user configuration/cache. Sum of file sizes, not filesystem allocation.',
}
# Store a stable sum including this metadata file and the checksum list.
files = sorted(p for p in package.rglob('*') if p.is_file() and p.name not in ('SHA256SUMS.txt', 'package-metrics.json'))
base_size = sum(p.stat().st_size for p in files)
checksum_size = sum(64+2+len(str(p.relative_to(package)).replace('\\','/').encode())+1 for p in files) + 64+2+len('package-metrics.json')+1
size = 0
for _ in range(10):
    metadata['portable_files_bytes'] = size
    data = (json.dumps(metadata, ensure_ascii=False, indent=2)+'\n').encode()
    actual = base_size+checksum_size+len(data)
    if actual == size:
        break
    size = actual
else:
    raise RuntimeError('size metadata did not converge')
(package/'package-metrics.json').write_bytes(data)
files.append(package/'package-metrics.json')
lines = [hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(package).as_posix() for p in sorted(files)]
(package/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n', encoding='utf-8')
assert sum(p.stat().st_size for p in package.rglob('*') if p.is_file()) == size
portable = root.parent/f'Bongo-Clawd-{version}-Windows-x64.zip'
portable_tmp = portable.with_suffix('.zip.tmp')
with zipfile.ZipFile(portable_tmp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.writestr(package.name+'/', b'')
    for p in sorted(package.rglob('*')):
        if p.is_file(): z.write(p, p.relative_to(out))
with zipfile.ZipFile(portable_tmp) as z:
    assert z.testzip() is None
portable_tmp.replace(portable)
source = root.parent/f'Bongo-Clawd-{version}-desktop-source.zip'
source_tmp = source.with_suffix('.zip.tmp')
with zipfile.ZipFile(source_tmp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in sorted(root.rglob('*')):
        rel = p.relative_to(root)
        if p.is_file() and not any(x in ('target','dist','node_modules','.git','__pycache__') for x in rel.parts) and p.suffix not in ('.zip','.pyc'):
            z.write(p, Path('bongo-clawd-next')/rel)
with zipfile.ZipFile(source_tmp) as z:
    assert z.testzip() is None
source_tmp.replace(source)
for p in [portable, source]:
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None
    print(json.dumps({'path':str(p),'bytes':p.stat().st_size,'MiB':round(p.stat().st_size/1048576,3)},ensure_ascii=False))
print(json.dumps(metadata,ensure_ascii=False))
