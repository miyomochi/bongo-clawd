"""Build the flat app/tray PNG and Windows ICO from its editable pixel SVG.

Standard library only. Nearest-neighbour scaling preserves the pixel grid.
This intentionally supports the rect-only icon, not arbitrary scene SVGs.
"""
from pathlib import Path
import struct
import xml.etree.ElementTree as E
import zlib

icons=Path(__file__).resolve().parents[1]/'src-tauri/icons'
svg=E.parse(icons/'icon.svg').getroot()
pixels=bytearray(64*64*4)
def draw(node,fill=None):
    fill=node.get('fill',fill)
    if node.tag.rsplit('}',1)[-1]=='rect':
        assert fill and len(fill)==7
        rgba=bytes.fromhex(fill[1:])+b'\xff'
        x,y,w,h=(int(node.get(k)) for k in ('x','y','width','height'))
        assert 0<=x<x+w<=64 and 0<=y<y+h<=64
        for row in range(y,y+h):
            pixels[(row*64+x)*4:(row*64+x+w)*4]=rgba*w
    for child in node:draw(child,fill)
draw(svg)
def png(size):
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
    rows=[]
    for y in range(size):
        row=bytearray(b'\0')
        for x in range(size):
            offset=((y*64//size)*64+x*64//size)*4
            row.extend(pixels[offset:offset+4])
        rows.append(row)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
(icons/'icon.png').write_bytes(png(64))
sizes=[16,24,32,48,64,128,256]
images=[png(size) for size in sizes]
offset=6+16*len(sizes);entries=[]
for size,data in zip(sizes,images):
    entries.append(struct.pack('<BBBBHHII',size%256,size%256,0,0,1,32,len(data),offset))
    offset+=len(data)
(icons/'icon.ico').write_bytes(struct.pack('<HHH',0,1,len(sizes))+b''.join(entries)+b''.join(images))
print('Built 64px app/tray icon and seven Windows icon sizes (four legs).')
