import * as T from 'three';
import { OrbitControls } from '../miyajima/OrbitControls.js';
import { GLTFLoader } from '../miyajima/addons/loaders/GLTFLoader.js';

const find = id => document.getElementById(id);
const canvas = document.querySelector('canvas');
const renderer = new T.WebGLRenderer({canvas, alpha:true, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=T.SRGBColorSpace;
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(26, 1, .05, 50);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, .96, 0);
controls.enablePan=false; controls.minDistance=1.9; controls.maxDistance=8;
const redraw = () => renderer.render(scene,camera);
controls.addEventListener('change',redraw);
const fill=new T.HemisphereLight(0xfff1dc,0xd4c7cd,1.8);scene.add(fill);
for(const [x,y,z,intensity] of [[-3,4,3,2.1],[3,2,-2,1.7]]){
  const lamp=new T.DirectionalLight(0xffeddb,intensity);
  lamp.position.set(x,y,z);scene.add(lamp);
}
function setView(overhead){
  const el=T.MathUtils.degToRad(overhead?35:8), az=T.MathUtils.degToRad(15);
  const distance=4.9;
  camera.position.copy(controls.target).add(new T.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).multiplyScalar(distance));
  controls.update();
  find('studio').setAttribute('aria-pressed',String(!overhead));
  find('overhead').setAttribute('aria-pressed',String(overhead));
  redraw();
}
find('studio').onclick=()=>setView(false);
find('overhead').onclick=()=>setView(true);
const observer=new ResizeObserver(()=>{
  const w=canvas.clientWidth,h=canvas.clientHeight;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();redraw();
});
observer.observe(canvas);
setView(false);
new GLTFLoader().load('wayfarer.glb',({scene:model})=>{
  scene.add(model);
  const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o)});
  const forearm=model.getObjectByName('ForearmL') || model.getObjectByName('Forearm.L');
  const forearmRest=forearm?.quaternion.clone();
  function update(){
    for(const mesh of meshes){
      if(mesh.morphTargetInfluences?.length)mesh.morphTargetInfluences[0]=Number(find('breadth').value)/100;
      if(mesh.name==='Headwear_Felt')mesh.visible=find('hat').checked;
      if(mesh.name==='Torso_Mantle')mesh.visible=find('cape').checked;
    }
    if(forearm){
      forearm.quaternion.copy(forearmRest);
      if(find('pose').checked)forearm.rotateX(-.70);
    }
    find('percent').textContent=find('breadth').value+'%';
    canvas.dataset.state=JSON.stringify({morph:meshes.filter(o=>o.morphTargetInfluences?.length).map(o=>o.morphTargetInfluences[0]),cape:model.getObjectByName('Torso_Mantle')?.visible,hat:model.getObjectByName('Headwear_Felt')?.visible,arm:forearm?.quaternion.toArray()});
    redraw();
  }
  for(const id of ['breadth','hat','cape','pose'])find(id).addEventListener('input',update);
  update();find('status').hidden=true;
},undefined,()=>{find('status').textContent='The interactive model could not load. A downloadable copy is available below.'});
