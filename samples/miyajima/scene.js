import * as T from 'three';
import {OrbitControls} from './OrbitControls.js';
import {GLTFLoader} from './addons/loaders/GLTFLoader.js';

const canvas = document.querySelector('canvas');
const status = document.querySelector('#status');
const material = color => new T.MeshStandardMaterial({color, roughness:0.95, flatShading:true});
const mat = Object.fromEntries(Object.entries({
  sand:0xc6aa7c, water:0x76b5b2, stone:0xc5ba9b, timber:0x8d654d, red:0xca4c32,
  cream:0xf1e2bd, roof:0x424d4c, gold:0xc19f58, tile:0x777b6b,
}).map(([name, color]) => [name, material(color)]));
const box = new T.BoxGeometry();
const cylinder = new T.CylinderGeometry(.5,.5,1,12);
const roofGeometry = new T.BufferGeometry();
// A shallow hip roof with a raised ridge and slightly upturned eaves.
const roofPoints = [[-.52,0,-.54],[.52,0,-.54],[.52,0,.54],[-.52,0,.54],
                    [-.44,.06,-.45],[.44,.06,-.45],[.44,.06,.45],[-.44,.06,.45],
                    [-.32,.95,0],[.32,.95,0]];
roofGeometry.setAttribute('position', new T.Float32BufferAttribute(roofPoints.flat(),3));
roofGeometry.setIndex([0,4,1,1,4,5, 1,5,2,2,5,6, 2,6,3,3,6,7, 3,7,0,0,7,4,
                       4,8,5,5,8,9, 5,9,6, 6,9,7,7,9,8, 7,8,4, 0,1,2,0,2,3]);
roofGeometry.computeVertexNormals();
for (const color of [mat.roof,mat.tile]) color.side = T.DoubleSide;
const views = {
  coast:{target:[24,5,39], offset:[-235,218,-317], text:'Explore the tidal inlet. Drag to orbit, scroll or pinch to zoom.'},
  gate:{target:[-85,8,-66], offset:[-32,13,-37], text:'The Great Torii stands offshore on two main pillars and four smaller supports.'},
  shrine:{target:[60,7,93], offset:[-81,53,-99], text:'At Itsukushima Shrine, vermilion corridors connect halls along the edge of the inlet.'},
  pagoda:{target:[169,29,-42], offset:[-55,44,-72], text:'Five stacked roofs mark the hill above the shrine. Lower the camera to see their silhouette.'},
};

async function start() {
  const renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  renderer.setClearColor(0xe4e6d9);
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0xe4e6d9,.00082);
  scene.add(new T.HemisphereLight(0xfff7e1,0xabc5bb,2.1));
  const sun = new T.DirectionalLight(0xffeed0,2);
  sun.position.set(-240,400,-170);
  scene.add(sun);
  const camera = new T.PerspectiveCamera(36,1,.3,3000);
  const controls = new OrbitControls(camera,canvas);
  controls.minDistance=23;
  controls.maxDistance=1500;
  controls.maxPolarAngle=Math.PI*.47;
  controls.enablePan=false;
  controls.enableDamping=true;
  const [buffer, gateway] = await Promise.all([
    fetch('./elevation.bin').then(response => {
      if (!response.ok) throw new Error('Elevation is unavailable');
      return response.arrayBuffer();
    }),
    new GLTFLoader().loadAsync('./gate.glb'),
  ]);
  const data = new Int16Array(buffer);
  const cols=113, rows=111, step=8;
  if (data.length !== cols*rows) throw new Error('Incomplete terrain grid');
  function altitude(x,z) {
    const c=T.MathUtils.clamp(Math.round(x/step)+56,0,cols-1);
    const r=T.MathUtils.clamp(Math.round(z/step)+55,0,rows-1);
    return data[r*cols+c]===-32768 ? -4.5 : data[r*cols+c]/10;
  }
  let seed=194502;
  function random() {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  }
  const positions=[], colors=[], indices=[];
  const shore=new T.Color(0xd3be90), meadow=new T.Color(0xaabc83), hill=new T.Color(0x719671);
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
    const x=(c-56)*step,z=(r-55)*step,y=altitude(x,z);
    positions.push(x,y,z);
    const color=shore.clone().lerp(meadow,T.MathUtils.clamp(y/14,0,1)).lerp(hill,T.MathUtils.clamp((y-14)/52,0,1));
    color.multiplyScalar(.96+random()*.07);
    colors.push(color.r,color.g,color.b);
    if(r<rows-1 && c<cols-1) {
      const k=r*cols+c;
      indices.push(k,k+cols,k+1,k+1,k+cols,k+cols+1);
    }
  }
  const terrain=new T.BufferGeometry();
  terrain.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  terrain.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  terrain.setIndex(indices);
  terrain.computeVertexNormals();
  scene.add(new T.Mesh(terrain,new T.MeshStandardMaterial({vertexColors:true,flatShading:true})));
  function mesh(geometry,surface,x,y,z,sx,sy,sz,parent=scene) {
    const m=new T.Mesh(geometry,surface);
    m.position.set(x,y,z); m.scale.set(sx,sy,sz); parent.add(m);
    return m;
  }
  mesh(box,mat.water,0,-4.0,0,896,8.8,880);
  mesh(box,mat.stone,0,-13,0,897,11,881);
  const edge=[];
  for(let c=0;c<cols;c++) edge.push([c,0]);
  for(let r=1;r<rows;r++) edge.push([cols-1,r]);
  for(let c=cols-2;c>=0;c--) edge.push([c,rows-1]);
  for(let r=rows-2;r>0;r--) edge.push([0,r]);
  const walls=[];
  for(let i=0;i<edge.length;i++) {
    const [c,r]=edge[i], [d,s]=edge[(i+1)%edge.length];
    const a=[(c-56)*step,altitude((c-56)*step,(r-55)*step),(r-55)*step];
    const b=[(d-56)*step,altitude((d-56)*step,(s-55)*step),(s-55)*step];
    const lowA=[a[0],-8,a[2]],lowB=[b[0],-8,b[2]];
    walls.push(...a,...b,...lowA,...lowA,...b,...lowB);
  }
  const skirt=new T.BufferGeometry();
  skirt.setAttribute('position',new T.Float32BufferAttribute(walls,3));skirt.computeVertexNormals();
  mat.sand.side=T.DoubleSide;scene.add(new T.Mesh(skirt,mat.sand));

  // Draw repeated scenery using one draw call per geometry/material combination.
  const batches=new Map(), transform=new T.Object3D();
  function repeat(geo,surface,x,y,z,sx,sy,sz,angle=0) {
    const key=geo.uuid+surface.uuid;
    if(!batches.has(key)) batches.set(key,{geo,surface,matrices:[]});
    transform.position.set(x,y,z);transform.rotation.set(0,angle,0);transform.scale.set(sx,sy,sz);
    transform.updateMatrix();batches.get(key).matrices.push(transform.matrix.clone());
  }
  const ripples=material(0xa9d1c6);
  for(let i=0;i<2200;i++) {
    const x=(random()-.5)*888,z=(random()-.5)*872;
    if(altitude(x,z)<-1) repeat(box,ripples,x,.43,z,2+random()*9,.027,.13+random()*.14,-.15);
  }
  const leaves=[0x446f56,0x527e59,0x679062,0x7e9d6b].map(material);
  const crown=new T.IcosahedronGeometry(1,0);
  const gate={x:-85,z:-66}, shrine={x:61,z:99}, pagoda={x:169,z:-42};
  const clear=(x,z) => (Math.abs(x-shrine.x)<62 && Math.abs(z-shrine.z)<49) || Math.hypot(x-pagoda.x,z-pagoda.z)<19;
  for(let i=0;i<7600;i++) {
    const x=(random()-.5)*887,z=(random()-.5)*871,y=altitude(x,z);
    if(y<13 || clear(x,z) || (y<24 && random()>.24)) continue;
    const h=4+random()*7,w=h*(.36+random()*.17);
    repeat(cylinder,mat.timber,x,y+h*.22,z,.7,h*.62,.7);
    repeat(crown,leaves[Math.floor(random()*leaves.length)],x,y+h*.70,z,w,h*.52,w,random()*6);
  }
  const plaster=[0xe6d5b6,0xd7b99a,0xd7ccb4].map(material);
  for(let gx=-410;gx<430;gx+=15) for(let gz=-415;gz<430;gz+=15) {
    const x=gx+random()*4,z=gz+random()*4,y=altitude(x,z);
    if(y<2.0 || y>16 || clear(x,z) || random()>.61 || Math.abs(y-altitude(x+6,z+6))>2.2) continue;
    const w=5+random()*4,d=4+random()*2.5,h=3+random()*2.7,angle=.22+(Math.floor((gx+gz)/100)%2)*.12;
    repeat(box,plaster[Math.floor(random()*3)],x,y+h*.38,z,w,h*1.25,d,angle);
    repeat(roofGeometry,random()>.27?mat.roof:mat.tile,x,y+h,z,w*1.17,2.2,d*1.22,angle);
  }
  const shrineGroup=new T.Group();shrineGroup.position.set(shrine.x,6.3,shrine.z);shrineGroup.rotation.y=.34;scene.add(shrineGroup);
  function building(x,z,w,d,wallH) {
    mesh(box,mat.timber,x,0,z,w+2,.9,d+2,shrineGroup);
    mesh(box,mat.cream,x,wallH*.53,z,w,wallH,d,shrineGroup);
    for(let i=0;i<=4;i++) for(const side of [-1,1]) mesh(box,mat.red,x-w/2+i*w/4,wallH*.50,z+side*d*.50,.52,wallH+1,.55,shrineGroup);
    mesh(roofGeometry,mat.roof,x,wallH+.3,z,w*1.32,wallH*.72,d*1.45,shrineGroup);
  }
  function cloister(x,z,length,across) {
    const corridor=new T.Group();corridor.position.set(x,0,z);corridor.rotation.y=across?Math.PI/2:0;shrineGroup.add(corridor);
    mesh(box,mat.timber,0,-.25,0,length,1,4.4,corridor);
    for(const side of [-1,1]){
      mesh(box,mat.red,0,1.3,side*1.8,length,.3,.3,corridor);
      for(let i=-length/2;i<=length/2;i+=4) mesh(box,mat.red,i,.1,side*1.75,.45,7.0,.45,corridor);
    }
    mesh(roofGeometry,mat.roof,0,3.6,0,length+2,1.9,5.6,corridor);
  }
  cloister(-25,-11,47,false);cloister(24,-11,48,false);
  cloister(-45,2,30,true);cloister(43,2,30,true);
  building(0,-9,15,10,4.2);building(0,8,23,13,5.5);building(0,25,16,11,5.4);
  building(-44,19,10,8,3.7);building(43,19,10,8,3.7);
  mesh(box,mat.timber,0,-.2,-24,18,.8,19,shrineGroup);
  const pagY=altitude(pagoda.x,pagoda.z);
  mesh(box,mat.stone,pagoda.x,pagY+.7,pagoda.z,14,1.4,14);
  for(let i=0;i<5;i++) {
    const w=11.2-i*1.15, y=pagY+1.4+i*4.5;
    mesh(box,mat.red,pagoda.x,y+1.65,pagoda.z,w*.7,3.3,w*.7);
    mesh(roofGeometry,mat.roof,pagoda.x,y+3.0,pagoda.z,w*1.26,2.6,w*1.26);
  }
  mesh(cylinder,mat.gold,pagoda.x,pagY+26,pagoda.z,.38,7,.38);
  for(let i=0;i<5;i++) mesh(cylinder,mat.roof,pagoda.x,pagY+24+i*.66,pagoda.z,1.6-i*.16,.24,1.6-i*.16);
  gateway.scene.position.set(gate.x,.30,gate.z);gateway.scene.rotation.y=.67;scene.add(gateway.scene);
  for(const {geo,surface,matrices} of batches.values()){
    const inst=new T.InstancedMesh(geo,surface,matrices.length);
    matrices.forEach((m,i)=>inst.setMatrixAt(i,m));scene.add(inst);
  }
  let transition=null, active='gate';
  function setView(key,instant=false) {
    const view=views[key], target=new T.Vector3(...view.target);
    const distance=canvas.clientWidth/canvas.clientHeight < .9 ? 1.19 : 1;
    const position=new T.Vector3(...view.offset).multiplyScalar(distance).add(target);
    if(instant || matchMedia('(prefers-reduced-motion:reduce)').matches) {
      controls.target.copy(target);camera.position.copy(position);controls.update();transition=null;
    } else {
      transition={from:camera.position.clone(),at:controls.target.clone(),position,target,start:performance.now()};
    }
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===key)));
    document.querySelector('#detail').textContent=view.text;active=key;
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  controls.addEventListener('start',()=>{transition=null;});
  function resize(){
    renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
    camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);resize();setView(active,true);
  status.hidden=true;
  renderer.setAnimationLoop(now=>{
    if(transition){
      const t=T.MathUtils.clamp((now-transition.start)/750,0,1),ease=t*t*(3-2*t);
      camera.position.lerpVectors(transition.from,transition.position,ease);
      controls.target.lerpVectors(transition.at,transition.target,ease);
      if(t===1) transition=null;
    }
    controls.update();renderer.render(scene,camera);
    canvas.dataset.view=active;
  });
}
start().catch(error=>{
  console.error(error);
  status.textContent='The interactive view needs WebGL. The torii model is available to download below.';
});
