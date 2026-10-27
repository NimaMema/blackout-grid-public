import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCanvasCity } from './city-canvas.js';
import { placeMapLabels } from './map-labels.js';

const DISTRICTS = {
  gateway: { n: '01', name: 'GATEWAY', x: -15, z: 9, color: 0xd9f477, height: 8 },
  queue: { n: '02', name: 'JOB QUEUE', x: -13, z: -11, color: 0xeca263, height: 5 },
  workers: { n: '03', name: 'WORKERS', x: 9, z: -9, color: 0xbddc88, height: 12 },
  database: { n: '04', name: 'DATABASE', x: 15, z: 10, color: 0x8bd6b0, height: 10 },
};
const vector = (x, y, z) => new THREE.Vector3(x, y, z);

export function createCity(host, onSelect) {
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2', { alpha: true, antialias: true });
  if (!context) return createCanvasCity(host, onSelect);
  const renderer = new THREE.WebGLRenderer({ canvas: probe, context, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x172015, .008);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 200);
  const initial = vector(48, 43, 53);
  camera.position.copy(initial);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0); controls.enableDamping = true; controls.dampingFactor = .065;
  controls.minDistance = 36; controls.maxDistance = 105; controls.maxPolarAngle = 1.25;
  controls.minPolarAngle = .35; controls.enablePan = false; controls.autoRotateSpeed = .35;
  scene.add(new THREE.AmbientLight(0xbac7a9, 1.7));
  const sunlight = new THREE.DirectionalLight(0xe4eccb, 2.6); sunlight.position.set(-15, 40, 20); scene.add(sunlight);
  const fill = new THREE.DirectionalLight(0x708965, 1.1); fill.position.set(20, 20, -30); scene.add(fill);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(56, .5, 43),
    new THREE.MeshStandardMaterial({ color: 0x1a241b, roughness: .95 }));
  ground.position.y = -.32; scene.add(ground);
  const grid = new THREE.GridHelper(64, 32, 0x52633b, 0x35432d);
  grid.material.transparent = true; grid.material.opacity = .26; grid.position.y = -.045; scene.add(grid);
  const geometryEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(56, .5, 43));
  const perimeter = new THREE.LineSegments(geometryEdges, new THREE.LineBasicMaterial({ color: 0x718247, transparent: true, opacity: .55 }));
  perimeter.position.copy(ground.position); scene.add(perimeter);
  const objects = [], districts = {}, labels = {};
  const makeBox = (x, y, z, w, h, d, material) => {
    const mesh = new THREE.Mesh(box, material);
    mesh.position.set(x, y + h / 2, z); mesh.scale.set(w, h, d); scene.add(mesh); return mesh;
  };
  const roadMat = new THREE.MeshBasicMaterial({ color: 0x111810 });
  const laneMat = new THREE.LineDashedMaterial({ color: 0x9baa68, dashSize: .4, gapSize: .65, transparent: true, opacity: .45 });
  function road(x1, z1, x2, z2) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, 1.5), roadMat);
    mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    mesh.position.set((x1 + x2) / 2, .005, (z1 + z2) / 2); scene.add(mesh);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([vector(x1,.04,z1),vector(x2,.04,z2)]), laneMat);
    line.computeLineDistances(); scene.add(line);
  }
  [-20, 0, 21].forEach(z => road(-27, z, 27, z));
  [-25, 0, 26].forEach(x => road(x, -21, x, 21));
  road(-25, -2, 26, -2); road(-3, -20, -3, 21);
  const routes = [
    [[-15,9],[-15,-2],[-13,-2],[-13,-11]],
    [[-13,-11],[0,-11],[0,-9],[9,-9]],
    [[9,-9],[26,-9],[26,10],[15,10]],
    [[15,10],[15,21],[-15,21],[-15,9]],
  ].map(points => {
    const route = new THREE.CurvePath();
    for (let i=1; i<points.length; i++) route.add(new THREE.LineCurve3(vector(points[i-1][0],.17,points[i-1][1]),vector(points[i][0],.17,points[i][1])));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(route.getPoints(80)),
      new THREE.LineBasicMaterial({ color: 0xb9d482, transparent: true, opacity: .25 }));
    scene.add(line); return route;
  });
  const dimWindow = new THREE.Color(0x19221a);
  const dummy = new THREE.Object3D();
  for (const [key, d] of Object.entries(DISTRICTS)) {
    const group = { buildings: [], windows: null, color: new THREE.Color(d.color), status: 'online', ring: null };
    districts[key] = group;
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x394533, roughness: .75, metalness: .28 });
    const podium = makeBox(d.x, .02, d.z, 10.5, .28, 10.5, new THREE.MeshStandardMaterial({ color: 0x2a3527 }));
    podium.userData.district = key; objects.push(podium);
    const ringGeo = new THREE.BufferGeometry().setFromPoints([
      vector(d.x-5.3,.33,d.z-5.3),vector(d.x+5.3,.33,d.z-5.3),vector(d.x+5.3,.33,d.z+5.3),
      vector(d.x-5.3,.33,d.z+5.3),vector(d.x-5.3,.33,d.z-5.3)]);
    group.ring = new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: d.color, transparent: true, opacity: .6 })); scene.add(group.ring);
    const layout = key === 'workers'
      ? [[-2.8,-2.7,7.3], [0,-2.7,11.5], [2.8,-2.7,8.9], [-2.8,1,5.3], [0,1,8.2], [2.8,1,6.8]]
      : key === 'queue'
      ? [[-2.7,-2.8,2], [1.5,-2.8,2.8], [-2.7,1.5,3.2], [1.5,1.5,4.6]]
      : key === 'gateway'
      ? [[-2.6,-2.1,4.3], [1.4,-1.6,8], [-2.6,2.3,3.5], [1.4,2.3,5.2]]
      : [[-2.3,-2,6.2], [1.5,-1.5,9.8], [-2.3,2.2,4], [1.5,2.6,5.8]];
    const windowTransforms = [];
    for (let b = 0; b < layout.length; b++) {
      const [ox, oz, h] = layout[b], width = key === 'workers' ? 2 : 2.7, depth = key === 'queue' ? 3.1 : 2.5;
      const mesh = makeBox(d.x+ox, .3, d.z+oz, width, h, depth, blockMat);
      mesh.userData.district = key; objects.push(mesh); group.buildings.push(mesh);
      const topMat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: .75 });
      const roof = makeBox(d.x+ox, h+.31, d.z+oz, width+.04, .07, depth+.04, topMat); group.buildings.push(roof);
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width,h,depth)),
        new THREE.LineBasicMaterial({ color: 0x74815d, transparent: true, opacity: .35 }));
      frame.position.copy(mesh.position); scene.add(frame);
      if (h > 7) {
        makeBox(d.x+ox, h+.4, d.z+oz, .12, 1.2, .12, new THREE.MeshBasicMaterial({color:d.color}));
        const antenna = new THREE.Mesh(new THREE.SphereGeometry(.12,6,4), new THREE.MeshBasicMaterial({color:d.color}));
        antenna.position.set(d.x+ox,h+1.7,d.z+oz); scene.add(antenna); group.buildings.push(antenna);
      }
      for (let y=.85; y<h-.2; y+=.77) {
        for (let c=-.72; c<=.72; c+=.72) {
          if ((Math.round(y*100)+b+Math.round(c*10)) % 7 === 0) continue;
          windowTransforms.push([d.x+ox+c,y,d.z+oz+depth/2+.017,.34,.27,.025]);
          windowTransforms.push([d.x+ox+width/2+.017,y,d.z+oz+c,.025,.27,.34]);
        }
      }
    }
    const windows = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial(), windowTransforms.length);
    windowTransforms.forEach(([x,y,z,w,h,d],i) => {
      dummy.position.set(x,y,z); dummy.scale.set(w,h,d); dummy.updateMatrix(); windows.setMatrixAt(i,dummy.matrix);
      windows.setColorAt(i, group.color.clone().multiplyScalar(.55+((i*13)%9)/20));
    });
    windows.instanceMatrix.needsUpdate=true; windows.instanceColor.needsUpdate=true; scene.add(windows); group.windows=windows;
    const label=document.createElement('button'); label.className='map-label';
    const title=document.createElement('span'); title.textContent=d.n+' / '+d.name;
    const state=document.createElement('small'); state.textContent='● ONLINE';
    label.append(title,state); label.addEventListener('click',()=>onSelect(key));
    label.setAttribute('aria-label','Inspect '+d.name.toLowerCase()+' district');
    host.append(label); labels[key]=label;
  }
  // Low-rise blocks around the perimeter make the services feel part of a city.
  const filler = new THREE.MeshStandardMaterial({ color:0x2a3526,roughness:1 });
  for(let i=0;i<18;i++){
    const x=-22+(i%9)*5.4,z=i<9?-18:18,h=.5+((i*7)%8)*.23;
    makeBox(x,0,z,2.2,h,1.3,filler);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.1,.12,6),
    new THREE.MeshStandardMaterial({color:0x364726,emissive:0x152207,roughness:.4}));
  hub.position.set(0,.05,-2); scene.add(hub);
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(1.55,.025,4,48),new THREE.MeshBasicMaterial({color:0xd9f477}));
  hubRing.rotation.x=-Math.PI/2; hubRing.position.set(0,.14,-2);scene.add(hubRing);
  const maxParticles=180;
  const particles=new THREE.InstancedMesh(new THREE.SphereGeometry(.13,5,4),new THREE.MeshBasicMaterial(),maxParticles);
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); particles.count=0; scene.add(particles);
  let flows=[], lastSubmitted=0,lastCompleted=0, lastTime=performance.now(), motion=true, selected='gateway', currentSnapshot=null, frame=0;
  function spawn(route,count,color) {
    for(let i=0;i<Math.min(16,count);i++) {
      if(flows.length>=maxParticles-30) flows.shift();
      flows.push({route,t:-i*.025,speed:.22+((i*3)%5)*.018,color:new THREE.Color(color)});
    }
  }
  function update(snapshot) {
    currentSnapshot=snapshot;
    const m=snapshot.metrics;
    spawn(0,Math.max(0,m.submitted-lastSubmitted),0xd9f477);
    spawn(1,Math.max(0,m.completed-lastCompleted),0x8bd6b0);
    spawn(2,Math.max(0,m.completed-lastCompleted),0x8bd6b0);
    lastSubmitted=m.submitted;lastCompleted=m.completed;
    for(const [key,g] of Object.entries(districts)) {
      const status=snapshot.services[key]; if(status===g.status) continue; g.status=status;
      const color=status==='offline'?dimWindow:status==='degraded'?new THREE.Color(0xeda258):g.color;
      for(let i=0;i<g.windows.count;i++)g.windows.setColorAt(i,color.clone().multiplyScalar(.6+((i*13)%9)/20));
      g.windows.instanceColor.needsUpdate=true;
      g.buildings.forEach(mesh=>{
        if(mesh.material.isMeshBasicMaterial) {mesh.material.color.copy(status==='offline'?new THREE.Color(0x4c3025):color);}
      });
    }
  }
  function select(key) { selected=key; }
  function resize() { const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix(); }
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let pointerStart={x:0,y:0};
  const raycaster=new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>6)return;
    const rect=renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    const hit=raycaster.intersectObjects(objects,false)[0];if(hit)onSelect(hit.object.userData.district);
  });
  const labelPoint=new THREE.Vector3();
  function animate(time) {
    frame=requestAnimationFrame(animate);
    const dt=motion?Math.min((time-lastTime)/1000,.08):0;lastTime=time;
    controls.update();
    if(dt) {
      flows.forEach(p=>{p.t+=p.speed*dt;}); flows=flows.filter(p=>p.t<1);
      hubRing.rotation.z+=dt*.15;
    }
    let count=0;
    flows.forEach(p=>{
      if(p.t<0)return;
      const pos=routes[p.route].getPoint(Math.min(.999,p.t));
      dummy.position.copy(pos);dummy.scale.setScalar(1);dummy.updateMatrix();
      particles.setMatrixAt(count,dummy.matrix);particles.setColorAt(count,p.color);count++;
    });
    const backlog=currentSnapshot?.metrics.backlog||0;
    for(let i=0;i<Math.min(28,Math.ceil(backlog/2));i++){
      dummy.position.set(-18.2+(i%7)*.8,.25,-5.5+Math.floor(i/7)*.55);dummy.scale.set(.75,.75,.75);dummy.updateMatrix();
      particles.setMatrixAt(count,dummy.matrix);particles.setColorAt(count,new THREE.Color(0xeca263));count++;
    }
    particles.count=Math.min(count,maxParticles);particles.instanceMatrix.needsUpdate=true;
    if(particles.instanceColor)particles.instanceColor.needsUpdate=true;
    const positions={};
    for(const [key,d] of Object.entries(DISTRICTS)) {
      const g=districts[key],label=labels[key];
      labelPoint.set(d.x,d.height+2.4,d.z).project(camera);
      positions[key]=[(labelPoint.x*.5+.5)*host.clientWidth,(-labelPoint.y*.5+.5)*host.clientHeight];
      label.className='map-label '+g.status+(selected===key?' selected':'');
      label.querySelector('small').textContent='● '+g.status.toUpperCase();
      label.setAttribute('aria-pressed',String(selected===key));
      g.ring.material.opacity=selected===key?.9:.3;
      g.ring.material.color.set(g.status==='offline'?0xb56c47:d.color);
    }
    placeMapLabels(labels,positions,host.clientWidth,host.clientHeight);
    renderer.render(scene,camera);
  }
  requestAnimationFrame(animate);
  return {
    update,select,
    orbit(value){controls.autoRotate=value;},
    motion(value){motion=value;},
    reset(){camera.position.copy(initial);controls.target.set(0,1,0);controls.update();},
    dispose(){cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.dispose();}
  };
}
