/* Detective fitting: inspect the keys, then magnify one eye. */
(function(global){
 'use strict';
 const NS='http://www.w3.org/2000/svg',duration=4400;
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const between=(t,a,b)=>ease((t-a)/(b-a));
 function path(points,close=true){
  const q=points.map(([x,y])=>[Math.round(x),Math.round(y)]);let d=`M${q[0].join(' ')}`;
  for(let i=1;i<q.length+(close?1:0);i++){
   const a=q[(i-1)%q.length],b=q[i%q.length],n=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));let old=a;
   for(let k=1;k<=n;k++){const p=[Math.round(a[0]+(b[0]-a[0])*k/n),Math.round(a[1]+(b[1]-a[1])*k/n)];if(p[0]!==old[0]&&p[1]!==old[1])d+=`H${p[0]}`;d+=`L${p.join(' ')}`;old=p;}
  }return d+(close?'Z':'');
 }
 global.createClawdDetectiveAnimation=function(ctx){
  const hat=ctx.svg.querySelector('#detective-hat-front');if(!hat)return null;
  const make=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const glass=make('g',{id:'detective-magnifier',display:'none','shape-rendering':'crispEdges','pointer-events':'none'});
  const keyboard=ctx.svg.querySelector('#keyboard');keyboard.parentNode.insertBefore(glass,keyboard);
  const handle=make('path',{fill:'#514267'}),handleFront=make('path',{fill:'#8470ac'});
  const backing=make('path',{fill:'#d97757',opacity:'0'}),tint=make('path',{fill:'#b6e2e8',opacity:'.18'});
  const bigEye=make('path',{fill:'#27221f',opacity:'0'}),rim=make('path',{fill:'#66527f','fill-rule':'evenodd'}),shine=make('path',{fill:'none',stroke:'#cfbedf','stroke-width':'1',opacity:'.8'});
  [handle,handleFront,backing,tint,bigEye,rim,shine].forEach(n=>glass.appendChild(n));
  const detectiveEyes=make('g',{id:'eyes-detective',display:'none',fill:'#27221f'}),leftEye=make('path'),rightEye=make('path',{d:'M130 65H135V78H130Z'});
  detectiveEyes.appendChild(leftEye);detectiveEyes.appendChild(rightEye);ctx.body.appendChild(detectiveEyes);
  const circle=(r,cy=-20)=>Array.from({length:65},(_,i)=>{const t=i/64*Math.PI*2;return[Math.cos(t)*r,cy+Math.sin(t)*r];});
  let active=false,armParent=null,armNext=null;
  const poses=[[0,156.5,87,48],[160,156.5,87,48],[440,174,96,48],[720,155,101,-18],[1100,167,100,8],[1470,155,101,-18],[2040,140.6,89.8,-24],[3100,140.6,89.8,-24],[3660,174,96,48],[3940,156.5,87,48],[4000,156.5,87,48]];
  function arm(x,y){
   const a=[158,74],b=[169,76],d=[x-5.5,y-1],c=[x+5.5,y+1],lower=p=>[p[0],p[1]+11];
   const faces=[[[a,b,lower(b),lower(a)],'#bc6049'],[[b,c,lower(c),lower(b)],'#bc6049'],[[d,a,lower(a),lower(d)],'#bc6049'],[[a,b,c,d],'#e89170'],[[d,c,lower(c),lower(d)],'#d97757']];
   ctx.left.innerHTML='<g id="paw-left-motion">'+faces.map(([points,fill])=>`<path fill="${fill}" d="${path(points)}"/>`).join('')+'</g>';
  }
  function paint(ms){
   // Spend 1150ms on the 750ms keyboard sweep; later beats keep their pacing.
   if(ms>720)ms=ms<1870?720+(ms-720)*750/1150:ms-400;
   if(!active){armParent=ctx.left.parentNode;armNext=ctx.left.nextSibling;glass.parentNode.insertBefore(ctx.left,glass);}
   active=true;ctx.detectivePhase=ms<440?'fetching':ms<1470?'inspecting':ms<2040?'lifting':ms<3100?'magnifying':'stowing';
   ctx.headphoneEyes=detectiveEyes;
   const focus=ctx.reduceMotion?(ms>=2040&&ms<3100?1:0):between(ms,1880,2040)*(1-between(ms,3100,3290));
   const wink=ms>=1940&&ms<3240;
   leftEye.setAttribute('d',wink?'M89 64L98 66V69L89 67Z':'M91 58H96V71H91Z');
   detectiveEyes.setAttribute('transform',`translate(0 ${ms>=600&&ms<1550?2:0})`);
   let i=0;while(i<poses.length-2&&ms>poses[i+1][0])i++;
   const a=poses[i],b=poses[i+1],f=between(ms,a[0],b[0]);let x=a[1]+(b[1]-a[1])*f,y=a[2]+(b[2]-a[2])*f,angle=a[3]+(b[3]-a[3])*f;
   if(ctx.reduceMotion){const held=ms>=440&&ms<3660;x=held?140.6:156.5;y=held?89.8:87;angle=held?-24:48;}
   arm(x,y);ctx.root.dataset.left='detective';
   const show=ms>=440&&ms<3780;glass.setAttribute('display',show?'inline':'none');
   if(show){
    const rad=angle*Math.PI/180,project=points=>points.map(([px,py])=>[x+px*Math.cos(rad)-py*Math.sin(rad),y+px*Math.sin(rad)+py*Math.cos(rad)]);
    const center=project([[0,-20]])[0],outer=project(circle(14)),inner=project(circle(11.3));
    handle.setAttribute('d',path(project([[-3,-9],[3,-9],[4,4],[-3,4]])));
    handleFront.setAttribute('d',path(project([[-2,-8],[1,-8],[2,3],[-2,3]])));
    rim.setAttribute('d',path(outer)+path(inner));
    backing.setAttribute('d',path(inner));backing.setAttribute('opacity',String(focus));
    tint.setAttribute('d',path(inner));
    const w=5+4*focus,h=13+6*focus;
    bigEye.setAttribute('d',path([[center[0]-w/2,center[1]-h/2],[center[0]+w/2,center[1]-h/2],[center[0]+w/2,center[1]+h/2],[center[0]-w/2,center[1]+h/2]]));bigEye.setAttribute('opacity',String(focus));
    shine.setAttribute('d',path(outer.slice(34,47),false));
   }
   const tilt=ctx.reduceMotion?0:1.1*Math.sin(Math.PI*between(ms,600,1470));hat.setAttribute('transform',`rotate(${tilt.toFixed(3)} 123 37)`);
  }
  function reset(){
   glass.setAttribute('display','none');detectiveEyes.setAttribute('display','none');detectiveEyes.removeAttribute('transform');hat.removeAttribute('transform');ctx.detectivePhase='none';
   if(active){armParent.insertBefore(ctx.left,armNext?.parentNode===armParent?armNext:null);ctx.pose('left','idle');active=false;armParent=armNext=null;}
  }
  ctx.cleanup.push(()=>{glass.remove();detectiveEyes.remove();});
  return{duration,paint,reset};
 };
})(window);
