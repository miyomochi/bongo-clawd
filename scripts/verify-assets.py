"""Verify the explicitly reviewed candidate baseline; old hashes remain archived."""
from pathlib import Path
import hashlib,json,xml.etree.ElementTree as E
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'candidate-assets-manifest.json').read_text())
for name,expected in manifest.items():
    actual=hashlib.sha256((root/'web'/name).read_bytes()).hexdigest()
    if actual!=expected:raise SystemExit('Candidate asset changed: '+name)
icons=json.loads((root/'icon-assets-manifest.json').read_text())
for name,expected in icons.items():
    actual=hashlib.sha256((root/'src-tauri/icons'/name).read_bytes()).hexdigest()
    if actual!=expected:raise SystemExit('App/tray icon changed: '+name)
original=E.parse(root/'web/core/clawd-base.svg').getroot()
current=E.parse(root/'web/clawd-scene.svg').getroot()
byid={n.get('id'):n for n in current.iter() if n.get('id')}
for node in original.iter():
    ident=node.get('id')
    if ident and node.tag.rsplit('}',1)[-1] in ('path','rect','circle','ellipse','polygon'):
        assert node.attrib==byid[ident].attrib,ident
assert (root/'Clawd-lab.html').read_bytes()==(root/'src-tauri/assets/Clawd-lab.html').read_bytes()
print(str(len(manifest))+' reviewed frontend assets + '+str(len(icons))+' app/tray icon assets match; original identified geometry and embedded lab verified.')
