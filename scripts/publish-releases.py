"""Validate archived packages; publish only the explicitly selected catalog entries."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def api(path, payload=None, method='POST'):
    args = ['gh', 'api', path]
    if payload is None:
        return json.loads(run(*args))
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json') as f:
        json.dump(payload, f)
        f.flush()
        return json.loads(run(*args, '--method', method, '--input', f.name))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--tag', default='all', help='Exact catalog tag, or all')
    args = parser.parse_args()
    os.chdir(ROOT)
    catalog = json.loads((ROOT / 'releases/catalog.json').read_text())
    selected = [r for r in catalog if args.tag in ('all', r['tag'])]
    if not selected:
        raise ValueError('Tag is not in releases/catalog.json')
    assert len({r['tag'] for r in catalog}) == len(catalog), 'Duplicate tag'
    assert sum(r['latest'] for r in catalog) == 1, 'Select one latest stable'

    # Finish every local integrity check before creating any release.
    for r in selected:
        assert re.fullmatch(r'v\d+\.\d+\.\d+(?:-[\w.]+)?', r['tag'])
        assert re.fullmatch(r'[0-9a-f]{40}', r['target'])
        assert not (r['latest'] and r['prerelease'])
        config = json.loads(run('git', 'show', r['target'] + ':src-tauri/tauri.conf.json'))
        expected = '0.1.0-preview.1' if r['tag'] == 'v0.1.0' else r['tag'][1:]
        assert config['version'] == expected, 'Source version mismatch'
        assert (ROOT / r['notes']).read_text().strip(), 'Missing release notes'
        for a in r['assets']:
            name = a['name']
            assert Path(name).name == name and name.endswith('.zip')
            path = ROOT / 'downloads' / name
            assert hashlib.sha256(path.read_bytes()).hexdigest() == a['sha256'], name
            with zipfile.ZipFile(path) as z:
                assert z.testzip() is None, 'Broken ZIP: ' + name
            # Historical uploads must remain byte-identical to the archive in git.
            assert run('git', 'hash-object', str(path)) == run('git', 'rev-parse', 'HEAD:downloads/' + name)
        print('Validated ' + r['tag'], flush=True)
    if not args.publish:
        return

    repo = os.environ['GITHUB_REPOSITORY']
    prefix = f'repos/{repo}'
    # Paginate so a rerun never mistakes an older published release for a new one.
    releases = json.loads(run('gh', 'api', '--paginate', '--slurp', prefix + '/releases?per_page=100'))
    existing = {r['tag_name']: r for page in releases for r in page}
    with tempfile.TemporaryDirectory() as tmp:
        for r in selected:
            tag = r['tag']
            # Refuse to move any previously created tag to a different source.
            refs = json.loads(run('gh', 'api', prefix + '/git/matching-refs/tags/' + tag))
            exact = [ref for ref in refs if ref['ref'] == 'refs/tags/' + tag]
            if exact:
                obj = exact[0]['object']
                if obj['type'] == 'tag':
                    obj = api(prefix + '/git/tags/' + obj['sha'])['object']
                assert obj['type'] == 'commit' and obj['sha'] == r['target'], 'Existing tag target mismatch'
            release = existing.get(tag)
            if release is None:
                release = api(prefix + '/releases', dict(
                    tag_name=tag, target_commitish=r['target'], name=r['title'],
                    body=(ROOT / r['notes']).read_text(), draft=True,
                    prerelease=r['prerelease'], make_latest='false'))
            else:
                assert release['prerelease'] == r['prerelease'], 'Existing release channel mismatch'
            directory = Path(tmp) / tag
            directory.mkdir()
            sums = ''.join(a['sha256'] + '  ' + a['name'] + '\n' for a in r['assets'])
            checksum = directory / 'SHA256SUMS.txt'
            checksum.write_text(sums)
            files = [ROOT / 'downloads' / a['name'] for a in r['assets']] + [checksum]
            old_assets = {a['name']: a for a in release['assets']}
            expected_names = {p.name for p in files}
            assert set(old_assets) <= expected_names, 'Unexpected existing assets'
            for path in files:
                digest = 'sha256:' + hashlib.sha256(path.read_bytes()).hexdigest()
                old = old_assets.get(path.name)
                if old:
                    assert old.get('digest') == digest and old['size'] == path.stat().st_size, 'Existing asset mismatch'
                else:
                    assert release['draft'], 'Refuse to add assets to a published release'
                    run('gh', 'release', 'upload', tag, str(path), '--repo', repo)
            uploaded = api(prefix + '/releases/' + str(release['id']))
            assert {a['name'] for a in uploaded['assets']} == expected_names
            for path in files:
                remote = next(a for a in uploaded['assets'] if a['name'] == path.name)
                assert remote['digest'] == 'sha256:' + hashlib.sha256(path.read_bytes()).hexdigest()
            # Publishing comes last, after all attachments have been verified.
            payload = dict(draft=False, make_latest='true' if r['latest'] else 'false')
            result = api(prefix + '/releases/' + str(release['id']), payload, 'PATCH')
            assert not result['draft'] and result['prerelease'] == r['prerelease']
            ref = api(prefix + '/git/ref/tags/' + tag)
            assert ref['object']['sha'] == r['target'], 'Published tag source mismatch'
            print('Published ' + result['html_url'], flush=True)


if __name__ == '__main__':
    main()
