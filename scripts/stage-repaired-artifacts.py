"""Stage only the reviewed binary artifacts into the publication branch."""
from pathlib import Path
import hashlib,json,os,shutil
root=Path(__file__).resolve().parents[1]
artifacts=Path(os.environ['REPAIR_ARTIFACTS'])
plan=json.loads((root/'releases/repair-2026-10-21.json').read_text())
for r in plan:
 edition=json.loads((artifacts/r['edition']/'EDITION.json').read_text())
 assert edition['edition']==r['edition'] and edition['version']==r['version']
 assert edition['source_commit']==r['source']
 for a in r['assets']:
  destination=root/a['path']
  if a['name']=='SHA256SUMS.txt':continue
  source=artifacts/r['edition']/'dist'/a['name']
  assert hashlib.sha256(source.read_bytes()).hexdigest()==a['sha256']
  destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,destination)
  if r['edition']=='beta':
   legacy=root/'downloads'/a['name'].replace('0.3.1-beta-','0.3.1-beta.1-')
   shutil.copyfile(source,legacy)
print('Both reviewed editions staged, including legacy raw beta download aliases.')
