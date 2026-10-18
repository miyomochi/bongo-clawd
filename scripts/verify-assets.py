"""Confirm the unchanged animation baseline; no third-party dependencies."""
from pathlib import Path
import hashlib
import json
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'baseline-animation-manifest.json').read_text())
for name, expected in manifest.items():
    actual = hashlib.sha256((root / 'web' / name).read_bytes()).hexdigest()
    if actual != expected:
        raise SystemExit(f'Animation changed: {name}')
print(f'{len(manifest)} baseline art/animation assets match byte for byte')
