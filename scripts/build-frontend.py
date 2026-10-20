"""Rebuild the desktop bundle and inline the reviewed scene/rig into its shell."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
order=['renderer','behavior','sleep','wake','input','demo','cool','happy','eggs','headphones','controller']
(root/'web/core/clawd.bundle.js').write_text('\n\n'.join((root/f'web/core/clawd-{name}.js').read_text(encoding='utf-8') for name in order),encoding='utf-8',newline='\n')
p=root/'web/index.html';s=p.read_text(encoding='utf-8')
s=re.sub(r'<svg\b.*?</svg>',lambda _: (root/'web/clawd-scene.svg').read_text(encoding='utf-8'),s,count=1,flags=re.S)
s=re.sub(r'(<script type="application/json" id="clawd-rig-data">).*?(</script>)',lambda m:m[1]+(root/'web/rig-data.json').read_text(encoding='utf-8')+m[2],s,flags=re.S)
p.write_text(s,encoding='utf-8',newline='\n')
print('Built desktop frontend.')
