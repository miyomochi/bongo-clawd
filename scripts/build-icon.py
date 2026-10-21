"""Build framed app/tray PNG and ICO; stdlib only, crisp body and smooth frame."""
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as E
import zlib
icons=Path(__file__).resolve().parents[1]/'src-tauri/icons'
rects=[]
def collect(node,fill=None,tx=0,ty=0,scale=1):
    fill=node.get('fill',fill)
    if node.get('transform'):
        m=re.fullmatch(r'translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)',node.get('transform'))
        assert m,'Unsupported icon transform'
        a,b,c=map(float,m.groups());tx,ty,scale=tx+a*scale,ty+b*scale,scale*c
    if node.tag.rsplit('}',1)[-1]=='rect':
        assert fill and re.fullmatch(r'#[0-9a-fA-F]{6}',fill)
        x,y,w,h=(float(node.get(k)) for k in ('x','y','width','height'))
        rects.append((tx+x*scale,ty+y*scale,w*scale,h*scale,float(node.get('rx',0))*scale,bytes.fromhex(fill[1:]),int(node.get('data-min-size',0))))
    for child in node:collect(child,fill,tx,ty,scale)
collect(E.parse(icons/'icon.svg').getroot())
def rgba(size):
    pixels=bytearray(size*size*4)
    for x,y,w,h,r,color,minimum in rects:
        if size<minimum:continue
        x,y,w,h,r=(v*size/64 for v in (x,y,w,h,r))
        for py in range(size):
            for px in range(size):
                if r:
                    hits=0
                    for sy in range(4):
                        for sx in range(4):
                            u,v=px+(sx+.5)/4,py+(sy+.5)/4
                            if not (x<=u<x+w and y<=v<y+h):continue
                            dx,dy=max(x+r-u,0,u-(x+w-r)),max(y+r-v,0,v-(y+h-r))
                            hits+=dx*dx+dy*dy<=r*r
                    a=hits/16
                else:a=int(round(x)<=px<round(x+w) and round(y)<=py<round(y+h))
                if not a:continue
                i=(py*size+px)*4;old=pixels[i+3]/255;out=a+old*(1-a)
                for c in range(3):pixels[i+c]=round((color[c]*a+pixels[i+c]*old*(1-a))/out)
                pixels[i+3]=round(out*255)
    return pixels
def png(size):
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
    p=rgba(size);rows=b''.join(b'\0'+p[y*size*4:(y+1)*size*4] for y in range(size))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b'')
(icons/'icon.png').write_bytes(png(64))
sizes=[16,24,32,48,64,128,256];images=[png(size) for size in sizes]
offset=6+16*len(sizes);entries=[]
for size,data in zip(sizes,images):
    entries.append(struct.pack('<BBBBHHII',size%256,size%256,0,0,1,32,len(data),offset));offset+=len(data)
(icons/'icon.ico').write_bytes(struct.pack('<HHH',0,1,len(sizes))+b''.join(entries)+b''.join(images))
print('Built framed app icon: 7 sizes, simplified border at 16/24px.')
