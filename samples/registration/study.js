import * as T from 'three';
import {OrbitControls} from '../miyajima/OrbitControls.js';
import {makeSegment} from './model.js';
import {fitLandmarks,minimumAltitude,surfaceErrors} from './fit.js';

const $=id=>document.getElementById(id);
const model=makeSegment();
const unit=new T.Vector3(1,1,1);
const initial=new T.Matrix4().compose(new T.Vector3(2.8,3.6,-5.2),
  new T.Quaternion().setFromEuler(new T.Euler(.19,-.14,.12)),unit);
const transformed=points=>points.map(p=>p.clone().applyMatrix4(initial));
const scanVertices=transformed(model.vertices);
const inverseInitial=initial.clone().invert();
const minTriangleHeight=.5;
let offsetPick=false;
let view;

function buildView() {
  const canvas=document.querySelector('canvas');
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio || 1));
  const scene=new T.Scene();
  scene.background=new T.Color('#172d32');
  const camera=new T.OrthographicCamera(-20,20,15,-15,.1,200);
  const controls=new OrbitControls(camera,canvas);
  controls.target.set(1.5,1,-1.8); controls.minZoom=.55;controls.maxZoom=4;controls.enablePan=false;
  const draw=()=>renderer.render(scene,camera);
  controls.addEventListener('change',draw);
  scene.add(new T.HemisphereLight(0xfff3dd,0x526462,1.7));
  const key=new T.DirectionalLight(0xffe8d5,2.4);key.position.set(-21,20,11);scene.add(key);
  const rim=new T.DirectionalLight(0x9de2ee,1.3);rim.position.set(12,8,-25);scene.add(rim);
  const reference=new T.Group();
  const contours=new T.LineBasicMaterial({color:0x8fe9d8,transparent:true,opacity:.71});
  for(const points of model.lines){
    reference.add(new T.Line(new T.BufferGeometry().setFromPoints(points),contours));
  }
  scene.add(reference);
  const scan=new T.Group();
  const material=new T.MeshStandardMaterial({color:0xe9a16d,roughness:.48,metalness:.04,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2});
  scan.add(new T.Mesh(model.geo,material));scan.matrixAutoUpdate=false;scene.add(scan);
  const grid=new T.GridHelper(82,41,0x3e6264,0x29464a);grid.position.y=-4.1;scene.add(grid);
  // Rings mark the reference picks. Filled dots travel with the scan.
  const marker=new T.SphereGeometry(.17,14,10);
  const dots=[],rings=[];
  const sourceMat=new T.MeshBasicMaterial({color:0x573319});
  for(const p of model.picks.spread){
    const dot=new T.Mesh(marker,sourceMat);scan.add(dot);dots.push(dot);
    const torus=new T.Mesh(new T.TorusGeometry(.33,.065,8,24),new T.MeshBasicMaterial({color:0xa6fff0}));
    torus.rotation.x=-Math.PI/2;torus.position.copy(p);scene.add(torus);rings.push(torus);
  }
  const errorLine=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xff3e52,depthTest:false}));
  errorLine.geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(6),3));
  errorLine.frustumCulled=false;errorLine.renderOrder=3;scene.add(errorLine);
  function setCamera(top){
    camera.up.set(0,top?0:1,top?-1:0);
    camera.position.copy(controls.target).add(top?new T.Vector3(0,62,0):new T.Vector3(15,32,54));
    camera.zoom=1;camera.updateProjectionMatrix();controls.update();draw();
    $('top').setAttribute('aria-pressed',String(top));$('oblique').setAttribute('aria-pressed',String(!top));
  }
  $('top').onclick=()=>setCamera(true);$('oblique').onclick=()=>setCamera(false);
  controls.addEventListener('start',()=>{for(const id of ['top','oblique']) $(id).setAttribute('aria-pressed','false');});
  function resize(){
    const w=canvas.clientWidth,h=canvas.clientHeight,aspect=w/h;
    const half=Math.max(10.7,17.7/aspect);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
    camera.updateProjectionMatrix();renderer.setSize(w,h,false);draw();
  }
  new ResizeObserver(resize).observe(canvas);resize();setCamera(false);
  return (pose,picks,fixed,segment)=>{
    scan.matrix.copy(pose);
    for(let i=0;i<dots.length;i++){
      dots[i].position.copy(picks[i]).applyMatrix4(inverseInitial);
      rings[i].position.copy(fixed[i]);rings[i].position.y+=.05;
    }
    errorLine.visible=Boolean(segment);
    if(segment){
      const attr=errorLine.geometry.attributes.position;
      segment.forEach((p,i)=>attr.setXYZ(i,p.x,p.y,p.z));attr.needsUpdate=true;
    }
    scan.matrixWorldNeedsUpdate=true;draw();
  };
}

function render(){
  const fixed=model.picks[$('preset').value];
  const measured=transformed(fixed);
  if(offsetPick)measured[2].y+=.5;
  const height=Math.min(minimumAltitude(fixed),minimumAltitude(measured));
  const blocked=height<minTriangleHeight;
  if(blocked)$('mix').value=0;
  $('apply').disabled=blocked;$('mix').disabled=blocked;
  const fraction=Number($('mix').value)/100;
  const correction=blocked?new T.Matrix4():fitLandmarks(measured,fixed);
  const rotation=new T.Quaternion().setFromRotationMatrix(correction);
  const translation=new T.Vector3().setFromMatrixPosition(correction);
  const intermediate=new T.Matrix4().compose(translation.multiplyScalar(fraction),
    new T.Quaternion().slerp(rotation,fraction),unit);
  const error=surfaceErrors(scanVertices,model.vertices,intermediate);
  $('rms').textContent=error.rms.toFixed(3);$('maximum').textContent=error.max.toFixed(3);$('percent').textContent=Math.round(fraction*100)+'%';
  $('count').textContent=model.vertices.length.toLocaleString('en-US')+' corresponding vertices';
  $('summary').textContent=blocked
    ? 'Fit blocked. The smallest triangle height is '+height.toFixed(3)+' mm. This study requires at least 0.5 mm. Choose wider-spaced picks.'
    : fraction===1
    ? (offsetPick?'The red line joins the most separated pair of surface vertices.':'The three exact pairs recover the known rigid pose.')
    : (fraction===0?'The two surfaces start in different poses.':'Surface error is measured at the current pose.');
  const segment=fraction===1 && error.max>.001
    ? [model.vertices[error.index],scanVertices[error.index].clone().applyMatrix4(intermediate)]:null;
  view?.(intermediate.clone().multiply(initial),measured,fixed,segment);
}
try{view=buildView();}catch(error){
  console.warn('Mesh view unavailable',error);
  $('fallback').hidden=false;
  document.querySelector('.camera').hidden=true;
}
$('mix').oninput=render;
$('preset').onchange=render;
$('apply').onclick=()=>{$('mix').value=100;render();};
$('reset').onclick=()=>{$('mix').value=0;render();};
for(const radio of document.querySelectorAll('[name=mode]'))radio.onchange=()=>{offsetPick=radio.value==='offset';render();};
render();
