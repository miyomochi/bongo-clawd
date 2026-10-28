"""Build a dark, short-brim detective hat on Clawd's integer pixel grid."""
from pathlib import Path
from lxml import etree as E
ROOT=Path(__file__).resolve().parents[1]
NS='http://www.w3.org/2000/svg'
def node(tag,**attrs):
    return E.Element('{'+NS+'}'+tag,{k.replace('_','-'):str(v) for k,v in attrs.items()})
def poly(parent,points,color):
    points=[(round(123+1.08*x),round(37+1.08*(y+.19*x))) for x,y in points]
    out=[]
    for a,b in zip(points,points[1:]+points[:1]):
        out.append(a);n=max(abs(b[0]-a[0]),abs(b[1]-a[1]));old=a
        for k in range(1,n+1):
            p=(round(a[0]+(b[0]-a[0])*k/n),round(a[1]+(b[1]-a[1])*k/n))
            if p[0]!=old[0] and p[1]!=old[1]:out.append((p[0],old[1]))
            out.append(p);old=p
    parent.append(node('path',d='M'+'L'.join(f'{x} {y}' for x,y in out)+'Z',fill=color))
hat=node('g',id='detective-hat-front',display='none',shape_rendering='crispEdges',pointer_events='none',data_anchor='body-top')
brim=[(-51,0),(-46,-2),(-34,-6),(-18,-9),(3,-10),(24,-9),(40,-7),(49,-2),(51,1),(49,4),(34,8),(13,11),(-10,11),(-29,8),(-44,4),(-51,3)]
poly(hat,[(x,y+2) for x,y in brim],'#272a2b')
poly(hat,brim,'#434747')
poly(hat,[(-48,0),(-35,3),(-17,7),(6,8),(29,5),(43,1),(48,-1),(45,3),(32,7),(11,10),(-10,10),(-30,7),(-44,3)],'#535755')
poly(hat,[(-34,1),(-33,-13),(-30,-22),(-24,-28),(-17,-28),(-6,-24),(1,-23),(10,-28),(19,-28),(26,-24),(30,-16),(33,0),(25,4),(9,6),(-14,5),(-27,3)],'#3c4040')
poly(hat,[(-30,-22),(-24,-28),(-17,-28),(-6,-24),(1,-23),(10,-28),(19,-28),(26,-24),(24,-21),(17,-23),(9,-23),(1,-19),(-7,-20),(-18,-24),(-25,-24)],'#555a57')
poly(hat,[(-17,-26),(-6,-22),(1,-21),(10,-26),(19,-26),(23,-23),(13,-23),(4,-19),(-1,-18),(-9,-21)],'#292e2e')
poly(hat,[(26,-22),(30,-16),(33,0),(25,4),(19,5),(24,-2),(24,-13)],'#2e3334')
poly(hat,[(-34,-5),(-26,-2),(-13,1),(9,2),(25,0),(32,-4),(33,0),(25,4),(9,6),(-14,5),(-27,3),(-34,1)],'#76533f')
poly(hat,[(-33,-5),(-25,-3),(-12,0),(9,1),(25,-1),(31,-4),(32,-3),(26,1),(9,3),(-13,2),(-26,-1),(-33,-3)],'#9b7351')
p=ROOT/'web/clawd-scene.svg';tree=E.parse(str(p));body=tree.xpath('//*[@id="body-motion"]')[0]
for old in tree.xpath('//*[@id="detective-hat-front"]'):old.getparent().remove(old)
body.append(hat)
p.write_bytes(E.tostring(tree.getroot(),encoding='utf-8'))
for n in body:
    if E.QName(n).localname=='g' and n.get('id','').endswith(('-front','-rear')):n.set('display','inline' if n is hat else 'none')
tree.write('/tmp/clawd-detective-thumb.svg',encoding='utf-8')
print('Built detective hat; thumbnail scene ready.')
