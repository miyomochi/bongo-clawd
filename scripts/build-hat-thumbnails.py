"""Use the original wardrobe head crop for the two new hats."""
from pathlib import Path
import subprocess, tempfile, xml.etree.ElementTree as E
root = Path(__file__).resolve().parents[1]
E.register_namespace('', 'http://www.w3.org/2000/svg')
for name in ['cowboy-hat', 'detective-hat']:
    scene = E.parse(root/'web/clawd-scene.svg')
    svg = scene.getroot()
    svg.set('viewBox', '50 -9 146 100.4')
    svg.set('width', '128'); svg.set('height', '88')
    for n in svg.iter():
        if n.tag.endswith('}g') and n.get('id', '').endswith(('-front','-rear')):
            n.set('display', 'inline' if n.get('id') == name+'-front' else 'none')
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp)/'thumb.svg'; scene.write(path, encoding='utf-8')
        subprocess.run(['inkscape', str(path), '--export-type=png',
                        '--export-filename='+str(root/'web/thumbs'/f'{name}.png')], check=True)
