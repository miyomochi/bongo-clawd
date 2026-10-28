/* Cowboy fitting: a bright plastic toy pops a rose, then returns to work. */
(function(global){
 'use strict';
 const NS='http://www.w3.org/2000/svg',duration=2700;
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const between=(t,a,b)=>ease((t-a)/(b-a));
 function path(points,close=true){
  const q=points.map(([x,y])=>[Math.round(x),Math.round(y)]);let d=`M${q[0].join(' ')}`;
  for(let i=1;i<q.length+(close?1:0);i++){
   const a=q[(i-1)%q.length],b=q[i%q.length],n=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));let old=a;
   for(let k=1;k<=n;k++){const p=[Math.round(a[0]+(b[0]-a[0])*k/n),Math.round(a[1]+(b[1]-a[1])*k/n)];if(p[0]!==old[0]&&p[1]!==old[1])d+=`H${p[0]}`;d+=`L${p.join(' ')}`;old=p;}
  }return d+(close?'Z':'');
 }
 global.createClawdCowboyAnimation=function(ctx){
  const hat=ctx.svg.querySelector('#cowboy-hat-front');if(!hat)return null;
  const make=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const toy=make('g',{id:'cowboy-toy',display:'none','shape-rendering':'crispEdges','pointer-events':'none'});
  const flower=make('g',{id:'cowboy-rose',display:'none'});
  const keyboard=ctx.svg.querySelector('#keyboard');keyboard.parentNode.insertBefore(toy,keyboard);
  function part(parent,points,fill){const node=make('path',{fill});parent.appendChild(node);return{node,points};}
  const gunParts=[
   part(toy,[[-4,-15],[17,-15],[19,-13],[26,-13],[28,-11],[28,-6],[11,-6],[7,3],[1,4],[-3,2],[-1,-6],[-4,-6]],'#487e92'),
   part(toy,[[6,-8],[13,-8],[13,-3],[11,-1],[6,-1],[5,-3]],'#f3c586'),
   part(toy,[[8,-6],[11,-6],[11,-3],[8,-3]],'#4f7381'),
   part(toy,[[-3,-15],[17,-15],[19,-13],[24,-13],[24,-8],[-3,-8]],'#8dcdd7'),
   part(toy,[[-2,-15],[16,-15],[18,-13],[2,-13],[-2,-12]],'#c6eced'),
   part(toy,[[-1,-8],[6,-8],[4,1],[1,2],[-2,0]],'#f2ab77'),
   part(toy,[[0,-7],[2,-7],[0,0],[-1,-1]],'#ffd3a1'),
   part(toy,[[23,-14],[27,-14],[28,-12],[28,-7],[23,-7]],'#f29b68'),
   part(toy,[[24,-13],[26,-13],[27,-12],[27,-8],[25,-8]],'#ffd09c'),
   part(toy,[[5,-12],[8,-12],[8,-10],[5,-10]],'#fff0c4')
  ];
  toy.appendChild(flower);
  const roseParts=[
   part(flower,[[26,-12],[39,-12],[39,-10],[26,-10]],'#649657'),
   part(flower,[[31,-12],[29,-16],[33,-15],[35,-12]],'#8db66b'),
   part(flower,[[33,-10],[34,-7],[37,-7],[36,-10]],'#7da75f'),
   part(flower,[[36,-15],[38,-17],[42,-17],[44,-15],[46,-15],[47,-12],[46,-9],[44,-7],[40,-6],[37,-8],[35,-11],[35,-14]],'#a74055'),
   part(flower,[[36,-14],[38,-16],[41,-16],[43,-14],[45,-14],[46,-12],[44,-10],[43,-8],[40,-7],[38,-9],[36,-10]],'#de6875'),
   part(flower,[[37,-14],[39,-16],[41,-15],[40,-13],[38,-12],[37,-12]],'#f8a0a3'),
   part(flower,[[40,-14],[43,-14],[44,-12],[42,-10],[40,-10],[39,-12]],'#b7455f'),
   part(flower,[[40,-13],[42,-13],[42,-11],[40,-11]],'#f58f98')
  ];
  const armSource=make('g');armSource.innerHTML=ctx.rig.left.idle;
  const faces=[...armSource.querySelectorAll('path')].map(n=>({fill:n.getAttribute('fill'),points:[...n.getAttribute('d').matchAll(/[ML]\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g)].map(m=>[+m[1],+m[2]])}));
  let active=false,armParent=null,armNext=null;
  const poses=[[0,156.5,87],[120,156.5,87],[350,174,96],[650,178,64],[850,178,61],[1660,178,61],[2110,178,61],[2450,174,96],[2640,156.5,87],[2700,156.5,87]];
  function arm(x,y){
   const origin=[163.5,75],u=[-7,12],len=Math.hypot(...u),base=[u[0]/len,u[1]/len],v=[x-origin[0],y-origin[1]],size=Math.hypot(...v),axis=v.map(n=>n/size);
   const projected=faces.map(face=>{const points=face.points.map(([px,py])=>{const dx=px-origin[0],dy=py-origin[1],along=(dx*base[0]+dy*base[1])*size/len,across=-dx*base[1]+dy*base[0];return[origin[0]+axis[0]*along-axis[1]*across,origin[1]+axis[1]*along+axis[0]*across];});return`<path fill="${face.fill}" d="${path(points)}"/>`;}).join('');
   ctx.left.innerHTML='<g id="paw-left-motion">'+projected+'</g>';
  }
  function paint(ms){
   if(!active){armParent=ctx.left.parentNode;armNext=ctx.left.nextSibling;toy.parentNode.insertBefore(ctx.left,toy);}
   active=true;ctx.cowboyPhase=ms<350?'fetching':ms<850?'lifting':ms<1060?'aiming':ms<1430?'blooming':ms<1850?'proud':ms<2110?'retracting':'stowing';
   ctx.headphoneEyes=ms>=1100&&ms<1850?ctx.happyEyes:ctx.openEyes;
   let i=0;while(i<poses.length-2&&ms>poses[i+1][0])i++;
   const a=poses[i],b=poses[i+1],f=between(ms,a[0],b[0]);let x=a[1]+(b[1]-a[1])*f,y=a[2]+(b[2]-a[2])*f;
   const kick=ctx.reduceMotion?0:Math.sin(Math.PI*between(ms,1040,1220));
   x-=1.8*kick;y+=.5*kick;
   if(ctx.reduceMotion){x=ms>=350&&ms<2450?178:156.5;y=ms>=350&&ms<2450?61:87;}
   arm(x,y);ctx.root.dataset.left='cowboy';
   const show=ms>=350&&ms<(ctx.reduceMotion?2450:2530);toy.setAttribute('display',show?'inline':'none');
   if(show){
    const angle=Math.atan2(y-75,x-163.5)+(28-4*kick)*Math.PI/180;
    const project=points=>points.map(([px,py])=>[x+px*Math.cos(angle)-py*Math.sin(angle),y+px*Math.sin(angle)+py*Math.cos(angle)]);
    gunParts.forEach(p=>p.node.setAttribute('d',path(project(p.points))));
    const pop=ctx.reduceMotion?(ms>=1100&&ms<1850?1:0):(between(ms,1060,1250)+.16*Math.sin(Math.PI*between(ms,1170,1430)))*(1-between(ms,1850,2110));
    flower.setAttribute('display',pop>0?'inline':'none');
    roseParts.forEach(p=>p.node.setAttribute('d',path(project(p.points.map(([px,py])=>[26+(px-26)*pop,-11+(py+11)*(.6+.4*pop)])))));
   }
   const tilt=ctx.reduceMotion?0:1.1*Math.sin(Math.PI*between(ms,1220,1720));
   hat.setAttribute('transform',`rotate(${tilt.toFixed(3)} 123 37)`);
  }

  function reset(){
   toy.setAttribute('display','none');flower.setAttribute('display','none');hat.removeAttribute('transform');ctx.cowboyPhase='none';
   if(active){armParent.insertBefore(ctx.left,armNext?.parentNode===armParent?armNext:null);ctx.pose('left','idle');active=false;armParent=armNext=null;}
  }
  ctx.cleanup.push(()=>toy.remove());
  return {duration,paint,reset};
 };
})(window);
