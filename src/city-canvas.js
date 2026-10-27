import { placeMapLabels } from './map-labels.js';
/** Orthographic Canvas renderer for browsers without WebGL. Uses the same live state and controls. */
export function createCanvasCity(host, onSelect) {
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');host.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const ds = {
    gateway: { n:'01',name:'GATEWAY',x:-15,z:9,h:8,color:'#d9f477' },
    queue: { n:'02',name:'JOB QUEUE',x:-13,z:-11,h:5,color:'#eca263' },
    workers: { n:'03',name:'WORKERS',x:9,z:-9,h:12,color:'#bddc88' },
    database: { n:'04',name:'DATABASE',x:15,z:10,h:10,color:'#8bd6b0' },
  };
  let w=0,h=0,dpr=1,yaw=.68,tilt=.52,zoom=1,selected='gateway',orbit=false,motion=true;
  let snapshot=null,flows=[],prevSubmitted=0,prevCompleted=0,lastTime=performance.now(),hitFaces=[];
  const labels={},buildings=[];
  function project(x,y,z) {
    const scale=Math.min(w/78,h/47)*zoom;
    const depth=x*Math.sin(yaw)+z*Math.cos(yaw);
    return [w*.5+(x*Math.cos(yaw)-z*Math.sin(yaw))*scale,h*.6+depth*scale*tilt-y*scale];
  }
  function poly(points,fill,stroke='#72865638',lineWidth=.65) {
    ctx.beginPath();points.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
  }
  function line(points,color,width=1) {
    ctx.beginPath();points.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function block(x,z,bw,bd,bh,key,filler=false) {
    buildings.push({x,z,w:bw,d:bd,h:bh,key,filler});
  }
  for(const [key,d] of Object.entries(ds)){
    const layout=key==='workers'?[[-2.8,-2.7,7.3],[0,-2.7,11.5],[2.8,-2.7,8.9],[-2.8,1,5.3],[0,1,8.2],[2.8,1,6.8]]
      :key==='queue'?[[-2.7,-2.8,2],[1.5,-2.8,2.8],[-2.7,1.5,3.2],[1.5,1.5,4.6]]
      :key==='gateway'?[[-2.6,-2.1,4.3],[1.4,-1.6,8],[-2.6,2.3,3.5],[1.4,2.3,5.2]]
      :[[-2.3,-2,6.2],[1.5,-1.5,9.8],[-2.3,2.2,4],[1.5,2.6,5.8]];
    layout.forEach(([ox,oz,bh])=>block(d.x+ox,d.z+oz,key==='workers'?2:2.7,key==='queue'?3.1:2.5,bh,key));
    const label=document.createElement('button');label.className='map-label';
    const name=document.createElement('span');name.textContent=d.n+' / '+d.name;
    const status=document.createElement('small');status.textContent='● ONLINE';label.append(name,status);
    label.setAttribute('aria-label','Inspect '+d.name.toLowerCase()+' district');
    label.onclick=()=>onSelect(key);host.append(label);labels[key]=label;
  }
  for(let i=0;i<18;i++)block(-22+(i%9)*5.4,i<9?-18:18,2.2,1.3,.5+((i*7)%8)*.23,'gateway',true);
  const routes=[
    [[-15,9],[-15,-2],[-13,-2],[-13,-11]],
    [[-13,-11],[0,-11],[0,-9],[9,-9]],
    [[9,-9],[26,-9],[26,10],[15,10]],
    [[15,10],[15,21],[-15,21],[-15,9]]
  ];
  function routePoint(route,t) {
    const points=routes[route],distances=[];let length=0;
    for(let i=1;i<points.length;i++){const d=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);distances.push(d);length+=d;}
    let remaining=Math.min(1,Math.max(0,t))*length;
    for(let i=0;i<distances.length;i++){
      if(remaining<=distances[i]||i===distances.length-1){const f=remaining/distances[i];return [points[i][0]+(points[i+1][0]-points[i][0])*f,.22,points[i][1]+(points[i+1][1]-points[i][1])*f];}
      remaining-=distances[i];
    }
  }
  function drawBuilding(b) {
    const {x,z,w:bw,d:bd,h:bh,key,filler}=b;
    const status=snapshot?.services[key]||'online',isOff=!filler&&status==='offline';
    const x1=x-bw/2,x2=x+bw/2,z1=z-bd/2,z2=z+bd/2;
    const faceX=Math.sin(yaw)>=0?x2:x1, faceZ=Math.cos(yaw)>=0?z2:z1;
    const sides=[
      {points:[[x1,0,faceZ],[x2,0,faceZ],[x2,bh,faceZ],[x1,bh,faceZ]],fill:isOff?'#302820':'#34412f'},
      {points:[[faceX,0,z1],[faceX,0,z2],[faceX,bh,z2],[faceX,bh,z1]],fill:isOff?'#29271f':'#253323'},
    ];
    sides.forEach(face=>{poly(face.points,face.fill);if(!filler)hitFaces.push({points:face.points.map(p=>project(...p)),key});});
    poly([[x1,bh,z1],[x2,bh,z1],[x2,bh,z2],[x1,bh,z2]],isOff?'#493b28':filler?'#405039':'#536444',isOff?'#8f5d3a88':ds[key].color+'66',.8);
    if(filler)return;
    hitFaces.push({points:[[x1,bh,z1],[x2,bh,z1],[x2,bh,z2],[x1,bh,z2]].map(p=>project(...p)),key});
    const color=isOff?'#493b25':status==='degraded'?'#eca263':ds[key].color;
    for(let y=.7;y<bh-.25;y+=.72){
      for(let offset=-.65;offset<=.66;offset+=.65){
        if((Math.round(y*100)+Math.round(offset*10)+Math.round(x))%7===0)continue;
        ctx.globalAlpha=isOff?.4:.55+((Math.round(y*100)+Math.round(offset*100))%5)/15;
        poly([[x+offset-.13,y,faceZ],[x+offset+.13,y,faceZ],[x+offset+.13,y+.24,faceZ],[x+offset-.13,y+.24,faceZ]],color,null);
        poly([[faceX,y,z+offset-.13],[faceX,y,z+offset+.13],[faceX,y+.24,z+offset+.13],[faceX,y+.24,z+offset-.13]],color,null);
      }
    }
    ctx.globalAlpha=1;
    if(bh>7){line([[x,bh,z],[x,bh+1.25,z]],color,.8);const p=project(x,bh+1.3,z);ctx.fillStyle=color;ctx.fillRect(p[0]-1,p[1]-1,2,2);}
    line([[x1,bh+.02,z1],[x2,bh+.02,z1],[x2,bh+.02,z2]],color+'aa',1);
  }
  function resize(){w=host.clientWidth;h=host.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let down=null,dragged=false;
  canvas.style.cursor='grab';
  canvas.onpointerdown=e=>{down={x:e.clientX,y:e.clientY,yaw,tilt};dragged=false;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';};
  canvas.onpointermove=e=>{
    if(!down)return;
    const dx=e.clientX-down.x,dy=e.clientY-down.y;dragged=dragged||Math.hypot(dx,dy)>5;
    yaw=down.yaw+dx*.005;tilt=Math.max(.3,Math.min(.8,down.tilt+dy*.002));
  };
  function contains(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
  canvas.onpointerup=e=>{
    if(!dragged){const r=canvas.getBoundingClientRect(),p=[e.clientX-r.left,e.clientY-r.top];for(let i=hitFaces.length-1;i>=0;i--)if(contains(p,hitFaces[i].points)){onSelect(hitFaces[i].key);break;}}
    down=null;canvas.style.cursor='grab';
  };
  canvas.onpointercancel=()=>{down=null;canvas.style.cursor='grab';};
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.7,Math.min(1.5,zoom*(e.deltaY>0?.94:1.06)));},{passive:false});
  let frame;
  function animate(time){
    frame=requestAnimationFrame(animate);const dt=motion?Math.min((time-lastTime)/1000,.1):0;lastTime=time;
    if(orbit&&!down&&motion)yaw+=dt*.045;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);hitFaces=[];
    poly([[-28,-.5,-21],[28,-.5,-21],[28,-.5,21],[-28,-.5,21]],'#1c291b','#79885577');
    for(let x=-28;x<=28;x+=2)line([[x,-.1,-21],[x,-.1,21]],'#7083471c',.5);
    for(let z=-20;z<=20;z+=2)line([[-28,-.1,z],[28,-.1,z]],'#7083471c',.5);
    for(const z of [-20,-2,21])line([[-27,.01,z],[27,.01,z]],'#0f180d',Math.min(w/78,h/47)*1.3*zoom);
    for(const x of [-25,-3,0,26])line([[x,.01,-21],[x,.01,21]],'#10190e',Math.min(w/78,h/47)*1.3*zoom);
    routes.forEach(route=>line(route.map(([x,z])=>[x,.04,z]),'#93b26144',1));
    for(const [key,d] of Object.entries(ds)){
      poly([[d.x-5.3,.1,d.z-5.3],[d.x+5.3,.1,d.z-5.3],[d.x+5.3,.1,d.z+5.3],[d.x-5.3,.1,d.z+5.3]],'#28352370',snapshot?.services[key]==='offline'?'#bc7b4a88':d.color+(selected===key?'bb':'44'),selected===key?1.2:.6);
    }
    flows.forEach(p=>{p.t+=dt*.24;});flows=flows.filter(p=>p.t<1);
    for(const p of flows){if(p.t<0)continue;const xy=project(...routePoint(p.route,p.t));ctx.shadowBlur=7;ctx.shadowColor=p.color;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(...xy,Math.max(1.2,Math.min(w/550,2.4)),0,Math.PI*2);ctx.fill();}
    ctx.shadowBlur=0;
    const backlog=snapshot?.metrics.backlog||0;
    for(let i=0;i<Math.min(40,Math.ceil(backlog/2));i++){
      const q=project(-18.3+(i%8)*.75,.2,-5.5+Math.floor(i/8)*.55);ctx.fillStyle='#eca263';ctx.fillRect(q[0]-1,q[1]-1,2,2);
    }
    buildings.sort((a,b)=>(a.x*Math.sin(yaw)+a.z*Math.cos(yaw))-(b.x*Math.sin(yaw)+b.z*Math.cos(yaw)));
    buildings.forEach(drawBuilding);
    const positions={};
    for(const [key,d]of Object.entries(ds)){
      const xy=project(d.x,d.h+2.8,d.z),label=labels[key],status=snapshot?.services[key]||'online';
      positions[key]=xy;
      label.className='map-label '+status+(selected===key?' selected':'');
      label.querySelector('small').textContent='● '+status.toUpperCase();label.setAttribute('aria-pressed',String(selected===key));
    }
    placeMapLabels(labels,positions,w,h);
  }
  frame=requestAnimationFrame(animate);
  function spawn(route,count,color){for(let i=0;i<Math.min(count,12);i++){if(flows.length>=150)flows.shift();flows.push({route,t:-i*.03,color});}}
  return {
    update(s){snapshot=s;spawn(0,Math.max(0,s.metrics.submitted-prevSubmitted),'#d9f477');spawn(1,Math.max(0,s.metrics.completed-prevCompleted),'#8bd6b0');spawn(2,Math.max(0,s.metrics.completed-prevCompleted),'#8bd6b0');prevSubmitted=s.metrics.submitted;prevCompleted=s.metrics.completed;},
    select(key){selected=key;},orbit(v){orbit=v;},motion(v){motion=v;},reset(){yaw=.68;tilt=.52;zoom=1;},
    dispose(){cancelAnimationFrame(frame);observer.disconnect();}
  };
}
