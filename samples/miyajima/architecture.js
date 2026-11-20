import * as T from 'three';

const box = new T.BoxGeometry();
const round = new T.CylinderGeometry(.5,.5,1,14);
const stoneFoot = new T.CylinderGeometry(.43,.54,1,8);
const colors = {lacquer:0xa83924, lightRed:0xc24d30, darkRed:0x652b24, wall:0xe5ddc4,
  boards:0xa7805d, edge:0x79553c, beam:0x594330, under:0x4f382e, bark:0x544e44,
  ridge:0x4a4540, brass:0xb59a5e, patina:0x475959, stone:0xa49d89, lattice:0x835839,
  plaster:0xcbc1ab, townTile:0x566068, brownTile:0x645a51, pewter:0x69706d, shade:0x363f40};
const materials = Object.fromEntries(Object.entries(colors).map(([k,color]) =>
  [k,new T.MeshStandardMaterial({color,roughness:k==='brass'?.5:.89, side:T.DoubleSide})]));

// Four hipped planes rise concavely from a curved eave to a ridge. A square
// pavilion uses a point ridge; corridor and worship halls use a long ridge.
function roofShape(ridge, lift, fascia=false) {
  const positions=[], uv=[], indices=[];
  const sides=[ [[-.5,-.5],[.5,-.5],[-ridge,0],[ridge,0]], [[.5,-.5],[.5,.5],[ridge,0],[ridge,0]],
    [[.5,.5],[-.5,.5],[ridge,0],[-ridge,0]], [[-.5,.5],[-.5,-.5],[-ridge,0],[-ridge,0]] ];
  for(const [a,b,innerA,innerB] of sides) {
    const start=positions.length/3, cols=lift<.04?3:16, rows=fascia?1:(lift<.04?2:6);
    for(let j=0;j<=rows;j++) for(let i=0;i<=cols;i++) {
      const u=i/cols,t=fascia?0:j/rows;
      const x=T.MathUtils.lerp(T.MathUtils.lerp(a[0],b[0],u),T.MathUtils.lerp(innerA[0],innerB[0],u),t);
      const z=T.MathUtils.lerp(T.MathUtils.lerp(a[1],b[1],u),T.MathUtils.lerp(innerA[1],innerB[1],u),t);
      const corner=Math.pow(Math.abs(2*u-1),3.2)*Math.pow(1-t,2)*lift;
      positions.push(x,corner+(fascia?-j*.105:Math.pow(t,1.38)),z);uv.push(u,t);
      if(i<cols && j<rows){const k=start+j*(cols+1)+i;indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}
    }
  }
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
const caps = Object.fromEntries(Object.entries({hall:[.29,.18],walk:[.46,.11],tower:[.012,.31],town:[.38,.035]}).map(([key,[r,l]])=>[key,[roofShape(r,l),roofShape(r,l,true),r]]));

export function makeBuilder(scene) {
  const batches=new Map(), local=new T.Object3D(), matrix=new T.Matrix4();
  function part(g,material,x,y,z,w,h,d,base,ry=0) {
    const m=typeof material==='string'?materials[material]:material;
    let row=batches.get(g.uuid+m.uuid);
    if(!row){row={g,m,matrices:[]};batches.set(g.uuid+m.uuid,row);}
    local.position.set(x,y,z);local.rotation.set(0,ry,0);local.scale.set(w,h,d);local.updateMatrix();
    matrix.copy(local.matrix);if(base) matrix.premultiply(base);
    row.matrices.push(matrix.clone());
  }
  function location(x,y,z,angle=0){const m=new T.Matrix4().makeRotationY(angle);m.setPosition(x,y,z);return m;}
  function flush(){for(const {g,m,matrices} of batches.values()){
    const mesh=new T.InstancedMesh(g,m,matrices.length);matrices.forEach((v,i)=>mesh.setMatrixAt(i,v));
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);
  }batches.clear();}
  return {part,location,flush};
}

export function buildArchitecture(builder,layout,ground,scene,surfaces) {
  const [bark,deckWood,granite]=surfaces;
  for(const key of ['bark','townTile','brownTile','pewter'])materials[key].map=bark;
  materials.bark.color.set(0x777c7a);materials.boards.color.set(0xe2dbcb);
  materials.boards.map=deckWood;materials.stone.color.set(0xd2cfc3);materials.stone.map=granite;
  const {part,location}=builder;
  const beam=(m,x,y,z,w,h,d,b)=>part(box,m,x,y,z,w,h,d,b);
  const column=(m,x,y,z,d,h,b)=>part(round,m,x,y,z,d,h,d,b);
  function rafter(b,start,end,width,material){
    const a=new T.Vector3(...start),direction=new T.Vector3(...end).sub(a),length=direction.length();
    const local=new T.Matrix4().compose(a.addScaledVector(direction,.5),
      new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()),new T.Vector3(1,1,1));
    beam(material,0,0,0,width,length,width,b.clone().multiply(local));
  }
  function roof(b,w,d,y,h,type='hall',skin='bark') {
    const [face,eave,r]=caps[type];
    part(face,skin,0,y,0,w,h,d,b);part(eave,'under',0,y,0,w,h,d,b);
    beam('under',0,y-.11,0,w*.9,.21,d*.9,b);
    if(type!=='tower')beam('ridge',0,y+h+.05,0,w*r*2+.3,.27,.32,b);
  }
  function rowPillars(b,length,depth,y,h,bays,wood='lacquer'){
    for(let i=0;i<=bays;i++) for(const sign of [-1,1]){
      const x=(i/bays-.5)*length,z=sign*depth/2;
      column(wood,x,y+h/2,z,.34,h,b);beam('darkRed',x,y+h-.18,z,.62,.22,.58,b);
      beam(wood,x,y+h+.06,z,.88,.20,.50,b);
    }
  }
  function platform(b,w,d,deck,piers=true) {
    beam('edge',0,deck-.30,0,w,.56,d,b);beam('boards',0,deck+.015,0,w+.12,.09,d+.12,b);
    if(piers) for(let i=0;i<=Math.ceil(w/4.5);i++)for(const side of [-1,1]){
      const x=(i/Math.ceil(w/4.5)-.5)*(w-1),z=side*(d/2-.45);
      column('beam',x,deck-1.8,z,.43,3.2,b);
      part(stoneFoot,'stone',x,deck-2.85,z,.83,1,.83,b);
    }
  }
  function rail(b,w,z,y,withCaps=true){
    for(const [dy,thick] of [[.23,.11],[.66,.12],[.86,.13]]) beam('lacquer',0,y+dy,z,w,thick,.13,b);
    const n=Math.ceil(w/2.4);for(let i=0;i<=n;i++){
      const x=w*(i/n-.5);beam('lightRed',x,y+.50,z,.18,1.01,.18,b);
      if(withCaps) column('patina',x,y+1.07,z,.22,.18,b);
    }
  }
  const deck=3.63;
  function hall(b,w,d,h,open=false,wood='lacquer',roofType='hall') {
    const enclosedW=w*.73,enclosedD=d*.64;
    platform(b,w*.89,d*.91,0);
    if(!open){
      beam(wood==='beam'?'boards':'wall',0,h*.49,0,enclosedW,h*.98,enclosedD,b);
      for(const sign of [-1,1]){
        beam(wood,0,.43,sign*enclosedD*.503,enclosedW,.43,.15,b);
        for(let i=0;i<=Math.ceil(enclosedW/2.4);i++){
          const x=enclosedW*(i/Math.ceil(enclosedW/2.4)-.5);
          beam(wood,x,h*.54,sign*enclosedD*.51,.20,h*.96,.13,b);
        }
      }
    }
    rowPillars(b,w*.83,d*.77,0,h,Math.max(2,Math.round(w/3.4)),wood);
    for(const side of [-1,1]){
      beam(wood,0,h-.04,side*d*.38,w*.91,.28,.32,b);
      beam(wood,0,h-.48,side*d*.38,w*.90,.17,.23,b);
    }
    roof(b,w,d,h+.14,Math.max(1.45,d*.30),roofType);
    for(const s of [-1,1])for(let i=0;i<=Math.ceil(w/.76);i++){
      const x=w*.93*(i/Math.ceil(w/.76)-.5);
      beam(wood,x,h+.03,s*d*.452,.12,.14,d*.11,b);
    }
  }
  // Local coordinates follow the axis from the offshore gate to the worship halls.
  const axis=.813, stage=[47.9,60.2];
  function site(x,z,y=deck,angle=0) {
    return location(stage[0]+Math.cos(axis)*x+Math.sin(axis)*z,y,
      stage[1]-Math.sin(axis)*x+Math.cos(axis)*z,axis+angle);
  }
  function walk(x1,z1,x2,z2) {
    const dx=x2-x1,dz=z2-z1,w=Math.hypot(dx,dz);
    const b=site((x1+x2)/2,(z1+z2)/2,deck,-Math.atan2(dz,dx));
    platform(b,w,3.8,0);rowPillars(b,w-.36,3.25,0,3.05,Math.ceil(w/3.7));
    for(const s of [-1,1]){rail(b,w,s*1.65,0,false);beam('lacquer',0,2.8,s*1.64,w,.22,.22,b);}
    roof(b,w+1,5.85,3.18,1.48,'walk');
  }
  [[-112,23,-67,23],[-67,23,-67,46],[-67,46,-25,46],[-25,46,-25,19],[-25,19,-7,19],
    [7,19,25,19],[25,19,25,45],[25,45,49,45],[49,45,49,22],[49,22,62,22]].forEach(p=>walk(...p));
  const deckPoly=layout.outlines['325942851'], outline=new T.Shape();
  deckPoly.forEach(([x,z],i)=>i===0?outline.moveTo(x,-z):outline.lineTo(x,-z));
  const g=new T.ExtrudeGeometry(outline,{depth:.32,bevelEnabled:false});
  g.rotateX(-Math.PI/2);g.translate(0,deck-.32,0);
  const pos=g.attributes.position,uv=g.attributes.uv;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);uv.setXY(i,(x*.69-z*.724)/8,(x*.724+z*.69)/5);}
  const platformMesh=new T.Mesh(g,materials.boards);platformMesh.receiveShadow=true;platformMesh.castShadow=true;scene.add(platformMesh);
  for(let i=1;i<deckPoly.length;i++){
    const [x,z]=deckPoly[i-1],[endX,endZ]=deckPoly[i];const n=Math.max(1,Math.ceil(Math.hypot(endX-x,endZ-z)/3.8));
    for(let j=0;j<n;j++){const px=x+(endX-x)*j/n,pz=z+(endZ-z)*j/n;
      column('edge',px,deck-1.8,pz,.35,3.1);part(stoneFoot,'stone',px,deck-2.8,pz,.77,1,.77);}
  }
  beam('under',0,.50,0,5.65,1.0,5.65,site(-.35,0));platform(site(-.35,0,deck+1),5.65,5.65,0,false);
  for(const side of [-1,1]){
    rail(site(-.35,0,deck+1,Math.PI/2),5.65,side*2.82,0);
    for(const end of [-1,1])rail(site(-.35+side*1.82,end*2.82,deck+1),1.9,0,0);
  }
  for(let i=0;i<4;i++)beam('boards',0,.13+i*.23,-4.2+i*.36,1.6,.24,.45,site(-.35,0));
  function lantern(b){
    part(stoneFoot,'stone',0,.20,0,1.1,.39,1.1,b);column('stone',0,.89,0,.38,1.0,b);
    part(stoneFoot,'stone',0,1.39,0,.90,.22,.90,b);beam('stone',0,1.75,0,.61,.63,.61,b);
    for(const side of [-1,1])beam('shade',0,1.78,side*.308,.27,.30,.02,b);
    part(caps.tower[0],'stone',0,2.05,0,1.20,.36,1.20,b);column('stone',0,2.50,0,.17,.20,b);
  }
  lantern(site(-1.45,-25.8));lantern(site(1.45,-25.8));
  const excluded=new Set([555763409,142668851,142668855]);
  for(const [id,x,z,w,d,ang,kind] of layout.buildings){
    if(excluded.has(id))continue;
    let y=ground(x,z);
    if(kind==='pagoda') {
      y=Math.max(y,10);
      const b=location(x,y,z,ang);
      // Set the tower into a terraced hilltop; the downhill approach reaches
      // the same raised landing as the masonry beneath its timber frame.
      beam('stone',0,-2.15,0,14.3,4.4,13.6,b);
      beam('stone',0,.085,0,14.7,.19,14.0,b);
      for(let s=0;s<9;s++)beam('stone',1.2,-.12-s*.21,-7.13-s*.39,3.05,.43,.48,b);
      beam('stone',0,-.65,0,8.5,2.65,8.5,b);
      beam('stone',0,.40,0,8.2,.80,8.2,b);
      for(let i=0;i<5;i++){
        const span=10.6-i*1.02, core=span*.48,level=.8+3.85*i;
        beam('lacquer',0,level+1.30,0,core,2.65,core,b);
        for(const faceAngle of [0,Math.PI/2]){
          const sideBase=b.clone().multiply(location(0,0,0,faceAngle));
          for(const s of [-1,1]){
            for(let j=-1;j<=1;j++){
              const px=j*core*.285;
              beam(i===0?'edge':'darkRed',px,level+1.34,s*core*.505,core*.2,1.45,.12,sideBase);
              for(const off of [-.19,.19])beam('lightRed',px+off,level+1.39,s*core*.53,.055,1.30,.08,sideBase);
            }
            beam('lightRed',0,level+2.05,s*core*.55,core*1.18,.23,.24,sideBase);
            for(let j=-3;j<=3;j++)beam('lacquer',j*span*.095,level+2.58,s*span*.32,.18,.25,span*.25,sideBase);
          }
        }
        roof(b,span,span,level+2.84,i===4?2.7:2.25,'tower');
        for(const face of [0,Math.PI/2]){const sideBase=b.clone().multiply(location(0,0,0,face));
          for(const s of [-1,1])for(let j=-6;j<=6;j++)beam('lightRed',j*span*.068,level+2.83,s*span*.426,.095,.09,span*.12,sideBase);
        }
      }
      column('patina',0,23.9,0,.20,7.2,b);
      for(let i=0;i<9;i++)column('patina',0,22.3+i*.34,0,1.07-i*.056,.095,b);
      part(stoneFoot,'brass',0,26.7,0,.47,.58,.47,b);continue;
    }
    if(id===142668904){
      const b=location(x,Math.max(15,y)+.8,z,ang);hall(b,w,d,6.3,true,'beam');
      for(const side of [-1,1])for(let i=0;i<=8;i++)beam('beam',(i/8-.5)*w*.84,-3.0,side*d*.37,.56,6.2,.56,b);
      beam('stone',0,-3.8,0,w*.76,5,d*.69,b);continue;
    }
    if(kind==='shrine' && x>0 && z>0 && x<144 && z<147){
      hall(location(x,deck,z,ang),w,d,Math.max(2.4,Math.min(5.9,d*.29)),[1306171245,142668863,157345375,1306168436].includes(id),
        id===1306168436?'beam':'lacquer');
      if(id===1306171245||id===142668949){
        const h=Math.min(5.9,d*.29),b=location(x,deck+h+.14,z,ang);
        const ridgeRoof=new T.BufferGeometry(),rise=d*.23,wing=d*.22;
        const vertices=[],idx=[];
        for(const side of [-1,1]){
          const x0=w*.34;const k=vertices.length/3;
          vertices.push(x0,d*.15,side*wing,x0,d*.15+rise,0,-x0,d*.15+rise,0,-x0,d*.15,side*wing);
          idx.push(k,k+1,k+2,k,k+2,k+3);
        }
        ridgeRoof.setAttribute('position',new T.Float32BufferAttribute(vertices,3));ridgeRoof.setIndex(idx);ridgeRoof.computeVertexNormals();
        const gable=new T.Mesh(ridgeRoof,materials.ridge);gable.applyMatrix4(b);gable.castShadow=true;scene.add(gable);
        for(const s of [-1,1]){
          const gg=new T.BufferGeometry();gg.setAttribute('position',new T.Float32BufferAttribute([s*w*.337,d*.15,-wing,s*w*.337,d*.15,wing,s*w*.337,d*.15+rise,0],3));gg.computeVertexNormals();
          const panel=new T.Mesh(gg,materials.boards.clone());panel.material.map=null;panel.material.color.set(0x815739);panel.applyMatrix4(b);scene.add(panel);
          beam('lacquer',s*w*.34,d*.15+.17,0,.12,.22,wing*2,b);
          for(const edge of [-1,1])rafter(b,[s*w*.344,d*.15,edge*wing],[s*w*.344,d*.15+rise,0],.16,'edge');
          for(let j=-2;j<=2;j++){
            const h=rise*(1-.29*Math.abs(j));
            beam('darkRed',s*w*.342,d*.15+h*.5,j*wing*.29,.14,h,.12,b);}
        }
      }
      continue;
    }
    if(y<.5 || Math.min(w,d)<2.3)continue;
    const b=location(x,y-.40,z,ang), h=2.8+(id%5)*.53, tone=['plaster','wall','boards'][id%3];
    beam(tone,0,h*.46-.65,0,w*.91,h*1.08+1.30,d*.89,b);
    for(const side of [-1,1]){
      const bays=Math.max(2,Math.min(6,Math.floor(w/2.5)));
      for(let j=0;j<bays;j++){const xx=w*((j+.5)/bays-.5)*.84;
        beam('lattice',xx,h*.49,side*d*.45,w*.60/bays,.91,.12,b);
        beam('shade',xx,h*.51,side*d*.456,w*.48/bays,.69,.10,b);}
      beam('edge',0,h*.76,side*d*.46,w*.86,.14,.45,b);
    }
    roof(b,w,d,h,Math.min(d*.32,3.4),'town',['townTile','brownTile','pewter'][id%3]);
  }
}
