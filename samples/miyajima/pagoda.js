import * as T from 'three';

// An interpretation of the exposed tower in the shrine's pre-repair east
// elevation. The four intermediate roofs die into the gallery above them.
const storeys = [
  // gallery Y, eave Y, eave width, gallery width, wall width
  [1.15, 4.36, 11.00, 7.45, 5.15],
  [5.86, 8.04, 10.68, 6.59, 4.57],
  [9.47, 11.53, 10.28, 6.25, 4.28],
  [12.90, 14.84, 9.81, 5.91, 4.04],
  [16.16, 18.02, 9.32, 5.59, 3.81],
];

const box = new T.BoxGeometry();
const shaft = new T.CylinderGeometry(.5, .5, 1, 12);
const bead = new T.SphereGeometry(.5, 12, 8);
const ring = new T.TorusGeometry(.45, .05, 6, 24).rotateX(Math.PI / 2);
const crown = new T.CylinderGeometry(.25, .50, 1, 16);
const tail = new T.BoxGeometry();
const tailVertices = tail.getAttribute('position');
for(let i=0;i<tailVertices.count;i++){
  if(tailVertices.getZ(i)>0){
    tailVertices.setX(i,tailVertices.getX(i)*.60);
    tailVertices.setY(i,tailVertices.getY(i)*.14+.31);
  }
}
tail.computeVertexNormals();

const gouged = new T.Shape();
gouged.moveTo(-.50, 0); gouged.lineTo(.50, 0); gouged.lineTo(.50, .48);
gouged.bezierCurveTo(.49,.67,.36,.68,.27,.71);
gouged.bezierCurveTo(.13,.75,.09,.85,0,.94);
gouged.bezierCurveTo(-.09,.85,-.13,.75,-.27,.71);
gouged.bezierCurveTo(-.36,.68,-.49,.67,-.50,.48);
gouged.closePath();
const windowShape = new T.ShapeGeometry(gouged, 5);

function roofSection(width, endWidth, height, cornerRise, fascia) {
  const positions=[], indices=[], uv=[];
  const columns=24, rows=fascia?1:8;
  for(let side=0;side<4;side++){
    const angle=side*Math.PI/2, c=Math.cos(angle), s=Math.sin(angle);
    const first=positions.length/3;
    for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
      const u=i/columns, v=fascia?0:j/rows;
      const half=T.MathUtils.lerp(width,endWidth,v)*.5;
      const x=(u*2-1)*half;
      const y=height*Math.pow(v,1.43)+cornerRise*Math.pow(Math.abs(2*u-1),3.6)*Math.pow(1-v,2);
      positions.push(x*c+half*s,y-(fascia?j*.18:0),half*c-x*s);
      uv.push(u,fascia?j:v);
      if(i<columns&&j<rows){const k=first+j*(columns+1)+i;indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1);}
    }
  }
  const geom=new T.BufferGeometry();
  geom.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geom.setIndex(indices);geom.computeVertexNormals();
  return geom;
}

export function buildPagoda(builder, base, [bark, deck, stone]) {
  const {part,location}=builder;
  const mat=(color,map=null)=>new T.MeshStandardMaterial({color,map,roughness:.88,side:T.DoubleSide});
  const red=mat(0x96523e), edge=mat(0xb76745), deep=mat(0x713a2b), cap=mat(0x768a78);
  const lime=mat(0xe2dfcf), opening=mat(0x324441), barkRoof=mat(0x6d777a,bark);
  const roofEdge=mat(0x3d3935), soffit=mat(0x794b38), boards=mat(0xc1ac90,deck), granite=mat(0xc7c6ba,stone);
  const iron=mat(0x515856), railEnd=mat(0xc4a780);
  const faces=Array.from({length:4},(_,i)=>base.clone().multiply(location(0,0,0,i*Math.PI/2)));
  const beam=(m,x,y,z,w,h,d,b=base)=>part(box,m,x,y,z,w,h,d,b);
  const post=(m,x,y,z,d,h,b=base)=>part(shaft,m,x,y,z,d,h,d,b);
  function strut(m,from,to,w,h,b,g=box){
    const a=new T.Vector3(...from),v=new T.Vector3(...to).sub(a);
    const transform=new T.Matrix4().compose(a.addScaledVector(v,.5),
      new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),v.clone().normalize()),new T.Vector3(1,1,1));
    part(g,m,0,0,0,w,h,v.length(),b.clone().multiply(transform));
  }
  // The landing and steps meet the same hillside as the earlier atlas.
  beam(granite,0,-2.15,0,14.3,4.4,13.6);
  beam(granite,0,.085,0,14.7,.19,14.0);
  for(let i=0;i<9;i++)beam(granite,1.2,-.12-i*.21,-7.13-i*.39,3.05,.43,.48);
  beam(granite,0,.25,0,7.62,.26,7.62);

  storeys.forEach(([floor,eave,span,gallery,core],i)=>{
    const wallH=eave-floor-(i===0?.96:.86), half=core/2, deckHalf=gallery/2;
    const railH=i===0?.72:.52;
    beam(deep,0,floor-.15,0,gallery,.22,gallery);
    beam(boards,0,floor,0,gallery+.10,.10,gallery+.10);
    beam(lime,0,floor+wallH/2,0,core,wallH,core);
    // Four bearing columns per face divide the elevation into three bays.
    for(let face=0;face<4;face++){
      const b=faces[face], outer=span/2, bay=core/3, thick=i===0?.24:.18;
      for(let k=0;k<3;k++){
        const x=(k-1.5)*bay;
        post(red,x,floor+wallH/2,half,thick,wallH+.08,b);
        if(i===0){
          post(deep,x,.70,deckHalf-.15,.22,.81,b);
          beam(granite,x,.34,deckHalf-.15,.36,.18,.36,b);
        }
      }
      for(const h of [.13,wallH*.43,wallH-.20])
        beam(red,0,floor+h,half,core+.20,i===0?.16:.12,.13,b);
      if(i===0){
        for(const sign of [-1,1]){
          beam(red,sign*bay*.245,floor+wallH*.46,half+.095,bay*.47,wallH*.83,.13,b);
          for(let t=1;t<=3;t++)beam(deep,sign*(bay*.055+t*bay*.102),floor+wallH*.46,half+.167,.022,wallH*.79,.02,b);
        }
      }else{
        part(windowShape,opening,0,floor+.09,half+.082,bay*.78,wallH*.65,1,b);
      }
      // The galleries project beyond the white infill. Corner finials are
      // shared by adjacent faces rather than stacked on top of one another.
      for(let j=0;j<4;j++){
        const x=-deckHalf+j*gallery/4;
        beam(red,x,floor+railH/2,deckHalf,.10,railH+.11,.10,b);
        if(j===0)part(bead,cap,x,floor+railH+.10,deckHalf,.16,.21,.16,b);
      }
      for(const ratio of [.27,.78,1])beam(ratio===1?railEnd:edge,0,floor+railH*ratio,deckHalf,gallery+.12,ratio===1?.065:.085,.10,b);

      // Arms step outward under each eave. The white gaps between tiers
      // remain visible around the woodwork in the shrine's elevation.
      const tieY=floor+wallH, reach=outer-half;
      beam(deep,0,tieY,half,core+.24,.21,.24,b);
      for(let k=0;k<=3;k++){
        const x=(k-1.5)*bay;
        beam(red,x,tieY+.14,half+.14,bay*.69,.16,.55,b);
        for(const end of [-1,1])beam(edge,x+end*bay*.26,tieY+.27,half+.31,.18,.17,.29,b);
        beam(red,x,tieY+.41,half+.40,bay*.88,.15,.34,b);
        beam(edge,x,tieY+.52,half+.46,.27,.16,.28,b);
        strut(deep,[x,tieY+.15,half+.12],[x,eave-.33,half+reach*.89],.16,.22,b,tail);
      }
      const rafters=22;
      for(let k=0;k<rafters;k++){
        const fraction=(k+.5)/rafters*2-1;
        const lift=.86*Math.pow(Math.abs(fraction),3.6);
        strut(edge,[fraction*half,eave-.31,half*.97],[fraction*outer,eave+lift-.21,outer-.10],.085,.10,b);
      }
    }
    const nextGallery=storeys[i+1]?.[3];
    const end=nextGallery?nextGallery*.96:.36;
    const rise=nextGallery?storeys[i+1][0]-eave-.14:2.30;
    part(roofSection(span-.13,core+.35,.04,.86,false),soffit,0,eave-.13,0,1,1,1,base);
    part(roofSection(span,end,rise,.86,false),barkRoof,0,eave,0,1,1,1,base);
    part(roofSection(span,end,rise,.86,true),roofEdge,0,eave,0,1,1,1,base);
  });
  const peak=20.32;
  part(crown,iron,0,peak+.16,0,1.14,.36,1.14,base);
  part(bead,iron,0,peak+.52,0,.73,.48,.73,base);
  post(iron,0,23.91,0,.21,6.58);
  for(let i=0;i<9;i++){
    const d=1.02-i*.052;
    part(ring,iron,0,peak+.96+i*.39,0,d,d,d,base);
  }
  part(crown,iron,0,25.40,0,.44,.90,.44,base);
  part(bead,iron,0,26.05,0,.38,.42,.38,base);
  part(crown,iron,0,26.52,0,.21,.64,.21,base);
}
