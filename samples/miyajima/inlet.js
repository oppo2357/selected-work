import * as T from 'three';
import {Water} from './addons/Water.js';

const clamp=T.MathUtils.clamp, mix=T.MathUtils.lerp;
function jitter(x,z) {
  const f=Math.sin(x*127.1+z*311.7)*43758.5453;return f-Math.floor(f);
}
function noise(x,z,s) {
  const a=Math.floor(x/s),b=Math.floor(z/s);
  let u=x/s-a,v=z/s-b;u=u*u*(3-2*u);v=v*v*(3-2*v);
  return mix(mix(jitter(a,b),jitter(a+1,b),u),mix(jitter(a,b+1),jitter(a+1,b+1),u),v);
}
function field(data,w,h,step) {
  return (x,z)=>{
    const cx=clamp(x/step+(w-1)/2,0,w-1),cz=clamp(z/step+(h-1)/2,0,h-1);
    const c=Math.min(w-2,Math.floor(cx)),r=Math.min(h-2,Math.floor(cz));
    const at=(a,b)=>data[b*w+a]===-32768?-3.5:data[b*w+a]/10;
    return mix(mix(at(c,r),at(c+1,r),cx-c),mix(at(c,r+1),at(c+1,r+1),cx-c),cz-r);
  };
}
function meshLand(scene,w,h,step,height,regional,map) {
  const pos=[],uv=[],idx=[];
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const x=(i-(w-1)/2)*step,z=(j-(h-1)/2)*step,y=height(x,z);
    pos.push(x,y,z);
    uv.push(i/(w-1),1-j/(h-1));
    if(i===w-1||j===h-1||regional && x>=-432&&x<432&&z>=-432&&z<432)continue;
    const k=j*w+i;idx.push(k,k+w,k+1,k+1,k+w,k+w+1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const m=new T.Mesh(g,new T.MeshLambertMaterial({map,color:0xc2c9b8,emissiveMap:map,emissive:0x707a71}));m.receiveShadow=true;scene.add(m);
}
function crown() {
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute([-.5,0,0,.5,0,0,.5,1,0,-.5,1,0,0,0,-.5,0,0,.5,0,1,.5,0,1,-.5],3));
  g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1],2));
  g.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);g.computeVertexNormals();return g;
}
export function makeLand(scene,builder,nearData,farData,layout,textures) {
  const near=field(nearData,113,111,8),far=field(farData,161,161,48);
  function height(x,z) {
    const blend=clamp(Math.min(448-Math.abs(x),440-Math.abs(z))/18,0,1);
    return mix(far(x,z),near(x,z),blend);
  }
  meshLand(scene,161,161,48,far,true,textures[1]);meshLand(scene,113,111,8,height,false,textures[0]);
  const crowns=crown();
  const foliage=textures.slice(2).map(map=>new T.MeshBasicMaterial({map,side:T.DoubleSide,alphaTest:.48,color:0xe7ead8}));
  const occupied=new Set();
  for(const [,x,z,w,d] of layout.buildings){
    const span=Math.min(28,Math.hypot(w,d)*.47+1);
    for(let i=Math.floor((x-span)/8);i<=Math.floor((x+span)/8);i++)for(let j=Math.floor((z-span)/8);j<=Math.floor((z+span)/8);j++)occupied.add(i+','+j);
  }
  for(let j=-65;j<=65;j++)for(let i=-65;i<=65;i++){
    const x=(i+jitter(i,j)-.5)*8.8,z=(j+jitter(j,i+18)-.5)*8.8,y=height(x,z);
    if(y<7.3 || occupied.has(Math.floor(x/8)+','+Math.floor(z/8)) || (y<18 && jitter(i+88,j)>.38))continue;
    const r=jitter(i+9,j+17),h=5.1+5.7*r,scale=2.45+2.1*jitter(i-4,j+15);
    const species=Math.min(2,Math.floor(jitter(i+60,j-22)*3));
    if(noise(x,z,35)<.22)continue;
    builder.part(crowns,foliage[species],x,y-.7,z,scale*2.5,h*1.15,scale*2.5,undefined,6*r);
  }
  // The orthophoto retains the original street and quay paving.
  return height;
}
export function makeSky(scene){
  const mat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,
    vertexShader:'varying vec3 ray; void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 ray;
      float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*45083.3);}
      float n(vec2 p){vec2 i=floor(p),u=fract(p);u=u*u*(3.-2.*u);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+1.),u.x),u.y);}
      void main(){
        vec3 d=normalize(ray);float y=max(.001,d.y),t=pow(y,.55);
        vec3 col=mix(vec3(.80,.79,.69),vec3(.24,.44,.58),t);
        float glow=pow(max(dot(d,normalize(vec3(-.80,.36,.22))),0.),4.);
        col+=vec3(.15,.077,.02)*glow;
        vec2 p=d.xz/(y+.10)*vec2(2.,7.);
        float c=smoothstep(.49,.76,n(p)*.57+n(p*2.7)*.3+n(p*7.1)*.13);
        col=mix(col,vec3(.87,.88,.84),c*.26*smoothstep(.01,.14,y));
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`});
  const sky=new T.Mesh(new T.SphereGeometry(7700,36,18),mat);sky.renderOrder=-10;scene.add(sky);
}
export function makeWater(scene,sun) {
  // Periodic wind-driven ripples; the normal texture contains only original numeric data.
  const n=256,buf=new Uint8Array(n*n*4);
  const waves=[[8,12,.13],[-6,17,.11],[14,21,.095],[-13,29,.074],[19,31,.059],[28,43,.041],[-36,51,.027],[45,27,.024]];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    let x=0,y=0;const a=i*2*Math.PI/n,b=j*2*Math.PI/n;
    for(const [kx,ky,amp] of waves){
      const warp=2.3*Math.sin(a+3*b+kx)+1.5*Math.sin(4*a-2*b+ky)+.85*Math.sin(7*a+5*b+kx+ky);
      const f=amp*(.73+.27*Math.sin(2*a-3*b+ky))*Math.sin(kx*a+ky*b+warp);
      x+=f*kx/ky;y+=f;
    }
    const len=Math.hypot(x,y,1),k=4*(j*n+i);buf[k]=128+x/len*127;buf[k+1]=128+y/len*127;buf[k+2]=128+127/len;buf[k+3]=255;
  }
  const normal=new T.DataTexture(buf,n,n);normal.wrapS=normal.wrapT=T.RepeatWrapping;
  normal.generateMipmaps=true;normal.minFilter=T.LinearMipmapLinearFilter;normal.magFilter=T.LinearFilter;normal.needsUpdate=true;
  const w=new Water(new T.PlaneGeometry(13000,13000),{textureWidth:768,textureHeight:512,waterNormals:normal,
    sunDirection:sun.position.clone().normalize(),sunColor:0xe1ded2,waterColor:0x185958,distortionScale:1.25,fog:true});
  w.material.fragmentShader=w.material.fragmentShader
    .replace('float rf0 = 0.3;', 'float rf0 = 0.085;')
    .replace('sunColor * diffuseLight * 0.3 + scatter','waterColor * (0.66 + diffuseLight * 0.36) + scatter * 0.28')
    .replace('vec3( 0.1 ) + reflectionSample * 0.9','vec3( 0.015 ) + reflectionSample * 0.985');
  w.rotation.x=-Math.PI/2;w.position.y=1.75;w.material.uniforms.size.value=12;scene.add(w);return w;
}
