"""Rebuild the desktop bundle and inline the reviewed scene/rig into its shell."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
order=['renderer','behavior','sleep','wake','input','demo','cool','happy','eggs','headphones','controller']
(root/'web/core/clawd.bundle.js').write_text('\n\n'.join((root/f'web/core/clawd-{name}.js').read_text() for name in order))
p=root/'web/index.html';s=p.read_text()
s=re.sub(r'<svg\b.*?</svg>',lambda _: (root/'web/clawd-scene.svg').read_text(),s,count=1,flags=re.S)
s=re.sub(r'(<script type="application/json" id="clawd-rig-data">).*?(</script>)',lambda m:m[1]+(root/'web/rig-data.json').read_text()+m[2],s,flags=re.S)
p.write_text(s)
print('Built desktop frontend.')
