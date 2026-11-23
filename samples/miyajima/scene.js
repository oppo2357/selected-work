import * as T from 'three';
import {OrbitControls} from './OrbitControls.js';
import {GLTFLoader} from './addons/loaders/GLTFLoader.js';
import {buildArchitecture, makeBuilder} from './architecture.js';
import {makeLand, makeSky, makeWater} from './inlet.js';

const canvas=document.querySelector('canvas'),status=document.querySelector('#status');
const views={
  gate:{target:[-83.7,8.0,-64],offset:[-16,-3.85,-31],text:'At water level, the reflection reveals the spacing of the two camphor pillars and their four supporting posts.'},
  tablet:{target:[-85,12.2,-64],offset:[-8.2,-1.55,-9.8],text:'The inscription faces the open water. Look along the roof edge to see the layered capping above the vermilion beams.'},
  coast:{target:[0,3,12],offset:[-199,175,-251],text:'From the Seto Inland Sea, the shrine sits between the waterfront town and the wooded slopes of Mount Misen.'},
  shrine:{target:[51,5.6,61],offset:[-33,5,-46],text:'The Takabutai dance stage faces the Great Torii. Raised walkways lead around the tidal inlet to the worship halls.'},
  pagoda:{target:[154.4,26.0,-52.7],offset:[21,3,-43],text:'Five tiers of cypress-bark eaves rise above the hill beside Senjōkaku. The study shows the tower without restoration scaffolding.'}
};
async function loadGate(){
  const loader=new GLTFLoader();
  try{
    const {MeshoptDecoder}=await import('./addons/meshopt_decoder.module.js');
    if(MeshoptDecoder.supported){
      return await loader.setMeshoptDecoder(MeshoptDecoder).loadAsync('gate-meshopt.glb');
    }
  }catch{
    // The standard GLB remains available if the optimized path cannot load.
  }
  return loader.loadAsync('gate.glb');
}
async function start(){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();scene.background=new T.Color(0xc3ccc7);scene.fog=new T.FogExp2(0xb5c6c2,.00091);
  const light=new T.HemisphereLight(0xfff1d8,0xc1c8bf,1.68);scene.add(light);
  const sun=new T.DirectionalLight(0xffe8ca,2.12);sun.position.set(-118,110,-82);sun.target.position.set(23,2,25);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-163,right:163,top:145,bottom:-145,near:.5,far:435});sun.shadow.normalBias=.055;sun.shadow.bias=-.00018;scene.add(sun,sun.target);
  const camera=new T.PerspectiveCamera(38,1,.35,9500),controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;controls.enablePan=false;controls.minDistance=9;controls.maxDistance=650;controls.maxPolarAngle=Math.PI*.495;
  const load=async(path,type)=>{const r=await fetch(path);if(!r.ok)throw Error(path+' '+r.status);return r[type]();};
  const loader=new T.TextureLoader();
  const [close,far,layout,gate,textures]=await Promise.all([load('elevation.bin','arrayBuffer'),load('regional-elevation.bin','arrayBuffer'),
    load('inlet.json','json'),loadGate(),
    Promise.all(['inlet-ortho','mountain-ortho','canopy-5','canopy-26','canopy-67','bark-courses','deck-boards','granite'].map(async(n,i)=>{
      const map=await loader.loadAsync(n+'.webp');map.colorSpace=T.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      if(i>=5){map.wrapS=map.wrapT=T.RepeatWrapping;}
      return map;
    }))]);
  const b=makeBuilder(scene), ground=makeLand(scene,b,new Int16Array(close),new Int16Array(far),layout,textures.slice(0,5));
  buildArchitecture(b,layout,ground,scene,textures.slice(5));b.flush();makeSky(scene);
  gate.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  gate.scene.position.set(-85,0,-64);gate.scene.rotation.y=.80;scene.add(gate.scene);
  const water=makeWater(scene,sun);
  let transition=null,active='gate',last=0,waterTime=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function view(key,instant=false){
    const v=views[key],target=new T.Vector3(...v.target);
    const scale=Math.max(1,1.02/camera.aspect);
    const position=new T.Vector3(...v.offset).multiplyScalar(scale).add(target);
    if(instant||reduced.matches){camera.position.copy(position);controls.target.copy(target);transition=null;controls.update();}
    else transition={from:camera.position.clone(),at:controls.target.clone(),position,target,start:performance.now()};
    active=key;document.querySelectorAll('[data-view]').forEach(button=>{
      if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.view===key));
    });document.querySelector('#detail').textContent=v.text;
  }
  document.querySelectorAll('button[data-view]').forEach(el=>el.onclick=()=>view(el.dataset.view));
  controls.addEventListener('start',()=>{transition=null;});
  controls.listenToKeyEvents(canvas);controls.keys={LEFT:'ArrowLeft',UP:'ArrowUp',RIGHT:'ArrowRight',BOTTOM:'ArrowDown'};
  canvas.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();transition=null;
    const s=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(e.key==='ArrowLeft')s.theta-=.09;if(e.key==='ArrowRight')s.theta+=.09;
    if(e.key==='ArrowUp')s.phi-=.06;if(e.key==='ArrowDown')s.phi+=.06;
    s.phi=T.MathUtils.clamp(s.phi,.12,controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(s));controls.update();
  });
  function resize(){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(canvas);resize();view('gate',true);
  function frame(now){
    if(document.hidden || (now-last<32 && !transition))return;
    const dt=Math.min((now-last)/1000,.12);last=now;
    if(transition){const t=T.MathUtils.clamp((now-transition.start)/830,0,1),ease=t*t*(3-2*t);
      camera.position.lerpVectors(transition.from,transition.position,ease);controls.target.lerpVectors(transition.at,transition.target,ease);
      if(t===1)transition=null;}
    controls.update();if(!reduced.matches)waterTime+=dt*.34;water.material.uniforms.time.value=waterTime;
    renderer.render(scene,camera);canvas.dataset.view=active;canvas.dataset.settled=String(transition===null);status.hidden=true;
  }
  renderer.setAnimationLoop(frame);
}
start().catch(e=>{console.error(e);status.textContent='The live view could not load. Download the torii below to inspect it in 3D.';});
